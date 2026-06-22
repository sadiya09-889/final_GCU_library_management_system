-- =============================================
-- Remove requested Supabase users
-- Run this in the Supabase SQL Editor.
-- =============================================

begin;

-- 1. Delete associated penalties
delete from public.penalties
where student_id in (
  select id from public.profiles
  where email in ('aimantaqia7@gmail.com', 'sukhitharmopagar@gmail.com')
);

-- 2. Delete associated issued books
delete from public.issued_books
where student_id in (
  select id from public.profiles
  where email in ('aimantaqia7@gmail.com', 'sukhitharmopagar@gmail.com')
);

-- 3. Delete from public.profiles
delete from public.profiles
where email in ('aimantaqia7@gmail.com', 'sukhitharmopagar@gmail.com');

-- 4. Delete from auth.identities
delete from auth.identities
where provider = 'email'
  and provider_id in ('aimantaqia7@gmail.com', 'sukhitharmopagar@gmail.com');

-- 5. Delete from auth.users
delete from auth.users
where email in ('aimantaqia7@gmail.com', 'sukhitharmopagar@gmail.com');

commit;