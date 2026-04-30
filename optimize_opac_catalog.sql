-- =============================================
-- OPAC unique catalog search optimization
-- Run this in Supabase SQL Editor after the books table exists.
-- =============================================
--
-- What this fixes:
--   - OPAC no longer needs to download every row from public.books.
--   - Duplicate copy rows are grouped into one logical catalog entry.
--   - Search/filter results are paginated in Postgres and cached by the app.

create extension if not exists pg_trgm;

create index if not exists books_opac_title_idx
  on public.books (lower(title), id);

create index if not exists books_opac_year_idx
  on public.books (year_of_publication);

create index if not exists books_opac_available_idx
  on public.books (available);

create index if not exists books_opac_isbn_idx
  on public.books (lower(btrim(isbn)))
  where nullif(btrim(isbn), '') is not null;

create index if not exists books_opac_search_trgm_idx
  on public.books using gin ((
    lower(concat_ws(' ',
      title,
      sub_title,
      author,
      author2,
      isbn,
      category,
      subject,
      book_number,
      accession_no,
      call_no,
      class_number,
      year_of_publication::text
    ))
  ) gin_trgm_ops);

create or replace function public.search_opac_books(
  p_search_text text default '',
  p_programme_keywords text[] default array[]::text[],
  p_year_start int default null,
  p_year_end int default null,
  p_available_only boolean default false,
  p_page_limit int default 12,
  p_page_offset int default 0
)
returns table (
  id uuid,
  title text,
  sub_title text,
  author text,
  author2 text,
  isbn text,
  category text,
  available int,
  total int,
  class_number text,
  book_number text,
  edition text,
  place_of_publication text,
  name_of_publication text,
  year_of_publication int,
  phy_desc text,
  volume text,
  general_note text,
  subject text,
  permanent_location text,
  current_library text,
  location text,
  date_of_purchase date,
  vendor text,
  bill_number text,
  price numeric,
  call_no text,
  accession_no text,
  item_type text,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
  with normalized_books as (
    select
      b.*,
      lower(concat_ws(' ',
        b.title,
        b.sub_title,
        b.author,
        b.author2,
        b.isbn,
        b.category,
        b.subject,
        b.book_number,
        b.accession_no,
        b.call_no,
        b.class_number,
        b.year_of_publication::text
      )) as opac_search_text,
      coalesce(
        nullif(regexp_replace(lower(btrim(b.isbn)), '[[:space:]]+', '', 'g'), ''),
        md5(regexp_replace(lower(concat_ws('|',
          btrim(b.title),
          btrim(b.author),
          btrim(b.edition),
          coalesce(b.year_of_publication::text, ''),
          btrim(b.name_of_publication)
        )), '[[:space:]]+', ' ', 'g'))
      ) as opac_unique_key
    from public.books b
  ),
  filtered_books as (
    select nb.*
    from normalized_books nb
    where (
        nullif(btrim(p_search_text), '') is null
        or nb.opac_search_text like '%' || lower(btrim(p_search_text)) || '%'
      )
      and (
        coalesce(array_length(p_programme_keywords, 1), 0) = 0
        or exists (
          select 1
          from unnest(p_programme_keywords) as keyword(value)
          where nb.opac_search_text like '%' || lower(btrim(keyword.value)) || '%'
        )
      )
      and (p_year_start is null or nb.year_of_publication >= p_year_start)
      and (p_year_end is null or nb.year_of_publication <= p_year_end)
      and (not p_available_only or coalesce(nb.available, 0) > 0)
  ),
  ranked_books as (
    select
      fb.*,
      row_number() over (
        partition by fb.opac_unique_key
        order by
          case when coalesce(fb.available, 0) > 0 then 0 else 1 end,
          greatest(coalesce(fb.total, 0), coalesce(fb.available, 0)) desc,
          fb.created_at asc,
          fb.id asc
      ) as representative_rank,
      sum(greatest(coalesce(fb.available, 0), 0)) over (
        partition by fb.opac_unique_key
      )::int as unique_available,
      sum(greatest(coalesce(fb.total, 0), coalesce(fb.available, 0), 0)) over (
        partition by fb.opac_unique_key
      )::int as unique_total
    from filtered_books fb
  ),
  unique_books as (
    select *
    from ranked_books rb
    where rb.representative_rank = 1
  )
  select
    ub.id,
    ub.title,
    ub.sub_title,
    ub.author,
    ub.author2,
    ub.isbn,
    ub.category,
    ub.unique_available as available,
    ub.unique_total as total,
    ub.class_number,
    ub.book_number,
    ub.edition,
    ub.place_of_publication,
    ub.name_of_publication,
    ub.year_of_publication,
    ub.phy_desc,
    ub.volume,
    ub.general_note,
    ub.subject,
    ub.permanent_location,
    ub.current_library,
    ub.location,
    ub.date_of_purchase,
    ub.vendor,
    ub.bill_number,
    ub.price,
    ub.call_no,
    ub.accession_no,
    ub.item_type,
    count(*) over () as total_count
  from unique_books ub
  order by lower(ub.title), ub.title, ub.id
  limit greatest(1, least(coalesce(p_page_limit, 12), 50))
  offset greatest(coalesce(p_page_offset, 0), 0);
$$;

grant execute on function public.search_opac_books(text, text[], int, int, boolean, int, int) to authenticated;
