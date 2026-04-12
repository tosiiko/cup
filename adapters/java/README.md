# java-cup

Java adapter path for CUP.

`java-cup` is now an alpha in-repo source adapter for Java backends. It includes a fluent `UIView` builder, action descriptors, validation helpers, policy validation, and JSON serialization utilities under `dev.tosiiko.cup`.

## What It Includes

- `UIView`
- `FetchAction`, `EmitAction`, `NavigateAction`
- `JavaCup` convenience helpers
- `CupValidator`
- `ViewPolicy.starter()` / `JavaCup.starterViewPolicy()`
- `ValidationError` and `PolicyError`
- `JsonWriter`

## Intended Use

Use it for Spring, Jakarta, or plain servlet backends where Java should own route resolution, state assembly, and secure mutations while the browser stays thin.

## Current Level

- status: alpha in repo
- implementation: real source layout
- verification: compiled locally with `javac` and example execution verified with `java`
