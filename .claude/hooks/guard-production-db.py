#!/usr/bin/env python3
"""Claude Code PreToolUse hook: guard the PRODUCTION Supabase project.

Applies only to Supabase MCP calls whose project_id is production. Anything
aimed at another project (dev) is not this hook's business and passes through.

On production:
  * apply_migration  -> allowed only if a file in supabase/migrations/ has that
                        name and byte-identical content ("file first"). If the
                        SQL contains destructive or security-weakening
                        statements, the human is asked to confirm instead.
  * execute_sql      -> read-only queries, plus the single version-alignment
                        update of supabase_migrations.schema_migrations that the
                        db-migration skill prescribes (and only for a file that
                        exists). Anything else is blocked: use apply_migration.
  * any other write tool (edge functions, branches, pause/restore) -> blocked.

Decisions: exit 2 + message on stderr blocks; a JSON "ask" decision makes
Claude Code stop and ask the human; no output means "no opinion" (normal
permission rules apply). Card #64.
"""
import glob
import json
import os
import re
import subprocess
import sys

PROD_PROJECT_ID = "ebdnlrwzhthqflsbdzvu"
WRITE_TOOLS = {
    "apply_migration", "execute_sql", "deploy_edge_function", "merge_branch", "reset_branch",
    "delete_branch", "rebase_branch", "create_branch", "pause_project", "restore_project",
    "create_project",
}
READ_ONLY_TOOLS = {
    "list_migrations", "list_tables", "list_extensions", "get_advisors",
    "get_project", "get_project_url", "get_publishable_keys", "get_edge_function",
    "list_edge_functions", "list_branches", "get_logs", "query_logs", "search_docs",
    "generate_typescript_types", "list_projects", "get_organization",
    "list_organizations", "get_cost",
}


def deny(message):
    print(f"BLOCKED (production database guard): {message}", file=sys.stderr)
    sys.exit(2)


def ask(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def repo_root(data):
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR")
    if project_dir:
        return project_dir
    cwd = data.get("cwd") or "."
    result = subprocess.run(
        ["git", "-C", cwd, "rev-parse", "--show-toplevel"], capture_output=True, text=True
    )
    return result.stdout.strip() or cwd


def strip_sql(sql):
    """Remove comments, string literals and dollar-quoted bodies, then lowercase."""
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    sql = re.sub(r"--[^\n]*", " ", sql)
    sql = re.sub(r"\$([A-Za-z_]*)\$.*?\$\1\$", " ", sql, flags=re.S)
    sql = re.sub(r"'(?:[^']|'')*'", "''", sql)
    return re.sub(r"\s+", " ", sql).strip().lower()


def destructive_findings(sql):
    """Return human-readable reasons why this SQL needs the human's go-ahead."""
    findings = []
    text = strip_sql(sql)
    raw = text  # comments, string literals and dollar-quoted bodies are already removed

    checks = [
        (r"\bdrop\s+(table|schema|type|extension|database|view|materialized\s+view|sequence|role|publication)\b",
         "drops a table, schema, type, extension or similar object"),
        (r"\balter\s+table\b[^;]*\bdrop\s+column\b", "drops a column"),
        (r"\balter\s+table\b[^;]*\bdrop\s+constraint\b", "drops a constraint"),
        (r"\balter\s+table\b[^;]*\balter\s+column\b[^;]*\b(set\s+data\s+)?type\b", "changes a column type"),
        (r"\balter\s+(table|type|index|view|sequence)\b[^;]*\brename\b", "renames an object or column"),
        (r"\btruncate\b", "truncates a table"),
        (r"\bdisable\s+row\s+level\s+security\b", "disables row level security"),
        (r"\bgrant\s+(all(\s+privileges)?|insert|update|delete|truncate)\s+on\b[^;]*\bto\b[^;]*\b(anon|public|authenticated)\b",
         "grants table-level write access to anon, authenticated or public"),
        (r"\bcreate\s+policy\b[^;]*\bfor\s+(insert|update|delete|all)\b[^;]*\b(with\s+check|using)\s*\(\s*true\s*\)",
         "creates a write policy that is open to everyone (using/with check true)"),
    ]
    for pattern, label in checks:
        if re.search(pattern, raw):
            findings.append(label)

    for statement in text.split(";"):
        statement = statement.strip()
        if re.match(r"^delete\s+from\b", statement) and not re.search(r"\bwhere\b", statement):
            findings.append("deletes rows without a WHERE clause")
        if re.match(r"^update\b", statement) and not re.search(r"\bwhere\b", statement):
            findings.append("updates rows without a WHERE clause")
    return sorted(set(findings))


WRITE_WORDS = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|vacuum|"
    r"reindex|cluster|refresh|comment|lock|set|reset|merge|into)\b"
)
VERSION_ALIGNMENT = re.compile(
    r"^\s*update\s+supabase_migrations\.schema_migrations\s+set\s+version\s*=\s*'(\d{14})'\s+"
    r"where\s+name\s*=\s*'([a-z0-9_]+)'\s+and\s+version\s*<>\s*'\1'\s*;?\s*$",
    re.I,
)


