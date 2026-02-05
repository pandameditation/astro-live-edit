Please look at the codebase and copilot-instructions.md and generate a plan for the new
  change: 
  **For Astro files**:
  BEFORE:  Replaces only the inner content of the tag, preserving the tag structure.
  AFTER: Replaces outerHTML, so that it can work when user modifies the structure of the tag.
  For example, if the user wants to modify <ul> style they will now be able to do so by adding
  `style="list-style-type: '✅ ' "` to the <ul> tag. That means that the way to find beginning
  and end of the tag in save-server.js should completely change its logic to accomodate for
  receiving outerHTML instead of innerHTML from the client.

  CLARIFICATIONS:

   1. The client should send outerHTML instead of innerHTML - This means the client is sending
  the entire tag including attributes like <ul style="list-style-type: '✅ '">...</ul>
   2. The server logic should replace the entire tag (not just inner content) - For Astro files,
  we need to find the opening tag, find its closing tag, and replace the entire span from
  <tag...> to </tag>
   3. Markdown files behavior remains unchanged - Only Astro files need this modification (they
  already work by converting to markdown)
   4. Source location tracking stays the same - The data-source-loc still points to where the
  opening tag begins
   5. Backward compatibility isn't needed - We're changing the behavior, not supporting both
  modes
  6. The change detection on the client (lines 15-18) should now rely on outerHTML, since
  we're sending outerHTML, so that attribute-only changes will be detected.

   PLAN:

   1. Modify client (public/live-edit.js) - Change from sending innerHTML to outerHTML
   2. Modify server (edit-server/save-server.js) - Change the Astro file handler to:
    - Find the opening tag at the specified location
    - Find its matching closing tag (using existing nesting logic)
    - Replace the entire tag span (opening tag + content + closing tag) with the new outerHTML
   3. Update the API contract - The POST body should include outerHTML instead of just content

   CHANGES MIGHT LOOK LIKE THIS:

  /public/live-edit.js (line 25):

   - Changed from cleanPlusBeautifyHTML(el.innerHTML) to cleanPlusBeautifyHTML(el.outerHTML)
   - Now sends the entire tag including attributes (e.g., <ul style="...">...</ul>)
      1. Line 9: Changed lastSavedContent.set(el, el.innerHTML) → lastSavedContent.set(el,
  el.outerHTML)
    - Initial save now tracks the entire tag
   2. Line 15: Changed if (last === el.innerHTML) → if (last === el.outerHTML)
    - Change detection now includes attribute changes
   3. Line 18: Changed lastSavedContent.set(el, el.innerHTML) → lastSavedContent.set(el,
  el.outerHTML)
    - Updates tracking with entire tag
   4. Line 25: Changed cleanPlusBeautifyHTML(el.innerHTML) → cleanPlusBeautifyHTML(el.outerHTML)
    - Sends complete tag structure to server

  /edit-server/save-server.js:

   - Function findTagAtPosition (lines 17-69): Renamed properties from innerStart/innerEnd to
  outerStart/outerEnd and updated comment to reflect it now finds the entire tag
   - Added line 55: Calculates closeTagEnd to include the closing tag (</${tagName}>.length)
   - Updated return values: Now returns outerStart (beginning of opening tag) and outerEnd (end
  of closing tag)
   - Function replaceOuterContent (lines 71-73): Renamed from replaceInnerContent - replaces the
  entire tag span
   - Astro file handler (lines 144-158): Updated to call replaceOuterContent instead of
  replaceInnerContent
   1. Line 17: Updated comment to reflect it finds "entire tag (opening + content + closing)"
   2. Lines 45-46, 61-62: Renamed innerStart/innerEnd → outerStart/outerEnd
    - Returns positions of complete tag boundaries
   3. Line 55: Added closeTagEnd calculation to include closing tag length
   4. Lines 71-73: Renamed function replaceInnerContent → replaceOuterContent
    - Replaces entire tag span instead of just content
   5. Line 147: Updated comment to clarify "replace entire tag (outerHTML)"
   6. Line 157: Changed to call replaceOuterContent with outerStart/outerEnd
  

  THINGS YOU SHOULDN'T TOUCH:

   - Markdown/MDX file handling: Still works the same way (converts HTML to Markdown)
   - Change tracking logic: Still uses innerHTML for change detection (only the sent content uses
   outerHTML)
   - Source location tracking: Still points to the opening tag position
   - All other client-side logic: List indentation, beautification, etc.

  POTENTIAL CONCERNS:

   1. Change detection still uses innerHTML: The lastSavedContent.set(el, el.innerHTML) still
  tracks innerHTML. This means if a user ONLY changes an attribute (like adding a style), it
  won't be detected as a change. Should I update this to track outerHTML as well?

  DEFINITION OF DONE:

   - Users can modify tag attributes (like <ul style="list-style-type: '✅ '">) in the browser
   - The entire tag (opening + content + closing) gets replaced in the source file
   - Existing content and nested tags are preserved