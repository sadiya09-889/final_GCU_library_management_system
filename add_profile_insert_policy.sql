-- =============================================
-- Allow authenticated users to create their own profile row.
-- Run this in the Supabase SQL Editor.
-- =============================================

drop policy if exists "Users can create their own profile" on public.profiles;

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);