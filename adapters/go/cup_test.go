package cup

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidateAcceptsView(t *testing.T) {
	view := New(`<h1>{{ title }}</h1>`).
		State(S{"title": "Hello", "items": []string{"A", "B"}}).
		Action("reload", Fetch("/reload")).
		Title("Home").
		Route("/")

	if err := view.Validate(); err != nil {
		t.Fatalf("expected valid view, got %v", err)
	}
}

func TestValidateRejectsUnsupportedFields(t *testing.T) {
	err := Validate(map[string]any{
		"template": "<p>Hi</p>",
		"state":    map[string]any{},
		"extra":    true,
	})
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "unsupported property") {
		t.Fatalf("expected unsupported property message, got %v", err)
	}
}

func TestValidateRejectsCrossTypeActionFields(t *testing.T) {
	err := Validate(map[string]any{
		"template": "<button data-action='save'>Save</button>",
		"state":    map[string]any{},
		"actions": map[string]any{
			"save": map[string]any{
				"type":    "fetch",
				"url":     "/save",
				"replace": true,
			},
		},
	})
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "unsupported property") {
		t.Fatalf("expected unsupported property message, got %v", err)
	}
}

func TestMarshalJSONIncludesMeta(t *testing.T) {
	view := New(`<h1>{{ title }}</h1>`).
		State(S{"title": "Hello"}).
		Title("Home").
		Route("/")

	encoded, err := json.Marshal(view)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	if !strings.Contains(string(encoded), `"generator":"cup-go/0.2.0"`) {
		t.Fatalf("expected generator metadata, got %s", string(encoded))
	}
}

func TestValidatePolicyAcceptsStarterSafeView(t *testing.T) {
	view := New(`<button data-action="save">Save</button>`).
		Action("save", Fetch("/api/save")).
		Title("Save").
		Route("/records/1")

	if err := ValidatePolicy(view.ToMap(), StarterViewPolicy); err != nil {
		t.Fatalf("expected starter-safe view to pass policy validation, got %v", err)
	}
}

func TestValidatePolicyRejectsSafeFilter(t *testing.T) {
	err := ValidatePolicy(map[string]any{
		"template": "<p>{{ content|safe }}</p>",
		"state":    map[string]any{"content": "<strong>Hi</strong>"},
		"meta": map[string]any{
			"version": "1",
			"title":   "Unsafe",
			"route":   "/unsafe",
		},
	}, StarterViewPolicy)
	if err == nil {
		t.Fatal("expected policy error")
	}
	if !strings.Contains(err.Error(), "|safe") {
		t.Fatalf("expected safe-filter message, got %v", err)
	}
}

func TestValidatePolicyRejectsAbsoluteActionURLs(t *testing.T) {
	err := ValidatePolicy(map[string]any{
		"template": `<button data-action="save">Save</button>`,
		"state":    map[string]any{},
		"actions": map[string]any{
			"save": map[string]any{
				"type":   "fetch",
				"url":    "https://example.com/save",
				"method": "POST",
			},
		},
		"meta": map[string]any{
			"version": "1",
			"title":   "External",
			"route":   "/external",
		},
	}, StarterViewPolicy)
	if err == nil {
		t.Fatal("expected policy error")
	}
	if !strings.Contains(err.Error(), "must stay relative") {
		t.Fatalf("expected relative-url message, got %v", err)
	}
}

func TestGeneratePageScaffoldIncludesExpectedArtifacts(t *testing.T) {
	bundle, err := GeneratePageScaffold("Account Health", "/crm/account-health", "Account Health")
	if err != nil {
		t.Fatalf("GeneratePageScaffold failed: %v", err)
	}

	paths := map[string]bool{}
	for _, artifact := range bundle.Files {
		paths[artifact.Path] = true
	}

	expected := []string{
		"internal/views/account_health.go",
		"templates/account_health.html",
		".cup/snippets/account_health.route.go",
	}
	for _, path := range expected {
		if !paths[path] {
			t.Fatalf("expected scaffold to include %s", path)
		}
	}
}

func TestGenerateActionScaffoldIncludesExpectedArtifacts(t *testing.T) {
	bundle, err := GenerateActionScaffold("sync accounts", "/api/accounts/sync", "/crm/companies")
	if err != nil {
		t.Fatalf("GenerateActionScaffold failed: %v", err)
	}

	paths := map[string]bool{}
	for _, artifact := range bundle.Files {
		paths[artifact.Path] = true
	}

	expected := []string{
		".cup/snippets/sync_accounts.action.go",
		".cup/snippets/sync_accounts.browser.js",
	}
	for _, path := range expected {
		if !paths[path] {
			t.Fatalf("expected scaffold to include %s", path)
		}
	}
}

func TestWriteScaffoldBundleWritesFilesAndRejectsCollisions(t *testing.T) {
	bundle, err := GeneratePageScaffold("Quarterly Plan", "", "")
	if err != nil {
		t.Fatalf("GeneratePageScaffold failed: %v", err)
	}

	root := t.TempDir()
	written, err := WriteScaffoldBundle(bundle, root, false)
	if err != nil {
		t.Fatalf("WriteScaffoldBundle failed: %v", err)
	}
	if len(written) != len(bundle.Files) {
		t.Fatalf("expected %d written files, got %d", len(bundle.Files), len(written))
	}
	if _, err := os.Stat(filepath.Join(root, "internal", "views", "quarterly_plan.go")); err != nil {
		t.Fatalf("expected written scaffold file: %v", err)
	}
	if _, err := WriteScaffoldBundle(bundle, root, false); err == nil {
		t.Fatal("expected collision error")
	}
}
