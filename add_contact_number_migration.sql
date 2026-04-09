-- Migration: Add contact_number column to profiles table
-- Run this in your Supabase SQL Editor

-- Add profile contact and registration fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reg_no text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.contact_number IS 'User contact/phone number';
COMMENT ON COLUMN public.profiles.reg_no IS 'Student registration number';

-- Ensure signup trigger stores contact number and reg no from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
begin
	insert into public.profiles (id, name, email, role, contact_number, reg_no)
	values (
		new.id,
		coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
		new.email,
		case
			when coalesce(new.raw_user_meta_data->>'role', '') in ('admin', 'librarian', 'student')
				then new.raw_user_meta_data->>'role'
			else 'student'
		end,
		nullif(new.raw_user_meta_data->>'contact_number', ''),
		nullif(new.raw_user_meta_data->>'reg_no', '')
	);
	return new;
end;
$$ language plpgsql security definer;