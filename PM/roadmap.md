# Astro Live Edit - Project Roadmap

This roadmap outlines the planned features and bug fixes for the Astro Live Edit system. Items are ordered by priority and complexity.

---

## Feature Roadmap


---

## Bug Fixes Roadmap


- Modifying the intro.md file does not result in saved changes. It seems to work in the frontend and sends the correct payload. But it doesn't do the full-trip from the backend and the changes are lost. Is it because we use custom HTML tag inside the .md like <br /> ? to develop
- Make sure that introducing HTML tags inside inside a markdown .md or .mdx file is supported, and that the changes in HTML-inside-md are sent to the server's payload


---

## Backlog

- To handle dynamic content/string literals in Astro islands
- Support of i18n strings : the system should detect i18n strings and modify them in place
- Visual "unsaved changes" indicator (yellow dot/badge on save button) (Dependancy on better-change-detection)
- Undo/redo functionality for edits made in browser
- History of the previous states that were Saved in the session (in localstorage)
- Auto-save with configurable delay (e.g., save 2 seconds after last change)
- Support for editing Astro component props via inspector
- Keyboard shortcuts (Ctrl+S to save, Ctrl+Z for undo)
- Diff view showing what changed before saving
- Multiple user support (show who's editing what)
- Read-only mode for production preview
- Custom save hooks (run linter, formatter before saving)

---

**Last updated:** 2026-02-06  
**Maintained by:** senior-pm
