import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

if (!supabaseAnonKey) {
  throw new Error('Missing SUPABASE_ANON_KEY')
}

// service_role client: bypasses RLS, used for every DB query in the app.
// Never call session-mutating auth methods (e.g. signInWithPassword) on this
// client — supabase-js swaps its Authorization header to the authenticated
// user's token as soon as a session is established, silently downgrading
// every later `.from(...)` call in the process from service_role to that
// user, regardless of `persistSession: false` (which only controls
// localStorage, not this in-memory header swap).
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// anon-key client, isolated from `supabase` above: used exclusively to mint
// login/register sessions via signInWithPassword. Never call `.from(...)` on
// this client — it must never be used for queries.
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
