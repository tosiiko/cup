# Changelog

## 0.1.3

- Removed published TypeScript declaration files from the npm package.
- Removed `types` exports so the package no longer exposes the declaration graph.
- Kept the bundled and minified JavaScript runtime as the only distributed implementation artifact.

## 0.1.2

- Switched npm builds to emit a bundled and minified runtime entry instead of publishing the full readable module graph.
- Stopped publishing JavaScript source maps and declaration maps.
- Kept type declarations while reducing the amount of implementation detail exposed in the npm artifact.

## 0.1.1

- Updated the README with practical guidance for structuring real CUP applications.
- Added best-practice recommendations for using `templates/`, modular backends, and thin browser shells.
- Documented `demo/dashboard2` as the reference structured CUP application.
- Added guidance for Tailwind and production-oriented security boundaries.

## 0.1.0

- Split protocol and client-side view types.
- Escaped template rendering by default with `|safe` as the trusted escape hatch.
- Added protocol validation for TypeScript, Python, and Go adapters.
- Hardened router, action dispatcher, and remote fetching behavior.
- Added tests, CI, adapter packaging, and an isolated demo application.
