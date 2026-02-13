# Feature: Version History for Edit Sessions

**Status:** DONE 
**Priority:** High  
**Complexity:** High  
**Started:** 2026-02-12  
**Branch:** `exp/undo-redo-try#1`

---


## Progress & Commits

- ✅ Experiment started, feature moved to PROGRESS
- ✅ Phase 1: Server-side versioning core complete (diff.js, versions.js, all API endpoints)
- ✅ Phase 2: Client-side UI complete (save-button, version-sidebar, version-card components)
- ✅ Phase 3: Version detail, diffs, restore — all wired up
- ✅ Phase 4: Version management (delete all, editable labels, auto-labeling)
- ✅ Phase 5: Restore & Baseline refactor (null crash, dialogs removed, "Currently editing" card)
- ✅ Phase 6: Checkpoint UX refactor (see "New philosophy" section above)
- ✅ Phase 7: Full snapshot architecture (eliminates data loss on any restore sequence)
- ✅ Phase 8: Immutable origin (git-first + origin.json persistence)
- ✅ Phase 9: Client-side unsaved changes display in "Currently editing" card
- ✅ Phase 10: Chevron rotation animation (▸ right → rotates 180° when panel opens)
- ✅ Phase 11: "Reset to git HEAD" option in ⋮ manage menu

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

### 5. Heading save failure (H2/H3 not saving)
Astro auto-generates `id` attributes on markdown headings (e.g. `<h2 id="my-heading">`). The `hasAttributes()` check in `save-server.js` returned `true`, setting `needsStringMode=true`, which overwrote the line-based heading edit with a full-body string replacement. **Fix:** `if (hasAttrs && !isHeading)` — exclude headings from the string mode check.

### 6. Restore regression after removing alerts
Removing `alert()` calls from the restore flow removed the implicit delay that allowed Vite to process HMR updates before the page was ready. **Fix:** Removed `window.location.reload()` entirely and rely on Vite's HMR to hot-reload changed files automatically.

### 7. Partial snapshots cause data loss
Versions that only stored changed files (partial snapshots) required a `resolveFileAtCheckpoint` backward-walk algorithm to reconstruct file state. This broke under complex restore sequences (e.g., save v1, save v2, save v3, restore v2, restore v1, restore origin — v3 would lose data). **Fix:** Switched to full snapshots — every version captures ALL tracked files, making diffs and restores trivially correct via direct file reads.

### 8. Origin data corruption
After `deleteAllVersions` wiped `.versions/`, the next `createBaseline` call snapshotted from current disk files (which had modified content), corrupting the origin. **Fix:** Hybrid approach — `createBaseline` tries `git show HEAD:<file>` first, falls back to disk. Origin content persisted in `origin.json` that survives `deleteAllVersions`. `deleteAllVersions` preserves `origin.json` and rebuilds v0 from it. `deleteVersion` blocks v0 deletion.

### 9. Unicode glyph size inconsistency
Swapping between Unicode characters `▸` and `◂` for the chevron caused size differences (different glyphs render at different sizes). **Fix:** Use a single `▸` glyph and rotate it with CSS `transform: rotate(180deg)` with a smooth `transition: transform 0.3s ease`.

---

## Exhaustive Change Log (All Phases)

### Phase 1: Server-Side Versioning Core
**Files created:**
- `edit-server/diff.js` — In-house LCS line diff algorithm (~120 lines, no external dependencies). Exports `diffLines(oldText, newText)` → `{ hunks, stats }` and `formatDiff(diffResult)` → string.
- `edit-server/versions.js` — Version storage module. Functions: `createBaseline`, `createVersion`, `listVersions`, `getVersionDetails`, `deleteVersion`, `deleteAllVersions`, `updateLabel`, `restoreVersion`, `getCurrentDiff`.

**Files modified:**
- `edit-server/save-server.js` — Added `import * as versions`, added 8 API endpoints: `POST /api/versions/baseline`, `GET /api/versions`, `GET /api/versions/current-diff`, `GET /api/versions/:id`, `DELETE /api/versions/:id`, `DELETE /api/versions`, `POST /api/versions/:id/restore`, `PATCH /api/versions/:id`. Hooked version creation into `POST /save`.

