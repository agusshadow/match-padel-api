
-- Fix: make handle_new_user use UPSERT so a subsequent INSERT from the API
-- (with the real full_name and username) will update the row instead of failing
-- with duplicate key 23505.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
begin
  insert into public.users (id, full_name, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'),
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set
      full_name = coalesce(excluded.full_name, public.users.full_name),
      username  = coalesce(excluded.username,  public.users.username),
      avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url);
  return new;
end;
$$;
