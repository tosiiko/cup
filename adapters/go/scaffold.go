package cup

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type ScaffoldFile struct {
	Path    string
	Content string
}

type ScaffoldBundle struct {
	Kind  string
	Name  string
	Files []ScaffoldFile
	Notes []string
}

type scaffoldNameParts struct {
	Snake string
	Kebab string
	Label string
	Camel string
}

var scaffoldWordPattern = regexp.MustCompile(`[A-Za-z0-9]+`)

func GeneratePageScaffold(name, route, title string) (ScaffoldBundle, error) {
	names, err := normalizeScaffoldName(name)
	if err != nil {
		return ScaffoldBundle{}, err
	}
	if route == "" {
		route = "/" + names.Kebab
	}
	if title == "" {
		title = names.Label
	}

	return ScaffoldBundle{
		Kind: "page",
		Name: names.Snake,
		Files: []ScaffoldFile{
			{
				Path:    filepath.ToSlash(filepath.Join("internal", "views", names.Snake+".go")),
				Content: goViewContent(names.Camel, route, title),
			},
			{
				Path:    filepath.ToSlash(filepath.Join("templates", names.Snake+".html")),
				Content: goTemplateContent(title),
			},
			{
				Path:    filepath.ToSlash(filepath.Join(".cup", "snippets", names.Snake+".route.go")),
				Content: goRouteSnippet(names, route),
			},
		},
		Notes: []string{
			"Wire the route snippet into your net/http server registration.",
			"Replace the placeholder records state in the generated view with real backend data.",
			"Keep policy validation in the route handler before writing JSON to the browser.",
		},
	}, nil
}

func GenerateActionScaffold(name, endpoint, successRoute string) (ScaffoldBundle, error) {
	names, err := normalizeScaffoldName(name)
	if err != nil {
		return ScaffoldBundle{}, err
	}
	if endpoint == "" {
		endpoint = "/api/" + names.Kebab
	}
	if successRoute == "" {
		successRoute = "/"
	}

	return ScaffoldBundle{
		Kind: "action",
		Name: names.Snake,
		Files: []ScaffoldFile{
			{
				Path:    filepath.ToSlash(filepath.Join(".cup", "snippets", names.Snake+".action.go")),
				Content: goActionSnippet(names, endpoint, successRoute),
			},
			{
				Path:    filepath.ToSlash(filepath.Join(".cup", "snippets", names.Snake+".browser.js")),
				Content: goBrowserSnippet(names.Snake, endpoint),
			},
		},
		Notes: []string{
			"Paste the action snippet into a POST handler and replace the placeholder payload validation.",
			"Point the generated handler at the view you want to remount after the action completes.",
			"Keep action URLs relative and run starter policy validation before writing the view.",
		},
	}, nil
}

func WriteScaffoldBundle(bundle ScaffoldBundle, root string, force bool) ([]string, error) {
	written := make([]string, 0, len(bundle.Files))
	for _, artifact := range bundle.Files {
		target := filepath.Join(root, filepath.FromSlash(artifact.Path))
		if !force {
			if _, err := os.Stat(target); err == nil {
				return nil, fmt.Errorf("refusing to overwrite existing scaffold file: %s", target)
			}
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return nil, err
		}
		if err := os.WriteFile(target, []byte(artifact.Content), 0o644); err != nil {
			return nil, err
		}
		written = append(written, target)
	}
	return written, nil
}

func normalizeScaffoldName(name string) (scaffoldNameParts, error) {
	parts := scaffoldWordPattern.FindAllString(name, -1)
	if len(parts) == 0 {
		return scaffoldNameParts{}, fmt.Errorf("name must include at least one letter or number")
	}

	snakeParts := make([]string, 0, len(parts))
	labelParts := make([]string, 0, len(parts))
	camelParts := make([]string, 0, len(parts))
	for _, part := range parts {
		lower := strings.ToLower(part)
		snakeParts = append(snakeParts, lower)
		labelParts = append(labelParts, strings.ToUpper(lower[:1])+lower[1:])
		camelParts = append(camelParts, strings.ToUpper(lower[:1])+lower[1:])
	}

	snake := strings.Join(snakeParts, "_")
	return scaffoldNameParts{
		Snake: snake,
		Kebab: strings.Join(snakeParts, "-"),
		Label: strings.Join(labelParts, " "),
		Camel: strings.Join(camelParts, ""),
	}, nil
}

func goViewContent(camel, route, title string) string {
	return strings.Join([]string{
		"package views",
		"",
		`import cup "github.com/cup-protocol/cup-go"`,
		"",
		fmt.Sprintf("func %sView(template string) *cup.UIView {", camel),
		"	return cup.New(template).",
		"		State(cup.S{",
		fmt.Sprintf(`			"title": %q,`, title),
		`			"records": []any{},`,
		"		}).",
		fmt.Sprintf("		Title(%q).", title),
		fmt.Sprintf("		Route(%q)", route),
		"}",
		"",
	}, "\n")
}

