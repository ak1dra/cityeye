import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dvwfjpqbnusjegwtpyau.supabase.co'
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mWjsSlxFpcKVUmMwwO8UpQ_SFggnJf5'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
