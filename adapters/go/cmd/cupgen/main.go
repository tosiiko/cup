package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	cup "github.com/cup-protocol/cup-go"
)

func main() {
	if len(os.Args) < 3 || os.Args[1] != "scaffold" {
		exitUsage()
	}

	kind := os.Args[2]
	switch kind {
	case "page":
		runPage(os.Args[3:])
	case "action":
		runAction(os.Args[3:])
	default:
		exitUsage()
	}
}

func runPage(args []string) {
	args = normalizeNameFirstArgs(args)
	flags := flag.NewFlagSet("page", flag.ExitOnError)
	route := flags.String("route", "", "route to generate")
	title := flags.String("title", "", "page title")
	out := flags.String("out", ".", "output directory")
	force := flags.Bool("force", false, "overwrite existing files")
	flags.Parse(args)

	if flags.NArg() != 1 {
		exitUsage()
	}

	bundle, err := cup.GeneratePageScaffold(flags.Arg(0), *route, *title)
	if err != nil {
		exitErr(err)
	}
	finish(bundle, *out, *force)
}

func runAction(args []string) {
	args = normalizeNameFirstArgs(args)
	flags := flag.NewFlagSet("action", flag.ExitOnError)
	endpoint := flags.String("endpoint", "", "POST endpoint to generate")
	successRoute := flags.String("success-route", "", "route to remount after the action succeeds")
	out := flags.String("out", ".", "output directory")
	force := flags.Bool("force", false, "overwrite existing files")
	flags.Parse(args)

	if flags.NArg() != 1 {
		exitUsage()
	}

	bundle, err := cup.GenerateActionScaffold(flags.Arg(0), *endpoint, *successRoute)
	if err != nil {
		exitErr(err)
	}
	finish(bundle, *out, *force)
}

func finish(bundle cup.ScaffoldBundle, out string, force bool) {
	written, err := cup.WriteScaffoldBundle(bundle, out, force)
	if err != nil {
		exitErr(err)
	}
	fmt.Printf("[cup-go] generated %s scaffold for %s\n", bundle.Kind, bundle.Name)
	for _, path := range written {
		fmt.Printf("  wrote %s\n", path)
	}
	for _, note := range bundle.Notes {
		fmt.Printf("  note: %s\n", note)
	}
}

func exitUsage() {
	fmt.Fprintln(os.Stderr, "usage: go run ./cmd/cupgen scaffold <page|action> <name> [flags]")
	os.Exit(2)
}

func exitErr(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}

func normalizeNameFirstArgs(args []string) []string {
	if len(args) == 0 {
		return args
	}
	if strings.HasPrefix(args[0], "-") {
		return args
	}
	return append(args[1:], args[0])
}
