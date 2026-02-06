# Debug Verbosity Toggle

**Status:** TODO  
**Experiment Branch:** `exp/debug-verbosity-try#1`  
**Priority:** Medium

## Problem Statement

Currently, the app logs verbosely by default during development, which clutters the console and terminal output. We need a simple way to toggle verbose logging ON/OFF, with the default being non-verbose (quiet mode).

## Requirements

### 1. Scope
- **Client-side** (`/public/live-edit.js`): Control browser console logging
- **Server-side** (`edit-server/save-server.js`): Control terminal/server logging

### 2. Behavior
- **Default mode:** Non-verbose (quiet) - minimal essential logs only
- **Verbose mode:** Show detailed debug information (current behavior)
- **Configuration:** Via npm command option: `npm run dev --verbose`

### 3. What to Log in Each Mode

**Non-verbose (default):**
- Critical errors only
- Server start/ready messages
- Successful saves (brief confirmation)

**Verbose mode:**
- All of the above, plus:
- File operation details
- Source location tracking info
- HTML cleaning/transformation steps
- Block detection and replacement details
- Request/response payloads
- Change tracking events

## Implementation Approach

### Option A: Environment Variable Pass-through (Recommended)
**Complexity:** ~50-80 lines of code changes

1. **package.json scripts:**
   - Modify `dev` script to detect `--verbose` flag
   - Pass as environment variable `VERBOSE=true` to both Astro and edit-server
   - Example: `"dev:edit": "VERBOSE=${VERBOSE:-false} concurrently \"npm run dev\" \"npm run edit-server\""`

2. **Edit server (`edit-server/save-server.js`):**
   - Read `process.env.VERBOSE` at startup
   - Create logging utility function: `log(message, level = 'info')`
   - Wrap existing console.log statements with conditional checks
   - Keep only critical errors in non-verbose mode

3. **Client (`/public/live-edit.js`):**
   - Inject `window.VERBOSE` flag via script tag in layout
   - Create client-side logging utility: `debugLog(message)`
   - Wrap existing console.log/warn statements
   - Keep only critical errors in non-verbose mode

**Pros:**
- Simple boolean flag
- Standard Node.js pattern
- Easy to test and debug
- No external dependencies

**Cons:**
- Requires passing env var through build tools
- May need different approach for Astro's dev server

### Option B: Config File Approach
**Complexity:** ~80-120 lines of code changes

1. Create a `debug.config.js` at project root
2. Both client and server read from this config
3. Allows more granular control in the future

**Pros:**
- Centralized configuration
- Easier to extend to multi-level logging later
- No need to modify npm scripts

**Cons:**
- More complex than needed for simple toggle
- Client-side config reading is awkward
- Over-engineered for current requirements

## Recommended Approach

**Option A** - Keep it simple with environment variable. The current requirement is just ON/OFF toggle, and env vars are the standard way to handle this in Node.js applications.

## Files to Modify

1. `package.json` - Add verbose flag handling to scripts
2. `edit-server/save-server.js` - Add logging utility and wrap console statements
3. `/public/live-edit.js` - Add client-side logging utility
4. `src/layouts/BaseLayout.astro` (or similar) - Inject VERBOSE flag to client

## Testing Checklist

- [ ] `npm run dev` produces minimal console output (non-verbose)
- [ ] `npm run dev --verbose` shows detailed logging
- [ ] `npm run dev:edit` respects verbose flag for both client and server
- [ ] Edit server shows only essential messages in non-verbose mode
- [ ] Client console shows only essential messages in non-verbose mode
- [ ] Error messages always appear regardless of verbose setting
- [ ] Verbose mode includes all previous debug information

## Estimated Effort

- **Code changes:** 50-80 lines
- **Files touched:** 4 files
- **Risk level:** Low (additive feature, no breaking changes)
- **Time estimate:** 1-2 hours

## Success Criteria

1. Default `npm run dev` is quiet and clean
2. `npm run dev --verbose` shows all debug details
3. No existing functionality is broken
4. Error messages always visible regardless of mode
