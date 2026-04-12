// CUP Go Adapter — net/http server example
// Run: go run example.go cup.go
// Then open: http://localhost:8001
//
// The CUP frontend fetches UIView JSON from these endpoints and renders it.
package main

import (
	"log"
	"net/http"
	"sync/atomic"

	cup "github.com/cup-protocol/cup-go"
)

var count atomic.Int64

var items = []string{"Alpha", "Beta", "Gamma"}

func corsHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func dashboardView() *cup.UIView {
	return cup.New(`
			<h2>Go Dashboard</h2>
			<p>Served from <strong>cup-go</strong> via net/http.</p>

			<div style="margin:1.5rem 0">
				<div style="font-size:3rem;font-weight:800">{{ count }}</div>
			<div style="display:flex;gap:.5rem;margin-top:1rem">
				<button data-action="increment">+ Increment</button>
				<button data-action="decrement">− Decrement</button>
				<button data-action="reset">Reset</button>
			</div>
		</div>

		<h3>Items</h3>
			<ul>
				{% for item in items %}
					<li>{{ item }}</li>
				{% endfor %}
			</ul>
		`).
			State(cup.S{
				"count": count.Load(),
				"items": items,
			}).
			Action("increment", cup.Fetch("/api/increment")).
			Action("decrement", cup.Fetch("/api/decrement")).
			Action("reset", cup.Fetch("/api/reset")).
			Title("Go Dashboard").
			Route("/")
}

func writeView(w http.ResponseWriter, view *cup.UIView) {
	if err := cup.ValidatePolicy(view.ToMap(), cup.StarterViewPolicy); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := view.WriteJSON(w); err != nil {
		log.Println("write error:", err)
	}
}

func main() {
	mux := http.NewServeMux()

	// Serve the initial UIView
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		corsHeaders(w)
		writeView(w, dashboardView())
	})

	// Actions — each returns the updated UIView
	mux.HandleFunc("POST /api/increment", func(w http.ResponseWriter, r *http.Request) {
		corsHeaders(w)
		count.Add(1)
		writeView(w, dashboardView())
	})

	mux.HandleFunc("POST /api/decrement", func(w http.ResponseWriter, r *http.Request) {
		corsHeaders(w)
		count.Add(-1)
		writeView(w, dashboardView())
	})

	mux.HandleFunc("POST /api/reset", func(w http.ResponseWriter, r *http.Request) {
		corsHeaders(w)
		count.Store(0)
		writeView(w, dashboardView())
	})

	// Handle preflight
	mux.HandleFunc("OPTIONS /", func(w http.ResponseWriter, r *http.Request) {
		corsHeaders(w)
		w.WriteHeader(http.StatusNoContent)
	})

	addr := "localhost:8001"
	log.Printf("CUP Go server → http://%s\n", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
