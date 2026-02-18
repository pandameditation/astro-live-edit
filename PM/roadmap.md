# Astro Live Edit - Project Roadmap

This roadmap outlines the planned features and bug fixes for the Astro Live Edit system. Items are ordered by priority and complexity.

---

## Vision

An open-source, offline-first live website editor for Astro, that can connect to AI to generate any component or webpage, SEO-friendly, beautiful design that generates beautiful code.

Inspirations: teleportHQ, Subframe.com

---

## Feature Roadmap

P0: prerequisites; P1: Phase 1; P2: Phase 2

**Allow modification of components/ HTML tags**

- Programmatically modify any HTML tag
- P0: identify any HTML tag from the code (add specific data-identifiers to each tag)
- Add style to tags
- Add scoped CSS to components (export to .astro)

**Better control over HTML editing**

- P1: Add a library of interactive HTML widgets/ Astro or island components (static or with Props)
- P2: The user can add any component (HTML tag, .astro or .svelte or .react components) and manage the library of components

**Full component editing**

- User can click on any component to select it. Selected components can be dragged, and can edit the component. Edit opens a side panel like in subframe with key properties and styles.

**Deep website modifications**

- Show the layers of the page (HTML tree revisited to simplify it)
- P3: Change device (mobile/tablet/desktop/TV) and show responsiveness accordingly
- P4: Support of Grid and flexbox for containers + some smart containers layout (popover, modal, drawer, cards, columns...)
- P2: Edit the order of components with drag&drop (right in the page or with the layers tool)
- P1: Commands over any component like in Subframe (e.g. Ask AI to edit, Copy as code, etc.)
- P1: Add any new neighbor component to the left, right, top or bottom of any component (AI can create component on the fly like Subframe)

**Style and branding control**

- P1: Allow to define design tokens for the project (colors, spacing, shadows, font pairs...) in a given file that AI/components can refer to. The definition of the design system with design tokens is also assisted by AI.
- P3: Add a library of images (add local images or find them online)




---

## Bug Fixes Roadmap

---
## Technical debt roadmap

- Ensure our UI components follow the same design system (styles, icons, fonts, spacing...) -> with a Design Tokens page that will feed them. They could use the same design system as Astro
- Ensure our UI components are instanciated in a similar way, and that reusable parts are actually reused (reusability, DRY, modularity of our UI).
---

## Backlog

- Support for editing Astro component props via inspector
- Keyboard shortcuts (Ctrl+S to save, Ctrl+Z for undo)
- Diff view showing what changed before saving
- Multiple user support (show who's editing what)
- Read-only mode for production preview
- Custom save hooks (run linter, formatter before saving)

---

**Last updated:** 2026-02-06  
**Maintained by:** senior-pm
