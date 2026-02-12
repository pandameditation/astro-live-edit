# Feature: Version History for Edit Sessions

**Status:** Ready for development  
**Priority:** High  
**Complexity:** High  

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

## F0r Developer

0. UI Design System: each time you need a new UI component, make it a specific .js file that will load the specific component (HTML+CSS+JS) when needed. We are using Vanilla JS here.
0.1 We refactor components to make them reusable when we see a fit.
0.2 The design system CSS will rely on inline style attributes instead. We will prefix these attributes with "ale-*" for astro-live-edit.
1. UI layout: Version history is a right-sidebar vertical panel (limited width), and "Save" is now a "menu button" that shows the option to "See versions" when clicked on the chevron part.
2. Auto-label versions: Versions should auto-label by content (e.g., "Updated 3 files") and can be modified by user input.
3. Diff detail: Show only the files that have diff, and when the user clicks on the files name, show an extract of the lines that have a diff, line-by-line.
4. Performance: If there are 100+ versions, lazy-load should be added to history list, so that we can keep scrolling in the list.
5. Cleanup: User can delete specific version, limit the number of saved versions in the history, and delete all versions, by clicking on a "⋮" UI button that will enable it.
