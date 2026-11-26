-- LiteLearn Migration 007: Basic database gate restricting class creation to approved coordinators.

-- 1. Coordinator allowlist table (managed by Admins only).
create table if not exists public.coordinator_allowlist (
  nim text primary key,
  note text,
  added_at timestamptz not null default now()
);

alter table public.coordinator_allowlist enable row level security;

drop policy if exists coordinator_allowlist_admin_all on public.coordinator_allowlist;
create policy coordinator_allowlist_admin_all
  on public.coordinator_allowlist
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 2. Gate create_class_as_rep so ordinary students cannot create classes unless allowlisted as coordinator.
create or replace function public.create_class_as_rep(
  p_name text,
  p_join_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_code text := upper(trim(coalesce(p_join_code, '')));
  v_class public.classes;
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.id = v_uid
    and p.deleted_at is null;

  if not found then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  if v_profile.role not in ('admin', 'lecturer', 'rep')
     and not exists (
       select 1
       from public.coordinator_allowlist a
       where upper(a.nim) = upper(v_profile.nim)
     ) then
    raise exception 'Only approved coordinators can create classes' using errcode = '42501';
  end if;

  if v_name = '' or v_code = '' then
    raise exception 'Class name and join code are required' using errcode = '22023';
  end if;

  insert into public.classes (name, join_code, created_by_user_id)
  values (v_name, v_code, v_uid)
  returning * into v_class;

  update public.profiles
  set class_id = v_class.id,
      role = case when role = 'admin' then 'admin' else 'rep' end,
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

revoke all on function public.create_class_as_rep(text, text) from public;
grant execute on function public.create_class_as_rep(text, text) to authenticated;
