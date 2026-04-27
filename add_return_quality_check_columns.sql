-- Migration: add librarian return quality check fields
-- Run this in your Supabase SQL Editor

ALTER TABLE public.issued_books
ADD COLUMN IF NOT EXISTS return_quality_status text
CHECK (return_quality_status IN ('excellent', 'good', 'minor_damage', 'damaged'));

ALTER TABLE public.issued_books
ADD COLUMN IF NOT EXISTS return_quality_notes text;

ALTER TABLE public.issued_books
ADD COLUMN IF NOT EXISTS return_quality_checked_at timestamptz;

ALTER TABLE public.issued_books
ADD COLUMN IF NOT EXISTS return_quality_checklist jsonb;

COMMENT ON COLUMN public.issued_books.return_quality_status IS 'Librarian condition assessment captured during return';
COMMENT ON COLUMN public.issued_books.return_quality_notes IS 'Optional librarian notes captured during return';
COMMENT ON COLUMN public.issued_books.return_quality_checked_at IS 'Timestamp when librarian completed the return quality check';
COMMENT ON COLUMN public.issued_books.return_quality_checklist IS 'Checklist values for cover, pages, binding, and cleanliness captured during return';
