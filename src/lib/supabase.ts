import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://anqaecdyipycajapmiev.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFucWFlY2R5aXB5Y2FqYXBtaWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMjUwMTAsImV4cCI6MjEwNzgwMTAxMH0.S1wdhr4vmvgK1xWhIJM-B1eGB1wNQtD5_iYSgA9JmtE';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'household_hub_auth_v1',
  },
});
