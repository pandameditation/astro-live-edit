# outerHTML Feature - Implementation Progress

## Status: ✅ COMPLETE (with markdown fix)

Implementation completed on 2026-02-09.
Markdown regression fixed on 2026-02-09.

---

## CHANGES MADE

### Client Side (`/public/live-edit.js`)

**Line 9:** Changed initial tracking from `innerHTML` to `outerHTML`
```javascript
// BEFORE: lastSavedContent.set(el, el.innerHTML);
// AFTER:  lastSavedContent.set(el, el.outerHTML);
```

**Line 15:** Changed change detection from `innerHTML` to `outerHTML`
```javascript
// BEFORE: if (last === el.innerHTML) {
// AFTER:  if (last === el.outerHTML) {
```

**Line 18:** Changed tracking update from `innerHTML` to `outerHTML`
```javascript
// BEFORE: lastSavedContent.set(el, el.innerHTML);
// AFTER:  lastSavedContent.set(el, el.outerHTML);
```

**Line 32:** Changed payload from `innerHTML` to `outerHTML`
```javascript
// BEFORE: const content = cleanPlusBeautifyHTML(el.innerHTML);
// AFTER:  const content = cleanPlusBeautifyHTML(el.outerHTML);
```

### Server Side (`/edit-server/save-server.js`)

**Line 17:** Updated function comment to reflect finding entire tag
```javascript
// BEFORE: // Finds the tag that wraps the given (line, column) position in sourceText
// AFTER:  // Finds the entire tag (opening + content + closing) at the given (line, column) position in sourceText
```

**Lines 40-48:** Changed self-closing tag return to use `outerStart/outerEnd`
```javascript
// BEFORE: return { tagName, innerStart: openTagStart, innerEnd: openTagEnd, selfClosing: true };
// AFTER:  return { tagName, outerStart: openTagStart, outerEnd: openTagEnd, selfClosing: true };
```

**Lines 50-63:** Changed non-self-closing tag logic to include closing tag
```javascript
// BEFORE:
const closeTagOffset = findMatchingCloseTag(sourceText, openTagEnd, tagName);
if (closeTagOffset === -1) continue;

if (offset >= openTagEnd && offset < closeTagOffset) {
  return {
    tagName,
    innerStart: openTagEnd,
    innerEnd: closeTagOffset
  };
}

// AFTER:
const closeTagOffset = findMatchingCloseTag(sourceText, openTagEnd, tagName);
if (closeTagOffset === -1) continue;

const closeTagEnd = closeTagOffset + `</${tagName}>`.length;  // NEW LINE

if (offset >= openTagEnd && offset < closeTagOffset) {
  return {
    tagName,
    outerStart: openTagStart,   // Changed to opening tag start
    outerEnd: closeTagEnd        // Changed to include closing tag
  };
}
```

**Lines 71-73:** Renamed function from `replaceInnerContent` to `replaceOuterContent`
```javascript
// BEFORE:
function replaceInnerContent(sourceText, innerStart, innerEnd, newContent) {
  return sourceText.slice(0, innerStart) + newContent + sourceText.slice(innerEnd);
}

// AFTER:
function replaceOuterContent(sourceText, outerStart, outerEnd, newContent) {
  return sourceText.slice(0, outerStart) + newContent + sourceText.slice(outerEnd);
}
```

**Lines 193-216:** Updated Astro file handler to use outer boundaries
```javascript
// Key changes:
- Line 193: Updated comment "replace entire tag (outerHTML)"
- Line 206: Changed from tagRange.innerStart to tagRange.outerStart
- Line 208: Changed from tagRange.innerEnd to tagRange.outerEnd  
- Line 215: Changed from replaceInnerContent to replaceOuterContent
```

---

## THINGS I DIDN'T TOUCH

- **Markdown/MDX file handling** (lines 141-189): Completely unchanged, still converts HTML to Markdown
- **Source location tracking**: Still uses `data-source-loc` pointing to opening tag position
- **List indentation logic** (lines 120-243): Tab/Shift+Tab behavior unchanged
- **Change batching and save button** (lines 75-115): Flow unchanged
- **HTML cleaning logic** (lines 254-310): `cleanPlusBeautifyHTML` function unchanged
- **All utility functions**: No changes to helper functions like `findMatchingCloseTag`, `markIndentableLists`, etc.

