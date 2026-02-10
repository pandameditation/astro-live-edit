# Feature: Deterministic Dynamic Content Editing

**Feature ID:** TODO-0001  
**Status:** Starting  
**Priority:** HIGH  
**Created:** 2026-02-10

---

## Problem Statement

Currently, dynamic content wrapped in `{expression}` is not editable in the live editor. However, when the dynamic logic is **deterministic** (known states, static number of states), we should allow editing the underlying content without breaking the logic.

**Examples:**
1. **i18n strings:** `{tr("site.translatable", "fr")}` - user should edit translations for all languages
2. **Conditional rendering:** `{showText ? <p>Show me!</p> : <p>I am invisible!</p>}` - user should edit text for both states

---

## Proposed Approach

### UX Design
Instead of disabling these elements, highlight them as special. On click:
- Open a popover/modal showing all available states
- Display state conditions on one side, editable content on the other
- Allow editing content for each state independently

**Example UI for conditional:**
```
State: showText = true
Content: [Show me!] (editable)

State: showText = false  
Content: [I am invisible (joke)!] (editable)
```

**Example UI for i18n:**
```
Language: en
Content: [Welcome] (editable)

Language: fr
Content: [Bienvenue] (editable)

Language: es
Content: [Bienvenido] (editable)
```

### Technical Implementation

**Phase 1: Detection & Marking**
1. Identify elements containing deterministic expressions during render
2. Add `data-dynamic-deterministic` attribute
3. Add `data-dynamic-type` (i18n | conditional)
4. Add `data-dynamic-states` (JSON of available states)

**Phase 2: Frontend Editing**
1. On click, open modal with state editor
2. Parse expression to extract all states
3. For i18n: reverse-engineer `tr()` function to find locale keys
4. For conditionals: parse ternary/if expressions to find all branches

**Phase 3: Backend Saving**
1. Send all state modifications to server
2. Server finds the expression in source file
3. Update content within each state while preserving logic structure
4. For i18n: update the locale files, not the source

---

## Files Likely Affected

- `astro.config.mjs` - Add detection plugin
- `src/components/SourceMap.astro` - Mark deterministic expressions
- `/public/live-edit.js` - Handle special click behavior, modal UI
- `edit-server/save-server.js` - Handle multi-state saves

---

## Acceptance Criteria

- [ ] i18n strings are highlighted as editable
- [ ] Clicking i18n opens modal showing all language variants
- [ ] User can edit each language variant independently
- [ ] Saving i18n updates locale files (or source, depending on implementation)
- [ ] Conditional expressions (ternary) are highlighted as editable
- [ ] Clicking conditional opens modal showing both branches
- [ ] User can edit content in each branch
- [ ] Saving conditional updates source code without breaking logic
- [ ] Original conditional/i18n logic remains intact after save

---

## Open Questions

1. How do we detect i18n functions? (Need to know the function name - `tr()`, `t()`, etc.)
2. Where are i18n translations stored? (Separate JSON files? Inline?)
3. Should we support nested conditionals in phase 1, or only simple ternaries?
4. Do we need to handle `if/else` blocks or only ternary operators?

---

## Notes

This is a complex feature that bridges static and dynamic content. Start with simple cases (single ternary, basic i18n) and expand from there.
