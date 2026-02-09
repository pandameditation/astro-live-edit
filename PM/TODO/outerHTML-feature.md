# Enable Attribute Editing for Astro Files (outerHTML)

## Problem
Users cannot edit HTML attributes (style, class, id, data-*, etc.) in the browser because we only send and replace the **inner content** of tags. If a user adds `style="list-style-type: '✅ '"` to a `<ul>` in the browser, it won't persist to the source file.

## Solution
Switch from `innerHTML` to `outerHTML` for Astro files, so the entire tag (including all attributes) is sent to the server and replaced in the source file.

**This enables editing ALL HTML attributes** - style, class, id, data-*, aria-*, custom attributes, etc.

---

## Scope

### IN SCOPE (What Changes)

**Client Side (`/public/live-edit.js`):**
- Line 9: Change initial tracking from `innerHTML` → `outerHTML`
- Line 15: Change detection comparison from `innerHTML` → `outerHTML`
- Line 18: Change tracking update from `innerHTML` → `outerHTML`
- Line 25+: Change payload from `innerHTML` → `outerHTML`

**Server Side (`/edit-server/save-server.js`):**
- Function `findTagAtPosition` (lines 17-67): Change to find entire tag boundaries (opening tag start → closing tag end)
- Function `replaceInnerContent` (lines 70-72): Rename to `replaceOuterContent`, replace entire tag span
- Astro file handler (lines 195-214): Use new outer boundaries when replacing content

### OUT OF SCOPE (What Stays the Same)

- **Markdown/MDX file handling**: Still converts HTML to Markdown, unchanged
- **Source location tracking**: Still points to opening tag position (`data-source-loc`)
- **List indentation, beautification, save button**: Client-side logic unchanged
- **Change grouping and saving flow**: Still collects changes on blur, sends on button click

---

## Implementation Details

### Step 1: Client Changes (`/public/live-edit.js`)

**Current behavior (lines 7-18):**
```javascript
document.querySelectorAll(editableTags).forEach(el => {
  el.contentEditable = true;
  lastSavedContent.set(el, el.innerHTML);  // ❌ Only tracks content

  el.addEventListener('blur', () => {
    const last = lastSavedContent.get(el);
    if (last === el.innerHTML) {            // ❌ Misses attribute changes
      return;
    }
    lastSavedContent.set(el, el.innerHTML); // ❌ Only updates content
    // ... send changes
  });
});
```

**New behavior:**
```javascript
document.querySelectorAll(editableTags).forEach(el => {
  el.contentEditable = true;
  lastSavedContent.set(el, el.outerHTML);  // ✅ Tracks entire tag

  el.addEventListener('blur', () => {
    const last = lastSavedContent.get(el);
    if (last === el.outerHTML) {            // ✅ Detects attribute changes
      return;
    }
    lastSavedContent.set(el, el.outerHTML); // ✅ Updates entire tag
    // ... send changes
  });
});
```

**And where we send to server (~line 32+):**
```javascript
// BEFORE:
const content = cleanPlusBeautifyHTML(el.innerHTML);

// AFTER:
const content = cleanPlusBeautifyHTML(el.outerHTML);
```

---

### Step 2: Server Changes (`/edit-server/save-server.js`)

**Current `findTagAtPosition` behavior (lines 40-62):**
```javascript
if (isSelfClosing) {
  if (offset >= openTagStart && offset <= openTagEnd) {
    return {
      tagName,
      innerStart: openTagStart,  // ❌ Points to opening tag start
      innerEnd: openTagEnd,      // ❌ Points to opening tag end
      selfClosing: true
    };
  }
} else {
  const closeTagOffset = findMatchingCloseTag(sourceText, openTagEnd, tagName);
  if (closeTagOffset === -1) continue;

  if (offset >= openTagEnd && offset < closeTagOffset) {
    return {
      tagName,
      innerStart: openTagEnd,    // ❌ Points AFTER opening tag (content start)
      innerEnd: closeTagOffset   // ❌ Points BEFORE closing tag (content end)
    };
  }
}
```

**New behavior:**
```javascript
if (isSelfClosing) {
  if (offset >= openTagStart && offset <= openTagEnd) {
    return {
      tagName,
      outerStart: openTagStart,  // ✅ Opening tag start
      outerEnd: openTagEnd,      // ✅ Opening tag end (same for self-closing)
      selfClosing: true
    };
  }
} else {
  const closeTagOffset = findMatchingCloseTag(sourceText, openTagEnd, tagName);
  if (closeTagOffset === -1) continue;

  const closeTagEnd = closeTagOffset + `</${tagName}>`.length;  // ✅ NEW: Include closing tag

  if (offset >= openTagEnd && offset < closeTagOffset) {
    return {
      tagName,
      outerStart: openTagStart,  // ✅ Opening tag start (<ul style="...">)
      outerEnd: closeTagEnd      // ✅ Closing tag end (</ul>)
    };
  }
}
```

**Replace function (lines 70-72):**
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

**Astro handler usage (lines 198-213):**
```javascript
// BEFORE:
const tagRange = findTagAtPosition(sourceText, start.line, start.column, tagName);
const oldContent = sourceText.slice(tagRange.innerStart, tagRange.innerEnd);
sourceText = replaceInnerContent(sourceText, tagRange.innerStart, tagRange.innerEnd, content);

// AFTER:
const tagRange = findTagAtPosition(sourceText, start.line, start.column, tagName);
const oldContent = sourceText.slice(tagRange.outerStart, tagRange.outerEnd);
sourceText = replaceOuterContent(sourceText, tagRange.outerStart, tagRange.outerEnd, content);
```

---

### Step 3: Test

1. Open a page with a list in dev mode
2. In browser, add `style="list-style-type: '✅ '"` to the `<ul>` tag (use browser devtools to verify it's there)
3. Edit some text in the list
4. Click save button
5. Check source `.astro` file - should see:
   ```html
   <ul style="list-style-type: '✅ '">
     <li>Updated text</li>
   </ul>
   ```

---

## Definition of Done

- [ ] User can edit ANY HTML attribute (style, class, id, data-*, aria-*, etc.) in browser
- [ ] Attribute-only changes are detected (no content change needed)
- [ ] Entire tag (opening + content + closing) is replaced in source file
- [ ] Nested tags and existing content are preserved
- [ ] Test passes: add `style="list-style-type: '✅ '"` to a `<ul>`, save, verify in source file