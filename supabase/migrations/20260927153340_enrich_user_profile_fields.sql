
-- New enums for the enriched registration profile
create type skill_level as enum ('beginner', 'intermediate', 'advanced');
create type preferred_hand as enum ('drive', 'backhand');

-- Split full_name into first_name/last_name, backfilling from existing data
alter table public.users
  add column first_name text,
  add column last_name text,
  add column skill_level skill_level,
  add column preferred_hand preferred_hand;

update public.users
set
  first_name = split_part(full_name, ' ', 1),
  last_name = nullif(trim(substring(full_name from position(' ' in full_name))), '')
where first_name is null;

-- Fallback for any row with no space in full_name (single-word name)
update public.users
set last_name = '-'
where last_name is null;

alter table public.users
  alter column first_name set not null,
  alter column last_name set not null;

-- Drop the old plain column and replace it with a generated one,
-- so full_name always stays in sync with first_name/last_name.
alter table public.users drop column full_name;

alter table public.users
  add column full_name text generated always as (
    trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
  ) stored;
