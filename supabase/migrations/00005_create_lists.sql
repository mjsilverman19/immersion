-- Create lists table
create table public.lists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  city_id uuid references cities(id),
  cover_photo_url text,
  is_public boolean default true,
  save_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create list_items table
create table public.list_items (
  id uuid default gen_random_uuid() primary key,
  list_id uuid references lists(id) on delete cascade not null,
  place_id uuid references places(id) on delete cascade not null,
  position smallint not null,
  note text,
  unique(list_id, place_id)
);

-- Enable RLS
alter table public.lists enable row level security;
alter table public.list_items enable row level security;

-- Lists: public read if public, self write
create policy "Public lists are readable"
  on public.lists for select
  using (is_public = true or auth.uid() = user_id);

create policy "Users can insert their own lists"
  on public.lists for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own lists"
  on public.lists for update
  using (auth.uid() = user_id);

create policy "Users can delete their own lists"
  on public.lists for delete
  using (auth.uid() = user_id);

-- List items: readable if list is public
create policy "List items are readable with list"
  on public.list_items for select
  using (
    exists (
      select 1 from public.lists
      where lists.id = list_items.list_id
      and (lists.is_public = true or lists.user_id = auth.uid())
    )
  );

create policy "Users can manage their list items"
  on public.list_items for insert
  with check (
    exists (
      select 1 from public.lists
      where lists.id = list_items.list_id
      and lists.user_id = auth.uid()
    )
  );

create policy "Users can update their list items"
  on public.list_items for update
  using (
    exists (
      select 1 from public.lists
      where lists.id = list_items.list_id
      and lists.user_id = auth.uid()
    )
  );

create policy "Users can delete their list items"
  on public.list_items for delete
  using (
    exists (
      select 1 from public.lists
      where lists.id = list_items.list_id
      and lists.user_id = auth.uid()
    )
  );

-- Indexes
create index idx_lists_user_id on public.lists(user_id);
create index idx_lists_city_id on public.lists(city_id);
create index idx_list_items_list_id on public.list_items(list_id);
