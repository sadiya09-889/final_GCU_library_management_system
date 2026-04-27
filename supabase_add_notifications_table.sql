-- Supabase migration: notifications table for overdue/email notifications
create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid references profiles(id) on delete cascade,
    sender_id uuid references profiles(id),
    type text check (type in ('due_soon', 'overdue', 'penalty', 'custom')) not null,
    title text not null,
    message text not null,
    related_book_id uuid references books(id),
    created_at timestamp with time zone default now(),
    read_at timestamp with time zone,
    email_sent boolean default false,
    meta jsonb
);

create index if not exists idx_notifications_recipient on notifications(recipient_id);
create index if not exists idx_notifications_created_at on notifications(created_at);
create index if not exists idx_notifications_read_at on notifications(read_at);
