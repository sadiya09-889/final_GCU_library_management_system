-- =============================================
-- Remove requested Supabase users
-- Run this in the Supabase SQL Editor.
-- =============================================

begin;

delete from auth.identities
where provider = 'email'
  and provider_id in ('aimantaqia7@gmail.com', 'sukhitharmopagar@gmail.com');

delete from public.profiles
where email in ('aimantaqia7@gmail.com', 'sukhitharmopagar@gmail.com');

delete from auth.users
where email in ('aimantaqia7@gmail.com', 'sukhitharmopagar@gmail.com');

commit;