# CUP Reference UI

The optional reference stylesheet lives at `@tosiiko/cup/styles/reference.css`.

Its job is not to replace your design system. It gives new CUP apps a safe, accessible baseline while teams decide how much custom branding they need.

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

## Recommended Use

- Start with the reference classes in new starters and internal tools.
- Keep semantic HTML first; the stylesheet assumes normal buttons, forms, links, and tables.
- Replace tokens gradually instead of rewriting the whole structure at once.
- Avoid mixing the reference layer with large amounts of inline styles in production apps.
