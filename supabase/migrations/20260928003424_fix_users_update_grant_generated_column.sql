-- full_name is a GENERATED column (computed from first_name/last_name) — it was
-- never actually updatable, so granting UPDATE on it was a no-op. The real
-- columns a user edits for their display name are first_name/last_name.
grant update (first_name, last_name) on public.users to authenticated;