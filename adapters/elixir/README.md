# ex-cup

Language: Elixir
Ecosystem: hex
Intent: official
Repository state: bootstrapped
Implementation kind: scaffold
Maturity: scaffold
Publication status: not-published
Protocol versions: 1

This is a generated CUP adapter scaffold. It establishes the in-repo package path, ecosystem metadata, and starter source layout for a future full implementation.

Adapter expectations:

- emit protocol-compatible `v1` views
- preserve `meta.version`, `meta.lang`, and `meta.generator`
- provide schema validation helpers
- provide starter-safe policy validation
- pass the shared CUP contract tests once fully implemented

Notes:

- Intended for Phoenix-compatible server workflows.
- This scaffold is generated from `adapters/namespaces.json`.
