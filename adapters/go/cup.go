// Package cup provides the Go adapter for the CUP UI Protocol.
// Any net/http handler can call view.WriteJSON(w) to serve a UIView.
//
// Usage:
//
//	view := cup.New(`<h1>{{ title }}</h1><p>{{ body }}</p>`).
//	    State(cup.S{"title": "Hello", "body": "From Go"}).
//	    Action("reload", cup.Fetch("/api/reload")).
//	    Title("Home").
//	    Route("/")
//
//	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
//	    view.WriteJSON(w)
//	})
package cup

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
)

const adapterVersion = "cup-go/0.2.4"

var (
	scriptTagPattern     = regexp.MustCompile(`(?i)<script\b`)
	inlineHandlerPattern = regexp.MustCompile(`(?i)\son[a-z][a-z0-9_-]*\s*=`)
	javascriptURLPattern = regexp.MustCompile(`(?i)\b(?:href|src)\s*=\s*(['"])\s*javascript:`)
	safeFilterPattern    = regexp.MustCompile(`\|\s*safe\b`)
)

// S is a convenience alias for map[string]any, used for state values.
type S = map[string]any

// ── Action descriptors ────────────────────────────────────────────────────────

type actionKind string

const (
	kindFetch    actionKind = "fetch"
	kindEmit     actionKind = "emit"
	kindNavigate actionKind = "navigate"
)

// ActionDescriptor is the JSON representation of any action.
type ActionDescriptor struct {
	Type    actionKind `json:"type"`
	URL     string     `json:"url,omitempty"`
	Method  string     `json:"method,omitempty"`
	Payload S          `json:"payload,omitempty"`
	Event   string     `json:"event,omitempty"`
	Detail  S          `json:"detail,omitempty"`
	Replace bool       `json:"replace,omitempty"`
}

// Fetch creates a FetchAction that POSTs to the given URL.
func Fetch(url string, opts ...func(*ActionDescriptor)) ActionDescriptor {
	a := ActionDescriptor{Type: kindFetch, URL: url, Method: "POST"}
	for _, o := range opts {
		o(&a)
	}
	return a
}

// WithMethod overrides the HTTP method on a FetchAction.
func WithMethod(m string) func(*ActionDescriptor) {
	return func(a *ActionDescriptor) { a.Method = m }
}

// WithPayload adds extra keys to the request body of a FetchAction.
func WithPayload(p S) func(*ActionDescriptor) {
	return func(a *ActionDescriptor) { a.Payload = p }
}

// Emit creates an EmitAction that dispatches a CustomEvent on the container.
func Emit(event string, detail ...S) ActionDescriptor {
	a := ActionDescriptor{Type: kindEmit, Event: event}
	if len(detail) > 0 {
		a.Detail = detail[0]
	}
	return a
}

// Navigate creates a NavigateAction that uses the History API.
func Navigate(url string, replace ...bool) ActionDescriptor {
	a := ActionDescriptor{Type: kindNavigate, URL: url}
	if len(replace) > 0 {
		a.Replace = replace[0]
	}
	return a
}

// ── UIView ────────────────────────────────────────────────────────────────────

type meta struct {
	Version   string `json:"version"`
	Lang      string `json:"lang"`
	Generator string `json:"generator"`
	Title     string `json:"title,omitempty"`
	Route     string `json:"route,omitempty"`
}

type uiViewJSON struct {
	Template string                      `json:"template"`
	State    S                           `json:"state"`
	Actions  map[string]ActionDescriptor `json:"actions,omitempty"`
	Meta     meta                        `json:"meta"`
}

type ValidationError struct {
	Issues []string
}

func (e ValidationError) Error() string {
	return "invalid CUP protocol view: " + strings.Join(e.Issues, "; ")
}

type ActionURLPolicy string

const (
	ActionURLsAny          ActionURLPolicy = "any"
	ActionURLsRelativeOnly ActionURLPolicy = "relative-only"
)

