-- Create cities table
create table public.cities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  country text not null,
  country_code text not null,
  latitude double precision not null,
  longitude double precision not null,
  timezone text,
  photo_url text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.cities enable row level security;

-- Public read access
create policy "Cities are publicly readable"
  on public.cities for select
  using (true);

-- Index
create index idx_cities_slug on public.cities(slug);
