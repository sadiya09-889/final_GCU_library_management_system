-- =============================================
-- Library Portal – Supabase Table Setup
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Books table
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sub_title text default '',
  author text not null,
  author2 text default '',
  isbn text default '',
  category text default '',
  available int default 0,
  total int default 0,
  class_number text default '',
  book_number text default '',
  edition text default '',
  place_of_publication text default '',
  name_of_publication text default '',
  year_of_publication int default 2024,
  phy_desc text default '',
  volume text default '',
  general_note text default '',
  subject text default '',
  permanent_location text default '',
  current_library text default '',
  location text default '',
  date_of_purchase date,
  vendor text default '',
  bill_number text default '',
  price numeric default 0,
  call_no text default '',
  accession_no text default '',
  item_type text default 'Book',
  created_at timestamptz default now()
);

create unique index if not exists books_book_number_unique
  on public.books ((lower(btrim(book_number))))
  where nullif(btrim(book_number), '') is not null;

create unique index if not exists books_accession_no_unique
  on public.books ((lower(btrim(accession_no))))
  where nullif(btrim(accession_no), '') is not null;

-- OPAC search: indexes plus a paginated unique-entry search function.
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

-- 2. Issued books table
create table if not exists public.issued_books (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete set null,
  book_title text not null,
  student_name text not null,
  student_id text not null,
  student_email text,
  issue_date date not null default current_date,
  due_date date not null,
  return_date date,
  return_quality_status text check (return_quality_status in ('excellent', 'good', 'minor_damage', 'damaged')),
  return_quality_notes text,
  return_quality_checked_at timestamptz,
  return_quality_checklist jsonb,
  status text not null default 'issued' check (status in ('issued', 'returned', 'overdue')),
  created_at timestamptz default now()
);

-- 2b. Book reservations table
create table if not exists public.book_reservations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade,
  book_title text not null,
  book_author text default '',
  book_number text default '',
  accession_no text default '',
  student_user_id uuid not null references public.profiles(id) on delete cascade,
  student_name text not null,
  student_email text not null,
  student_reg_no text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'fulfilled', 'cancelled', 'rejected')),
  notes text default '',
  processed_by uuid references public.profiles(id) on delete set null,
  processed_at timestamptz,
  requested_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists book_reservations_student_idx
  on public.book_reservations (student_user_id, requested_at desc);

create index if not exists book_reservations_status_idx
  on public.book_reservations (status, requested_at desc);

create unique index if not exists book_reservations_active_unique
  on public.book_reservations (book_id, student_user_id)
  where status in ('pending', 'approved');

