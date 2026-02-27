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

-- 2. Issued books table
create table if not exists public.issued_books (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete set null,
  book_title text not null,
  student_name text not null,
  student_id text not null,
  issue_date date not null default current_date,
  due_date date not null,
  return_date date,
  status text not null default 'issued' check (status in ('issued', 'returned', 'overdue')),
  created_at timestamptz default now()
);

-- 3. Profiles table (linked to Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'student' check (role in ('admin', 'librarian', 'student')),
  department text,
  join_date date default current_date,
  created_at timestamptz default now()
);

-- =============================================
-- Row Level Security
-- =============================================

alter table public.books enable row level security;
alter table public.issued_books enable row level security;
alter table public.profiles enable row level security;

-- Books: anyone authenticated can read, admins/librarians can write
create policy "Books are readable by authenticated users"
  on public.books for select to authenticated using (true);

create policy "Books are insertable by authenticated users"
  on public.books for insert to authenticated with check (true);

create policy "Books are updatable by authenticated users"
  on public.books for update to authenticated using (true);

create policy "Books are deletable by authenticated users"
  on public.books for delete to authenticated using (true);

-- Issued books: anyone authenticated can read, authenticated can insert/update
create policy "Issued books are readable by authenticated users"
  on public.issued_books for select to authenticated using (true);

create policy "Issued books are insertable by authenticated users"
  on public.issued_books for insert to authenticated with check (true);

create policy "Issued books are updatable by authenticated users"
  on public.issued_books for update to authenticated using (true);

-- Profiles: authenticated users can read all profiles
create policy "Profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Auto-create profile on signup (optional trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
