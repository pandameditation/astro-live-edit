# Astro Live Edit - Project Roadmap

This roadmap outlines the planned features and bug fixes for the Astro Live Edit system. Items are ordered by priority and complexity.

---

## Feature Roadmap

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