-- 3. Profiles table (linked to Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'student' check (role in ('admin', 'librarian', 'student', 'faculty')),
  school text,
  department text,
  contact_number text,
  reg_no text,
  join_date date default current_date,
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists school text;
alter table public.profiles add column if not exists department text;

-- 4. Academic programme recommendation data
create table if not exists public.academic_programmes (
  id uuid primary key default gen_random_uuid(),
  school text not null,
  department text not null,
  sheet_name text not null unique,
  unique_titles int not null default 0,
  total_copies int not null default 0,
  is_general_reference boolean not null default false,
  created_at timestamptz default now()
);

create unique index if not exists academic_programmes_school_department_unique
  on public.academic_programmes (school, department);

create table if not exists public.programme_books (
  id uuid primary key default gen_random_uuid(),
  school text not null,
  department text not null,
  sheet_name text not null,
  sort_order int not null,
  title text not null,
  author text default '',
  isbn text default '',
  call_no text default '',
  subject text default '',
  copies int not null default 0,
  accession_numbers text default '',
  created_at timestamptz default now()
);

create unique index if not exists programme_books_sheet_sort_unique
  on public.programme_books (sheet_name, sort_order);

create index if not exists programme_books_school_department_idx
  on public.programme_books (school, department, sort_order);

-- =============================================
-- Row Level Security
-- =============================================

alter table public.books enable row level security;
alter table public.issued_books enable row level security;
alter table public.book_reservations enable row level security;
alter table public.profiles enable row level security;
alter table public.academic_programmes enable row level security;
alter table public.programme_books enable row level security;

-- Helper for role-aware RLS checks.
create or replace function public.has_role(_uid uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = _uid
      and p.role = any(_roles)
  );
$$;

revoke all on function public.has_role(uuid, text[]) from public;
grant execute on function public.has_role(uuid, text[]) to authenticated;

drop policy if exists "Books are readable by authenticated users" on public.books;
drop policy if exists "Books are insertable by authenticated users" on public.books;
drop policy if exists "Books are updatable by authenticated users" on public.books;
drop policy if exists "Books are deletable by authenticated users" on public.books;
drop policy if exists "Books are insertable by admins or librarians" on public.books;
drop policy if exists "Books are updatable by admins or librarians" on public.books;
drop policy if exists "Books are deletable by admins or librarians" on public.books;

drop policy if exists "Issued books are readable by authenticated users" on public.issued_books;
drop policy if exists "Issued books are insertable by authenticated users" on public.issued_books;
drop policy if exists "Issued books are updatable by authenticated users" on public.issued_books;
drop policy if exists "Issued books are insertable by admins or librarians" on public.issued_books;
drop policy if exists "Issued books are updatable by admins or librarians" on public.issued_books;
drop policy if exists "Issued books are deletable by admins or librarians" on public.issued_books;

drop policy if exists "Reservations are readable by owner or staff" on public.book_reservations;
drop policy if exists "Students can create their own reservations" on public.book_reservations;
drop policy if exists "Students can cancel their own pending reservations" on public.book_reservations;
drop policy if exists "Admins or librarians can update reservations" on public.book_reservations;

drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can update their own profile or admin can update" on public.profiles;

drop policy if exists "Academic programmes are readable by authenticated users" on public.academic_programmes;
drop policy if exists "Academic programmes are writable by admins or librarians" on public.academic_programmes;
drop policy if exists "Programme books are readable by authenticated users" on public.programme_books;
drop policy if exists "Programme books are writable by admins or librarians" on public.programme_books;

-- Books: anyone authenticated can read; only admin/librarian can write.
create policy "Books are readable by authenticated users"
  on public.books for select to authenticated using (true);

create policy "Books are insertable by admins or librarians"
  on public.books for insert to authenticated
  with check (public.has_role(auth.uid(), array['admin', 'librarian']));

create policy "Books are updatable by admins or librarians"
  on public.books for update to authenticated
  using (public.has_role(auth.uid(), array['admin', 'librarian']))
  with check (public.has_role(auth.uid(), array['admin', 'librarian']));

create policy "Books are deletable by admins or librarians"
  on public.books for delete to authenticated
  using (public.has_role(auth.uid(), array['admin', 'librarian']));

-- Issued books: anyone authenticated can read; only admin/librarian can write.
create policy "Issued books are readable by authenticated users"
  on public.issued_books for select to authenticated using (true);

create policy "Issued books are insertable by admins or librarians"
  on public.issued_books for insert to authenticated
  with check (public.has_role(auth.uid(), array['admin', 'librarian']));

create policy "Issued books are updatable by admins or librarians"
  on public.issued_books for update to authenticated
  using (public.has_role(auth.uid(), array['admin', 'librarian']))
  with check (public.has_role(auth.uid(), array['admin', 'librarian']));

create policy "Issued books are deletable by admins or librarians"
  on public.issued_books for delete to authenticated
  using (public.has_role(auth.uid(), array['admin', 'librarian']));

-- Book reservations: students create/cancel their own requests; admin/librarian process all.
create policy "Reservations are readable by owner or staff"
  on public.book_reservations for select to authenticated
  using (student_user_id = auth.uid() or public.has_role(auth.uid(), array['admin', 'librarian']));

create policy "Students can create their own reservations"
  on public.book_reservations for insert to authenticated
  with check (student_user_id = auth.uid());

create policy "Students can cancel their own pending reservations"
  on public.book_reservations for update to authenticated
  using (student_user_id = auth.uid() and status = 'pending')
  with check (student_user_id = auth.uid() and status = 'cancelled');

create policy "Admins or librarians can update reservations"
  on public.book_reservations for update to authenticated
  using (public.has_role(auth.uid(), array['admin', 'librarian']))
  with check (public.has_role(auth.uid(), array['admin', 'librarian']));

-- Profiles: keep read access for authenticated users; allow self-update or admin update.
create policy "Profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can update their own profile or admin can update"
  on public.profiles for update to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), array['admin']))
  with check (auth.uid() = id or public.has_role(auth.uid(), array['admin']));

-- Academic recommendations: students/faculty can read; admin/librarian import and maintain data.
create policy "Academic programmes are readable by authenticated users"
  on public.academic_programmes for select to authenticated using (true);

create policy "Academic programmes are writable by admins or librarians"
  on public.academic_programmes for all to authenticated
  using (public.has_role(auth.uid(), array['admin', 'librarian']))
  with check (public.has_role(auth.uid(), array['admin', 'librarian']));

create policy "Programme books are readable by authenticated users"
  on public.programme_books for select to authenticated using (true);

create policy "Programme books are writable by admins or librarians"
  on public.programme_books for all to authenticated
  using (public.has_role(auth.uid(), array['admin', 'librarian']))
  with check (public.has_role(auth.uid(), array['admin', 'librarian']));

-- Auto-create profile on signup (optional trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role, school, department, contact_number, reg_no)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    case
      when coalesce(new.raw_user_meta_data->>'role', '') in ('admin', 'librarian', 'student', 'faculty')
        then new.raw_user_meta_data->>'role'
      when nullif(new.raw_user_meta_data->>'reg_no', '') is not null
        then 'student'
      when lower(coalesce(new.email, '')) like '%@gcu.edu.in'
        then 'faculty'
      else 'student'
    end,
    nullif(new.raw_user_meta_data->>'school', ''),
    nullif(new.raw_user_meta_data->>'department', ''),
    nullif(new.raw_user_meta_data->>'contact_number', ''),
    nullif(new.raw_user_meta_data->>'reg_no', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Keep auth metadata role and profiles.role synchronized.
create or replace function public.sync_profile_role_to_auth()
returns trigger as $$
begin
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role)
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_profile_role_changed on public.profiles;
create trigger on_profile_role_changed
  after insert or update of role on public.profiles
  for each row execute function public.sync_profile_role_to_auth();
