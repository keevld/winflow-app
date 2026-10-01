import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type AdminContext = {
  clientId: string
  service: Awaited<ReturnType<typeof createServiceClient>>
}

type AdminContextResult = AdminContext | { error: NextResponse }

// Shared guard for every /api/settings/* route: only an authenticated admin
// may read/write their own agency's knowledge base (products, pricing,
// pain points, etc.). Mirrors the same check the requesting_user_is_admin_of()
// RLS helper does in Postgres, since these routes use the service-role
// client (which bypasses RLS) to perform multi-table writes.
export async function requireAdminContext(): Promise<AdminContextResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    return { error: NextResponse.json({ error: 'No agency assigned to this user' }, { status: 403 }) }
  }
  if (profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Solo administradores pueden editar esto' }, { status: 403 }) }
  }

  const service = await createServiceClient()
  return { clientId: profile.client_id, service }
}

export function isAdminContext(ctx: AdminContextResult): ctx is AdminContext {
  return !('error' in ctx)
}
