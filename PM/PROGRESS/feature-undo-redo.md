# Feature: Version History for Edit Sessions

**Status:** In Progress  
**Priority:** High  
**Complexity:** High  
**Started:** 2026-02-12  
**Branch:** `exp/undo-redo-try#1`

---

## New philosophy
The way new restore points are created ATM is very confusing for the users. We propose a refactoring to improve the UX.
1. When the user saves, it creates a new snapshot that can be restored.
2. When the user restores from a snapshot, we don't want to save a new snapshot "Before restore to vX". We are OK with losing those transient changes.
3. This way, this is easier to reason about what versions are in the version history, because there are way less versions.
4. There is no "Baseline" version: this is now "Origin" version.
5. There is a new way to track diff: the "Currently editing" shows the diff with the latest "Checkpoint". The checkpoint is the latest saved version, or (if this happened) the latest restored version. There can be only one checkpoint (the most recent event between last save and last restore) that acts as the reference for the diff calculation.
6. When we restore from a version successfully, it displays text in the card: "No changes
  in this version". Instead it should display: "Checkpoint" and the card should have a yellow
  background and border to highlight that. Also a little glowing yellow dot indicator next to
  the "vX" label should show that it is the checkpoint.
7. The "Checkpoint" version should be recomputed after save or restore action takes place. The checkpoint id should be the latest saved version, or the latest restored version.
8. It doesn't make any sense to restore the current checkpoint (we are already on it). It doesn't
  make sense to delete the checkpoint either. Also, there should be no diff on the checkpoint
  (we are comparing each version to the checkpoint, so no diff here). Also, the origin should
  not show any diff when it is created, since it should also be the checkpoint at creation time.
  Please remove the checkpoint restore and delete buttons, make sure the diff are checked
  against the checkpoint, and make sure the origin is the original checkpoint when we start
  creating versions.

---


## Progress & Commits

- ✅ Experiment started, feature moved to PROGRESS
- ✅ Phase 1: Server-side versioning core complete (diff.js, versions.js, all API endpoints)
- ✅ Phase 2: Client-side UI complete (save-button, version-sidebar, version-card components)
- ✅ Phase 3: Version detail, diffs, restore — all wired up
- ✅ Phase 4: Version management (delete all, editable labels, auto-labeling)

---

## Challenges & Lessons Learned

### 1. JSDoc comment fragmentation during edit
When inserting the `updateLabel` function above `restoreVersion`, the edit tool split the existing JSDoc comment for `restoreVersion`, leaving orphaned `* ...` lines outside any comment block. This caused a `SyntaxError: Unexpected token '*'` at runtime. **Lesson:** When inserting code above a function that has a JSDoc comment, include the full JSDoc in the replacement to avoid fragmentation.

### 2. `const` hoisting / temporal dead zone
The original refactor placed `updateSaveIndicator()` (which references `saveButtonUI`) above where `saveButtonUI` was declared with `const`. While `function` declarations are hoisted, `const` bindings are not — they exist in the "temporal dead zone" until their declaration is evaluated. If a `MutationObserver` fired during element setup (between the function definition and the `const` declaration), it would crash. **Fix:** Moved `saveButtonUI` creation above all code that references it, before the element setup loop.

### 3. Script loading: `is:inline` vs `type="module"`
`live-edit.js` was loaded as `<script is:inline src="/live-edit.js" />` — a plain script, not a module. ES `import` statements don't work in non-module scripts. Changed to `<script is:inline type="module" src="/live-edit.js" />`. The `_suppressObserver` variable (previously a true global `let`) becomes module-scoped, but since it's only used within `live-edit.js` itself, this is safe.

### 4. Port conflicts during testing
The edit server uses port 3000. Testing with `node edit-server/save-server.js` while a previous instance was still running caused `EADDRINUSE`. **Lesson:** Always check for and kill existing processes on the target port before starting a new server instance during testing.

---

## Summary

Create a comprehensive version history system for the live editor. Every time a user presses Save, the current state of all edited files is captured as a version snapshot. Users can browse past versions (displayed as UI cards), see what changed (files, diffs, metadata), and restore any previous version by clicking on the card.

Think of it as a lightweight version control system built into the editor—safe exploration without risk.

---

## Context

