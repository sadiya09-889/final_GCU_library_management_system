-- =============================================
-- Books duplicate cleanup + uniqueness hardening
-- Run this once on an existing Supabase project
-- =============================================
--
-- Assumption:
--   This app models one logical book row per `book_number`.
--   Multiple copies should be tracked in `available` / `total`,
--   not as duplicate rows in `public.books`.

-- 1. Keep one row per normalized book_number, preferring rows that already
--    have an accession number because they came from the clean KOHA import.
with ranked_book_numbers as (
  select
    id,
    row_number() over (
      partition by lower(btrim(book_number))
      order by
        case when nullif(btrim(accession_no), '') is not null then 0 else 1 end,
        created_at asc,
        id asc
    ) as rn
  from public.books
  where nullif(btrim(book_number), '') is not null
)
delete from public.books b
using ranked_book_numbers ranked
where b.id = ranked.id
  and ranked.rn > 1;

-- 2. Clean up any remaining duplicate accession numbers.
with ranked_accessions as (
  select
    id,
    row_number() over (
      partition by lower(btrim(accession_no))
      order by created_at asc, id asc
    ) as rn
  from public.books
  where nullif(btrim(accession_no), '') is not null
)
delete from public.books b
using ranked_accessions ranked
where b.id = ranked.id
  and ranked.rn > 1;

-- 3. Enforce uniqueness going forward.
create unique index if not exists books_book_number_unique
  on public.books ((lower(btrim(book_number))))
  where nullif(btrim(book_number), '') is not null;

create unique index if not exists books_accession_no_unique
  on public.books ((lower(btrim(accession_no))))
  where nullif(btrim(accession_no), '') is not null;
