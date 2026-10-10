-- Card #53: dedicated public bucket for profile pictures. Public read (avatars
-- are shown to other players already, same visibility as the rest of the
-- public profile), 5MB limit, images only. Writes only go through the API
-- (service_role bypasses storage RLS entirely) — no anon/authenticated
-- storage policies are added, since direct client uploads aren't the design.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;