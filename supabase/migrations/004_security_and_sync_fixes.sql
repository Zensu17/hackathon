-- LiteLearn Migration 004: Revoke public SECURITY DEFINER oracle, enforce authoritative NIM derivation,
-- add server-side note LWW guard, and provide pre-signup join code check.

-- 1. Remove public/anon RPC access to material_class_id and inline RLS class checks on notes.
revoke all on function public.material_class_id(uuid) from public;
revoke all on function public.material_class_id(uuid) from anon, authenticated;

drop policy if exists notes_insert_own on public.notes;
create policy notes_insert_own
  on public.notes
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.materials m
      join public.courses c on c.id = m.course_id
      where m.id = material_id
        and c.class_id = public.current_user_class_id()
    )
  );

drop policy if exists notes_update_own on public.notes;
create policy notes_update_own
  on public.notes
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.materials m
      join public.courses c on c.id = m.course_id
      where m.id = material_id
        and c.class_id = public.current_user_class_id()
    )
  );

-- 2. Enforce Last-Write-Wins on public.notes so stale offline writes cannot overwrite newer server notes.
create or replace function public.enforce_notes_lww()
returns trigger
language plpgsql
as $$
begin
  if old.updated_at is not null
     and new.updated_at is not null
     and new.updated_at < old.updated_at then
    new.body := old.body;
    new.updated_at := old.updated_at;
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notes_lww on public.notes;
create trigger trg_notes_lww
  before update on public.notes
  for each row
  execute function public.enforce_notes_lww();

-- 3. Harden handle_new_auth_user to prevent NIM squatting via arbitrary emails or spoofed metadata.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_email text := lower(nullif(trim(coalesce(new.email, '')), ''));
  v_nim text;
begin
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
    'Student'
  );

  if v_email is not null and v_email like '%@nim.litelearn.local' then
    v_nim := upper(split_part(v_email, '@', 1));
    if v_nim !~ '^[0-9]{2}[A-Z][0-9]{5}$' then
      raise exception 'Invalid IT Del NIM format' using errcode = '22023';
    end if;
  else
    -- Non-NIM auth accounts cannot claim a student NIM via raw_user_meta_data.
    v_nim := upper(substr(replace(new.id::text, '-', ''), 1, 8));
  end if;

  insert into public.profiles (id, email, nim, display_name)
  values (new.id, v_email, v_nim, v_display_name)
  on conflict (id) do update
    set nim = excluded.nim,
        email = coalesce(excluded.email, public.profiles.email),
        display_name = excluded.display_name;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_nim_format_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_nim_format_check
      check (nim ~ '^[0-9]{2}[A-Z][0-9]{5}$' or nim ~ '^[0-9A-F]{8}$') not valid;
  end if;
end;
$$;

-- 4. Pre-signup class join-code existence check so typos do not create orphaned auth accounts.
create or replace function public.check_class_join_code(p_join_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    where c.join_code = upper(trim(coalesce(p_join_code, '')))
      and c.deleted_at is null
  );
$$;

revoke all on function public.check_class_join_code(text) from public;
grant execute on function public.check_class_join_code(text) to anon, authenticated;
