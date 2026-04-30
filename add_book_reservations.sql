-- =============================================
-- Book reservation workflow
-- Run this in Supabase SQL Editor.
-- =============================================

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

alter table public.book_reservations enable row level security;

drop policy if exists "Reservations are readable by owner or staff" on public.book_reservations;
drop policy if exists "Students can create their own reservations" on public.book_reservations;
drop policy if exists "Students can cancel their own pending reservations" on public.book_reservations;
drop policy if exists "Admins or librarians can update reservations" on public.book_reservations;

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
