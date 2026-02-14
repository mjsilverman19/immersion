-- Create follows table
create table public.follows (
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

-- Create saves table
create table public.saves (
  user_id uuid references profiles(id) on delete cascade,
  list_id uuid references lists(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, list_id)
);

-- Enable RLS
alter table public.follows enable row level security;
alter table public.saves enable row level security;

-- Follows: public read, self insert/delete
create policy "Follows are publicly readable"
  on public.follows for select
  using (true);

create policy "Users can follow others"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow others"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- Saves: self read/write/delete
create policy "Users can see their saves"
  on public.saves for select
  using (auth.uid() = user_id);

create policy "Users can save lists"
  on public.saves for insert
  with check (auth.uid() = user_id);

create policy "Users can unsave lists"
  on public.saves for delete
  using (auth.uid() = user_id);
