# CUP Conformance And Observability

This repo now treats protocol conformance as more than "does it parse".

## What Gets Checked

- schema validity for `ProtocolView` and `ProtocolPatch`
- policy compliance for starter-safe output
- capability negotiation against declared `meta.extensions`
- provenance metadata on official adapter output
- runtime traces for render, action, and validation events

## Runtime Hooks

Use these helpers when you want runtime-level visibility:

- `createTraceObserver(container)`
- `inspectTraces(container)`
- `validateProtocolView(..., { capabilities })`
- `createCapabilityHeaders(...)`
- `negotiateCapabilities(...)`

## Repo Coverage

- negotiation behavior:
  [`../tests/runtime/negotiation.test.ts`](../tests/runtime/negotiation.test.ts)
- runtime trace hooks:
  [`../tests/runtime/tracing.test.ts`](../tests/runtime/tracing.test.ts)
- official adapter conformance:
  [`../tests/runtime/adapter-conformance.test.ts`](../tests/runtime/adapter-conformance.test.ts)
- cross-language mounting contract:
  [`../tests/runtime/contract.test.ts`](../tests/runtime/contract.test.ts)

## Practical Rule

Adapters should emit truthful provenance.
Clients should validate required capabilities before mount.
Optional extensions should stay ignorable unless marked required.
