-- Unauthenticated (anon) requests have no business updating any user row at all
-- (the RLS policy already blocks it since auth.uid() is null, but revoke the grant
-- outright for defense in depth / consistency with the authenticated-role fix).
revoke update on table public.users from anon;