Currently, when users save edits, there's no record of previous states. If they want to see what the content looked like yesterday or revert to an earlier version, they're stuck. This feature creates an immutable audit trail of every save, allowing users to confidently edit knowing they can always travel back in time.

---

## Scope & Behavior

### In Scope
- **Version snapshots**: On every Save button click, create a versioned snapshot of all modified files
- **Baseline version**: Create a "v0" baseline snapshot when the user first loads the editor (represents original state before any edits)
- **Persistent storage**: Store versions on disk (edit-server manages a `.versions/` directory per project)
- **Unlimited history**: Keep all versions forever (up to 5Mo of storage), with UI option to manually prune old history and delete specific versions if desired.
- **Version metadata**:
  - Auto-generated ID (v1, v2, v3...)
  - Timestamp (when saved)
  - Optional user-provided label/name
  - List of changed files with relative paths
- **Version detail cards**:
  - Show filename + relative path
  - Show file-by-file diff summaries (expandable)
  - Show full diffs (expandable)
- **Version travel**: User can click a version card to open it live
- **Restore capability**: View past version → optionally edit it → click "Save as New" to make it current version.
- **Read/explore**: While viewing a past version the user can come back to the most recent version easily.

### Out of Scope
- Integration with git (separate from version control)
- Diff view before saving to disk (versions capture state after save)
- Automatic version creation (only on manual Save click)
- Team/multi-user collaboration features

---

## Acceptance Criteria

1. ✅ On first page load, create "Baseline" version (v0) showing original file state
2. ✅ Each Save button click creates a new version with auto-ID and timestamp
3. ✅ Versions stored on disk in `edit-server/.versions/` (or similar), persistent across sessions
4. ✅ Version history UI shows card list: file count, timestamp, optional label, expandable diff preview
5. ✅ User can click a version card to view it.
6. ✅ User can edit a viewed version and click "Save as New" to make it current
7. ✅ Version card shows which files changed (additions/modifications/deletions if applicable)
8. ✅ Full diff expandable per file (show exact changes)
9. ✅ User can optionally delete old versions to prune history (configurable UI or limit)
10. ✅ UI clearly distinguishes "current/live version" from "historical versions"

---

## Technical Approach

### Client Side (`/public/live-edit.js`)
1. Add "Version History" button/sidebar to UI (list all versions)
2. On click, fetch version list from `/api/versions` endpoint
3. Render version cards with metadata + expandable diffs
4. On version click, fetch version details from `/api/versions/{id}` and load into editor (read-only mode initially)
5. Add "Save as New Version" button when viewing historical version
6. Clicking "Save as New Version" sends current state to `/save` endpoint (as usual), server creates new version

### Server Side (`edit-server/save-server.js`)
1. Create `.versions/` directory in project root (if not exists)
2. On Save request:
   - Capture version metadata (files changed, timestamp)
   - Save full file snapshots to `.versions/v{n}/` directory
   - Generate `manifest.json` with version ID, timestamp, file list, optional label
3. New endpoints:
   - `GET /api/versions` - List all versions with metadata (lightweight response)
   - `GET /api/versions/{id}` - Fetch specific version details including diffs
   - `DELETE /api/versions/{id}` - Delete old version
4. Store versions as directory structure:
   ```
   .versions/
     v0/
       manifest.json
       files/
         src/pages/index.astro
         src/content/post.md
         ...
     v1/
       manifest.json
       files/
         ...
   ```

