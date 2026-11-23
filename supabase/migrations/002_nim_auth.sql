-- LiteLearn PRD v2: NIM authentication schema migration.

alter table public.profiles
  add column if not exists nim text;

alter table public.profiles
  alter column email drop not null;

update public.profiles
  set nim = upper(split_part(email, '@', 1))
  where nim is null and email is not null;

alter table public.profiles
  alter column nim set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_nim_unique'
  ) then
    alter table public.profiles
      add constraint profiles_nim_unique unique (nim);
  end if;
end;
$$;

-- Update auth trigger to read NIM from user metadata and persist email safely.
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

  insert into public.profiles (id, email, nim, display_name)
  values (new.id, lower(nullif(trim(coalesce(new.email, '')), '')), upper(v_nim), v_display_name)
  on conflict (id) do update
    set nim = excluded.nim,
        email = coalesce(excluded.email, public.profiles.email),
        display_name = excluded.display_name;

  return new;
end;
$$;