func goTemplateContent(title string) string {
	return strings.Join([]string{
		"<section class=\"cup-card\">",
		fmt.Sprintf("  <h2 class=\"cup-card-title\">%s</h2>", title),
		"  <p>Replace this scaffold with the real page content and state bindings.</p>",
		"",
		"  {% if records %}",
		"    <div>",
		"      {% for record in records %}",
		"        <article>",
		"          <strong>{{ record.title }}</strong>",
		"          <p>{{ record.detail }}</p>",
		"        </article>",
		"      {% endfor %}",
		"    </div>",
		"  {% else %}",
		"    <p>No records yet. Replace this placeholder once the view has real data.</p>",
		"  {% endif %}",
		"</section>",
		"",
	}, "\n")
}

func goRouteSnippet(names scaffoldNameParts, route string) string {
	return strings.Join([]string{
		"package TODO",
		"",
		"import (",
		`	"net/http"`,
		`	"os"`,
		"",
		`	cup "github.com/cup-protocol/cup-go"`,
		fmt.Sprintf(`	"your/module/internal/views"`),
		")",
		"",
		fmt.Sprintf("// Register %s in your router setup.", route),
		fmt.Sprintf("func register%sRoute() {", names.Camel),
		fmt.Sprintf(`	http.HandleFunc(%q, func(w http.ResponseWriter, r *http.Request) {`, route),
		fmt.Sprintf(`		raw, err := os.ReadFile(%q)`, filepath.ToSlash(filepath.Join("templates", names.Snake+".html"))),
		"		if err != nil {",
		"			http.Error(w, err.Error(), http.StatusInternalServerError)",
		"			return",
		"		}",
		fmt.Sprintf("		view := views.%sView(string(raw))", names.Camel),
		"		if err := cup.ValidatePolicy(view.ToMap(), cup.StarterViewPolicy); err != nil {",
		"			http.Error(w, err.Error(), http.StatusInternalServerError)",
		"			return",
		"		}",
		"		if err := view.WriteJSON(w); err != nil {",
		"			http.Error(w, err.Error(), http.StatusInternalServerError)",
		"		}",
		"	})",
		"}",
		"",
	}, "\n")
}

func goActionSnippet(names scaffoldNameParts, endpoint, successRoute string) string {
	return strings.Join([]string{
		"package TODO",
		"",
		"import (",
		`	"encoding/json"`,
		`	"io"`,
		`	"net/http"`,
		`	"os"`,
		"",
		`	cup "github.com/cup-protocol/cup-go"`,
		fmt.Sprintf(`	"your/module/internal/views"`),
		")",
		"",
		fmt.Sprintf("// Register POST %s and replace the placeholder payload logic.", endpoint),
		fmt.Sprintf("func register%sAction() {", names.Camel),
		fmt.Sprintf(`	http.HandleFunc(%q, func(w http.ResponseWriter, r *http.Request) {`, endpoint),
		"		if r.Method != http.MethodPost {",
		"			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)",
		"			return",
		"		}",
		"",
		"		payload := map[string]any{}",
		"		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil && err != io.EOF {",
		"			http.Error(w, err.Error(), http.StatusBadRequest)",
		"			return",
		"		}",
		fmt.Sprintf(`		raw, err := os.ReadFile(%q)`, filepath.ToSlash(filepath.Join("templates", names.Snake+".html"))),
		"		if err != nil {",
		"			http.Error(w, err.Error(), http.StatusInternalServerError)",
		"			return",
		"		}",
		fmt.Sprintf("		view := views.%sView(string(raw))", names.Camel),
		"		view.State(cup.S{",
		fmt.Sprintf(`			"notice": %q,`, names.Label+" completed."),
		`			"payload": payload,`,
		"		})",
		fmt.Sprintf("		view.Route(%q)", successRoute),
		"		if err := cup.ValidatePolicy(view.ToMap(), cup.StarterViewPolicy); err != nil {",
		"			http.Error(w, err.Error(), http.StatusInternalServerError)",
		"			return",
		"		}",
		"		if err := view.WriteJSON(w); err != nil {",
		"			http.Error(w, err.Error(), http.StatusInternalServerError)",
		"		}",
		"	})",
		"}",
		"",
	}, "\n")
}

func goBrowserSnippet(name, endpoint string) string {
	return strings.Join([]string{
		"// Example browser bridge mapping",
		fmt.Sprintf(`FORM_ENDPOINTS.%s = %q;`, name, endpoint),
		"",
		"// Example form hook",
		fmt.Sprintf(`<form data-form-kind=%q>`, name),
		`  <input type="hidden" name="csrf_token" value="{{ csrf_token }}" />`,
		"  <button type=\"submit\">Submit</button>",
		"</form>",
		"",
	}, "\n")
}
