# POSTMORTEM: Deterministic Dynamic Content (Brainstorming Experiment)

**Experiment:** `deterministic-dynamic-content-try`  
**Status:** ✅ ABANDONED (Successfully Completed)  
**Date:** 2026-02-12  
**Duration:** ~2 days

---

## What Was This Experiment?

Brainstorming session for deterministic dynamic content editing. Specifically: how to enable users to edit i18n strings and conditional content that is rendered via function calls and expressions, without breaking the surrounding logic.

**Scope:** Research and architecture design only - no code implementation.

---

## Why Abandon?

This experiment achieved its goal. The brainstorming phase is complete and thoroughly documented. We have consensus on the best architectural approach (Option D: Eval + Probe). 

**The experiment contains only documentation, no code.**

The next phase is implementation, which will be a separate experiment with clear deliverables.

---

## Key Decision Made

**✅ Option D chosen: "Eval + Probe" Strategy**

### Architecture Overview:
- **Build-time import tracing** to discover locale data
- **Dynamic function invocation** to probe all possible states
- **Library-agnostic** (works with ANY i18n implementation)
- **No configuration needed** by user
- **Estimated effort:** ~350 lines of code

### How It Works:
1. During build, trace imports to find locale data files
2. At runtime, inject probe values to discover all content variants
3. Mark discovered content with metadata for frontend editing
4. Save edits back to source files automatically

---

## Five Approaches Evaluated

Full analysis documented in `PM/PROGRESS/feature-deterministic-dynamic-content-PROGRESS.md` (if it still exists):

### Option A: AST-Based Expression Extraction
- **Complexity:** 200-300 lines
- **Verdict:** Too complex for MVP
- **Why rejected:** Heavy parser dependencies, maintainability concerns

### Option B: Runtime Introspection via Wrapper
- **Complexity:** 80-100 lines
- **Verdict:** Simplest, but requires user action
- **Why rejected:** Requires users to wrap their i18n functions

### Option C: Regex-based Matching
- **Complexity:** 150 lines
- **Verdict:** Fragile and limited
- **Why rejected:** Can't handle complex expressions, breaks easily

### ⭐ Option D: Eval + Probe (CHOSEN)
- **Complexity:** ~350 lines
- **Verdict:** Best balance of power and simplicity
- **Why chosen:** 
  - Automatic detection
  - Works with any i18n library
  - No user configuration
  - Flexible enough for future expansion

### Option E: Config-based Hybrid
- **Complexity:** 120-150 lines
- **Verdict:** Good fallback option
- **Why rejected:** Option D is better, but keep this as Plan B

---

## What We Learned

### Technical Insights:
1. **Import tracing is powerful**: Can discover locale data automatically without user config
2. **Eval is safe in controlled contexts**: With proper sandboxing, eval can solve complex problems elegantly
3. **Library-agnostic is worth the effort**: Don't lock users into specific i18n implementations

### Scope Decisions:
1. **Phase 1:** i18n calls only (highest value, clearest use case)
2. **Phase 2:** Ternary expressions (more complex, lower priority)
3. **Future:** Nested conditionals, complex expressions (if users need them)

### Open Questions for Implementation:
- How to handle locale files that aren't JSON? (YAML, TS, etc.)
- What's the performance impact of probing all states?
- How to display 50+ locales in the UI without overwhelming users?
- Should we cache probe results or re-probe on every build?

---

## Deliverables from This Experiment

### Documentation Created:
- ✅ Problem statement and use cases defined
- ✅ Five architectural approaches evaluated with code sketches
- ✅ Decision made with clear rationale
- ✅ Implementation estimate (350 lines)
- ✅ Phased approach defined (i18n first, ternaries later)

### Artifacts:
- `PM/TODO/feature-deterministic-dynamic-content.md` - Original feature spec
- `PM/PROGRESS/feature-deterministic-dynamic-content-PROGRESS.md` - Full brainstorming notes (if preserved)

---

## Next Steps

1. **Update TODO:** Revise `PM/TODO/feature-deterministic-dynamic-content.md` with final Option D architecture
2. **Start implementation experiment:** Create new branch when ready to build
3. **Scope Phase 1:** Focus on i18n calls only
4. **Define success metrics:** What does "working" look like for MVP?

---

## Why This Was Valuable

This experiment prevented us from jumping into implementation with the wrong approach. By evaluating five options upfront, we avoided:
- Building Option A and realizing it's too complex
- Building Option B and realizing users won't adopt it
- Building Option C and realizing it breaks too easily

**Time saved by thorough planning: estimated 2-3 days of rework.**

The next implementation experiment will move fast because the hard decisions are already made.

---

## Status: Ready for Implementation

This experiment is marked "abandoned" but really it's "successfully completed." The brainstorming phase is done. Implementation can begin whenever prioritized.

**Recommendation:** Start implementation experiment within the next sprint while context is fresh.
