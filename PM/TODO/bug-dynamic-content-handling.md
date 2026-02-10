# Bug Fix: Dynamic Content & String Interpolation Handling

**Priority:** HIGH  
**Type:** Bug Fix  
**Files Affected:** 
- `/public/live-edit.js` (frontend)
- `edit-server/save-server.js` (backend)

---

## Problem Statement

In .astro files (and other Astro island formats like .jsx, .svelte), dynamic content like string interpolation, conditional rendering, and dynamic tags are currently not handled correctly:

**Examples of dynamic content:**
- `{tr("site.translatable", "fr")}` - i18n strings
- `{visible && <p>Show me!</p>}` - conditional rendering
- `const Element = 'div'; <Element>Hello!</Element>` - dynamic tags
- Full list: https://docs.astro.build/en/reference/astro-syntax/

**Current Issues:**
1. **Frontend:** Dynamic content is made contenteditable, allowing users to break the interpolation syntax
2. **Backend:** When saving, dynamic attributes are overwritten or corrupted instead of preserved

---

## Requirements

### Core Requirements

1. **Frontend - Make dynamic content non-editable:**
   - Detect interpolated content (text within `{...}`)
   - Mark these elements/regions as non-editable
   - Visual indicator that content is dynamic (grey out, or special styling)

2. **Backend - Preserve dynamic attributes:**
   - When receiving payloads, detect and preserve `{...}` expressions
   - Allow editing static content around dynamic parts
   - Never modify or remove interpolated expressions

### Exception: Editable i18n Strings

**Special handling for i18n patterns:**
- Pattern: `{tr("site.translatable", "fr")}` or similar i18n calls
- Allow editing the **referenced string** in the i18n file
- Preserve the function call syntax itself
- Same for conditional content: `{visible ? <p>Show me!</p> : <p>Else show me!</p>}`
  - Allow editing text inside tags without breaking conditional logic

---

## Approach

### Phase 1: Preserve Dynamic Content (Core Fix)

**Frontend (`/public/live-edit.js`):**
1. Add regex to detect `{...}` patterns in HTML
2. Wrap or mark these with `contenteditable="false"` or `data-dynamic="true"`
3. Exclude dynamic regions from being sent in payload

**Backend (`edit-server/save-server.js`):**
1. Before replacing content, extract all `{...}` expressions from original source
2. After HTML-to-Markdown conversion, re-inject preserved expressions
3. Test with various Astro syntax patterns

### Phase 2: i18n String Editing (Enhancement)

This can be tackled separately after core preservation works.

---

## Acceptance Criteria

- [ ] Dynamic content `{...}` is not made contenteditable in browser
- [ ] Editing static content around dynamic parts works correctly
- [ ] Backend preserves all `{...}` expressions when saving
- [ ] No regressions: existing Markdown/Astro editing still works

---

## Testing Checklist

1. Create .astro file with `{tr("key", "lang")}` - verify not editable
2. Edit text before/after interpolation - verify saves correctly
3. Create .astro with `{visible && <p>Text</p>}` - verify preserved
4. Edit text in .md file - verify still works as expected

---

**Created:** 2026-02-10  
**Status:** Ready for development
