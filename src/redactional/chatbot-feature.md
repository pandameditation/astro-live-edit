Please look at the codebase and copilot-instructions.md and generate a plan for the new
  change: 
  **For Astro files**:
  BEFORE:  Replaces only the inner content of the tag, preserving the tag structure.
  AFTER: Replaces outerHTML, so that it can work when user modifies the structure of the tag.
  For example, if the user wants to modify <ul> style they will now be able to do so by adding
  `style="list-style-type: '✅ ' "` to the <ul> tag. That means that the way to find beginning
  and end of the tag in save-server.js should completely change its logic to accomodate for
  receiving outerHTML instead of innerHTML from the client.