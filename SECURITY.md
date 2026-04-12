# Security Policy

## Supported versions

Only the latest published pre-1.0 release receives security fixes.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the project maintainers before public disclosure.

When reporting an issue, include:

- A description of the affected API or template input
- A minimal reproduction
- Impact details and any known mitigations

## Security model

- CUP escapes `{{ }}` output by default.
- `|safe` must only be used for trusted, sanitized HTML.
- Remote protocol views are validated before mounting unless validation is explicitly disabled.
