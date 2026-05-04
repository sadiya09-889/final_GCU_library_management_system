-- =============================================
-- Notifications RLS policies (optional)
-- Run this if RLS is enabled on notifications.
-- =============================================

alter table public.notifications enable row level security;

drop policy if exists "Notifications are readable by recipient" on public.notifications;
drop policy if exists "Notifications are insertable by staff" on public.notifications;
drop policy if exists "Notifications are updatable by recipient" on public.notifications;

create policy "Notifications are readable by recipient"
  on public.notifications for select to authenticated
  using (recipient_id = auth.uid() or public.has_role(auth.uid(), array['admin', 'librarian']));

create policy "Notifications are insertable by staff"
  on public.notifications for insert to authenticated
  with check (public.has_role(auth.uid(), array['admin', 'librarian']));

create policy "Notifications are updatable by recipient"
  on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());