-- Run this once in Supabase SQL Editor to fix demo logins.
-- It creates (if missing), confirms, and resets passwords for:
--   admin@gcu.edu.in / admin123
--   librarian@gcu.edu.in / lib123

create extension if not exists pgcrypto;

-- Ensure profiles exists for fresh projects where schema SQL has not been applied yet.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'student' check (role in ('admin', 'librarian', 'student')),
  department text,
  join_date date default current_date,
  created_at timestamptz default now()
);

do $$
declare
  v_admin_id uuid;
  v_librarian_id uuid;
begin
  -- Admin user
  select id into v_admin_id from auth.users where email = 'admin@gcu.edu.in';

  if v_admin_id is null then
    v_admin_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change_token_current,
      reauthentication_token,
      phone_change_token,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'admin@gcu.edu.in',
      crypt('admin123', gen_salt('bf')),
      '',
      '',
      '',
      '',
      '',
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Admin","role":"admin"}'::jsonb,
      now(),
      now()
    );
  else
    update auth.users
    set
      encrypted_password = crypt('admin123', gen_salt('bf')),
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      reauthentication_token = coalesce(reauthentication_token, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"name":"Admin","role":"admin"}'::jsonb,
      updated_at = now()
    where id = v_admin_id;
  end if;

  if not exists (
    select 1 from auth.identities where user_id = v_admin_id and provider = 'email'
  ) then
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      v_admin_id,
      jsonb_build_object(
        'sub', v_admin_id::text,
        'email', 'admin@gcu.edu.in',
        'email_verified', true,
        'phone_verified', false,
        'name', 'Admin',
        'role', 'admin'
      ),
      'email',
      'admin@gcu.edu.in',
      now(),
      now(),
      now()
    );
  end if;

  insert into public.profiles (id, name, email, role)
  values (v_admin_id, 'Admin', 'admin@gcu.edu.in', 'admin')
  on conflict (id) do update
  set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role;

  -- Librarian user
  select id into v_librarian_id from auth.users where email = 'librarian@gcu.edu.in';

  if v_librarian_id is null then
    v_librarian_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change_token_current,
      reauthentication_token,
      phone_change_token,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_librarian_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'librarian@gcu.edu.in',
      crypt('lib123', gen_salt('bf')),
      '',
      '',
      '',
      '',
      '',
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Librarian","role":"librarian"}'::jsonb,
      now(),
      now()
    );
  else
    update auth.users
    set
      encrypted_password = crypt('lib123', gen_salt('bf')),
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      reauthentication_token = coalesce(reauthentication_token, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"name":"Librarian","role":"librarian"}'::jsonb,
      updated_at = now()
    where id = v_librarian_id;
  end if;

  if not exists (
    select 1 from auth.identities where user_id = v_librarian_id and provider = 'email'
  ) then
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      v_librarian_id,
      jsonb_build_object(
        'sub', v_librarian_id::text,
        'email', 'librarian@gcu.edu.in',
        'email_verified', true,
        'phone_verified', false,
        'name', 'Librarian',
        'role', 'librarian'
      ),
      'email',
      'librarian@gcu.edu.in',
      now(),
      now(),
      now()
    );
  end if;

  insert into public.profiles (id, name, email, role)
  values (v_librarian_id, 'Librarian', 'librarian@gcu.edu.in', 'librarian')
  on conflict (id) do update
  set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role;
end $$;

-- Safety normalization for manually inserted auth rows to avoid GoTrue 500s.
update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  email_change = coalesce(email_change, ''),
  phone_change = coalesce(phone_change, '')
where email in ('admin@gcu.edu.in', 'librarian@gcu.edu.in');

-- Verify results
select
  email,
  email_confirmed_at is not null as email_confirmed,
  raw_user_meta_data->>'role' as role
from auth.users
where email in ('admin@gcu.edu.in', 'librarian@gcu.edu.in')
order by email;
