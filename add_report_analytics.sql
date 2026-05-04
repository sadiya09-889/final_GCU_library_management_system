-- =============================================
-- Library report analytics helpers
-- Run this in the Supabase SQL Editor.
-- =============================================

create or replace function public.get_library_report_summary()
returns table (
  total_collection bigint,
  currently_issued bigint,
  overdue_books bigint
)
language sql
stable
set search_path = public
as $$
  select
    (select count(*)::bigint from public.books) as total_collection,
    (select count(*)::bigint from public.issued_books where status = 'issued') as currently_issued,
    (select count(*)::bigint from public.issued_books where status = 'overdue') as overdue_books;
$$;

create or replace function public.get_library_monthly_activity()
returns table (
  month_key text,
  issues bigint,
  returns bigint
)
language sql
stable
set search_path = public
as $$
  with months as (
    select date_trunc('month', gs)::date as month_start
    from generate_series(
      date_trunc('month', current_date) - interval '11 months',
      date_trunc('month', current_date),
      interval '1 month'
    ) as gs
  ),
  issue_counts as (
    select
      date_trunc('month', issue_date)::date as month_start,
      count(*)::bigint as issue_count
    from public.issued_books
    where issue_date >= date_trunc('month', current_date) - interval '11 months'
      and issue_date < date_trunc('month', current_date) + interval '1 month'
    group by 1
  ),
  return_counts as (
    select
      date_trunc('month', return_date)::date as month_start,
      count(*)::bigint as return_count
    from public.issued_books
    where return_date is not null
      and return_date >= date_trunc('month', current_date) - interval '11 months'
      and return_date < date_trunc('month', current_date) + interval '1 month'
    group by 1
  )
  select
    to_char(m.month_start, 'YYYY-MM') as month_key,
    coalesce(i.issue_count, 0)::bigint as issues,
    coalesce(r.return_count, 0)::bigint as returns
  from months m
  left join issue_counts i on i.month_start = m.month_start
  left join return_counts r on r.month_start = m.month_start
  order by m.month_start;
$$;

grant execute on function public.get_library_report_summary() to authenticated;
grant execute on function public.get_library_monthly_activity() to authenticated;