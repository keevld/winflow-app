import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Active products of the caller's own agency. Works for admins and sellers.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    return NextResponse.json({ error: 'No agency assigned to this user' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, name')
    .eq('client_id', profile.client_id)
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data ?? [], is_admin: profile.role === 'admin' })
}
