import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function cookieHandlers() {
  return {
    async getAll() {
      return (await cookies()).getAll()
    },
    async setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
      const store = await cookies()
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          store.set(name, value, options as Parameters<typeof store.set>[2])
        )
      } catch {}
    },
  }
}

export async function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieHandlers() }
  )
}

// Service role — bypasses RLS. Use only in server actions/routes, never in client.
export async function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  )
}
