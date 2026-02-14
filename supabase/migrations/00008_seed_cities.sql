-- Seed 5 cities with real coordinates
insert into public.cities (name, slug, country, country_code, latitude, longitude, timezone)
values
  ('Lisbon', 'lisbon', 'Portugal', 'PT', 38.7223, -9.1393, 'Europe/Lisbon'),
  ('Mexico City', 'mexico-city', 'Mexico', 'MX', 19.4326, -99.1332, 'America/Mexico_City'),
  ('Seoul', 'seoul', 'South Korea', 'KR', 37.5665, 126.978, 'Asia/Seoul'),
  ('Porto', 'porto', 'Portugal', 'PT', 41.1579, -8.6291, 'Europe/Lisbon'),
  ('Chiang Mai', 'chiang-mai', 'Thailand', 'TH', 18.7061, 98.9817, 'Asia/Bangkok')
on conflict (slug) do nothing;
