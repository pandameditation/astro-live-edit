# Git Experiment Workflow Cheatsheet

**Philosophy:** Experiments live on isolated branches. Commit freely, rollback freely, merge or discard cleanly.

---

## Quick Commands

| Command | What It Does |
|---------|-------------|
| `git exp-start <name>` | Create `exp/<name>-try#1` and switch to it |
| `git exp-switch <branch>` | Switch to any branch |
| `git exp-list` | Show all experiment branches |
| `git exp-status` | Current branch + uncommitted changes |
| `git exp-commit "msg"` | Stage all + commit |
| `git exp-log` | Last 5 commits (graph) |
| `git exp-rollback [N]` | Undo last N commits (default: 1) ⚠️ |
| `git exp-save` | Merge to main + optional push (with confirmation) |
| `git exp-abandon` | Delete experiment (requires exact name) ⚠️ |

---

## Common Workflows

### Start → Work → Merge
```bash
git exp-start chatbot-feature
git exp-commit "Add component"
git exp-commit "Add styling"
git exp-save  # yes, yes → merged & pushed
```

### Made a Mistake → Rollback
```bash
git exp-commit "Bad idea"
git exp-rollback
git exp-commit "Better idea"
```

### Failed Experiment → Delete & Restart
```bash
git exp-abandon  # type: exp/feature-x-try#1
git exp-start feature-x  # creates try#2
```

### Multiple Experiments
```bash
git exp-list  # see all
git exp-switch exp/chatbot-feature-try#1
git exp-commit "Work on chatbot"
git exp-switch exp/ui-redesign-try#1
git exp-commit "Work on UI"
```

---

## exp-save Flow

```bash
git exp-save
```

**Prompts:**
1. `Proceed? (yes/no):` → Confirm merge
2. `Auto-pull and push? (yes/no):` → Choose sync mode

**If conflicts detected:**
- Opens files in VS Code
- Fix conflicts, remove markers (`<<<<`, `====`, `>>>>`)
- Return to terminal: `1` to continue, `2` to abort

---

## Best Practices

✅ Commit often (small snapshots)  
✅ Use descriptive names: `chatbot-feature` not `test`  
✅ Check `git exp-status` before switching  
✅ Review `git exp-log` before merging  
✅ Increment try# when restarting: `try#1` → `try#2`

---

## Troubleshooting

**"Not on an experiment branch!"**
```bash
git exp-status  # Check where you are
git exp-switch exp/your-branch-try#1
```

**Uncommitted changes error:**
```bash
git exp-commit "WIP"  # Or: git stash
```

**Merge conflict:**
1. Edit files in VS Code
2. Remove conflict markers
3. Save
4. Type `1` to continue

**Undo accidental merge:**
```bash
git reset --hard HEAD~1  # Before pushing!
```

---

## Branch Naming

Format: `exp/<goal>-try#N`

Examples:
- `exp/chatbot-feature-try#1`
- `exp/ui-redesign-try#2`
- `exp/perf-optimization-try#1`

---

**Remember:** Main branch is sacred. Experiments are disposable. Fear nothing! 🔬
