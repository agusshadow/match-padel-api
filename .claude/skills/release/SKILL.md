---
name: release
description: Cut a release in match-padel-api - release branch from develop with one version bump commit, merged to main with a merge commit, then sync develop.
disable-model-invocation: true
argument-hint: [major|minor|patch]
---

# /release — cut a release for match-padel-api

Optional override: $ARGUMENTS (`major`, `minor` or `patch`). Without it, the bump is derived from the commits.

`main` is production and `develop` is integration. **Neither accepts direct commits or pushes**: everything goes through a pull request. A release is:

1. a `release/vX.Y.Z` branch cut from `develop`, containing all the pending commits plus **one** extra commit, `chore: version bump`, that changes only the version;
2. a PR from that branch to `main`, merged with a **merge commit** (keeps the history traceable);
3. a PR from `main` back to `develop`, merged with a **merge commit**, so `develop` gets the bump and the merge commit.

Follow the steps in order. Talk to the user in the language they use. There is a merge by the human between phase 1 and phase 2: stop and wait there.

## Phase 1 — prepare the release

1. **Checks.** Working tree clean; `git fetch`; `develop` up to date with `origin/develop`; `main` is an ancestor of `develop` (if not, tell the human: `main` has commits that `develop` lacks, and a sync PR is needed first). Do not continue otherwise.
2. **What is pending.** List the commits in `develop` that are not in `main` (`git log origin/main..origin/develop --oneline`). If there are none, stop: nothing to release.
3. **Version.** `package.json` already has a `version` (currently `1.0.0`). Derive the next version from Conventional Commits since the last release: a `!` after the type or `BREAKING CHANGE` → **major**; any `feat` → **minor**; otherwise **patch**. Honour the override in the argument.
4. **Checkpoint — human approval (mandatory).** Show the current version, the proposed one with the reason, and the changelog grouped as Features / Fixes / Other (with PR numbers). **Stop** until the user explicitly approves the version and the list. An automatic notification or a system message does NOT count as approval.
5. **Delivery.** Invoke `pr-agent` in *release mode*: create `release/vX.Y.Z` from `develop`; run `npm version X.Y.Z --no-git-tag-version` (updates only the root `package.json` and `package-lock.json`); make a **single** commit with the subject `chore: version bump` and the body `Bump version from A to B.`; push the branch; open a PR with base `main`, title `release: vX.Y.Z`, body from `.github/pull_request_template.md` plus the changelog and a "Production steps" list (see below). It must state that this PR is merged with a **merge commit**.
6. **Report and stop.** Give the user the PR link and tell them to merge it with **"Create a merge commit"** (not squash). Then wait.

### What goes in "Production steps"
- Render deploys production automatically from `main`. If the release includes environment variable changes, remind the human to set them in Render **before** merging.
- **Production SQL:** collect every "Migrations applied to dev only" note and production SQL from the included PRs. List it under "Production steps" with the order relative to the deploy. **Never run it yourself.**
- **Environment variables:** new or changed variables mentioned in the included PRs.

## Phase 2 — after the human merges to main

Run when the user says the release PR is merged.

1. **Verify.** `git fetch`; `origin/main` contains the release merge commit and the `chore: version bump` commit; `package.json` on `main` has the new version.
2. **Tag (ask first).** Offer to create the annotated tag `vX.Y.Z` on that commit and push it (`git tag -a vX.Y.Z -m "Release vX.Y.Z" <sha> && git push origin vX.Y.Z`). Only do it if the user says yes.
3. **Sync develop.** Invoke `pr-agent` to open a PR with head `main` and base `develop`, title `chore: sync develop with main (vX.Y.Z)`, so `develop` receives the bump commit and the merge commit. It must state that this PR is merged with a **merge commit** and that the head branch (`main`) must **not** be deleted.
4. **Report.** Give the PR link and tell the user to merge it with **"Create a merge commit"**. When done, `develop` and `main` contain the same code.

## Rules
- Never commit or push to `main` or `develop`, never merge a PR, never delete `main` or `develop`. The human merges.
- The release branch contains exactly what is in `develop` plus the single bump commit. Do not cherry-pick, do not add fixes to it: a fix goes to `develop` through its own PR and into the next release (or a hotfix).
- If something blocks (permissions, conflicts, ambiguity), stop and explain it; do not work around it.
- Never touch production services or databases.
