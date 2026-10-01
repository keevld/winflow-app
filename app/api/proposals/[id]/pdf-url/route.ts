import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // ── 1. Auth ───────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 2. Profile ────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    return NextResponse.json({ error: 'No agency assigned to this user' }, { status: 403 })
  }

  // ── 3. Proposal — load with anon client (RLS pre-filters) ─
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, client_id, created_by, pdf_url')
    .eq('id', id)
    .single()

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found or access denied' }, { status: 403 })
  }

  // ── 4. Explicit authorization ─────────────────────────────
  if (proposal.client_id !== profile.client_id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (profile.role === 'seller' && proposal.created_by !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (!proposal.pdf_url) {
    return NextResponse.json({ error: 'No PDF yet' }, { status: 404 })
  }

  // ── 5. Sign the storage path (bucket is private) ──────────
  const service = await createServiceClient()
  const { data: signed, error: signError } = await service.storage
    .from('proposals')
    .createSignedUrl(proposal.pdf_url, 60 * 10)

  if (signError || !signed) {
    return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
