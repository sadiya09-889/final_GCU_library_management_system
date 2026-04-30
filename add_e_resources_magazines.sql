-- =============================================
-- E-Resources: magazines upload table and storage
-- Run this in the Supabase SQL Editor.
-- =============================================

create table if not exists public.magazines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'General',
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists magazines_created_at_idx
  on public.magazines (created_at desc);

create index if not exists magazines_uploaded_by_idx
  on public.magazines (uploaded_by);

alter table public.magazines enable row level security;

drop policy if exists "Magazines are readable by authenticated users" on public.magazines;
drop policy if exists "Magazines are insertable by admins or librarians" on public.magazines;
drop policy if exists "Magazines are deletable by admins or librarians" on public.magazines;

create policy "Magazines are readable by authenticated users"
  on public.magazines for select to authenticated
  using (true);

create policy "Magazines are insertable by admins or librarians"
  on public.magazines for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.has_role(auth.uid(), array['admin', 'librarian'])
  );

create policy "Magazines are deletable by admins or librarians"
  on public.magazines for delete to authenticated
  using (public.has_role(auth.uid(), array['admin', 'librarian']));

insert into storage.buckets (id, name, public)
values ('magazines', 'magazines', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

drop policy if exists "Magazine files are readable by authenticated users" on storage.objects;
drop policy if exists "Magazine files are uploadable by admins or librarians" on storage.objects;
drop policy if exists "Magazine files are deletable by admins or librarians" on storage.objects;

create policy "Magazine files are readable by authenticated users"
  on storage.objects for select to authenticated
  using (bucket_id = 'magazines');

create policy "Magazine files are uploadable by admins or librarians"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'magazines'
    and public.has_role(auth.uid(), array['admin', 'librarian'])
  );

create policy "Magazine files are deletable by admins or librarians"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'magazines'
    and public.has_role(auth.uid(), array['admin', 'librarian'])
  );
