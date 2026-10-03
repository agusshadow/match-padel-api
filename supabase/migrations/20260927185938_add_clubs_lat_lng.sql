alter table public.clubs
  add column if not exists lat double precision,
  add column if not exists lng double precision;

comment on column public.clubs.lat is 'Latitude, WGS84 — used for the map view (Trello card #49)';
comment on column public.clubs.lng is 'Longitude, WGS84 — used for the map view (Trello card #49)';