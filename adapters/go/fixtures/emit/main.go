package main

import (
	"encoding/json"
	"log"
	"os"

	cup "github.com/cup-protocol/cup-go"
)

func main() {
	view := cup.New(`<div>{{ title }}</div>`).
		State(cup.S{
			"title": "Hello from Go",
			"items": []string{"Alpha", "Beta"},
		}).
		Action("next", cup.Navigate("/next")).
		Title("Fixture").
		Route("/fixture")

	if err := view.Validate(); err != nil {
		log.Fatal(err)
	}

	if err := json.NewEncoder(os.Stdout).Encode(view.ToMap()); err != nil {
		log.Fatal(err)
	}
}
