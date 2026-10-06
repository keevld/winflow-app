import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sanitizeContent, sanitizeItems } from '@/lib/commercial'

// Guarda las ediciones del vendedor en una propuesta comercial (contenido + partidas de precio).
export async function PATCH(
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

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, client_id, created_by, status, proposal_type, accepted_at')
    .eq('id', id)
    .single()
  if (!proposal || proposal.client_id !== profile.client_id) {
    return NextResponse.json({ error: 'Proposal not found or access denied' }, { status: 403 })
  }
  if (profile.role === 'seller' && proposal.created_by !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  if (proposal.proposal_type !== 'commercial') {
    return NextResponse.json({ error: 'No es una propuesta comercial' }, { status: 400 })
  }
  if (proposal.accepted_at) {
    return NextResponse.json({ error: 'La propuesta ya fue aceptada y no se puede editar' }, { status: 409 })
  }
  if (!['ready', 'draft', 'failed'].includes(proposal.status)) {
    return NextResponse.json({ error: 'La propuesta ya se envió y no se puede editar' }, { status: 409 })
  }

  const update: Record<string, unknown> = {}
  if ('commercial' in body) update.commercial = sanitizeContent(body.commercial)
  if (typeof body.valid_until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.valid_until)) {
    update.valid_until = body.valid_until
  } else if (body.valid_until === null) {
    update.valid_until = null
  }
  if (body.pricing_mode === 'packages' || body.pricing_mode === 'single' || body.pricing_mode === 'lines') {
    update.pricing_mode = body.pricing_mode
  }

  const service = await createServiceClient()

  if (Object.keys(update).length) {
    const { error } = await service.from('proposals').update(update).eq('id', id).eq('client_id', profile.client_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if ('items' in body) {
    const items = sanitizeItems(body.items)
    // Reemplazo completo: borra y vuelve a insertar las partidas
    const { error: delErr } = await service
      .from('proposal_price_items')
      .delete()
      .eq('proposal_id', id)
      .eq('client_id', profile.client_id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    if (items.length) {
      const { error: insErr } = await service
        .from('proposal_price_items')
        .insert(items.map(({ id: _omit, ...it }) => ({ ...it, proposal_id: id, client_id: profile.client_id })))
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
    const names = Array.from(new Set(items.map(i => i.description))).slice(0, 3).join(', ')
    await service.from('proposals').update({ product: names || null }).eq('id', id).eq('client_id', profile.client_id)
  }

  return NextResponse.json({ ok: true })
}