### Phase 2: Client-Side UI
**Files created:**
- `public/components/save-button.js` — Menu button with Save action + chevron to toggle version history. Exports `createSaveButton({ onSave, onToggleVersions })`.
- `public/components/version-card.js` — Version card component with timestamp, editable label, file count, expandable per-file diffs, restore + delete buttons. Exports `createVersionCard()` and `renderDiffDetails()`.
- `public/components/version-sidebar.js` — Right sidebar panel with "Currently editing" card, version list, manage menu (⋮), baseline creation on page load. Exports `createVersionSidebar()` and `createBaselineFromPage()`.

**Files modified:**
- `public/live-edit.js` — Added ES module imports for all 3 components, replaced old save button with new menu button, wired sidebar toggle, added `data-source-file` guard for contenteditable, added baseline creation call on page load.
- `src/components/SourceMap.astro` — Changed `<script is:inline>` to `<script is:inline type="module">` for ES module support.
- `.gitignore` — Added `edit-server/.versions/` and `dist/`.

### Phase 3: Bug Fixes & Polish
- **CORS fix:** Swapped middleware order — `cors()` now runs before `express.json()` so CORS headers are sent even on parse errors.
- **ContentEditable leak fix:** Added `if (!el.getAttribute('data-source-file')) return;` guard so UI elements (buttons, sidebar, cards) don't become editable.
- **Dialog removal:** Removed all `confirm()` and `alert()` calls from restore flow — restore executes silently.
- **"Currently editing" card:** Static blue-accent card always at top of sidebar, clickable to show live diffs against checkpoint.

### Phase 4: Version Management
- **Delete individual version:** 🗑 button with red background on expanded version cards.
- **Delete all versions:** "🗑 Delete all versions" option in ⋮ manage menu.
- **Editable labels:** Double-click version label to rename (calls `PATCH /api/versions/:id`).
- **Auto-labeling:** Default label "Updated N files" generated on version creation.
- **Auto-skip empty versions:** `createVersion` compares files byte-for-byte against previous version; returns `null` if identical.

### Phase 5: Heading Save Fix
- **Root cause:** Astro auto-generates `id` attributes on markdown headings → `needsStringMode=true` → overwrites line-based edit.
- **Fix:** `if (hasAttrs && !isHeading)` check in `save-server.js` excludes headings from string mode.

### Phase 6: Checkpoint UX Refactor
- **No backup on restore:** Removed "Before restore to vX" snapshot creation — transient changes are OK to lose.
- **"Baseline" → "Origin":** Renamed throughout UI and code.
- **Checkpoint system:** `checkpoint.json` stores the ID of the latest save or restore version. All diffs are computed against the checkpoint. Checkpoint version returns empty diffs. `createBaseline` only sets checkpoint to 0 if none exists yet.
- **Checkpoint visual:** Yellow background (`#2a2a1a`), border (`#c90`), glowing dot animation, "📌 Checkpoint" badge on checkpoint version cards.
- **No restore/delete on checkpoint:** Buttons hidden when `isCheckpoint` is true.
- **Checkpoint fallback on delete:** If deleted version was checkpoint, falls back to latest remaining version.

