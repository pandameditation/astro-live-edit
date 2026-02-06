# Astro Live Edit - Project Roadmap

This roadmap outlines the planned features and bug fixes for the Astro Live Edit system. Items are ordered by priority and complexity.

---

## Feature Roadmap

### *TODO-0001: OuterHTML Support for Astro Files*

**Priority:** HIGH  
**Complexity:** ~80-100 lines  
**Status:** Ready for implementation

**Problem:**
Currently, users can only edit content inside tags but cannot modify tag attributes (like adding styles to `<ul>` tags). The system replaces innerHTML only, not the entire tag structure.

**What needs to be done:**
Enable users to modify tag attributes in the browser inspector and have those changes saved back to source files. Change from innerHTML to outerHTML handling for Astro files.

**Implementation approach:**

1. **Client-side changes (`/public/live-edit.js`):**
   - Line 9: Change `lastSavedContent.set(el, el.innerHTML)` → `lastSavedContent.set(el, el.outerHTML)`
   - Line 15: Change `if (last === el.innerHTML)` → `if (last === el.outerHTML)` (detect attribute changes)
   - Line 18: Change `lastSavedContent.set(el, el.innerHTML)` → `lastSavedContent.set(el, el.outerHTML)`
   - Line 25: Change `cleanPlusBeautifyHTML(el.innerHTML)` → `cleanPlusBeautifyHTML(el.outerHTML)`

2. **Server-side changes (`edit-server/save-server.js`):**
   - Rename `findTagAtPosition` to reflect it finds entire tags (not just inner content)
   - Update return values: `outerStart` (beginning of opening tag) and `outerEnd` (end of closing tag including `</${tagName}>`)
   - Rename `replaceInnerContent` → `replaceOuterContent`
   - Replace entire tag span (opening tag + content + closing tag) with new outerHTML

**Key considerations:**
- Markdown/MDX files remain unchanged (they already convert to markdown)
- Source location tracking stays the same (points to opening tag position)
- Must preserve nested tag structure and indentation
- Example use case: User adds `style="list-style-type: '✅ '"` to a `<ul>` tag

**Definition of done:**
- Users can modify tag attributes in browser inspector
- Entire tag (opening + content + closing) gets replaced in source file
- Existing content and nested tags are preserved
- Change detection works for attribute-only changes

**Estimated effort:** 2-3 hours

---

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

### *TODO-0003: Debug Verbosity Toggle (Retry with Simpler Approach)*

**Priority:** LOW  
**Complexity:** ~30-50 lines (simpler than attempted)  
**Status:** Needs simpler implementation approach (see `PM/ABANDONED/debug-verbosity-toggle-POSTMORTEM.md`)

**Problem:**
Application logs verbosely by default during development, cluttering console and terminal output. Need a simple ON/OFF toggle for debug logging.

**Previous attempt failed:**
First implementation used complex inline Node.js script in package.json that broke the startup. See postmortem for full details.

**Better approaches for retry:**

**Option A: Separate script file** (RECOMMENDED - simplest)
```javascript
// scripts/dev-edit.js
const { spawn } = require('child_process');
const verbose = process.argv.includes('--verbose');
process.env.VERBOSE = verbose ? 'true' : 'false';
spawn('npx', ['concurrently', 'npm run dev', 'npm run edit-server'], {
  stdio: 'inherit',
  shell: true
});
```
Then in package.json: `"dev:edit": "node scripts/dev-edit.js"`

**Option B: Environment variable convention**
```javascript
// debug.config.js (at project root)
module.exports = {
  verbose: process.env.DEBUG === 'true'
};
```
Usage: `DEBUG=true npm run dev:edit` (standard Unix pattern)

**Option C: cross-env package**
```json
"dev:edit": "cross-env VERBOSE=false concurrently \"npm run dev\" \"npm run edit-server\"",
"dev:edit:verbose": "cross-env VERBOSE=true concurrently \"npm run dev\" \"npm run dev-server\""
```
Requires `npm install cross-env` but is very straightforward.

**What to implement (regardless of option):**
- Logging utility functions in both client and server
- Wrap console.log statements with conditional checks
- Always show critical errors and save confirmations
- Verbose mode shows file operations, transformations, payloads

**Key lesson learned:**
Keep package.json scripts simple. No inline Node.js programs. Prefer boring, proven patterns.

**Definition of done:**
- `npm run dev:edit` produces minimal, clean output (default)
- `npm run dev:edit --verbose` (or equivalent) shows all debug details
- Critical errors always visible regardless of mode
- Application starts successfully

**Estimated effort:** 1 hour (with simpler approach)

---

## Bug Fixes Roadmap

_No known critical bugs at this time._

---

## Backlog

- Multi-level logging (ERROR/WARN/INFO/DEBUG/TRACE) instead of simple ON/OFF toggle
- Visual "unsaved changes" indicator (yellow dot/badge on save button)
- Undo/redo functionality for edits made in browser
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
