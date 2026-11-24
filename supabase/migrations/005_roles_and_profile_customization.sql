-- LiteLearn Migration 005: Multi-role support (lecturer, assistant, admin) and profile customization fields.

-- 1. Expand allowed roles on public.profiles to support student, rep, lecturer, assistant, and admin.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'rep', 'lecturer', 'assistant', 'admin'));

-- 2. Add optional profile customization columns on public.profiles.
alter table public.profiles
  add column if not exists study_program text,
  add column if not exists bio text,
  add column if not exists avatar_color text,
  add column if not exists avatar_data_url text;

-- 3. Allow authenticated users to update their own profile customization columns (still blocking role and class_id).
grant update (display_name, study_program, bio, avatar_color, avatar_data_url, updated_at)
  on public.profiles to authenticated;

-- 4. Expand is_class_rep helper so rep, lecturer, assistant, and admin roles can manage class courses and materials.
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
      and p.role in ('rep', 'lecturer', 'assistant', 'admin')
      and p.class_id = target_class_id
  );
$$;
