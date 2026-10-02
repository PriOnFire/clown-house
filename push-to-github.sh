#!/usr/bin/env bash
# CLOWN HOUSE — one-command GitHub publishing.
# Usage:  ./push-to-github.sh [repo-name] [public|private]
set -e
REPO="${1:-clown-house}"
VIS="${2:-public}"
cd "$(dirname "$0")"

if command -v gh >/dev/null 2>&1; then
  if ! gh auth status >/dev/null 2>&1; then
    echo "Not logged in to GitHub CLI yet. Run:  gh auth login"
    exit 1
  fi
  echo "Creating $VIS repo '$REPO' and pushing..."
  gh repo create "$REPO" --"$VIS" --source=. --remote=origin --push --description "Multiplayer Roblox horror game concept + playable prototype: an abandoned indoor playground where the party never ended."
  echo "Done:"; gh repo view --json url -q .url
else
  echo "GitHub CLI (gh) not found — manual route:"
  echo "  1. Go to https://github.com/new"
  echo "     Name: $REPO    Visibility: $VIS"
  echo "     Do NOT check 'Add a README/license/.gitignore' (repo already has commits)."
  echo "  2. Then in this folder run:"
  echo "       git remote add origin https://github.com/<YOUR-USERNAME>/$REPO.git"
  echo "       git push -u origin main"
fi
