
-- Seed 3 clubs with courts for testing
INSERT INTO public.clubs (id, name, slug, description, address, city, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Padel Buenos Aires', 'padel-buenos-aires', 'El mejor club de padel en el centro de Buenos Aires', 'Av. Corrientes 1234', 'Buenos Aires', true),
  ('22222222-2222-2222-2222-222222222222', 'Club Deportivo Palermo', 'club-deportivo-palermo', 'Complejo deportivo con 6 canchas de padel en Palermo', 'Av. Santa Fe 4567', 'Buenos Aires', true),
  ('33333333-3333-3333-3333-333333333333', 'Padel Belgrano', 'padel-belgrano', 'Canchas de padel en Belgrano con vestuarios y cafetería', 'Cabildo 890', 'Buenos Aires', true)
ON CONFLICT (id) DO NOTHING;

-- Courts for club 1
INSERT INTO public.courts (id, club_id, name, surface, is_indoor, price_per_hour, is_active) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cancha 1', 'indoor', true, 4500, true),
  ('aaaa0001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Cancha 2', 'outdoor', false, 3500, true),
  ('aaaa0001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Cancha 3', 'panoramic', false, 5000, true)
ON CONFLICT (id) DO NOTHING;

-- Courts for club 2
INSERT INTO public.courts (id, club_id, name, surface, is_indoor, price_per_hour, is_active) VALUES
  ('aaaa0002-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Cancha A', 'indoor', true, 4000, true),
  ('aaaa0002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Cancha B', 'indoor', true, 4000, true),
  ('aaaa0002-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Cancha C', 'outdoor', false, 3000, true)
ON CONFLICT (id) DO NOTHING;

-- Courts for club 3
INSERT INTO public.courts (id, club_id, name, surface, is_indoor, price_per_hour, is_active) VALUES
  ('aaaa0003-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Cancha Norte', 'indoor', true, 3800, true),
  ('aaaa0003-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Cancha Sur', 'outdoor', false, 2800, true)
ON CONFLICT (id) DO NOTHING;

-- Court schedules (Mon-Sun for all courts, 8am-10pm, 90min slots)
INSERT INTO public.court_schedules (court_id, day_of_week, open_time, close_time, slot_minutes, is_active)
SELECT c.id, d.day, '08:00:00'::time, '22:00:00'::time, 90, true
FROM public.courts c
CROSS JOIN (SELECT generate_series(0,6) AS day) d
WHERE c.is_active = true
ON CONFLICT DO NOTHING;
