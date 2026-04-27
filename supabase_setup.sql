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

-- 3. Profiles table (linked to Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'student' check (role in ('admin', 'librarian', 'student', 'faculty')),
  department text,
  contact_number text,
  reg_no text,
  join_date date default current_date,
  created_at timestamptz default now()
);

-- =============================================
-- Row Level Security
-- =============================================

alter table public.books enable row level security;
alter table public.issued_books enable row level security;
alter table public.profiles enable row level security;

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

drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can update their own profile or admin can update" on public.profiles;

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

-- Profiles: keep read access for authenticated users; allow self-update or admin update.
create policy "Profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can update their own profile or admin can update"
  on public.profiles for update to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), array['admin']))
  with check (auth.uid() = id or public.has_role(auth.uid(), array['admin']));

-- Auto-create profile on signup (optional trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role, contact_number, reg_no)
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
