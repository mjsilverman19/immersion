-- Function to increment contribution count and update unlocked cities
create or replace function public.handle_new_log()
returns trigger
language plpgsql
security definer
as $$
declare
  v_home_city_id uuid;
  v_count int;
begin
  -- Get user's home city
  select home_city_id into v_home_city_id
  from public.profiles
  where id = NEW.user_id;

  -- Get place's city
  -- Increment contribution count
  update public.profiles
  set
    contribution_count = contribution_count + 1,
    updated_at = now()
  where id = NEW.user_id;

  -- Check if user has reached unlock threshold
  select contribution_count into v_count
  from public.profiles
  where id = NEW.user_id;

  -- If threshold reached, unlock all cities
  if v_count >= 10 then
    update public.profiles
    set unlocked_cities = (select array_agg(id) from public.cities)
    where id = NEW.user_id;
  end if;

  return NEW;
end;
$$;

-- Create trigger
create trigger on_log_insert
  after insert on public.logs
  for each row
  execute function public.handle_new_log();

-- Function to update save_count on lists
create or replace function public.handle_save_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    update public.lists
    set save_count = save_count + 1
    where id = NEW.list_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.lists
    set save_count = save_count - 1
    where id = OLD.list_id;
    return OLD;
  end if;
  return null;
end;
$$;

create trigger on_save_insert
  after insert on public.saves
  for each row
  execute function public.handle_save_change();

create trigger on_save_delete
  after delete on public.saves
  for each row
  execute function public.handle_save_change();
