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

## How to make it again

If you want to install these aliases on a new project in the future, add this to the .gitconfig file, after `[user]` line:

[alias]
	exp-start = "!f() { git switch -c \"exp/$1-try#1\"; echo \"✓ Experiment started: exp/$1-try#1\"; }; f"
	exp-switch = "!f() { git switch \"$1\"; }; f"
	exp-list = branch --list \"exp/*\"
	exp-status = !git --no-pager branch --show-current && echo \"---\" && git --no-pager status -s
	exp-commit = "!f() { git add -A && git commit -m \"$1\"; }; f"
	exp-log = log --oneline --graph -5
	exp-rollback = "!f() { git reset --hard HEAD~${1:-1}; }; f"
	exp-save = "!f() { \n  BRANCH=$(git branch --show-current); \n  if [[ ! \"$BRANCH\" =~ ^exp/ ]]; then \n    echo \"❌ Not on an experiment branch!\"; \n    exit 1; \n  fi; \n  \n  # Check for uncommitted changes and commit them first\n  if [[ -n $(git status -s) ]]; then\n    echo \"📝 Uncommitted changes detected on $BRANCH\";\n    echo -n \"Commit message (or press Enter for default): \";\n    read commit_msg;\n    if [ -z \"$commit_msg\" ]; then\n      commit_msg=\"WIP: Auto-commit before merge\";\n    fi;\n    git add -A || exit 1;\n    git commit -m \"$commit_msg\" || exit 1;\n    echo \"✓ Changes committed on $BRANCH\";\n  fi;\n  \n  echo \"About to merge: $BRANCH -> main\"; \n  echo -n \"Proceed? (yes/no): \"; \n  read CONFIRM; \n  if [ \"$CONFIRM\" != \"yes\" ]; then \n    echo \"Cancelled.\"; \n    exit 0; \n  fi; \n  \n  echo -n \"Auto-pull and push? (yes/no): \"; \n  read SYNC; \n  \n  git switch main || exit 1;\n  \n  if [ \"$SYNC\" = \"yes\" ]; then\n    echo \"Pulling from origin/main...\";\n    git fetch origin main || exit 1;\n    merge_output=$( (git merge origin/main) 2>&1 );\n    merge_exit=$?;\n    \n    if [[ \"$merge_output\" == *\"error: Your local changes to the following files would be overwritten\"* ]]; then\n      echo \"⚠️  Staging uncommitted changes...\";\n      git add . || exit 1;\n      git commit -m \"Preparing conflict resolution\" || exit 1;\n      merge_output=$( (git merge origin/main) 2>&1 );\n      merge_exit=$?;\n    fi;\n    \n    if [[ \"$merge_output\" == *\"CONFLICT\"* ]] || [ $merge_exit -ne 0 ]; then\n      echo \"⚠️  MERGE CONFLICTS DETECTED\";\n      for conflicted_file in $(git diff --name-only --diff-filter=U 2>/dev/null); do\n        echo \"  - $conflicted_file\";\n      done;\n      echo \"\";\n      echo \"Opening conflicted files in VS Code...\";\n      git diff --name-only --diff-filter=U 2>/dev/null | xargs -I {} code \"{}\";\n      echo -n \"After resolving conflicts, enter 1 to continue or 2 to abort: \";\n      read conflict_choice;\n      case $conflict_choice in\n        1)\n          echo \"Finalizing conflict resolution...\";\n          git add . || exit 1;\n          git commit -m \"Conflict resolved manually\" || exit 1;\n          ;;\n        2)\n          echo \"Aborting. Run: git merge --abort\";\n          exit 1;\n          ;;\n        *)\n          echo \"Invalid choice. Aborting.\";\n          exit 1;\n          ;;\n      esac;\n    fi;\n  fi;\n  \n  echo \"Merging $BRANCH into main...\";\n  git merge --no-ff \"$BRANCH\" -m \"Merge $BRANCH into main\" || exit 1;\n  git branch -d \"$BRANCH\" || exit 1;\n  echo \"✓ Merged and deleted $BRANCH\";\n  \n  if [ \"$SYNC\" = \"yes\" ]; then\n    echo \"Pushing to origin/main...\";\n    git push || exit 1;\n    echo \"✓ Pushed to remote\";\n  fi;\n}; f"
	exp-abandon = "!f() { \n  BRANCH=$(git branch --show-current); \n  if [[ ! \"$BRANCH\" =~ ^exp/ ]]; then \n    echo \"❌ Not on an experiment branch!\"; \n    exit 1; \n  fi; \n  echo \"⚠️  About to DELETE branch: $BRANCH\"; \n  echo \"   All commits will be lost!\"; \n  echo -n \"Type branch name to confirm: \"; \n  read CONFIRM; \n  if [ \"$CONFIRM\" = \"$BRANCH\" ]; then \n    git switch main && git branch -D \"$BRANCH\" && echo \"✓ Deleted $BRANCH\"; \n  else \n    echo \"Cancelled (did not match).\"; \n  fi; \n}; f"
