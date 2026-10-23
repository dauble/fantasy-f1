---
name: release
description: Cut a release for this repo — bump the SemVer version in package.json/package-lock.json, add a Keep a Changelog entry to CHANGELOG.md, commit, and create an annotated git tag. Use when the user runs /release, asks to "release", "bump the version", "cut a version", or "add a changelog entry", and proactively at the end of any change that is about to be committed or PR'd without a version bump and changelog entry (every change in this repo gets both).
argument-hint: "[patch|minor|major|X.Y.Z] [short title]"
---

# Release

Every change merged to `main` in this repo ships with a version bump and a CHANGELOG entry. This skill does that consistently and tags the result.

Arguments (both optional): `$ARGUMENTS`
- First token: `patch`, `minor`, `major`, or an explicit `X.Y.Z`. If omitted, infer it (step 3).
- Remaining text: the release title. If omitted, derive a short title from the change.

## 1. Preflight

Run these and stop with an explanation if any check fails:

```bash
git rev-parse --abbrev-ref HEAD      # must NOT be main — releases ride on the feature branch's PR
git status --short                   # note uncommitted work; it may be part of this release
git fetch origin main --tags --quiet
node -p "require('./package.json').version"              # current branch version
git show origin/main:package.json | node -p "JSON.parse(require('fs').readFileSync(0)).version"  # main's version
```

- If on `main`, stop and suggest creating a branch first.
- If there are no changes vs `origin/main` (committed or uncommitted), there is nothing to release, so stop.
- If the branch already bumped the version past main's (an earlier `/release` on this branch), **update that entry in place**. Don't bump a second time: one PR = one version.

## 2. Understand the change

Read what is actually shipping. Don't rely only on commit messages:

```bash
git log --oneline origin/main..HEAD
git diff origin/main...HEAD --stat
git diff --stat                      # uncommitted
```

Read the relevant diffs so the changelog explains the *user-visible effect and why*, not just which files moved.

## 3. Choose the version (SemVer, 0.x rules)

The base is **the higher of the branch's and `origin/main`'s version**. This avoids two parallel PRs claiming the same number, which has happened here before. Then apply:

| Change | While `0.y.z` (current) | After `1.0.0` |
|---|---|---|
| Breaking change (data format, storage keys, API contract, removed feature) | minor | major |
| New user-facing feature (`Added`) | minor | minor |
| Bug fix, docs, deps, internal refactor, small tweak | patch | patch |

An explicit argument always wins. State the proposed version and the reason in one line, then continue. Don't ask unless the bump is ambiguous (e.g. maybe breaking).

Check the tag doesn't already exist: `git rev-parse -q --verify "refs/tags/vX.Y.Z"`. If it does, go to the next free version.

## 4. Bump the version

```bash
npm version X.Y.Z --no-git-tag-version
```

This updates `package.json` **and** `package-lock.json` together. Never hand-edit just one. Don't let npm commit or tag; this skill does that itself.

## 5. Update CHANGELOG.md (Keep a Changelog 1.1.0)

Format reference: https://keepachangelog.com/en/1.1.0/

Insert the new entry directly above the most recent version entry, below the file's intro. If a `## [Unreleased]` section exists, move its bullets into the new version and leave an empty `## [Unreleased]` heading behind.

```markdown
## [X.Y.Z] - YYYY-MM-DD

<One-line summary title of the release.>

### Fixed

- **What changed, in user terms.** Why it was wrong / why it matters, then how it was fixed, naming key files or functions in backticks (`src/utils/priceStorage.js`).

---
```

Rules:
- Date is today, ISO `YYYY-MM-DD`.
- Use **only** these section headings, in this order, omitting empty ones: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. Map loosely: docs/deps/housekeeping → `Changed`; CVE fixes → `Security`; new pages/features → `Added`.
- Write for someone using or maintaining the app: lead with the effect, then the cause and the fix. Match the depth of recent entries, which explain *why* and not just *what*. Don't paste commit messages.
- Keep the `---` separator between versions, matching the rest of the file.
- Older entries use the legacy `## Version X - date - Title` style. Leave them alone unless the user asks to migrate them.
- **Compare links:** if a tag for the previous version exists, add or update a reference link at the bottom of the file:
  `[X.Y.Z]: https://github.com/dauble/fantasy-f1/compare/vPREV...vX.Y.Z`
  and point `[Unreleased]` (if present) at `compare/vX.Y.Z...HEAD`. If the previous tag doesn't exist, skip the link rather than writing a broken one.

## 6. Commit

- **Uncommitted feature work present:** commit it together with the bump and changelog in one commit (this repo's convention). Use a descriptive message about the change itself, not "release".
- **Feature work already committed:** make a separate commit with just `package.json`, `package-lock.json`, and `CHANGELOG.md`, message `Release vX.Y.Z: <title>`.

Stage files explicitly by name; never `git add -A`. Include the session's required commit attribution trailer.

## 7. Tag

```bash
git tag -a vX.Y.Z -m "vX.Y.Z - <title>"
```

Annotated tags only (`-a`), always with the `v` prefix. If re-running on a branch whose release commit changed, move the local tag with `git tag -fa` **only if it has not been pushed** (`git ls-remote --tags origin vX.Y.Z` is empty). Never force-move a pushed tag.

## 8. Push (ask first)

Pushing is outward-facing, so ask before doing it. When approved:

```bash
git push -u origin HEAD
git push origin vX.Y.Z
```

PRs here are merged with merge commits, so the tagged branch commit stays in `main`'s history. If a PR is ever squash-merged, the tag would point at an orphaned commit. In that case, after merging, re-tag the squash commit on `main` and tell the user.

## 9. Report

Finish with a short summary: the old and new version and why, the changelog section(s) added, the commit SHA, the tag, and whether anything was pushed.
