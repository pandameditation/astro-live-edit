❯ The problem is that if the user changes things in the browser's inspector, it doesn't
  update the payload. User then have to go inside a field and do modifications for the payload to
   update(client-side). Please look into this mechanism and propose improvements (this is because of the blur event which is not appropriate)

RECOMMENDATION:

  Use MutationObserver with debouncing to detect changes:

   1. Watch all contenteditable elements for attribute/content changes
   2. Debounce rapid changes (wait 500ms after last change)
   3. Update the tracked state and payload automatically
   4. Show a visual indicator when changes are detected

  This makes the DevTools inspector workflow seamless - change attributes, see them detected,
  click save.

  How it works:

   - MutationObserver watches each element as they get modified
   - Debounce (500ms) updates changes array after user stops editing
   - Save button sends accumulated changes

  Pros:

   - User gets feedback that changes are detected (console logs)
   - Can implement "unsaved changes" indicator (yellow dot on save button)
   - Changes array always up-to-date
   - Can add "undo" functionality later

  Cons:

   - More complex code (~50 lines)
   - Observer overhead (though minimal)
   - Constantly updating internal state
   - Might capture unwanted intermediate states
