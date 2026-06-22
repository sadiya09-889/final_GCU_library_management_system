-- =============================================
-- Penalties RLS policies
-- Run this if RLS is enabled on penalties.
-- =============================================

alter table public.penalties enable row level security;

drop policy if exists "Penalties are readable by owner or staff" on public.penalties;
drop policy if exists "Penalties are writable by admins or librarians" on public.penalties;

create policy "Penalties are readable by owner or staff"
  on public.penalties for select to authenticated
  using (student_id = auth.uid() or public.has_role(auth.uid(), array['admin', 'librarian']));

create policy "Penalties are writable by admins or librarians"
  on public.penalties for all to authenticated
  using (public.has_role(auth.uid(), array['admin', 'librarian']))
  with check (public.has_role(auth.uid(), array['admin', 'librarian']));
