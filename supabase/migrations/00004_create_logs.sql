-- Create logs table
create table public.logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  place_id uuid references places(id) on delete cascade not null,
  rating smallint check (rating >= 1 and rating <= 5) not null,
  tags text[] default '{}',
  review text,
  photos text[],
  is_local_log boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, place_id)
);

-- Enable RLS
alter table public.logs enable row level security;

-- Public read access
create policy "Logs are publicly readable"
  on public.logs for select
  using (true);

-- Self write access
create policy "Users can insert their own logs"
  on public.logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own logs"
  on public.logs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own logs"
  on public.logs for delete
  using (auth.uid() = user_id);

-- Indexes
create index idx_logs_user_id on public.logs(user_id);
create index idx_logs_place_id on public.logs(place_id);
create index idx_logs_created_at on public.logs(created_at desc);
