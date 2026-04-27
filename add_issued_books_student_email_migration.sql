-- Migration: store matched student email on issued books for overdue notifications
-- Run this in your Supabase SQL Editor

ALTER TABLE public.issued_books
ADD COLUMN IF NOT EXISTS student_email text;

COMMENT ON COLUMN public.issued_books.student_email IS 'Matched student email captured when the book is issued';

UPDATE public.issued_books AS ib
SET
  student_id = COALESCE(NULLIF(p.reg_no, ''), ib.student_id),
  student_email = COALESCE(NULLIF(BTRIM(ib.student_email), ''), p.email)
FROM public.profiles AS p
WHERE p.reg_no = ib.student_id
   OR p.id::text = ib.student_id;
