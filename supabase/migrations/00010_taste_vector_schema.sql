-- Taste vector schema: scenario pairs, onboarding choices, place saves, notifications
-- Also adds taste_vector columns to profiles

--------------------------------------------------------------------------------
-- 1. scenario_pairs — pairwise onboarding questions
--------------------------------------------------------------------------------
create table public.scenario_pairs (
  id uuid default gen_random_uuid() primary key,
  dimension text not null,            -- e.g. "ambiance", "price", "social_mode"
  prompt text not null,               -- the evocative question shown to the user
  option_a_label text not null,
  option_a_description text not null,
  option_b_label text not null,
  option_b_description text not null,
  image_url_a text,                   -- nullable, for later
  image_url_b text,                   -- nullable, for later
  vector_direction float8[] not null, -- 8-element array: which axis this pair probes
  display_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.scenario_pairs enable row level security;

-- Publicly readable, no client writes
create policy "Scenario pairs are publicly readable"
  on public.scenario_pairs for select
  using (true);

create index idx_scenario_pairs_dimension on public.scenario_pairs(dimension);
create index idx_scenario_pairs_display_order on public.scenario_pairs(display_order);

--------------------------------------------------------------------------------
-- 2. onboarding_choices — records each user's quiz answers
--------------------------------------------------------------------------------
create table public.onboarding_choices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  scenario_pair_id uuid not null references scenario_pairs(id) on delete cascade,
  chose_b boolean not null,
  position smallint not null,         -- order shown to this user
  created_at timestamptz default now(),
  unique (user_id, scenario_pair_id)
);

alter table public.onboarding_choices enable row level security;

-- Readable and writable by the owning user only
create policy "Users can read their own onboarding choices"
  on public.onboarding_choices for select
  using (auth.uid() = user_id);

create policy "Users can insert their own onboarding choices"
  on public.onboarding_choices for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own onboarding choices"
  on public.onboarding_choices for update
  using (auth.uid() = user_id);

create index idx_onboarding_choices_user on public.onboarding_choices(user_id);

--------------------------------------------------------------------------------
-- 3. Profiles — add taste vector columns
--------------------------------------------------------------------------------
alter table public.profiles
  add column taste_vector float8[] default '{}',
  add column taste_vector_version integer default 0,
  add column onboarding_version integer default 1;

--------------------------------------------------------------------------------
-- 4. place_saves — saving individual places (distinct from list saves)
--------------------------------------------------------------------------------
create table public.place_saves (
  user_id uuid not null references profiles(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  source_user_id uuid references profiles(id) on delete set null,  -- the local who recommended it
  created_at timestamptz default now(),
  primary key (user_id, place_id)
);

alter table public.place_saves enable row level security;

-- Readable and writable by the owning user only
create policy "Users can read their own place saves"
  on public.place_saves for select
  using (auth.uid() = user_id);

create policy "Users can save places"
  on public.place_saves for insert
  with check (auth.uid() = user_id);

create policy "Users can unsave places"
  on public.place_saves for delete
  using (auth.uid() = user_id);

create index idx_place_saves_user on public.place_saves(user_id);
create index idx_place_saves_place on public.place_saves(place_id);

--------------------------------------------------------------------------------
-- 5. notifications
--------------------------------------------------------------------------------
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,                 -- "follow", "save", "message", "taste_match"
  actor_id uuid references profiles(id) on delete set null,
  target_id text,                     -- polymorphic reference
  read boolean not null default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

-- Readable by the owning user only
create policy "Users can read their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

-- System inserts notifications (via service role or triggers), but allow user to mark as read
create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

create index idx_notifications_user on public.notifications(user_id);
create index idx_notifications_user_unread on public.notifications(user_id) where read = false;
create index idx_notifications_created on public.notifications(created_at desc);