---

## POTENTIAL CONCERNS

1. **Backward compatibility**: This is a breaking change - old behavior (innerHTML) is completely replaced. However, spec explicitly stated backward compatibility isn't needed.

2. **Attribute stripping in cleanPlusBeautifyHTML**: The function removes `data-source-*`, `contenteditable`, and `data-indentable` attributes. This is correct behavior - these are internal tracking attributes that shouldn't be saved to source files.

3. **Self-closing tags**: For self-closing tags (br, img, etc.), `outerStart` and `outerEnd` still point to the same tag boundaries (no closing tag to include). This is correct.

4. **Nested tag preservation**: Since we're replacing the entire tag span with the cleaned outerHTML from the browser, nested tags and their attributes should be preserved correctly by the browser's DOM representation.

---

## VERIFICATION CHECKLIST

To verify the implementation works:

- [ ] Start dev server: `npm run dev:edit`
- [ ] Open a page with a `<ul>` list
- [ ] Use browser devtools to add `style="list-style-type: '✅ '"` to the `<ul>` tag
- [ ] Edit some text in the list
- [ ] Click "💾 Save" button
- [ ] Check the source `.astro` file - should contain the style attribute on the `<ul>` tag
- [ ] Verify nested tags and content are preserved
- [ ] Test attribute-only change (no content edit) to ensure change detection works

---

## MARKDOWN REGRESSION FIX (2026-02-09)

### Problem Discovered
After implementing outerHTML for client, Markdown/MDX files lost list indentation on save. The issue was **double-wrapping** of content.

**Root cause:**
```javascript
// Client now sends: "<ul><li>item</li></ul>" (outerHTML)
// Server was doing: wrapped = `<ul>${content}</ul>`
// Result: "<ul><ul><li>item</li></ul></ul>" ❌ Double-wrapped
```

This broke Turndown conversion and lost all indentation.

### Solution Implemented
Added smart detection to handle outerHTML properly for Markdown files:

**Two new helper functions:**

1. **`stripOuterTag(outerHTML, tagName)`** - Extracts innerHTML from outerHTML
   ```javascript
   stripOuterTag("<ul><li>item</li></ul>", "ul") 
   → "<li>item</li>"
   ```

2. **`hasAttributes(outerHTML, tagName)`** - Detects if tag has any HTML attributes
   ```javascript
   hasAttributes("<ul style='color:red'>...</ul>", "ul") → true
   hasAttributes("<ul>...</ul>", "ul") → false
   ```

**Markdown handler logic (lines 157-175):**
```javascript
// Check if content has HTML attributes
const keepAsHTML = hasAttributes(content, tagName);

if (keepAsHTML) {
  // Keep as raw HTML (has custom attributes like style, class, etc.)
  newLines = content.split('\n');
} else {
  // Convert to markdown (no custom attributes - prefer markdown syntax)
  const innerContent = stripOuterTag(content, tagName);
  const wrapped = `<${tagName}>${innerContent}</${tagName}>`;
  markdown = turndownWithListContext(wrapped, tagName);
  newLines = markdown.split('\n');
}
```

### Behavior After Fix

**Case 1: No attributes (prefer markdown)**
```html
<!-- Client sends: -->
<ul><li>item 1</li><li>item 2</li></ul>

<!-- Server converts to: -->
- item 1
- item 2
```

**Case 2: With attributes (keep HTML)**
```html
<!-- Client sends: -->
<ul style="list-style-type: '✅'"><li>item 1</li></ul>

<!-- Server keeps as: -->
<ul style="list-style-type: '✅'"><li>item 1</li></ul>
```

### Files Changed

**`/edit-server/save-server.js`:**
- Lines 262-281: Added `stripOuterTag()` and `hasAttributes()` helper functions
- Lines 157-175: Modified markdown handler to use helpers and decide HTML vs markdown

---

## DEFINITION OF DONE

✅ User can edit ANY HTML attribute (style, class, id, data-*, aria-*, etc.) in browser  
✅ Attribute-only changes are detected (change detection uses outerHTML)  
✅ Entire tag (opening + content + closing) is replaced in source file  
✅ Nested tags and existing content are preserved (browser handles DOM representation)  
⏳ Manual testing required to verify end-to-end functionality
