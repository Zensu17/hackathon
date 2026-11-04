-- LiteLearn Milestone 1 initial Postgres schema, onboarding RPCs, storage bucket, and RLS policies.

create extension if not exists pgcrypto;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  join_code text not null unique check (
    join_code = upper(trim(join_code))
    and char_length(join_code) between 3 and 16
  ),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null check (char_length(trim(display_name)) > 0),
  class_id uuid null references public.classes(id) on delete set null,
  role text null check (role in ('student', 'rep')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  code text not null check (char_length(trim(code)) > 0),
  name text not null check (char_length(trim(name)) > 0),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.course_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.weeks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  week_number integer not null check (week_number >= 1),
  title text not null check (char_length(trim(title)) > 0),
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  unique (course_id, week_number)
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  week_id uuid not null references public.weeks(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  external_url text null check (
    external_url is null or external_url ~* '^https?://'
  ),
  attachment_name text null,
  attachment_size_bytes integer null check (
    attachment_size_bytes is null
    or (attachment_size_bytes > 0 and attachment_size_bytes <= 5242880)
  ),
  attachment_mime_type text null check (
    attachment_mime_type is null or attachment_mime_type = 'application/pdf'
  ),
  attachment_storage_path text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  week_id uuid null references public.weeks(id) on delete set null,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  body text not null check (char_length(trim(body)) > 0),
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  unique (user_id, material_id)
);

-- Indexes for Phase 2 delta sync (updated_at) and foreign-key lookups.
create index if not exists idx_classes_updated_at on public.classes (updated_at);
create index if not exists idx_profiles_updated_at on public.profiles (updated_at);
create index if not exists idx_profiles_class_id on public.profiles (class_id);
create index if not exists idx_courses_class_id on public.courses (class_id);
create index if not exists idx_courses_updated_at on public.courses (updated_at);
create index if not exists idx_course_follows_user_id on public.course_follows (user_id);
create index if not exists idx_course_follows_course_id on public.course_follows (course_id);
create index if not exists idx_weeks_course_id on public.weeks (course_id);
create index if not exists idx_weeks_updated_at on public.weeks (updated_at);
create index if not exists idx_materials_course_id on public.materials (course_id);
create index if not exists idx_materials_week_id on public.materials (week_id);
create index if not exists idx_materials_updated_at on public.materials (updated_at);
create index if not exists idx_deadlines_course_id on public.deadlines (course_id);
create index if not exists idx_deadlines_week_id on public.deadlines (week_id);
create index if not exists idx_deadlines_due_at on public.deadlines (due_at);
create index if not exists idx_deadlines_updated_at on public.deadlines (updated_at);
create index if not exists idx_announcements_course_id on public.announcements (course_id);
create index if not exists idx_announcements_posted_at on public.announcements (posted_at desc);
create index if not exists idx_announcements_updated_at on public.announcements (updated_at);
create index if not exists idx_notes_user_id on public.notes (user_id);
create index if not exists idx_notes_material_id on public.notes (material_id);
create index if not exists idx_notes_updated_at on public.notes (updated_at);

-- Populate public.profiles automatically when a new auth.users row is created.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, 'student'), '@', 1)
  );

  insert into public.profiles (id, email, display_name)
  values (new.id, lower(coalesce(new.email, '')), v_display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Helper functions used in Row-Level Security policies.
create or replace function public.current_user_class_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.class_id
  from public.profiles p
  where p.id = auth.uid()
    and p.deleted_at is null;
$$;

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
      and p.role = 'rep'
      and p.class_id = target_class_id
  );
$$;

create or replace function public.course_class_id(target_course_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.class_id
  from public.courses c
  where c.id = target_course_id;
$$;

-- Atomic class creation RPC assigning caller role = 'rep'.
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

  if v_name = '' or v_code = '' then
    raise exception 'Class name and join code are required' using errcode = '22023';
  end if;

  insert into public.classes (name, join_code, created_by_user_id)
  values (v_name, v_code, v_uid)
  returning * into v_class;

  update public.profiles
  set class_id = v_class.id,
      role = 'rep',
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

-- Atomic class join RPC assigning caller role = 'student'.
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
      role = 'student',
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

revoke all on function public.create_class_as_rep(text, text) from public;
grant execute on function public.create_class_as_rep(text, text) to authenticated;

revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;

-- Enable Row-Level Security on all 9 application tables.
alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_follows enable row level security;
alter table public.weeks enable row level security;
alter table public.materials enable row level security;
alter table public.deadlines enable row level security;
alter table public.announcements enable row level security;
alter table public.notes enable row level security;

-- Prevent direct client updates to role or class_id on public.profiles.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, updated_at) on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_own_safe on public.profiles;
create policy profiles_update_own_safe
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role is not distinct from (
      select p.role from public.profiles p where p.id = auth.uid()
    )
    and class_id is not distinct from (
      select p.class_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists classes_select_member on public.classes;
create policy classes_select_member
  on public.classes
  for select
  to authenticated
  using (id = public.current_user_class_id());

drop policy if exists classes_update_rep on public.classes;
create policy classes_update_rep
  on public.classes
  for update
  to authenticated
  using (public.is_class_rep(id))
  with check (public.is_class_rep(id));

drop policy if exists courses_select_member on public.courses;
create policy courses_select_member
  on public.courses
  for select
  to authenticated
  using (class_id = public.current_user_class_id());

drop policy if exists courses_insert_rep on public.courses;
create policy courses_insert_rep
  on public.courses
  for insert
  to authenticated
  with check (public.is_class_rep(class_id));

drop policy if exists courses_update_rep on public.courses;
create policy courses_update_rep
  on public.courses
  for update
  to authenticated
  using (public.is_class_rep(class_id))
  with check (public.is_class_rep(class_id));

drop policy if exists course_follows_select_own on public.course_follows;
create policy course_follows_select_own
  on public.course_follows
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists course_follows_insert_own on public.course_follows;
create policy course_follows_insert_own
  on public.course_follows
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.course_class_id(course_id) = public.current_user_class_id()
  );

