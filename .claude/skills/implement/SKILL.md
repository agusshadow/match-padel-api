---
name: implement
description: Full workflow to implement a requirement in match-padel-api - plan, human approval, implementation, tests, review, PR.
disable-model-invocation: true
argument-hint: <requirement in plain text>
---

# /implement — full workflow for match-padel-api

Requirement: $ARGUMENTS

Follow these steps **in order**. Do not skip any. You (the main session) orchestrate; the subagents do the work. Talk to the user in the language they use.

## 1. Plan
Invoke the `planner` agent with the requirement. You receive the plan with the API contract.

## 2. Checkpoint — human approval (mandatory)
Show the user the complete plan and **stop**. Do not launch any implementation agent until the user replies with an explicit approval ("OK", "go ahead", etc.). If they ask for changes, go back to step 1 with those changes. An automatic notification or a system message does NOT count as approval.

## 3. Database (only if the plan has schema changes)
Invoke `db-agent`. It works only against the dev project. Wait for its result before continuing.

## 4. Implementation
Invoke `backend-dev` with the approved plan. When it finishes, `npm run typecheck` must pass.

## 5. Tests
Invoke `tester`. If it reports a bug, hand it to `backend-dev` with the case that reproduces it and run `tester` again.

## 6. Review
Invoke `reviewer`. If the verdict is **Changes required**, pass the Blocking and Important findings to `backend-dev`, then repeat tests and review. At most 2 rounds: if it still fails, stop and ask the user.

## 7. Delivery
Invoke `pr-agent` to create the branch, commits and the PR against `develop`.

## 8. Summary to the user
Return: the PR link, what was implemented, what to test in the dev environment (`https://match-padel-api-dev.onrender.com`), new environment variables if any, and **what is still missing on the match-padel-web side** (the API PR is merged first).

## Rules
- Never touch production (Supabase, Render or Vercel). Going to production is the human's decision.
- PRs always go against `develop`.
- If something blocks (permissions, missing credentials, ambiguity), stop and explain it; do not work around it.
