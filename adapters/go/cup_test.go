package cup

import (
	"encoding/json"
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

func TestMarshalJSONIncludesMeta(t *testing.T) {
	view := New(`<h1>{{ title }}</h1>`).
		State(S{"title": "Hello"}).
		Title("Home").
		Route("/")

	encoded, err := json.Marshal(view)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	if !strings.Contains(string(encoded), `"generator":"cup-go/0.1.0"`) {
		t.Fatalf("expected generator metadata, got %s", string(encoded))
	}
}