type ViewPolicy struct {
	RequireVersion      bool
	RequireTitle        bool
	RequireRoute        bool
	AllowSafeFilter     bool
	AllowInlineHandlers bool
	AllowJavaScriptURLs bool
	AllowScriptTags     bool
	ActionURLs          ActionURLPolicy
}

var StarterViewPolicy = ViewPolicy{
	RequireVersion:      true,
	RequireTitle:        true,
	RequireRoute:        true,
	AllowSafeFilter:     false,
	AllowInlineHandlers: false,
	AllowJavaScriptURLs: false,
	AllowScriptTags:     false,
	ActionURLs:          ActionURLsRelativeOnly,
}

type PolicyError struct {
	Issues []string
}

func (e PolicyError) Error() string {
	return "CUP view policy rejected: " + strings.Join(e.Issues, "; ")
}

// UIView is the CUP UI contract builder.
type UIView struct {
	template string
	state    S
	actions  map[string]ActionDescriptor
	title    string
	route    string
}

// New creates a new UIView with the given Django-style template.
func New(template string) *UIView {
	return &UIView{
		template: template,
		state:    S{},
		actions:  map[string]ActionDescriptor{},
	}
}

// State merges key/value pairs into the view state.
func (v *UIView) State(data S) *UIView {
	for k, val := range data {
		v.state[k] = val
	}
	return v
}

// Action registers a named action.
func (v *UIView) Action(name string, a ActionDescriptor) *UIView {
	v.actions[name] = a
	return v
}

// Title sets the view title (shown in CUP DevTools).
func (v *UIView) Title(t string) *UIView {
	v.title = t
	return v
}

// Route records the server route that produced this view.
func (v *UIView) Route(r string) *UIView {
	v.route = r
	return v
}

// ToMap returns the UIView as a plain map ready for JSON marshalling.
func (v *UIView) ToMap() uiViewJSON {
	return uiViewJSON{
		Template: v.template,
		State:    v.state,
		Actions:  v.actions,
		Meta: meta{
			Version:   "1",
			Lang:      "go",
			Generator: adapterVersion,
			Title:     v.title,
			Route:     v.route,
		},
	}
}

func (v *UIView) Validate() error {
	return Validate(v.ToMap())
}

// MarshalJSON implements json.Marshaler.
func (v *UIView) MarshalJSON() ([]byte, error) {
	if err := v.Validate(); err != nil {
		return nil, err
	}
	return json.Marshal(v.ToMap())
}

// WriteJSON writes the UIView as JSON to an http.ResponseWriter.
// Sets Content-Type to application/json and status 200.
func (v *UIView) WriteJSON(w http.ResponseWriter) error {
	if err := v.Validate(); err != nil {
		return err
	}
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write(b)
	return err
}

func Validate(input any) error {
	encoded, err := json.Marshal(input)
	if err != nil {
		return err
	}

	var decoded any
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		return err
	}

	issues := make([]string, 0)
	validateView(decoded, "view", &issues)
	if len(issues) > 0 {
		return ValidationError{Issues: issues}
	}
	return nil
}

func ValidatePolicy(input any, policy ViewPolicy) error {
	encoded, err := json.Marshal(input)
	if err != nil {
		return err
	}

	var decoded any
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		return err
	}

	if err := Validate(decoded); err != nil {
		return err
	}

	issues := make([]string, 0)
	validateViewPolicy(decoded, "view", policy, &issues)
	if len(issues) > 0 {
		return PolicyError{Issues: issues}
	}
	return nil
}

