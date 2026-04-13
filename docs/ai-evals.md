# CUP AI Prompts, Evals, And Fixtures

Phase 1 treats AI support as a governed workflow, not a free-form shortcut.

## Prompt Pack

Use prompts that ask for:

- one route at a time
- one page template at a time
- relative action URLs only
- explicit `meta.version`, `meta.title`, and `meta.route`
- no `|safe` unless a human explicitly allows trusted HTML

## Eval Loop

1. generate a candidate view
2. run schema validation
3. run starter policy validation
4. if it fails, run `repairProtocolViewCandidate()`
5. re-validate the repaired result
6. keep the repaired output's `meta.provenance` so reviewers can see that it was repaired

## Repo Fixtures

- valid starter-grade fixture:
  [`../tests/fixtures/ai/generated-valid.json`](../tests/fixtures/ai/generated-valid.json)
- unsafe generated fixture:
  [`../tests/fixtures/ai/generated-unsafe.json`](../tests/fixtures/ai/generated-unsafe.json)
- automated eval test:
  [`../tests/runtime/ai-fixtures.test.ts`](../tests/runtime/ai-fixtures.test.ts)
- official adapter conformance test:
  [`../tests/runtime/adapter-conformance.test.ts`](../tests/runtime/adapter-conformance.test.ts)

## Practical Rule

AI may help author routes, templates, and actions.
AI may not become the trust boundary.
