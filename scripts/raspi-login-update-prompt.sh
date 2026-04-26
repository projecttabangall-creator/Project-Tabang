#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/project-tabang}"
BRANCH="${BRANCH:-main}"
FINGERPRINT_SERVICE="${FINGERPRINT_SERVICE:-tabang-fingerprint}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-tabang-frontend}"

if [ ! -d "$PROJECT_DIR/.git" ]; then
  echo "Project repo not found at $PROJECT_DIR"
  exit 0
fi

if [ "${TABANG_SKIP_UPDATE_PROMPT:-}" = "1" ]; then
  exit 0
fi

echo
echo "Project Tabang update check"
echo "Repo: $PROJECT_DIR"
read -r -p "Pull latest updates from origin/$BRANCH now? [y/N] " answer

case "$answer" in
  y|Y|yes|YES)
    ;;
  *)
    echo "Skipped update."
    exit 0
    ;;
esac

cd "$PROJECT_DIR"

before="$(git rev-parse HEAD)"
git fetch origin "$BRANCH"

if [ "$before" = "$(git rev-parse "origin/$BRANCH")" ]; then
  echo "Already up to date."
  exit 0
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Local changes detected. Stashing before pull."
  git stash push -u -m "raspi auto-stash before update $(date -Is)"
  stashed=1
else
  stashed=0
fi

git pull --ff-only origin "$BRANCH"

if [ -f package-lock.json ]; then
  npm install
fi

if [ "${TABANG_BUILD_LOCAL_FRONTEND:-0}" = "1" ]; then
  npm run build -w packages/frontend
fi

if systemctl list-unit-files | grep -q "^$FINGERPRINT_SERVICE.service"; then
  sudo systemctl restart "$FINGERPRINT_SERVICE"
fi

if [ "${TABANG_BUILD_LOCAL_FRONTEND:-0}" = "1" ] &&
  systemctl list-unit-files | grep -q "^$FRONTEND_SERVICE.service"; then
  sudo systemctl restart "$FRONTEND_SERVICE"
fi

if [ "$stashed" = "1" ]; then
  echo "Your local changes were stashed. Restore them with: cd $PROJECT_DIR && git stash pop"
fi

echo "Update complete."
