-- LiteLearn Migration 006: Student-only registration and Admin all-user management RPCs.

-- 1. Check whether the current authenticated user is an active Admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.deleted_at is null
      and p.role = 'admin'
  );
$$;

-- 2. Allow active Admins to manage content in any class, while reps/lecturers/assistants manage their own class.
create or replace function public.is_class_rep(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.deleted_at is null
      and (
        p.role = 'admin'
        or (
          p.role in ('rep', 'lecturer', 'assistant')
          and p.class_id = target_class_id
        )
      )
  );
$$;

-- 3. Preserve existing Admin role when switching classes via join_class_by_code.
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

  update public.profiles
  set class_id = v_class.id,
      role = case when role = 'admin' then 'admin' else 'student' end,
      updated_at = now()
  where id = v_uid
    and deleted_at is null
  returning * into v_profile;

  if not found then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'class', to_jsonb(v_class),
    'profile', to_jsonb(v_profile)
  );
end;
$$;

-- 4. Allow active Admins to select all profiles and classes under RLS.
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists classes_select_admin on public.classes;
create policy classes_select_admin
  on public.classes
  for select
  to authenticated
  using (public.is_admin());

-- 5. Admin RPC: List all users across all classes.
create or replace function public.admin_list_all_users()
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select p.*
  from public.profiles p
  order by
    (p.deleted_at is not null) asc,
    case p.role
      when 'admin' then 0
      when 'lecturer' then 1
      when 'assistant' then 2
      when 'rep' then 3
      when 'student' then 4
      else 5
    end asc,
    p.display_name asc;
end;
$$;

-- 6. Admin RPC: List all active classes.
create or replace function public.admin_list_all_classes()
returns setof public.classes
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select c.*
  from public.classes c
  where c.deleted_at is null
  order by c.name asc;
end;
$$;

-- 7. Admin RPC: Update a user's display name, role, class assignment, study program, or bio.
create or replace function public.admin_update_user_profile(
  p_target_user_id uuid,
  p_display_name text default null,
  p_role text default null,
  p_class_id uuid default null,
  p_update_class boolean default false,
  p_study_program text default null,
  p_bio text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles;
  v_active_admin_count integer;
  v_updated public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select *
  into v_target
  from public.profiles p
  where p.id = p_target_user_id;

  if not found then
    raise exception 'Target user profile not found' using errcode = 'P0002';
  end if;

  if p_role is not null then
    if p_role not in ('student', 'rep', 'lecturer', 'assistant', 'admin') then
      raise exception 'Invalid account role' using errcode = '22023';
    end if;

    if v_target.deleted_at is null and v_target.role = 'admin' and p_role <> 'admin' then
      select count(*)
      into v_active_admin_count
      from public.profiles p
      where p.deleted_at is null
        and p.role = 'admin';

      if v_active_admin_count <= 1 then
        raise exception 'Cannot remove the Admin role from the last active Administrator' using errcode = '42501';
      end if;
    end if;
  end if;

  if p_update_class and p_class_id is not null then
    if not exists (
      select 1 from public.classes c where c.id = p_class_id and c.deleted_at is null
    ) then
      raise exception 'Target class not found' using errcode = 'P0002';
    end if;
  end if;

  update public.profiles
  set display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
      role = coalesce(p_role, role),
      class_id = case when p_update_class then p_class_id else class_id end,
      study_program = coalesce(p_study_program, study_program),
      bio = coalesce(p_bio, bio),
      updated_at = now()
  where id = p_target_user_id
  returning * into v_updated;

  return v_updated;
end;
$$;

-- 8. Admin RPC: Deactivate or restore a user account.
create or replace function public.admin_set_user_active(
  p_target_user_id uuid,
  p_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles;
  v_active_admin_count integer;
  v_updated public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if auth.uid() = p_target_user_id and not p_active then
    raise exception 'You cannot deactivate your own admin account' using errcode = '42501';
  end if;

  select *
  into v_target
  from public.profiles p
  where p.id = p_target_user_id;

  if not found then
    raise exception 'Target user profile not found' using errcode = 'P0002';
  end if;

  if not p_active and v_target.deleted_at is null and v_target.role = 'admin' then
    select count(*)
    into v_active_admin_count
    from public.profiles p
    where p.deleted_at is null
      and p.role = 'admin';

    if v_active_admin_count <= 1 then
      raise exception 'Cannot deactivate the last active Administrator' using errcode = '42501';
    end if;
  end if;

  update public.profiles
  set deleted_at = case when p_active then null else now() end,
      updated_at = now()
  where id = p_target_user_id
  returning * into v_updated;

  return v_updated;
end;
$$;

-- 9. Admin RPC: Create a class without altering the Admin caller's own role or class.
create or replace function public.admin_create_class(
  p_name text,
  p_join_code text
)
returns public.classes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_code text := upper(trim(coalesce(p_join_code, '')));
  v_created public.classes;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if v_name = '' or v_code = '' then
    raise exception 'Class name and join code are required' using errcode = '22023';
  end if;

  insert into public.classes (name, join_code, created_by_user_id)
  values (v_name, v_code, v_uid)
  returning * into v_created;

  return v_created;
end;
$$;

revoke all on function public.admin_list_all_users() from public;
grant execute on function public.admin_list_all_users() to authenticated;

revoke all on function public.admin_list_all_classes() from public;
grant execute on function public.admin_list_all_classes() to authenticated;

revoke all on function public.admin_update_user_profile(uuid, text, text, uuid, boolean, text, text) from public;
grant execute on function public.admin_update_user_profile(uuid, text, text, uuid, boolean, text, text) to authenticated;

revoke all on function public.admin_set_user_active(uuid, boolean) from public;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;

revoke all on function public.admin_create_class(text, text) from public;
grant execute on function public.admin_create_class(text, text) to authenticated;
