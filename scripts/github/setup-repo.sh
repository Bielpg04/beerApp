#!/usr/bin/env bash
# Applies repository settings as code: merge options and the `main` ruleset.
# Idempotent. Usage: scripts/github/setup-repo.sh
set -euo pipefail
cd "$(dirname "$0")"

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

gh repo edit "$repo" \
  --enable-squash-merge --enable-merge-commit --enable-rebase-merge=false \
  --delete-branch-on-merge --enable-wiki=false >/dev/null

id=$(gh api "repos/$repo/rulesets" --jq '.[] | select(.name == "main") | .id')
if [[ -n "$id" ]]; then
  gh api --method PUT "repos/$repo/rulesets/$id" --input main-ruleset.json >/dev/null
  echo "Ruleset 'main' updated ($id)"
else
  gh api --method POST "repos/$repo/rulesets" --input main-ruleset.json >/dev/null
  echo "Ruleset 'main' created"
fi
