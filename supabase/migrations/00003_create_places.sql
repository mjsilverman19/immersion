-- Create places table
create table public.places (
  id uuid default gen_random_uuid() primary key,
  google_place_id text unique,
  name text not null,
  city_id uuid references cities(id) not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  category text not null,
  subcategory text,
  photo_urls text[],
  google_maps_url text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.places enable row level security;

-- Public read access
create policy "Places are publicly readable"
  on public.places for select
  using (true);

-- Authenticated users can insert places
create policy "Authenticated users can insert places"
  on public.places for insert
  with check (auth.role() = 'authenticated');

-- Indexes
create index idx_places_city_id on public.places(city_id);
create index idx_places_google_place_id on public.places(google_place_id);
create index idx_places_category on public.places(category);