### Diff Generation
- When fetching version details, compute diffs between versions (current vs previous, or any two versions)
- Use an in-house equivalent of `diff` library (e.g., `diff-match-patch` or similar) to generate human-readable diffs per file (we don't want external dependency)
- Cache diffs in manifest to avoid recomputation

---

## Key Files Affected

- `/public/live-edit.js` - Add version UI, history modal/sidebar
- `edit-server/save-server.js` - Main versioning logic, endpoint handlers
- `edit-server/package.json` - May need diff library dependency
- No changes needed to Astro config (versioning is edit-server feature)

---

## For Developer

0. UI Design System: each time you need a new UI component, make it a specific .js file that will load the specific component (HTML+CSS+JS) when needed. We are using Vanilla JS here.
0.1 We refactor components to make them reusable when we see a fit.
0.2 The design system CSS will rely on inline style attributes instead. We will prefix these attributes with "ale-*" for astro-live-edit.
1. UI layout: Version history is a right-sidebar vertical panel (limited width), and "Save" is now a "menu button" that shows the option to "See versions" when clicked on the chevron part.
2. Auto-label versions: Versions should auto-label by content (e.g., "Updated 3 files") and can be modified by user input.
3. Diff detail: Show only the files that have diff, and when the user clicks on the files name, show an extract of the lines that have a diff, line-by-line.
4. Performance: If there are 100+ versions, lazy-load should be added to history list, so that we can keep scrolling in the list.
5. Cleanup: User can delete specific version, limit the number of saved versions in the history, and delete all versions, by clicking on a "⋮" UI button that will enable it.


##  Checkpoint #1

  <overview>
  The user is building a **Version History system** for the Astro Live Edit project — a
  lightweight version control built into the browser-based editor. Every Save creates a snapshot,
   users can browse versions in a sidebar, see file-level diffs, and restore any previous
  version. The approach was phased: server-side versioning core first (storage, API endpoints,
  diff algorithm), then client-side UI (save menu button, version sidebar, version cards with
  expandable diffs). The project uses vanilla JS (no frameworks), inline styles prefixed with
  `ale-*`, and separate `.js` component files.
  </overview>

  <history>
  1. User said "Let's start working on the undo-redo feature"
     - Explored codebase: `live-edit.js`, `save-server.js`, `SourceMap.astro`,
  `BaseLayout.astro`, PM files
     - Found existing spec at `PM/PROGRESS/feature-undo-redo.md` with detailed requirements
     - Created implementation plan in session workspace `plan.md`
     - Asked 3 clarifying questions: diff approach (in-house LCS), baseline files (only rendered
  page files), build order (server-first)
     - **Phase 1 (Server):** Created `edit-server/diff.js` (LCS line diff),
  `edit-server/versions.js` (version storage module), added 7 API endpoints to `save-server.js`,
  hooked version creation into `POST /save`
     - **Phase 2 (Client):** Created `public/components/save-button.js` (menu button with
  chevron), `public/components/version-card.js` (expandable card with diffs),
  `public/components/version-sidebar.js` (right panel). Rewired `live-edit.js` to use new
  components, changed script to `type="module"`, added baseline creation on page load
     - All endpoints tested with curl, build verified passing

  2. User asked for a delete button on version cards (trash icon, red background, right of
  restore button)
     - Added `onDelete` param to `renderDiffDetails` in `version-card.js`
     - Created flex row with restore button + 🗑 delete button (`#5a2a2a` background)
     - Updated both `renderDiffDetails` call sites in `version-sidebar.js` to pass `onDelete:
  deleteAndReload`

  3. User asked to skip creating versions with no content changes
     - Modified `createVersion` in `versions.js` to compare snapshotted files byte-for-byte
  against previous version
     - If all files identical, removes snapshot directory and returns `null`
     - Updated `save-server.js` to handle `null` return gracefully
     - Tested: confirmed duplicate saves produce no version entry

  4. User reported CORS error on `POST /api/versions/baseline`
     - Investigated: `cors()` middleware was present and working (verified with curl + Origin
  header)
     - Swapped middleware order: `cors()` now runs **before** `express.json()` so CORS headers
  are sent even if JSON parsing fails
     - Likely root cause was edit server not running when page loaded; the try/catch in
  `createBaselineFromPage` already handles this gracefully

  5. User reported UI elements (save button, sidebar, cards) getting `contentEditable` injected
     - Root cause: `document.querySelectorAll(editableTags)` matched all `p`, `div`, `span` etc.
  including our UI
     - Fix: Added `if (!el.getAttribute('data-source-file')) return;` guard before making
  elements editable — only source-tracked content gets `contentEditable`

  6. User asked to remove all confirm/alert dialogs from Restore flow
     - Removed `confirm()` before restore in `version-card.js`
     - Removed `alert()` after restore and replaced error `alert()` with `console.error` in
  `version-sidebar.js`
     - Restore now just executes and reloads silently

  7. User asked for a "Currently editing" card always at top of sidebar
     - Added a static card with blue accent (`#68f` border, `#8af` text), no version number, no
  action buttons
     - Always renders first in the card list, before all version cards

  8. User asked for diffs to be shown in the "Currently editing" card (diff against most recent
  saved version)
     - Confirmed: diff against most recent saved/restored version
     - **Server:** Added `getCurrentDiff()` to `versions.js` — reads live files on disk, diffs
  against latest version snapshot
     - **Server:** Added `GET /api/versions/current-diff` endpoint in `save-server.js` (placed
  BEFORE `:id` route to avoid param matching)
     - **Client:** Made "Currently editing" card clickable, fetches and renders diff on click
     - **Issue discovered but not yet fixed:** `renderDiffDetails` renders restore/delete action
  buttons at the bottom, which are inappropriate for the "Currently editing" card (passed no-op
  handlers as workaround)
  </history>

  <work_done>
  Files created:
  - `edit-server/diff.js`: In-house LCS line diff algorithm (~120 lines, no dependencies)
  - `edit-server/versions.js`: Version storage module (baseline, create, list, details, delete,
  deleteAll, restore, updateLabel, getCurrentDiff)
  - `public/components/save-button.js`: Menu button with Save + chevron for version history
  - `public/components/version-card.js`: Version card with timestamp, editable label, file count,
   expandable per-file diffs, restore + delete buttons
  - `public/components/version-sidebar.js`: Right sidebar panel with "Currently editing" card,
  version list, manage menu, baseline creation

  Files modified:
  - `edit-server/save-server.js`: Added `import * as versions`, swapped cors/json middleware
  order, hooked version creation into POST /save (with null handling for no-change saves), added
  8 API endpoints
  - `public/live-edit.js`: Added ES module imports, replaced old save button with new components,
   added `data-source-file` guard for contenteditable, added baseline + sidebar wiring
  - `src/components/SourceMap.astro`: Changed `<script is:inline src="/live-edit.js" />` to
  `<script is:inline type="module" src="/live-edit.js" />`
  - `.gitignore`: Added `edit-server/.versions/`
  - `PM/PROGRESS/feature-undo-redo.md`: Updated with progress, challenges & lessons learned

  Work completed:
  - [x] In-house line diff (LCS-based)
  - [x] Version storage system (.versions/ directory with manifests and file snapshots)
  - [x] All server API endpoints (baseline, list, details, delete, deleteAll, restore,
  updateLabel, current-diff)
  - [x] Auto-skip versions with no content changes
  - [x] Save menu button with chevron
  - [x] Version sidebar with card list
  - [x] "Currently editing" card with live diff
  - [x] Version cards with expandable per-file diffs
  - [x] Restore (silent, no dialogs) and delete functionality
  - [x] Editable labels (double-click to rename)
  - [x] Auto-labeling ("Updated N files")
  - [x] "⋮" manage menu with "Delete all versions"
  - [x] CORS fix
  - [x] ContentEditable exclusion for UI elements
  - [ ] **INCOMPLETE:** "Currently editing" card shows restore/delete buttons via
  `renderDiffDetails` — needs fix

  Current state: Build passes, both servers start successfully, all endpoints tested via curl.
  The "Currently editing" card's diff display inappropriately shows restore/delete buttons (no-op
   handlers passed as workaround).
  </work_done>

  <technical_details>
  **Architecture:**
  - Two separate Node.js apps: Astro dev server (port 4321) and edit server (port 3000)
  - Version snapshots stored in `edit-server/.versions/v{N}/files/` with a global `manifest.json`
  - Client components are vanilla JS ES modules under `public/components/`, loaded via
  `live-edit.js`

  **Key decisions:**
  - In-house LCS diff (no external dependency) — ~120 lines, produces hunked output with context
  lines
  - Version IDs are sequential integers (v0, v1, v2...), v0 is always the baseline
  - Empty versions (no content diff) are automatically discarded at creation time
  - `cors()` middleware placed BEFORE `express.json()` to ensure CORS headers on parse errors
  - `GET /api/versions/current-diff` route must be defined BEFORE `GET /api/versions/:id` to
  avoid Express matching "current-diff" as an `:id` param

  **Issues encountered and resolved:**
  1. **JSDoc comment fragmentation:** Inserting code above a JSDoc-commented function can orphan
  the comment, causing `SyntaxError: Unexpected token '*'`. Fix: include full JSDoc in
  replacement.
  2. **`const` temporal dead zone:** `updateSaveIndicator()` referenced `saveButtonUI` before its
   `const` declaration. Fixed by moving creation above all references.
  3. **`is:inline` to `type="module"`:** `live-edit.js` needed ES module imports, requiring
  `type="module"` on the script tag. Module scripts are deferred by default. `_suppressObserver`
  becomes module-scoped (safe, only used internally).
  4. **Port conflicts:** Must kill existing process on port 3000 before starting test server.
  5. **UI elements getting contenteditable:** Fixed by checking `data-source-file` attribute
  before making elements editable.

  **Spec conventions (from PM/PROGRESS/feature-undo-redo.md):**
  - UI components: separate .js files, inline styles, vanilla JS
  - Design system CSS uses inline style attributes (prefix `ale-*` for astro-live-edit)
  - Baseline captures only files currently rendered on the page (from `data-source-file`
  attributes)
  - 5MB storage limit for `.versions/` directory
  - No git integration

  **Unresolved issue:**
  - `renderDiffDetails()` in `version-card.js` always renders restore + delete action buttons at
  the bottom. When called for the "Currently editing" card, these buttons appear but have no-op
  handlers. This needs to be fixed (likely by making the buttons conditional via an options
  parameter).
  </technical_details>

  <important_files>
  - `edit-server/save-server.js`
     - Main server: Express app with save logic + all version API endpoints
     - Added: `import * as versions`, cors before json, version creation hook in POST /save, 8
  new endpoints
     - Key sections: middleware (lines 8-10), POST /save hook (lines ~348-362), version API
  routes (lines ~375-445)

  - `edit-server/versions.js`
     - Version storage module: all CRUD operations, baseline, restore, getCurrentDiff
     - Functions: createBaseline, createVersion (with empty-version skip), listVersions,
  getVersionDetails, deleteVersion, deleteAllVersions, updateLabel, restoreVersion,
  getCurrentDiff
     - Storage path: `edit-server/.versions/`

  - `edit-server/diff.js`
     - In-house LCS line diff algorithm
     - Exports: `diffLines(oldText, newText)` → `{ hunks, stats }`, `formatDiff(diffResult)` →
  string

  - `public/live-edit.js`
     - Main client script: change tracking, contenteditable setup, save button + sidebar wiring
     - Key changes: ES module imports (lines 1-2), save button + sidebar created early (lines
  13-63), `data-source-file` guard (line 105), baseline call (line 131)

  - `public/components/version-sidebar.js`
     - Right sidebar panel: version list, "Currently editing" card with live diff, manage menu
     - Key sections: "Currently editing" card (lines ~126-178), loadVersions (line 112),
  loadDiffDetails (line 177), restoreVersion, deleteAndReload
     - API_BASE constant: `http://localhost:3000`

  - `public/components/version-card.js`
     - Version card component + renderDiffDetails function
     - `createVersionCard()`: card with header, editable label, file count, expandable diff
  container
     - `renderDiffDetails()`: renders file list with expandable per-line diffs + action buttons
  (restore + delete)
     - **Current issue:** Action buttons always rendered, inappropriate for "Currently editing"
  context

  - `public/components/save-button.js`
     - Menu button: Save + chevron for version history toggle
     - Exports `createSaveButton({ onSave, onToggleVersions })` → `{ container, saveBtn,
  chevronBtn, setUnsaved() }`

  - `src/components/SourceMap.astro`
     - Changed script tag to `type="module"` (line 52)

  - `PM/PROGRESS/feature-undo-redo.md`
     - Feature spec + progress tracking + challenges/lessons learned

  - `.gitignore`
     - Added `edit-server/.versions/`
  </important_files>

  <next_steps>
  Immediate fix needed:
  - `renderDiffDetails()` in `version-card.js` renders restore/delete buttons unconditionally.
  The "Currently editing" card calls this function with no-op handlers, so the buttons appear but
   do nothing. **Fix:** Add an option like `{ showActions: false }` to `renderDiffDetails()` to
  conditionally skip the action buttons row. The call in `version-sidebar.js` for the "Currently
  editing" card should pass `showActions: false`.

  Remaining feature work (from spec):
  - [ ] Lazy-load for 100+ versions (infinite scroll in sidebar)
  - [ ] Per-version delete button directly on the card header (not just in expanded diff view) —
  may be desired UX improvement

  Session plan file:
  `/Users/aadert/.copilot/session-state/c7707929-f406-423a-a094-e6b288a63593/plan.md`
  </next_steps>