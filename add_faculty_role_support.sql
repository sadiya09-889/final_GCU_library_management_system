-- Migration: add faculty role support and infer student/faculty profile role
-- Run this in your Supabase SQL Editor

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'librarian', 'student', 'faculty'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
begin
  insert into public.profiles (id, name, email, role, contact_number, reg_no)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    case
      when coalesce(new.raw_user_meta_data->>'role', '') in ('admin', 'librarian', 'student', 'faculty')
        then new.raw_user_meta_data->>'role'
      when nullif(new.raw_user_meta_data->>'reg_no', '') is not null
        then 'student'
      when lower(coalesce(new.email, '')) like '%@gcu.edu.in'
        then 'faculty'
      else 'student'
    end,
    nullif(new.raw_user_meta_data->>'contact_number', ''),
    nullif(new.raw_user_meta_data->>'reg_no', '')
  );
  return new;
end;
$$ language plpgsql security definer;

UPDATE public.profiles
SET role = case
  when role in ('admin', 'librarian') then role
  when nullif(btrim(reg_no), '') is not null then 'student'
  when lower(coalesce(email, '')) like '%@gcu.edu.in' then 'faculty'
  else 'student'
end
WHERE role not in ('admin', 'librarian');
