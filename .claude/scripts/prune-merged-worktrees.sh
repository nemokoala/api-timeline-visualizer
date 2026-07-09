#!/usr/bin/env bash
# Remove worktrees whose branch is fully merged into the default branch.
# Skips the main checkout, the worktree this session is running in, and any
# worktree with uncommitted tracked changes.
set -uo pipefail

git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# C:/-style paths, so they compare equal to `git worktree list` output on Windows.
common_dir=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
main_root=${common_dir%/.git}
current_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0

default_branch=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)
default_branch=${default_branch#origin/}
[ -n "$default_branch" ] || default_branch=main
git rev-parse --verify --quiet "refs/heads/$default_branch" >/dev/null || exit 0

removed=()
while IFS= read -r wt; do
  [ "$wt" = "$main_root" ] && continue
  [ "$wt" = "$current_root" ] && continue
  [ -d "$wt" ] || continue

  branch=$(git -C "$wt" symbolic-ref --quiet --short HEAD 2>/dev/null) || continue
  [ "$branch" = "$default_branch" ] && continue

  git merge-base --is-ancestor "$branch" "refs/heads/$default_branch" 2>/dev/null || continue
  [ -n "$(git -C "$wt" status --porcelain --untracked-files=no 2>/dev/null)" ] && continue

  if git worktree remove --force "$wt" 2>/dev/null; then
    removed+=("$(basename "$wt")")
    git branch -d "$branch" >/dev/null 2>&1
  fi
done < <(git worktree list --porcelain | sed -n 's/^worktree //p')

git worktree prune 2>/dev/null

if [ ${#removed[@]} -gt 0 ]; then
  list=$(printf '%s, ' "${removed[@]}")
  printf '{"systemMessage":"Pruned merged worktree(s): %s"}\n' "${list%, }"
fi
exit 0
