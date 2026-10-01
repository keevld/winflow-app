import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(
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

  // ── 3. Body ───────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const proposal_text = body.proposal_text
  if (typeof proposal_text !== 'string' || !proposal_text.trim()) {
    return NextResponse.json({ error: 'proposal_text is required' }, { status: 400 })
  }

  // ── 4. Proposal — load with anon client (RLS pre-filters) ─
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, client_id, created_by, status')
    .eq('id', id)
    .single()

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found or access denied' }, { status: 403 })
  }

  // ── 5. Explicit authorization ─────────────────────────────
  if (proposal.client_id !== profile.client_id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (profile.role === 'seller' && proposal.created_by !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Can't edit text after it's already been sent to the prospect
  if (proposal.status === 'sent' || proposal.status === 'sending') {
    return NextResponse.json({ error: 'No se puede editar una propuesta ya enviada' }, { status: 400 })
  }

  // ── 6. Save (service role — authorization already verified) ──
  const service = await createServiceClient()
  const { error: updateErr } = await service
    .from('proposals')
    .update({ proposal_text, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', profile.client_id)

  if (updateErr) {
    return NextResponse.json({ error: 'No se pudo guardar el texto' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