func validateView(input any, path string, issues *[]string) {
	view, ok := input.(map[string]any)
	if !ok {
		*issues = append(*issues, fmt.Sprintf("%s must be an object", path))
		return
	}

	validateAllowedKeys(view, []string{"template", "state", "actions", "meta"}, path, issues)

	if _, ok := view["template"].(string); !ok {
		*issues = append(*issues, fmt.Sprintf("%s.template must be a string", path))
	}

	state, ok := view["state"].(map[string]any)
	if !ok {
		*issues = append(*issues, fmt.Sprintf("%s.state must be an object", path))
	} else {
		validateJSONObject(state, path+".state", issues)
	}

	if actionsValue, exists := view["actions"]; exists {
		actions, ok := actionsValue.(map[string]any)
		if !ok {
			*issues = append(*issues, fmt.Sprintf("%s.actions must be an object", path))
		} else {
			for actionName, descriptor := range actions {
				validateAction(descriptor, path+".actions."+actionName, issues)
			}
		}
	}

	if metaValue, exists := view["meta"]; exists {
		validateMeta(metaValue, path+".meta", issues)
	}
}

func validateAction(input any, path string, issues *[]string) {
	action, ok := input.(map[string]any)
	if !ok {
		*issues = append(*issues, fmt.Sprintf("%s must be an object", path))
		return
	}

	actionType, ok := action["type"].(string)
	if !ok {
		*issues = append(*issues, fmt.Sprintf("%s.type must be a string", path))
		return
	}

	switch actionType {
	case "fetch":
		validateAllowedKeys(action, []string{"type", "url", "method", "payload"}, path, issues)
		if _, ok := action["url"].(string); !ok {
			*issues = append(*issues, fmt.Sprintf("%s.url must be a string", path))
		}
		if method, exists := action["method"]; exists {
			methodString, ok := method.(string)
			if !ok || !contains([]string{"GET", "POST", "PUT", "PATCH", "DELETE"}, methodString) {
				*issues = append(*issues, fmt.Sprintf("%s.method must be a supported HTTP method", path))
			}
		}
		if payload, exists := action["payload"]; exists {
			payloadMap, ok := payload.(map[string]any)
			if !ok {
				*issues = append(*issues, fmt.Sprintf("%s.payload must be an object", path))
			} else {
				validateJSONObject(payloadMap, path+".payload", issues)
			}
		}
	case "emit":
		validateAllowedKeys(action, []string{"type", "event", "detail"}, path, issues)
		if _, ok := action["event"].(string); !ok {
			*issues = append(*issues, fmt.Sprintf("%s.event must be a string", path))
		}
		if detail, exists := action["detail"]; exists {
			detailMap, ok := detail.(map[string]any)
			if !ok {
				*issues = append(*issues, fmt.Sprintf("%s.detail must be an object", path))
			} else {
				validateJSONObject(detailMap, path+".detail", issues)
			}
		}
	case "navigate":
		validateAllowedKeys(action, []string{"type", "url", "replace"}, path, issues)
		if _, ok := action["url"].(string); !ok {
			*issues = append(*issues, fmt.Sprintf("%s.url must be a string", path))
		}
		if replace, exists := action["replace"]; exists {
			if _, ok := replace.(bool); !ok {
				*issues = append(*issues, fmt.Sprintf("%s.replace must be a boolean", path))
			}
		}
	default:
		*issues = append(*issues, fmt.Sprintf("%s.type must be one of fetch, emit, navigate", path))
	}
}

func validateMeta(input any, path string, issues *[]string) {
	metaValue, ok := input.(map[string]any)
	if !ok {
		*issues = append(*issues, fmt.Sprintf("%s must be an object", path))
		return
	}

	validateAllowedKeys(metaValue, []string{"version", "lang", "generator", "title", "route"}, path, issues)

	if version, exists := metaValue["version"]; exists {
		versionString, ok := version.(string)
		if !ok || versionString != "1" {
			*issues = append(*issues, fmt.Sprintf("%s.version must be \"1\"", path))
		}
	}

	for _, key := range []string{"lang", "generator", "title", "route"} {
		if value, exists := metaValue[key]; exists {
			if _, ok := value.(string); !ok {
				*issues = append(*issues, fmt.Sprintf("%s.%s must be a string", path, key))
			}
		}
	}
}

