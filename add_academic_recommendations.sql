-- =============================================
-- Academic school/department recommendations
-- Run this in Supabase SQL Editor before importing the programme workbook.
-- =============================================

alter table public.profiles add column if not exists school text;
alter table public.profiles add column if not exists department text;

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

alter table public.academic_programmes enable row level security;
alter table public.programme_books enable row level security;

drop policy if exists "Academic programmes are readable by authenticated users" on public.academic_programmes;
drop policy if exists "Academic programmes are writable by admins or librarians" on public.academic_programmes;
drop policy if exists "Programme books are readable by authenticated users" on public.programme_books;
drop policy if exists "Programme books are writable by admins or librarians" on public.programme_books;

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
