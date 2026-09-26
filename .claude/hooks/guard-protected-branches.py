#!/usr/bin/env python3
"""Claude Code PreToolUse hook: keep agents off the protected branches.

Blocks (exit code 2) Bash commands that would commit to, or push to,
`main` or `develop`, and force pushes. Agents must work on a feature
branch and open a pull request against `develop`.
The environment variable ALLOW_PROTECTED_BRANCH only affects the git hooks in
.githooks/ (for the human); it is intentionally NOT honoured here.
"""
import json
import re
import subprocess
import sys

PROTECTED = {"main", "develop"}


def block(message):
    print(f"BLOCKED: {message}", file=sys.stderr)
    sys.exit(2)


try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if data.get("tool_name") != "Bash":
    sys.exit(0)

command = (data.get("tool_input") or {}).get("command") or ""
cwd = data.get("cwd") or "."


def current_branch():
    result = subprocess.run(
        ["git", "-C", cwd, "branch", "--show-current"], capture_output=True, text=True
    )
    return result.stdout.strip()


HINT = (
    " Work on a branch (git switch -c feat/<topic>) and open a pull request against"
    " develop. Releases go through a release/vX.Y.Z branch."
)
REFSPEC = re.compile(r"^\+?(?:[^:\s]+:)?(?:refs/heads/)?(main|develop)$")

switched = False  # a branch switch earlier in the same command line
for raw in re.split(r"&&|\|\||;|\n|\|", command):
    part = raw.strip()
    match = re.match(r"^(?:\w+=\S+\s+)*git\s+(?:-C\s+\S+\s+|-c\s+\S+\s+)*(\S+)(.*)$", part)
    if not match:
        continue
    sub, rest = match.group(1), match.group(2).split()

    if sub in ("switch", "checkout"):
        switched = True
    elif sub == "commit":
        if not switched and current_branch() in PROTECTED:
            block(f"direct commits to '{current_branch()}' are not allowed." + HINT)
    elif sub == "push":
        flags = [t for t in rest if t.startswith("-")]
        args = [t for t in rest if not t.startswith("-")]
        if "--force" in flags or "-f" in flags:
            block("force pushes are not allowed (use --force-with-lease on your own feature branch only).")
        if "--all" in flags or "--mirror" in flags:
            block("pushing all refs is not allowed.")
        refspecs = args[1:]  # args[0] is the remote
        if any(REFSPEC.match(t) for t in refspecs):
            block("pushing to 'main' or 'develop' is not allowed." + HINT)
        if not refspecs and not switched and current_branch() in PROTECTED:
            block(f"you are on '{current_branch()}'; pushing it directly is not allowed." + HINT)

sys.exit(0)
