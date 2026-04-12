# CUP AI Guidance

Use this when an AI system is asked to generate CUP views, templates, or route scaffolds.

## Generation Rules

- Emit JSON that matches `schema/uiview.v1.json`.
- Keep action URLs relative unless a human explicitly approves a different policy.
- Always include `meta.version`, `meta.title`, and `meta.route` for starter-quality output.
- Treat `{{ value|safe }}` as an exception. Do not generate it for untrusted content.
- Do not generate inline event handler attributes such as `onclick=`.
- Keep permissions and mutation decisions on the server, not in the template.

## Validation Loop

1. Run schema validation first.
2. Run view policy validation second.
3. If validation fails, repair the output instead of bypassing the policy.
4. Only mount or ship views that pass both checks.

Phase 1 now exposes helpers for this loop directly:

- `validateProtocolView()`
- `validateViewPolicy()`
- `repairProtocolViewCandidate()`
- `repairProtocolPatchCandidate()`

## Good AI Tasks

- scaffold a new route and template file
- generate a CRUD table page using the reference vocabulary
- wire relative `fetch` and `navigate` actions
- add state fields to an existing view builder

## Bad AI Tasks

- invent client-side permission logic
- bypass CSRF requirements
- inject unreviewed trusted HTML
- emit absolute action URLs into starter apps

See [`./ai-evals.md`](./ai-evals.md) for the prompt/eval/fixture set used by this repo.
