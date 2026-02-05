


We generated a git alias like that:
[user]
	keep as before
[alias]
	exp-start = "!f() { git switch -c \"exp/$1-try#1\"; echo \"✓ Experiment started: exp/$1-try#1\"; }; f"
	exp-switch = "!f() { git switch \"$1\"; }; f"
	exp-list = branch --list \"exp/*\"
	exp-status = !git --no-pager branch --show-current && echo \"---\" && git --no-pager status -s
	exp-commit = "!f() { git add -A && git commit -m \"$1\"; }; f"
	exp-log = log --oneline --graph -5
	exp-rollback = "!f() { git reset --hard HEAD~${1:-1}; }; f"
	exp-save = "!f() { \n  BRANCH=$(git branch --show-current); \n  if [[ ! \"$BRANCH\" =~ ^exp/ ]]; then \n    echo \"❌ Not on an experiment branch!\"; \n    exit 1; \n  fi; \n  echo \"About to merge: $BRANCH -> main\"; \n  echo -n \"Proceed? (yes/no): \"; \n  read CONFIRM; \n  if [ \"$CONFIRM\" = \"yes\" ]; then \n    git switch main && git merge \"$BRANCH\" && git branch -d \"$BRANCH\" && echo \"✓ Merged and deleted $BRANCH\"; \n  else \n    echo \"Cancelled.\"; \n  fi; \n}; f"
	exp-abandon = "!f() { \n  BRANCH=$(git branch --show-current); \n  if [[ ! \"$BRANCH\" =~ ^exp/ ]]; then \n    echo \"❌ Not on an experiment branch!\"; \n    exit 1; \n  fi; \n  echo \"⚠️  About to DELETE branch: $BRANCH\"; \n  echo \"   All commits will be lost!\"; \n  echo -n \"Type branch name to confirm: \"; \n  read CONFIRM; \n  if [ \"$CONFIRM\" = \"$BRANCH\" ]; then \n    git switch main && git branch -D \"$BRANCH\" && echo \"✓ Deleted $BRANCH\"; \n  else \n    echo \"Cancelled (did not match).\"; \n  fi; \n}; f"



[alias] #with conflict resolution
	exp-start = "!f() { git switch -c \"exp/$1-try#1\"; echo \"✓ Experiment started: exp/$1-try#1\"; }; f"
	exp-switch = "!f() { git switch \"$1\"; }; f"
	exp-list = branch --list \"exp/*\"
	exp-status = !git --no-pager branch --show-current && echo \"---\" && git --no-pager status -s
	exp-commit = "!f() { git add -A && git commit -m \"$1\"; }; f"
	exp-log = log --oneline --graph -5
	exp-rollback = "!f() { git reset --hard HEAD~${1:-1}; }; f"
	exp-save = "!f() { \n  BRANCH=$(git branch --show-current); \n  if [[ ! \"$BRANCH\" =~ ^exp/ ]]; then \n    echo \"❌ Not on an experiment branch!\"; \n    exit 1; \n  fi; \n  echo \"About to merge: $BRANCH -> main\"; \n  echo -n \"Proceed? (yes/no): \"; \n  read CONFIRM; \n  if [ \"$CONFIRM\" != \"yes\" ]; then \n    echo \"Cancelled.\"; \n    exit 0; \n  fi; \n  \n  echo -n \"Auto-pull and push? (yes/no): \"; \n  read SYNC; \n  \n  git switch main || exit 1;\n  \n  if [ \"$SYNC\" = \"yes\" ]; then\n    echo \"Pulling from origin/main...\";\n    git fetch origin main;\n    merge_output=$( (git merge origin/main) 2>&1 );\n    \n    if [[ \"$merge_output\" == *\"error: Your local changes to the following files would be overwritten\"* ]]; then\n      echo \"⚠️  Staging uncommitted changes...\";\n      git add .;\n      git commit -am \"Preparing conflict resolution\";\n      merge_output=$( (git merge origin/main) 2>&1 );\n    fi;\n    \n    if [[ \"$merge_output\" == *\"CONFLICT\"* ]]; then\n      echo \"⚠️  MERGE CONFLICTS DETECTED\";\n      for conflicted_file in $(git diff --name-only --diff-filter=U); do\n        echo \"  - $conflicted_file\";\n      done;\n      echo \"\";\n      echo \"Opening conflicted files...\";\n      git diff --name-only --diff-filter=U | xargs -I {} code \"{}\";\n      echo -n \"After resolving conflicts, enter 1 to continue or 2 to abort: \";\n      read conflict_choice;\n      case $conflict_choice in\n        1)\n          echo \"Finalizing conflict resolution...\";\n          git add .;\n          git commit -am \"Conflict resolved manually\";\n          ;;\n        2)\n          echo \"Aborting. Run git merge --abort to reset.\";\n          exit 1;\n          ;;\n        *)\n          echo \"Invalid choice. Aborting.\";\n          exit 1;\n          ;;\n      esac;\n    fi;\n  fi;\n  \n  echo \"Merging $BRANCH into main...\";\n  git merge \"$BRANCH\" || exit 1;\n  git branch -d \"$BRANCH\";\n  echo \"✓ Merged and deleted $BRANCH\";\n  \n  if [ \"$SYNC\" = \"yes\" ]; then\n    echo \"Pushing to origin/main...\";\n    git push;\n    echo \"✓ Pushed to remote\";\n  fi;\n}; f"
	exp-abandon = "!f() { \n  BRANCH=$(git branch --show-current); \n  if [[ ! \"$BRANCH\" =~ ^exp/ ]]; then \n    echo \"❌ Not on an experiment branch!\"; \n    exit 1; \n  fi; \n  echo \"⚠️  About to DELETE branch: $BRANCH\"; \n  echo \"   All commits will be lost!\"; \n  echo -n \"Type branch name to confirm: \"; \n  read CONFIRM; \n  if [ \"$CONFIRM\" = \"$BRANCH\" ]; then \n    git switch main && git branch -D \"$BRANCH\" && echo \"✓ Deleted $BRANCH\"; \n  else \n    echo \"Cancelled (did not match).\"; \n  fi; \n}; f"
