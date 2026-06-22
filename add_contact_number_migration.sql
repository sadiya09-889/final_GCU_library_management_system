-- Migration: Add profile metadata columns used during signup
-- Run this in your Supabase SQL Editor

-- Add profile contact and academic fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reg_no text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.contact_number IS 'User contact/phone number';
COMMENT ON COLUMN public.profiles.school IS 'Student or faculty school';
COMMENT ON COLUMN public.profiles.department IS 'Student or faculty department';
COMMENT ON COLUMN public.profiles.reg_no IS 'Student registration number';

-- Ensure signup trigger stores contact number and reg no from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
begin
	insert into public.profiles (id, name, email, role, school, department, contact_number, reg_no)
	values (
		new.id,
		coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
		new.email,
		case
			when nullif(btrim(new.raw_user_meta_data->>'reg_no'), '') is not null then 'student'
			when lower(coalesce(new.raw_user_meta_data->>'role', '')) = 'faculty' then 'faculty'
			when lower(coalesce(new.email, '')) like '%@gcu.edu.in' then 'faculty'
			else 'student'
		end,
		nullif(new.raw_user_meta_data->>'school', ''),
		nullif(new.raw_user_meta_data->>'department', ''),
		nullif(new.raw_user_meta_data->>'contact_number', ''),
		nullif(new.raw_user_meta_data->>'reg_no', '')
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
$$ language plpgsql security definer;
