import { createClient } from '@supabase/supabase-js';

import type { Database } from '../types/database';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly at startup rather than with opaque network errors later.
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env at the repo root (or apps/mobile/.env) and fill in ' +
      'your hosted Supabase project values, then restart `expo start` with cache clear.',
  );
}

/**
 * Anon-key client: catalog reads are public via RLS; user features (Phase 3)
 * will layer auth on this same client.
 */
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // Phase 3 wires AsyncStorage-backed session persistence + phone OTP.
    persistSession: false,
  },
});
