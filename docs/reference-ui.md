# CUP Reference UI

The optional reference stylesheet lives at `@tosiiko/cup/styles/reference.css`.

Its job is not to replace your design system. It gives new CUP apps a safe, accessible baseline while teams decide how much custom branding they need.

## What It Is

- a reference theme for CUP demos, starters, and early product builds
- an optional semantic class vocabulary for common authenticated app surfaces
- a token-driven baseline that can be overridden gradually

## What It Is Not

- not part of the wire protocol
- not required for CUP views to be valid
- not the only correct visual interpretation of a CUP app
- not a replacement for a product-specific design system

That boundary matters: CUP’s protocol defines structure and behavior, while `reference.css` is only one optional visual layer.

## Layer Model

The current stylesheet intentionally mixes a few layers in one file, but it now documents them explicitly:

- theme tokens:
  fonts, colors, radii, spacing, shadows
- layouts:
  `cup-app`, `cup-shell`, `cup-sidebar`, `cup-content`, `cup-stack`, `cup-section`
- primitives:
  `cup-button`, `cup-input`, `cup-select`, `cup-textarea`, `cup-label`, `cup-code`
- semantic components:
  `cup-card`, `cup-banner`, `cup-empty`, `cup-error`, `cup-table`, `cup-dialog`

Long term, CUP may split these into separate files such as:

- `cup-theme.css`
- `cup-layout.css`
- `cup-primitives.css`
- `cup-components.css`

For now, they stay together because the reference layer is still intentionally small and easy to ship.

## Component Vocabulary

- Shell: `cup-app`, `cup-shell`, `cup-sidebar`, `cup-content`
- Layout: `cup-stack`, `cup-section`, `cup-card`, `cup-actions`
- Navigation: `cup-nav`, `cup-tab-list`, `cup-tab`, `cup-pagination`
- Forms: `cup-field`, `cup-label`, `cup-input`, `cup-select`, `cup-textarea`, `cup-button`
- Messaging: `cup-banner`, `cup-empty`, `cup-error`
- Data: `cup-table`
- Dialogs: `cup-dialog-backdrop`, `cup-dialog`

## Styling Intent

- warm neutral background with strong contrast for authenticated apps
- token-driven spacing, radii, and color choices
- keyboard-visible focus states
- mobile-safe shell collapse under `920px`
- optional usage: classes only, no runtime dependency
- reference-theme status: this is the starter/default look, not a protocol requirement

## Theme Extensibility

- Token overrides are the primary customization mechanism.
- Fonts are intentionally variable-driven through `--cup-font-sans` and `--cup-font-mono`.
- Apps can scope the reference look with `.cup-theme-reference` instead of relying only on `:root`.
- Dark mode is not standardized by CUP yet; teams should treat it as an app/theme concern, not a protocol concern.
- Alternative themes such as minimal, dense, or brand-specific variants are expected over time.

## Recommended Use

- Start with the reference classes in new starters and internal tools.
- Keep semantic HTML first; the stylesheet assumes normal buttons, forms, links, and tables.
- Replace tokens gradually instead of rewriting the whole structure at once.
- Avoid mixing the reference layer with large amounts of inline styles in production apps.
- If your app already has a design system, treat this stylesheet as vocabulary inspiration, not a dependency mandate.
