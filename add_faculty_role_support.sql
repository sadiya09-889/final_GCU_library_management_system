-- Migration: add faculty role support and infer student/faculty profile role
-- Run this in your Supabase SQL Editor

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reg_no text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'librarian', 'student', 'faculty'));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.resolve_library_member_role(
  _email text,
  _reg_no text,
  _requested_role text default null
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  select case
    when nullif(btrim(coalesce(_reg_no, '')), '') is not null then 'student'
    when lower(coalesce(_requested_role, '')) in ('student', 'faculty') then lower(coalesce(_requested_role, ''))
    when lower(coalesce(_email, '')) like '%@gcu.edu.in' then 'faculty'
    else 'student'
  end;
$$;

REVOKE ALL ON FUNCTION public.resolve_library_member_role(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_library_member_role(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_uid uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = _uid
      and p.role = any(_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text[]) TO authenticated;

DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own student or faculty profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile or admin can update" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own student or faculty profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Profiles are readable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own student or faculty profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND role = public.resolve_library_member_role(email, reg_no, role)
  );

CREATE POLICY "Users can update their own student or faculty profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.resolve_library_member_role(email, reg_no, role)
  );

CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), ARRAY['admin']))
  WITH CHECK (public.has_role(auth.uid(), ARRAY['admin']));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    nullif(new.raw_user_meta_data->>'school', ''),
    nullif(new.raw_user_meta_data->>'department', ''),
    nullif(new.raw_user_meta_data->>'contact_number', ''),
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

REVOKE ALL ON FUNCTION public.handle_new_user() FROM public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role)
  where id = new.id;
  return new;
end;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_role_to_auth() FROM public;

DROP TRIGGER IF EXISTS on_profile_role_changed ON public.profiles;
CREATE TRIGGER on_profile_role_changed
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role_to_auth();

UPDATE public.profiles AS p
SET role = case
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
FROM auth.users AS u
WHERE u.id = p.id
  AND p.role not in ('admin', 'librarian');

UPDATE auth.users AS u
SET raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
FROM public.profiles AS p
WHERE p.id = u.id;
