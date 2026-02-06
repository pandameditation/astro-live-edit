# Debug Verbosity Toggle - POSTMORTEM

**Experiment Branch:** `exp/debug-verbosity-try#1` (DELETED)  
**Started:** 2026-02-06  
**Abandoned:** 2026-02-06  
**Duration:** ~15 minutes

## What Was Attempted

Implemented a simple ON/OFF debug verbosity toggle for the Astro Live Edit system, allowing developers to control console/terminal logging output via `npm run dev:edit --verbose` flag.

### Implementation Approach (Option A - Environment Variable)

1. **package.json** - Modified `dev:edit` script to detect `--verbose` flag and pass as environment variable:
   ```json
   "dev:edit": "node -e \"const args = process.argv.slice(2); const verbose = args.includes('--verbose') ? 'true' : 'false'; require('child_process').spawn('npx', ['concurrently', `VERBOSE=${verbose} npm run dev`, `VERBOSE=${verbose} npm run edit-server`], {shell: true, stdio: 'inherit'})\""
   ```

2. **edit-server/save-server.js** - Added verbosity control and logging utilities (~40 lines)

3. **public/live-edit.js** - Added client-side verbosity control and logging (~20 lines)

4. **src/layouts/BaseLayout.astro** - Injected `window.VERBOSE` flag to client (~10 lines)

**Total changes:** ~70 lines across 4 files

## Why It Failed

### Critical Issue: The npm script didn't start the app

The complex Node.js inline execution approach in package.json **completely broke the startup**. When running `npm run dev:edit`, the application failed to launch.

**Root cause:** The inline Node.js script using `child_process.spawn()` with nested npx/concurrently commands was too fragile. The command string parsing, shell interaction, and environment variable passing through multiple layers created a brittle setup that didn't work.

## Technical Problems Identified

1. **Over-engineered script approach** - Trying to parse CLI args and spawn processes inline in package.json is not a standard pattern
2. **Environment variable propagation** - Passing `VERBOSE=...` through npx → concurrently → npm was unreliable
3. **No fallback or error handling** - When the spawn failed, there was no indication why
4. **Cross-platform concerns** - Shell interactions differ between Windows/Unix, making this approach even more fragile

## Lessons Learned

### What Went Wrong:
- **Chose complexity over simplicity** - The inline Node.js script was clever but not robust
- **Didn't test incrementally** - Should have verified the script worked before implementing all logging changes
- **Wrong abstraction level** - Package.json scripts should be simple command chains, not mini-programs

### Better Approaches for Future Attempt:

**Option B: Simple script file** (~10 lines)
```javascript
// scripts/dev-edit.js
const { spawn } = require('child_process');
const verbose = process.argv.includes('--verbose');
process.env.VERBOSE = verbose;
spawn('npx', ['concurrently', 'npm run dev', 'npm run edit-server'], {
  stdio: 'inherit',
  shell: true
});
```
Then: `"dev:edit": "node scripts/dev-edit.js"`

**Option C: Cross-env package**
```json
"dev:edit": "cross-env VERBOSE=false concurrently \"npm run dev\" \"npm run edit-server\"",
"dev:edit:verbose": "cross-env VERBOSE=true concurrently \"npm run dev\" \"npm run edit-server\""
```
Simpler but requires two separate commands.

**Option D: Config file** (simplest)
```javascript
// debug.config.js
module.exports = { verbose: process.env.DEBUG === 'true' };
```
Then: `DEBUG=true npm run dev:edit` (standard Unix pattern)

## Recommendation for Retry

If this feature is revisited:
1. **Use Option D (config file)** - Standard, simple, works everywhere
2. **Test the startup first** - Verify `npm run dev:edit` works before adding logging changes
3. **Keep it boring** - No inline Node.js scripts in package.json
4. **Consider if it's worth it** - Maybe the verbose logging isn't actually a problem?

## Files to Clean Up

- `PM/PROGRESS/debug-verbosity-toggle.md` - Remove (abandoned)
- `PM/TODO/debug-verbosity-toggle.md` - **Keep for potential rework** (feature still valuable, just needs better approach)

## Decision

**Keep in roadmap/TODO:** The feature itself is still useful (quieter default output), but needs a simpler, more robust implementation approach.

User can retry with:
- A separate startup script file
- The cross-env package
- A simple config file
- Or just accept verbose logging during development

---

**Postmortem Author:** senior-pm  
**Date:** 2026-02-06