def is_read_only(sql):
    text = strip_sql(sql)
    if not text:
        return False
    for statement in (s.strip() for s in text.split(";") if s.strip()):
        if not re.match(r"^(select|with|show|explain|values|table)\b", statement):
            return False
        if WRITE_WORDS.search(statement):
            return False
    return True


def main(raw_input):
    try:
        data = json.loads(raw_input)
    except Exception:
        # Unreadable input: fail closed if it even mentions production.
        if PROD_PROJECT_ID in raw_input:
            deny("could not parse the tool call that mentions the production project.")
        sys.exit(0)

    tool_name = data.get("tool_name") or ""
    tool_input = data.get("tool_input") or {}
    if "__" not in tool_name or not tool_name.startswith("mcp__"):
        sys.exit(0)
    action = tool_name.rsplit("__", 1)[-1]
    if action not in WRITE_TOOLS and action not in READ_ONLY_TOOLS:
        sys.exit(0)  # not a Supabase tool this hook knows about
    if tool_input.get("project_id") != PROD_PROJECT_ID:
        sys.exit(0)  # dev or anything else: not this hook's business
    if action in READ_ONLY_TOOLS:
        sys.exit(0)

    root = repo_root(data)
    migrations = os.path.join(root, "supabase", "migrations")

    if action == "apply_migration":
        name = tool_input.get("name") or ""
        query = tool_input.get("query") or ""
        matches = glob.glob(os.path.join(migrations, f"*_{name}.sql"))
        if not name or not matches:
            deny(f"no migration file named '*_{name}.sql' in supabase/migrations/. Production only "
                 "receives migrations that already exist in the repo (file first, see the "
                 "db-migration skill).")
        with open(matches[0], encoding="utf-8") as f:
            content = f.read()
        if content != query:
            deny(f"the SQL being applied is not byte-identical to {os.path.basename(matches[0])}. "
                 "Apply the file's exact contents; never a modified copy.")
        findings = destructive_findings(query)
        if findings:
            ask("This production migration needs your go-ahead: it " + "; it ".join(findings) + ". "
                f"File: {os.path.basename(matches[0])}.")
        sys.exit(0)

    if action == "execute_sql":
        query = tool_input.get("query") or ""
        alignment = VERSION_ALIGNMENT.match(query)
        if alignment:
            version, name = alignment.group(1), alignment.group(2)
            if os.path.exists(os.path.join(migrations, f"{version}_{name}.sql")):
                sys.exit(0)
            deny(f"version alignment for '{name}' does not match any file "
                 f"supabase/migrations/{version}_{name}.sql.")
        if is_read_only(query):
            sys.exit(0)
        deny("write SQL on production through execute_sql is not allowed. Use apply_migration with "
             "a file from supabase/migrations/ (db-migration skill, 'Promotion to production').")

    deny(f"'{action}' is not allowed on the production project from an agent session.")


if __name__ == "__main__":
    raw = sys.stdin.read()
    try:
        main(raw)
    except SystemExit:
        raise
    except Exception as error:  # a crash would otherwise be a non-blocking error: fail closed
        if PROD_PROJECT_ID in raw:
            deny(f"the guard itself failed ({type(error).__name__}: {error}); not letting a "
                 "production call through unchecked.")
        sys.exit(0)
