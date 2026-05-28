#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$REPO_DIR/.git/auto-backup.log"

cd "$REPO_DIR"

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] checking repository"

  if ! git remote get-url origin >/dev/null 2>&1; then
    echo "origin remote is not configured; skip"
    exit 0
  fi

  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    if ! git diff --cached --quiet; then
      git commit -m "Auto backup: $(date '+%Y-%m-%d %H:%M:%S')"
    fi
  else
    echo "no local changes"
  fi

  branch="$(git branch --show-current)"
  if [ -z "$branch" ]; then
    echo "no current branch; skip push"
    exit 0
  fi

  git pull --rebase --autostash origin "$branch"
  git push origin "$branch"
  echo "backup complete"
} >> "$LOG_FILE" 2>&1
