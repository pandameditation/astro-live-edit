# Feature: Better Change Detection with MutationObserver

**Status:** Implementation complete — pending merge  
**Priority:** MEDIUM  
**Complexity:** ~50 lines added  
**Branch:** exp/feature-better-change-detection-try#1

---

## Problem Statement

Currently, the system only detects changes when users blur contenteditable fields (click away). If users modify elements via browser DevTools inspector, the changes aren't detected because blur events never fire. Users must manually trigger a blur in a contenteditable field for the system to recognize any changes.

This workflow is clunky and limits the user experience.

---

## What Needs to Be Done

Replace the blur-event-based change detection in `/public/live-edit.js` with a MutationObserver that automatically detects any DOM changes (content, attributes, structure) and updates the tracked state in real-time.

---

## Recommended Approach

### 1. Add MutationObserver for contenteditable elements

- Watch for three mutation types:
  - `childList` (content changes)
  - `characterData` (text changes)
  - `subtree: true` (nested element modifications)
- Debounce changes (wait 500ms after last mutation before updating state)
- Update the `lastSavedContent` WeakMap automatically when changes are detected

### 2. Visual Feedback

- Show unsaved changes indicator (e.g., visual marker on the save button) when mutations are detected
- Foundation for future undo/redo functionality

### 3. Implementation Details

- ~50 additional lines of code
- Minimal performance impact (modern browsers optimize MutationObserver)
- Debouncing prevents excessive state updates

---

## Critical Constraints

**MUST preserve existing list indentation behavior:**
- The Tab/Shift+Tab list item indentation logic (in `handleTabKey`) must continue to work correctly
- The `data-indentable` class behavior must not break
- Focus-based blur event handling should be complemented (not replaced) by MutationObserver

---

## Implementation Checklist

- [ ] Add MutationObserver to watch all contenteditable elements
- [ ] Implement debounce timer (500ms) for mutation updates
- [ ] Update `lastSavedContent` WeakMap on mutations
- [ ] Add visual indicator for unsaved changes
- [ ] Test DevTools inspector workflow
- [ ] Test list indentation (Tab/Shift+Tab)
- [ ] Verify no regressions in existing blur event handling
- [ ] Test with contenteditable div, span, list items, blockquotes, headings

---

## Definition of Done

✓ Changes made in DevTools inspector are automatically detected  
✓ Save button shows visual indicator when unsaved changes exist  
✓ List indentation (Tab/Shift+Tab) still works correctly  
✓ No regressions in existing functionality  
✓ Debouncing prevents excessive updates  

---

## File Locations

**Primary file to modify:**
- `/public/live-edit.js` - Add MutationObserver logic here

**Related files (do not modify unless necessary):**
- `src/components/SourceMap.astro` - Source tracking injection
- `edit-server/save-server.js` - Backend file writing
- `astro.config.mjs` - Remark plugin configuration

---

## Context: Live Edit System Architecture

The live-edit system tracks editable content through:

1. **Source location attributes**: Each editable element has `data-source-file` and `data-source-loc` (line:column format)
2. **Change detection**: Currently via blur events on contenteditable elements
3. **Saving**: Client sends POST to `localhost:3000/save` with edited content
4. **File writing**: Backend preserves Markdown frontmatter, converts HTML back to Markdown, or updates Astro tag content

The contenteditable elements are set up with `editableTags` configuration:
```javascript
const editableTags = 'p, span, ul, ol, div, blockquote, h1, h2, h3, h4, h5, h6';
```

---

**Created:** 2026-02-12  
**Developer:** In Progress  
**Branch:** exp/feature-better-change-detection-try#1

## Progress Log

**2026-02-12:** Experiment started, moving to implementation phase

**2026-02-12:** Implementation complete. Changes made to `/public/live-edit.js`:

### Changes Made
- **Extracted `trackChange(el)` function**: Shared change-tracking logic used by both blur events and MutationObserver, eliminating code duplication
- **Added MutationObserver**: Each contenteditable element gets an observer watching `childList`, `characterData`, and `subtree` mutations with 500ms debounce
- **Added `_suppressObserver` flag**: Prevents false positives during Tab/Shift+Tab list indentation (programmatic DOM changes)
- **Added `updateSaveIndicator()` function**: Save button shows yellow glow (`box-shadow`) and "💾 Save •" text when unsaved changes exist; resets after successful save
- **Added `transition` to save button style**: Smooth box-shadow animation

### Things NOT touched
- `edit-server/save-server.js` — no backend changes needed
- `src/components/SourceMap.astro` — source tracking unchanged
- `astro.config.mjs` — remark plugin unchanged
- All utility functions (`cleanPlusBeautifyHTML`, `markIndentableLists`, caret helpers, `isCaretInsideFirstLi`) — unchanged

### How it works
1. On DOMContentLoaded, each contenteditable element gets both a `blur` listener and a `MutationObserver`
2. When DOM changes are detected (typing, DevTools edits, etc.), the observer debounces at 500ms then calls `trackChange`
3. `trackChange` compares current `outerHTML` to last saved state, updates the `changes` array, and triggers the save button indicator
4. Tab indentation sets `_suppressObserver = true` to prevent observer noise during programmatic DOM manipulation
5. On save, the indicator resets to default appearance
