-- Auto-update updated_at on row modification
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.logs
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.lists
  for each row execute function public.handle_updated_at();
