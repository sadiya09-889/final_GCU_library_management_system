-- One-shot repair for faculty signup/login on an existing Supabase database.
-- Run this in the Supabase SQL editor on the live project.

alter table public.profiles add column if not exists school text;
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists contact_number text;
alter table public.profiles add column if not exists reg_no text;

alter table public.profiles enable row level security;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
add constraint profiles_role_check
check (role in ('admin', 'librarian', 'student', 'faculty'));

drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can insert their own student or faculty profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can update their own profile or admin can update" on public.profiles;
drop policy if exists "Users can update their own student or faculty profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;

drop function if exists public.resolve_library_member_role(text, text);
create or replace function public.resolve_library_member_role(
  _email text,
  _reg_no text,
  _requested_role text default null
)
returns text
language sql
immutable
as $$
  select case
    when nullif(btrim(coalesce(_reg_no, '')), '') is not null then 'student'
    when lower(coalesce(_requested_role, '')) in ('student', 'faculty') then lower(coalesce(_requested_role, ''))
    when lower(coalesce(_email, '')) like '%@gcu.edu.in' then 'faculty'
    else 'student'
  end;
$$;

revoke all on function public.resolve_library_member_role(text, text, text) from public;
grant execute on function public.resolve_library_member_role(text, text, text) to authenticated;

create or replace function public.has_role(_uid uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = _uid
      and p.role = any(_roles)
  );
$$;

revoke all on function public.has_role(uuid, text[]) from public;
grant execute on function public.has_role(uuid, text[]) to authenticated;

create policy "Profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can insert their own student or faculty profile"
  on public.profiles for insert to authenticated
  with check (
    auth.uid() = id
    and role = public.resolve_library_member_role(email, reg_no, role)
  );

create policy "Users can update their own student or faculty profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = public.resolve_library_member_role(email, reg_no, role)
  );

create policy "Admins can update profiles"
  on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), array['admin']))
  with check (public.has_role(auth.uid(), array['admin']));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := lower(coalesce(new.raw_user_meta_data->>'role', ''));
  trusted_role text := lower(coalesce(new.raw_app_meta_data->>'library_role', new.raw_app_meta_data->>'role', ''));
begin
  insert into public.profiles (id, name, email, role, school, department, contact_number, reg_no)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    lower(coalesce(new.email, '')),
    case
      when trusted_role in ('admin', 'librarian', 'student', 'faculty') then trusted_role
      else public.resolve_library_member_role(new.email, new.raw_user_meta_data->>'reg_no', requested_role)
    end,
    nullif(btrim(new.raw_user_meta_data->>'school'), ''),
    nullif(btrim(new.raw_user_meta_data->>'department'), ''),
    nullif(btrim(new.raw_user_meta_data->>'contact_number'), ''),
    nullif(btrim(new.raw_user_meta_data->>'reg_no'), '')
  )
  on conflict (id) do update
  set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role,
    school = excluded.school,
    department = excluded.department,
    contact_number = excluded.contact_number,
    reg_no = excluded.reg_no;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create or replace function public.sync_profile_role_to_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role)
  where id = new.id;
  return new;
end;
$$;

revoke all on function public.sync_profile_role_to_auth() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_profile_role_changed on public.profiles;
create trigger on_profile_role_changed
  after insert or update of role on public.profiles
  for each row execute function public.sync_profile_role_to_auth();

update public.profiles as p
set role = case
  when p.role in ('admin', 'librarian') then p.role
  else public.resolve_library_member_role(
    p.email,
    p.reg_no,
    case
      when lower(coalesce(u.raw_user_meta_data->>'role', '')) = 'faculty' or p.role = 'faculty' then 'faculty'
      when lower(coalesce(u.raw_user_meta_data->>'role', '')) = 'student' then 'student'
      else p.role
    end
  )
end
from auth.users as u
where u.id = p.id
  and p.role not in ('admin', 'librarian');

update auth.users as u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
from public.profiles as p
where p.id = u.id;

select
  p.email,
  p.role as profile_role,
  u.raw_user_meta_data->>'role' as raw_user_role
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'faculty'
   or u.raw_user_meta_data->>'role' = 'faculty'
   or lower(coalesce(p.email, '')) like '%@gcu.edu.in'
order by p.email;
