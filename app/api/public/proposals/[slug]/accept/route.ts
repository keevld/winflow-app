import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Público (sin login): el prospecto acepta la propuesta comercial.
// Acceso protegido por el slug no adivinable, igual que /p/[slug].
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let body: { name?: unknown; option?: unknown; comment?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : ''
  const option = typeof body.option === 'string' ? body.option.trim().slice(0, 40) : ''
  if (name.length < 2) {
    return NextResponse.json({ error: 'Escribe tu nombre para aceptar.' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: proposal } = await service
    .from('proposals')
    .select('id, client_id, status, proposal_type, pricing_mode, valid_until, accepted_at')
    .eq('public_slug', slug)
    .single()

  if (!proposal || proposal.proposal_type !== 'commercial' || proposal.status !== 'sent') {
    return NextResponse.json({ error: 'Propuesta no disponible' }, { status: 404 })
  }
  if (proposal.accepted_at) {
    return NextResponse.json({ ok: true, already: true })
  }
  if (proposal.valid_until) {
    const end = new Date(`${proposal.valid_until}T23:59:59`)
    if (Date.now() > end.getTime()) {
      return NextResponse.json({ error: 'Esta propuesta ya venció. Pide una versión actualizada.' }, { status: 410 })
    }
  }

  // La opción debe existir en las partidas de la propuesta
  const { data: items } = await service
    .from('proposal_price_items')
    .select('option_key, unit_price')
    .eq('proposal_id', proposal.id)
  const keys = Array.from(new Set((items ?? []).map(i => i.option_key as string)))
  if ((items ?? []).some(i => i.unit_price === null)) {
    return NextResponse.json({ error: 'Propuesta no disponible' }, { status: 409 })
  }
  let chosen: string | null = null
  if (proposal.pricing_mode === 'packages' && keys.length > 1) {
    if (!keys.includes(option)) {
      return NextResponse.json({ error: 'Elige una de las opciones.' }, { status: 400 })
    }
    chosen = option
  } else {
    chosen = keys[0] ?? null
  }

  const now = new Date().toISOString()
  // Condicional: solo si todavía no estaba aceptada (idempotencia ante doble clic)
  const { data: updated, error } = await service
    .from('proposals')
    .update({
      accepted_at: now,
      accepted_by_name: name,
      accepted_option: chosen,
      accepted_comment: comment || null,
      outcome: 'won',
      outcome_at: now,
    })
    .eq('id', proposal.id)
    .is('accepted_at', null)
    .select('id')
  if (error) return NextResponse.json({ error: 'No se pudo registrar la aceptación' }, { status: 500 })
  if (!updated?.length) return NextResponse.json({ ok: true, already: true })

  await service.from('proposal_events').insert({
    proposal_id: proposal.id,
    client_id: proposal.client_id,
    event_type: 'accepted',
    metadata: { name, option: chosen },
  })

  return NextResponse.json({ ok: true })
}