drop policy if exists course_follows_delete_own on public.course_follows;
create policy course_follows_delete_own
  on public.course_follows
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists weeks_select_member on public.weeks;
create policy weeks_select_member
  on public.weeks
  for select
  to authenticated
  using (public.course_class_id(course_id) = public.current_user_class_id());

drop policy if exists weeks_insert_rep on public.weeks;
create policy weeks_insert_rep
  on public.weeks
  for insert
  to authenticated
  with check (public.is_class_rep(public.course_class_id(course_id)));

drop policy if exists weeks_update_rep on public.weeks;
create policy weeks_update_rep
  on public.weeks
  for update
  to authenticated
  using (public.is_class_rep(public.course_class_id(course_id)))
  with check (public.is_class_rep(public.course_class_id(course_id)));

drop policy if exists materials_select_member on public.materials;
create policy materials_select_member
  on public.materials
  for select
  to authenticated
  using (public.course_class_id(course_id) = public.current_user_class_id());

drop policy if exists materials_insert_rep on public.materials;
create policy materials_insert_rep
  on public.materials
  for insert
  to authenticated
  with check (public.is_class_rep(public.course_class_id(course_id)));

drop policy if exists materials_update_rep on public.materials;
create policy materials_update_rep
  on public.materials
  for update
  to authenticated
  using (public.is_class_rep(public.course_class_id(course_id)))
  with check (public.is_class_rep(public.course_class_id(course_id)));

drop policy if exists deadlines_select_member on public.deadlines;
create policy deadlines_select_member
  on public.deadlines
  for select
  to authenticated
  using (public.course_class_id(course_id) = public.current_user_class_id());

drop policy if exists deadlines_insert_rep on public.deadlines;
create policy deadlines_insert_rep
  on public.deadlines
  for insert
  to authenticated
  with check (public.is_class_rep(public.course_class_id(course_id)));

drop policy if exists deadlines_update_rep on public.deadlines;
create policy deadlines_update_rep
  on public.deadlines
  for update
  to authenticated
  using (public.is_class_rep(public.course_class_id(course_id)))
  with check (public.is_class_rep(public.course_class_id(course_id)));

drop policy if exists announcements_select_member on public.announcements;
create policy announcements_select_member
  on public.announcements
  for select
  to authenticated
  using (public.course_class_id(course_id) = public.current_user_class_id());

drop policy if exists announcements_insert_rep on public.announcements;
create policy announcements_insert_rep
  on public.announcements
  for insert
  to authenticated
  with check (public.is_class_rep(public.course_class_id(course_id)));

drop policy if exists announcements_update_rep on public.announcements;
create policy announcements_update_rep
  on public.announcements
  for update
  to authenticated
  using (public.is_class_rep(public.course_class_id(course_id)))
  with check (public.is_class_rep(public.course_class_id(course_id)));

drop policy if exists notes_select_own on public.notes;
create policy notes_select_own
  on public.notes
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notes_insert_own on public.notes;
create policy notes_insert_own
  on public.notes
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists notes_update_own on public.notes;
create policy notes_update_own
  on public.notes
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notes_delete_own on public.notes;
create policy notes_delete_own
  on public.notes
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Private PDF attachment bucket capped at 5 MB (5,242,880 bytes).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 5242880, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists materials_bucket_select_member on storage.objects;
create policy materials_bucket_select_member
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = public.current_user_class_id()::text
  );

drop policy if exists materials_bucket_insert_rep on storage.objects;
create policy materials_bucket_insert_rep
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = public.current_user_class_id()::text
    and public.is_class_rep(public.current_user_class_id())
  );

drop policy if exists materials_bucket_update_rep on storage.objects;
create policy materials_bucket_update_rep
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = public.current_user_class_id()::text
    and public.is_class_rep(public.current_user_class_id())
  )
  with check (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = public.current_user_class_id()::text
    and public.is_class_rep(public.current_user_class_id())
  );

drop policy if exists materials_bucket_delete_rep on storage.objects;
create policy materials_bucket_delete_rep
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = public.current_user_class_id()::text
    and public.is_class_rep(public.current_user_class_id())
  );
