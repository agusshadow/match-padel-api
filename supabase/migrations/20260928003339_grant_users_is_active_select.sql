-- apps/admin's UsersPage.tsx selects is_active directly (not through service_role);
-- it was missed in the initial column grant for card #11.
grant select (is_active) on public.users to anon, authenticated;