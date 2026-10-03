-- Card #10 (R1): a player must not be able to change their own role, elo or
-- is_active via the anon/authenticated key, even though the RLS row policy
-- (auth.uid() = id) lets them update their own row. Column-level GRANTs are the
-- correct way to restrict *which* columns an UPDATE may touch, independent of RLS.
revoke update on table public.users from authenticated;
grant update (full_name, phone, avatar_url) on public.users to authenticated;

-- Card #11 (R2): "users_public_read" (using (true)) currently exposes every column,
-- including phone and fcm_token, to anyone with the anon key. Restrict SELECT to
-- the public-profile columns only; phone/fcm_token stay readable solely via
-- service_role (the API), e.g. through the authenticated user's own session for
-- their own row is still covered separately by service_role-backed endpoints.
revoke select on table public.users from anon, authenticated;
grant select (
  id, username, first_name, last_name, full_name, avatar_url, elo, role,
  skill_level, preferred_hand, created_at
) on public.users to anon, authenticated;