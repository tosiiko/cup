# CUP Testing

Use the repo checks in this order.

## Fast Feedback

```bash
npm run test:ts
```

Covers:

- parser and rendering rules
- runtime behavior
- policy enforcement
- repair/offline helpers
- cross-language and Node fixture contracts

## Full Validation

```bash
npm run check
```

Covers:

- TypeScript build
- TypeScript tests
- Python adapter tests
- Go adapter tests
- packed npm artifact verification, including transport-free core bundle checks

## Starter And Package Smoke

```bash
npm run starter:smoke
npm run demo:smoke
```

These verify:

- official starters boot and return policy-compliant views
- demos still mount end to end
- the published npm artifact contains the expected runtime/docs assets and no transport markers or source maps

## What To Add Tests For

- schema or policy changes
- new starter routes and actions
- remote fetch/patch/stream behavior
- security boundaries like CSRF, session handling, and safe rendering
- adapter output whenever the contract changes
