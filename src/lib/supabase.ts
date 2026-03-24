import { createClient, SupabaseClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL || ''
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const isConfigured = rawUrl && rawKey && !rawUrl.includes('your_supabase') && !rawKey.includes('your_supabase')

export const isSupabaseConfigured = Boolean(isConfigured)

const supabaseUrl = isConfigured ? rawUrl : 'https://placeholder.supabase.co'
const supabaseAnonKey = isConfigured ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.placeholder'

if (!isConfigured) {
  console.warn('⚠️ Supabase credentials not configured. Please update your .env file with valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)