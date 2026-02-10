# Bug Fix: Dynamic Content Handling — Phase 1 Progress

**Status:** Implementation complete, pending manual testing  
**Date:** 2026-02-10

---

## Changes Made

### `src/components/SourceMap.astro`
- Added server-side scanning of all `.astro` files in `src/` to detect lines containing `{…}` template expressions in element content (not attributes)
- Builds an array of `"absolutePath:lineNumber"` strings and passes it to the client via `define:vars`
- Client script now marks matching elements with `data-dynamic="true"` after copying source attributes
- Heuristic: strips HTML tags from line, checks remaining text for `{…}` patterns to avoid false positives from attribute-only expressions like `style={{...}}`

### `public/live-edit.js`
- Elements with `data-dynamic="true"` get `contenteditable="false"` instead of `true`
- Visual indicators: opacity 0.6, cursor `not-allowed`, tooltip explaining "Dynamic content — not editable in browser"
- These elements are excluded from change tracking (no blur listener, no WeakMap entry)

### `edit-server/save-server.js`
- Backend safety net: before replacing an `.astro` tag's content, extracts the innerHTML from original source and checks for `{…}` expressions
- If dynamic expression found, the edit is SKIPPED with a warning log, preserving the original source

## Things Not Touched
- Markdown/MDX processing: no changes to the markdown path
- List indentation logic: untouched
- Remark plugin in `astro.config.mjs`: untouched

## Potential Concerns
- The `{…}` detection heuristic uses regex — it won't handle deeply nested or multi-line expressions. This is acceptable for Phase 1.
- The "strip tags then check" approach may have edge cases with text content that literally contains `{` and `}` (rare in practice)
- `define:vars` serializes the full array of dynamic locations on every page — minimal overhead for small projects but could grow
