# Astro Live Edit - Project Roadmap

This roadmap outlines the planned features and bug fixes for the Astro Live Edit system. Items are ordered by priority and complexity.

---

## Feature Roadmap

TODO-0001
- Exception to the rule of dynamic content handling: when the dynamic logic is deterministic (we know which states it can take in advance, and the number of states is static), for example for the i18n strings like `{tr("site.translatable", "fr")}` or the `{showText ? <p>Show me!</p> : <p>I am invisible (joke)!</p>}` examples, then we should refer to the original string. That means for the i18n example, we should retro-engineer the tr function and find the locale for "site.translatable" in "fr" language. For the show/hide example, user should be able to see the different state the component can take right in the frontend.-> The work is to edit the static text that is referred inside `{expression}` without destroying the conditional logic around it. UX-wise, we can keep the current logic and imagine that instead of the line being disabled, it could be highlighted and on click the user can modify all the available states in a popover that displays the available states on one side and their value on the other side. e.g. it would show a state for "showText=True" and another for "showText=False". For i18n it would show a state for each language.

### *TODO-0002: Better Change Detection with MutationObserver*

**Priority:** MEDIUM  
**Complexity:** ~50 lines  
**Status:** Ready for implementation

**Problem:**
When users change elements via the browser's DevTools inspector (not by typing in contenteditable fields), changes aren't detected because the system relies on `blur` events. Users must manually trigger blur by clicking into a field and modifying it for the payload to update.

**What needs to be done:**
Replace blur-event-based change detection with MutationObserver that watches for any DOM changes (content, attributes, structure) and automatically updates the tracked state.

**Recommended approach:**

1. **Add MutationObserver to watch contenteditable elements:**
   - Watch for attribute changes, content changes, and subtree modifications
   - Debounce changes (wait 500ms after last modification before updating)
   - Update `lastSavedContent` WeakMap automatically when changes are detected
   - Show visual indicator when unsaved changes exist

2. **Benefits:**
   - DevTools inspector workflow becomes seamless
   - Change detection includes attribute modifications
   - Can show "unsaved changes" indicator (e.g., yellow dot on save button)
   - Foundation for future "undo" functionality

3. **Implementation details:**
   - ~50 additional lines of code
   - Minimal observer overhead (modern browsers are efficient)
   - Debouncing prevents excessive state updates

**CRITICAL: List indentation behavior**
Must preserve the existing Tab/Shift+Tab list item indentation logic. The blur event changes should not break the `data-indentable` functionality for `<ul>` and `<ol>` elements.

**Definition of done:**
- Changes made in DevTools inspector are automatically detected
- Save button shows indicator when changes exist
- List indentation (Tab/Shift+Tab) still works correctly
- No regressions in existing functionality

**Estimated effort:** 1-2 hours

---

---

## Bug Fixes Roadmap

- Modifying the intro.md file does not result in saved changes. It seems to work in the frontend and sends the correct payload. But it doesn't do the full-trip from the backend and the changes are lost. Is it because we use custom HTML tag inside the .md like <br /> ? to develop
- Handle dynamic content handling in Astro islands as well (support React template literal, svelte interpolation, etc.)
- Make sure that introducing HTML tags inside inside a markdown .md or .mdx file is supported, and that the changes in HTML-inside-md are sent to the server's payload

---

## Backlog

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