### Phase 7: Full Snapshot Architecture
- **Problem:** Partial snapshots (only changed files per version) caused data loss under complex restore sequences.
- **Fix:** Rewrote `createVersion` to snapshot ALL tracked files (from origin's file list). Each version is now a self-contained complete snapshot.
- **Simplified:** `getVersionDetails`, `restoreVersion`, and `getCurrentDiff` now do direct file reads (no backward-walk reconstruction). Removed `resolveFileAtCheckpoint` entirely.

### Phase 8: Immutable Origin
- **Problem:** Origin content got overwritten when `deleteAllVersions` wiped `.versions/` and `createBaseline` re-snapshotted from modified disk files.
- **Fix:** `createBaseline` tries `git show HEAD:<file>` via `execSync` first, falls back to disk. Origin content stored in `origin.json` (separate from manifest) — survives `deleteAllVersions`. `deleteAllVersions` reads `origin.json` before wiping, then rebuilds v0 from it. `deleteVersion(0)` is blocked.
- **Tested:** Full up-and-down restore sequence (v0→v1→v2→v3→v2→v1→v0→v1→v2→v3) all consistent.

### Phase 9: Client-Side Unsaved Changes Display
- **Change:** "Currently editing" card no longer calls `GET /api/versions/current-diff` (server endpoint preserved for API consumers).
- **New behavior:** `createVersionSidebar` accepts `{ getChanges }` — a function returning the pending `changes[]` array from `live-edit.js`.
- **Badge:** Blue `N unsaved` badge on the "Currently editing" card header, updated live as edits occur via `versionSidebar.updatePending()`.
- **Expandable detail:** Click to see pending edits grouped by file, with tag name + content preview (HTML stripped, truncated to 60 chars).

### Phase 10: Chevron Animation
- **Change:** Chevron on save button changed from `▾` (down) to `▸` (right-pointing).
- **Animation:** Uses CSS `transform: rotate(180deg)` with `transition: transform 0.3s ease` — smooth rotation when panel opens/closes. Single glyph, no Unicode swap (avoids size inconsistency).

### Phase 11: Reset to Git HEAD
- **Backend:** Added `resetOrigin(filePaths)` to `versions.js` — wipes all versions + `origin.json`, restores tracked files to `git show HEAD:` content on disk, rebuilds fresh origin.
- **API:** Added `POST /api/versions/reset-origin` endpoint in `save-server.js`.
- **UI:** Added "🔄 Reset to git HEAD" option in ⋮ manage menu with confirm dialog. Reuses `getTrackedFiles()` helper (extracted from `createBaselineFromPage`).

---

## Current File Inventory

### Created files:
| File | Purpose |
|------|---------|
| `edit-server/diff.js` | In-house LCS line diff algorithm |
| `edit-server/versions.js` | Version storage: origin, snapshots, checkpoint, CRUD, diffs, reset |
| `public/components/save-button.js` | Menu button: Save + animated chevron |
| `public/components/version-card.js` | Version card with checkpoint indicator, diffs, actions |
| `public/components/version-sidebar.js` | Right sidebar: "Currently editing", version list, manage menu |

### Modified files:
| File | Changes |
|------|---------|
| `edit-server/save-server.js` | `import * as versions`, cors→json order, heading fix, version hook in POST /save, 9 API endpoints |
| `public/live-edit.js` | ES module imports, save button + sidebar wiring, `data-source-file` guard, `getChanges` + `updatePending` |
| `src/components/SourceMap.astro` | `type="module"` on script tag |
| `.gitignore` | Added `edit-server/.versions/` and `dist/` |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/versions/baseline` | Create origin (v0) from tracked files |
| `POST` | `/api/versions/reset-origin` | Reset origin to latest git HEAD, wipe all versions |
| `GET` | `/api/versions` | List all versions + checkpoint ID |
| `GET` | `/api/versions/current-diff` | Diff live disk files vs checkpoint |
| `GET` | `/api/versions/:id` | Version details with diffs against checkpoint |
| `POST` | `/api/versions/:id/restore` | Restore files from version, set as checkpoint |
| `DELETE` | `/api/versions/:id` | Delete version (blocked for id=0) |
| `DELETE` | `/api/versions` | Delete all except origin (preserves origin.json) |
| `PATCH` | `/api/versions/:id` | Update version label |

---

## Remaining Work

- [ ] Lazy-load for 100+ versions (infinite scroll in sidebar)
- [ ] `findTagAtPosition` bug for `<h1>` in `.astro` files (pre-existing, unrelated)

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


<!-- Historical checkpoint data removed — all content is now captured in the Exhaustive Change Log above -->
