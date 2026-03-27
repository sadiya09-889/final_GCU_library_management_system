-- Migration: Add contact_number column to profiles table
-- Run this in your Supabase SQL Editor

-- Add contact_number column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_number text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.contact_number IS 'User contact/phone number';