func validateJSONObject(input map[string]any, path string, issues *[]string) {
	for key, value := range input {
		validateJSONValue(value, path+"."+key, issues)
	}
}

func validateJSONValue(value any, path string, issues *[]string) {
	switch typed := value.(type) {
	case nil, string, float64, bool:
		return
	case []any:
		for index, item := range typed {
			validateJSONValue(item, fmt.Sprintf("%s[%d]", path, index), issues)
		}
	case map[string]any:
		for key, item := range typed {
			validateJSONValue(item, path+"."+key, issues)
		}
	default:
		*issues = append(*issues, fmt.Sprintf("%s must be JSON-serializable", path))
	}
}

func validateAllowedKeys(input map[string]any, allowed []string, path string, issues *[]string) {
	for key := range input {
		if !contains(allowed, key) {
			*issues = append(*issues, fmt.Sprintf("%s contains unsupported property %q", path, key))
		}
	}
}

func validateViewPolicy(input any, path string, policy ViewPolicy, issues *[]string) {
	view, ok := input.(map[string]any)
	if !ok {
		return
	}

	template, _ := view["template"].(string)
	meta, _ := view["meta"].(map[string]any)

	if policy.RequireVersion {
		if version, ok := meta["version"].(string); !ok || version != "1" {
			*issues = append(*issues, fmt.Sprintf("%s.meta.version is required by policy", path))
		}
	}
	if policy.RequireTitle {
		if title, ok := meta["title"].(string); !ok || title == "" {
			*issues = append(*issues, fmt.Sprintf("%s.meta.title is required by policy", path))
		}
	}
	if policy.RequireRoute {
		if route, ok := meta["route"].(string); !ok || route == "" {
			*issues = append(*issues, fmt.Sprintf("%s.meta.route is required by policy", path))
		}
	}
	if !policy.AllowSafeFilter && safeFilterPattern.MatchString(template) {
		*issues = append(*issues, fmt.Sprintf("%s.template uses the |safe filter, which is disabled by policy", path))
	}
	if !policy.AllowScriptTags && scriptTagPattern.MatchString(template) {
		*issues = append(*issues, fmt.Sprintf("%s.template contains a <script> tag, which is disabled by policy", path))
	}
	if !policy.AllowInlineHandlers && inlineHandlerPattern.MatchString(template) {
		*issues = append(*issues, fmt.Sprintf("%s.template contains inline event handler attributes, which are disabled by policy", path))
	}
	if !policy.AllowJavaScriptURLs && javascriptURLPattern.MatchString(template) {
		*issues = append(*issues, fmt.Sprintf("%s.template contains a javascript: URL, which is disabled by policy", path))
	}

	if policy.ActionURLs != ActionURLsRelativeOnly {
		return
	}

	actions, ok := view["actions"].(map[string]any)
	if !ok {
		return
	}
	for actionName, raw := range actions {
		validateActionPolicy(raw, path+".actions."+actionName, issues)
	}
}

func validateActionPolicy(input any, path string, issues *[]string) {
	action, ok := input.(map[string]any)
	if !ok {
		return
	}

	actionType, _ := action["type"].(string)
	if actionType != "fetch" && actionType != "navigate" {
		return
	}

	url, ok := action["url"].(string)
	if !ok || !isRelativeURL(url) {
		*issues = append(*issues, fmt.Sprintf("%s.url must stay relative under the current policy", path))
	}
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func isRelativeURL(url string) bool {
	if strings.HasPrefix(url, "//") {
		return false
	}
	return strings.HasPrefix(url, "/") ||
		strings.HasPrefix(url, "./") ||
		strings.HasPrefix(url, "../") ||
		strings.HasPrefix(url, "?") ||
		strings.HasPrefix(url, "#")
}
