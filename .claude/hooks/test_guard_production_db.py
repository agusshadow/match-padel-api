#!/usr/bin/env python3
"""Tests for guard-production-db.py. Run: python3 .claude/hooks/test_guard_production_db.py"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "guard-production-db.py")
PROD = "ebdnlrwzhthqflsbdzvu"
DEV = "vrnonxpxksaruvsvbplt"
SERVER = "mcp__444d5521-8a8e-4372-987d-b340a21f3b35__"

SAFE_SQL = "create table public.things (id uuid primary key);\nalter table public.things enable row level security;\n"


class GuardTest(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.root, "supabase", "migrations"))

    def write_migration(self, version, name, sql):
        path = os.path.join(self.root, "supabase", "migrations", f"{version}_{name}.sql")
        with open(path, "w", encoding="utf-8") as f:
            f.write(sql)

    def run_hook(self, action, **tool_input):
        payload = {"tool_name": SERVER + action, "tool_input": tool_input, "cwd": self.root}
        env = dict(os.environ, CLAUDE_PROJECT_DIR=self.root)
        result = subprocess.run([sys.executable, HOOK], input=json.dumps(payload),
                                capture_output=True, text=True, env=env)
        decision = None
        if result.stdout.strip():
            decision = json.loads(result.stdout)["hookSpecificOutput"]["permissionDecision"]
        return result.returncode, decision, result.stdout + result.stderr

    def assertAllowed(self, *args, **kw):
        code, decision, out = self.run_hook(*args, **kw)
        self.assertEqual((code, decision), (0, None), out)

    def assertBlocked(self, *args, **kw):
        code, _, out = self.run_hook(*args, **kw)
        self.assertEqual(code, 2, out)

    def assertAsks(self, *args, **kw):
        code, decision, out = self.run_hook(*args, **kw)
        self.assertEqual((code, decision), (0, "ask"), out)

    # ---- not production / read only
    def test_dev_is_not_guarded(self):
        self.assertAllowed("apply_migration", project_id=DEV, name="whatever", query="drop table users;")
        self.assertAllowed("execute_sql", project_id=DEV, query="delete from users;")

    def test_other_servers_ignored(self):
        payload = {"tool_name": "mcp__github__merge_pull_request", "tool_input": {"project_id": PROD}}
        r = subprocess.run([sys.executable, HOOK], input=json.dumps(payload), capture_output=True, text=True)
        self.assertEqual((r.returncode, r.stdout), (0, ""))

    def test_production_read_tools(self):
        self.assertAllowed("list_migrations", project_id=PROD)
        self.assertAllowed("get_advisors", project_id=PROD, type="security")

    # ---- apply_migration
    def test_file_first(self):
        self.assertBlocked("apply_migration", project_id=PROD, name="add_things", query=SAFE_SQL)

    def test_identical_file_is_allowed(self):
        self.write_migration("20261010120000", "add_things", SAFE_SQL)
        self.assertAllowed("apply_migration", project_id=PROD, name="add_things", query=SAFE_SQL)

    def test_modified_copy_is_blocked(self):
        self.write_migration("20261010120000", "add_things", SAFE_SQL)
        self.assertBlocked("apply_migration", project_id=PROD, name="add_things", query=SAFE_SQL + "-- x")

    def apply_file(self, sql):
        self.write_migration("20261010120000", "change_x", sql)
        return self.run_hook("apply_migration", project_id=PROD, name="change_x", query=sql)

    def test_destructive_asks(self):
        for sql in [
            "alter table public.users drop column phone;",
            "drop table public.users;",
            "truncate public.users;",
            "delete from public.users;",
            "update public.users set elo = 1000;",
            "alter table public.users alter column elo type bigint;",
            "alter table public.users rename column elo to rating;",
            "alter table public.users disable row level security;",
            "create policy \"open\" on public.users for insert with check (true);",
            "grant all on table public.users to anon;",
        ]:
            code, decision, out = self.apply_file(sql)
            self.assertEqual((code, decision), (0, "ask"), sql + " -> " + out)

    def test_additive_and_redefinitions_pass(self):
        for sql in [
            "alter table public.users add column bio text;",
            "create index on public.users(elo);",
            "drop policy if exists \"p\" on public.users;\ncreate policy \"p\" on public.users for select using (true);",
            "create or replace function f() returns void language plpgsql as $$ begin delete from t; end; $$;",
            "update public.users set onboarding_completed_at = now() where onboarding_completed_at is null;",
            "-- drop table users;\nalter table public.users add column x int; /* truncate t */",
            "grant update (first_name) on public.users to authenticated;",
            "insert into achievements (code) values ('drop table x') on conflict do nothing;",
        ]:
            code, decision, out = self.apply_file(sql)
            self.assertEqual((code, decision), (0, None), sql + " -> " + out)

    # ---- execute_sql
    def test_execute_sql_read_only(self):
        self.assertAllowed("execute_sql", project_id=PROD, query="select count(*) from users")
        self.assertAllowed("execute_sql", project_id=PROD, query="with a as (select 1) select * from a;")
        self.assertAllowed("execute_sql", project_id=PROD, query="select version, name from supabase_migrations.schema_migrations")

    def test_execute_sql_writes_blocked(self):
        for q in ["insert into users values (1)", "delete from users where id = 1", "drop table users",
                  "select 1; delete from users where true", "select * into new_t from users",
                  "with d as (delete from users where true returning *) select * from d",
                  "update supabase_migrations.schema_migrations set version = '1'"]:
            self.assertBlocked("execute_sql", project_id=PROD, query=q)

    def test_version_alignment(self):
        q = ("update supabase_migrations.schema_migrations set version = '20261010120000' "
             "where name = 'add_things' and version <> '20261010120000';")
        self.assertBlocked("execute_sql", project_id=PROD, query=q)  # no file yet
        self.write_migration("20261010120000", "add_things", SAFE_SQL)
        self.assertAllowed("execute_sql", project_id=PROD, query=q)

    # ---- fail closed
    def test_garbage_mentioning_production_is_blocked(self):
        env = dict(os.environ, CLAUDE_PROJECT_DIR=self.root)
        r = subprocess.run([sys.executable, HOOK], input="not json " + PROD, capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 2, r.stderr)
        r = subprocess.run([sys.executable, HOOK], input="not json at all", capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 0)

    def test_unexpected_crash_on_production_is_blocked(self):
        # migrations folder missing makes glob/open paths unusual; a non-string query must not crash through
        self.assertBlocked("apply_migration", project_id=PROD, name="x", query=None)

    # ---- other tools
    def test_other_write_tools_blocked(self):
        for action in ["deploy_edge_function", "merge_branch", "reset_branch", "pause_project", "delete_branch"]:
            self.assertBlocked(action, project_id=PROD)


class RealMigrations(unittest.TestCase):
    """The history itself, as the guard would see it if it were promoted today."""

    def test_report(self):
        root = os.path.abspath(os.path.join(os.path.dirname(HOOK), "..", ".."))
        folder = os.path.join(root, "supabase", "migrations")
        files = sorted(f for f in os.listdir(folder) if f.endswith(".sql"))
        if not files:
            self.skipTest("no migrations")
        asks, blocked = [], []
        for f in files:
            with open(os.path.join(folder, f), encoding="utf-8") as fh:
                sql = fh.read()
            name = f.split("_", 1)[1][:-4]
            payload = {"tool_name": SERVER + "apply_migration", "cwd": root,
                       "tool_input": {"project_id": PROD, "name": name, "query": sql}}
            r = subprocess.run([sys.executable, HOOK], input=json.dumps(payload), capture_output=True,
                               text=True, env=dict(os.environ, CLAUDE_PROJECT_DIR=root))
            if r.returncode == 2:
                blocked.append(f)
            elif r.stdout.strip():
                reason = json.loads(r.stdout)["hookSpecificOutput"]["permissionDecisionReason"]
                asks.append((f, reason))
        print(f"\nreal history: {len(files)} files, {len(asks)} would ask, {len(blocked)} blocked")
        for f, reason in asks:
            print("  ASK  ", f, "->", reason.split("it ", 1)[1].split(". File")[0])
        self.assertEqual(blocked, [])


if __name__ == "__main__":
    unittest.main(verbosity=1)
