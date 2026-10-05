import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { capitalizeFirst } from '@/lib/text'

// Marca una propuesta enviada como ganada / perdida (o quita la marca).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const outcome = body.outcome
  if (outcome !== 'won' && outcome !== 'lost' && outcome !== null) {
    return NextResponse.json({ error: 'outcome debe ser won, lost o null' }, { status: 400 })
  }
  const reason =
    outcome === 'lost' && typeof body.reason === 'string' && body.reason.trim()
      ? capitalizeFirst(body.reason).slice(0, 500)
      : null

  // RLS pre-filters to the caller's agency; then explicit checks.
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, client_id, created_by, status')
    .eq('id', id)
    .single()
  if (!proposal || proposal.client_id !== profile.client_id) {
    return NextResponse.json({ error: 'Proposal not found or access denied' }, { status: 403 })
  }
  if (profile.role === 'seller' && proposal.created_by !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  if (proposal.status !== 'sent') {
    return NextResponse.json({ error: 'Solo se puede marcar una propuesta ya enviada' }, { status: 409 })
  }

  const service = await createServiceClient()
  const { error } = await service
    .from('proposals')
    .update({
      outcome,
      outcome_at: outcome ? new Date().toISOString() : null,
      outcome_reason: reason,
    })
    .eq('id', id)
    .eq('client_id', profile.client_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, outcome, outcome_reason: reason })
}
