#!/usr/bin/env bash
# Build the Angular app and publish it to the gh-pages branch,
# keeping content.json and media/ (managed from the admin dashboard) untouched.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm ci
npx ng build --base-href ./
WT="$(mktemp -d)"
git fetch origin gh-pages
git worktree add "$WT" origin/gh-pages
cd "$WT"
find . -maxdepth 1 -type f \( -name '*.js' -o -name '*.css' -o -name 'index.html' \) ! -name 'media.js' -delete
cp -r "$ROOT/dist/dawnsogni/browser/." .
git add -A
git commit -m "Deploy site" || true
git push origin HEAD:gh-pages
cd "$ROOT" && git worktree remove "$WT" --force
