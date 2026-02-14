-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  home_city_id uuid references cities(id),
  is_local_verified boolean default false,
  contribution_count int default 0,
  unlocked_cities uuid[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Public read access
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

-- Self write access
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Indexes
create index idx_profiles_username on public.profiles(username);
create index idx_profiles_home_city on public.profiles(home_city_id);
