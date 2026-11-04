-- LiteLearn PRD v2: NIM authentication schema migration.

alter table public.profiles
  add column if not exists nim text;

update public.profiles
  set nim = upper(split_part(email, '@', 1))
  where nim is null and email is not null;

alter table public.profiles
  alter column nim set not null;

alter table public.profiles
  add constraint profiles_nim_unique unique (nim);

-- Update auth trigger to read NIM from user metadata.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_nim text;
begin
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, 'student'), '@', 1)
  );

  v_nim := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nim'), ''),
    split_part(coalesce(new.email, '11S22001'), '@', 1)
  );

  insert into public.profiles (id, nim, display_name)
  values (new.id, upper(v_nim), v_display_name)
  on conflict (id) do update
    set nim = excluded.nim,
        display_name = excluded.display_name;

  return new;
end;
$$;

