-- LiteLearn Migration 003: RLS class-scope hardening for notes, safe NIM fallback, and rep-demotion guard.

-- Helper resolving a material's owning class_id for RLS validation.
create or replace function public.material_class_id(target_material_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.class_id
  from public.materials m
  join public.courses c on c.id = m.course_id
  where m.id = target_material_id;
$$;

-- Enforce that private notes can only target materials belonging to the caller's class.
drop policy if exists notes_insert_own on public.notes;
create policy notes_insert_own
  on public.notes
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.material_class_id(material_id) = public.current_user_class_id()
  );

drop policy if exists notes_update_own on public.notes;
create policy notes_update_own
  on public.notes
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.material_class_id(material_id) = public.current_user_class_id()
  );

-- Replace colliding hardcoded NIM fallback with collision-safe user UUID prefix fallback.
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
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Student'
  );

  v_nim := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nim'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    upper(substr(replace(new.id::text, '-', ''), 1, 8))
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

-- Guard join_class_by_code so an existing class rep cannot silently demote themselves and orphan their class.
create or replace function public.join_class_by_code(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_join_code, '')));
  v_class public.classes;
  v_existing public.profiles;
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into v_class
  from public.classes c
  where c.join_code = v_code
    and c.deleted_at is null
  limit 1;

  if not found then
    raise exception 'No class matched that join code' using errcode = 'P0002';
  end if;

  select *
  into v_existing
  from public.profiles p
  where p.id = v_uid
    and p.deleted_at is null
  limit 1;

  if not found then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  if v_existing.role = 'rep'
     and v_existing.class_id is not null
     and v_existing.class_id <> v_class.id then
    raise exception 'Class representatives cannot switch classes without transferring ownership' using errcode = '42501';
  end if;

  update public.profiles
  set class_id = v_class.id,
      role = case
        when v_existing.class_id = v_class.id and v_existing.role = 'rep' then 'rep'
        else 'student'
      end,
      updated_at = now()
  where id = v_uid
    and deleted_at is null
  returning * into v_profile;

  return jsonb_build_object(
    'class', to_jsonb(v_class),
    'profile', to_jsonb(v_profile)
  );
end;
$$;

revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;
