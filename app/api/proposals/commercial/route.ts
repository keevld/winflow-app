import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateCommercial } from '@/lib/commercial-generate'
import { capitalizeFirst, titleCase } from '@/lib/text'
import type { PricingMode } from '@/lib/commercial'

// La generación llama a la IA (20-60 s).
export const maxDuration = 120

const MODES: PricingMode[] = ['packages', 'single', 'lines']
const UUID = /^[0-9a-f-]{36}$/i

const s = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function POST(req: NextRequest) {
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
  const clientId = profile.client_id as string

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const mode = body.pricing_mode as PricingMode
  if (!MODES.includes(mode)) {
    return NextResponse.json({ error: 'Modo de precios inválido' }, { status: 400 })
  }

  const prospect_name = titleCase(s(body.prospect_name, 120))
  const prospect_company = capitalizeFirst(s(body.prospect_company, 160))
  const prospect_email = s(body.prospect_email, 200)
  const call_notes = s(body.call_notes, 20000)
  if (!prospect_name || !prospect_company) {
    return NextResponse.json({ error: 'Nombre y empresa del prospecto son obligatorios' }, { status: 400 })
  }
  if (!call_notes) {
    return NextResponse.json({ error: 'Pega las notas o la transcripción de la llamada' }, { status: 400 })
  }
  if (prospect_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prospect_email)) {
    return NextResponse.json({ error: 'El correo del prospecto no es válido' }, { status: 400 })
  }

  const productIds = Array.isArray(body.product_ids)
    ? (body.product_ids as unknown[]).filter((x): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 8)
    : []

  // Propuesta inicial de origen (opcional): debe ser de la misma agencia
  let parentId: string | null = null
  if (typeof body.parent_proposal_id === 'string' && UUID.test(body.parent_proposal_id)) {
    const { data: parent } = await supabase
      .from('proposals')
      .select('id, client_id, created_by')
      .eq('id', body.parent_proposal_id)
      .single()
    if (!parent || parent.client_id !== clientId) {
      return NextResponse.json({ error: 'Propuesta de origen no encontrada' }, { status: 403 })
    }
    if (profile.role === 'seller' && parent.created_by !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    parentId = parent.id
  }

  const fields = {
    prospect_name,
    prospect_title: capitalizeFirst(s(body.prospect_title, 120)) || null,
    prospect_company,
    prospect_email: prospect_email || null,
    prospect_website: s(body.prospect_website, 300) || null,
    prospect_industry: capitalizeFirst(s(body.prospect_industry, 120)) || null,
    prospect_company_size: s(body.prospect_company_size, 60) || null,
    prospect_pain: s(body.prospect_pain, 4000) || null,
    call_notes,
    budget_hint: s(body.budget_hint, 200) || null,
    desired_deadline: s(body.desired_deadline, 200) || null,
  }

  const service = await createServiceClient()

  // Nombre del servicio principal solo como referencia en el tablero
  const validUntil = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: created, error: insertErr } = await service
    .from('proposals')
    .insert({
      client_id: clientId,
      created_by: user.id,
      public_slug: nanoid(16),
      status: 'generating',
      generation_started_at: new Date().toISOString(),
      proposal_type: 'commercial',
      parent_proposal_id: parentId,
      pricing_mode: mode,
      valid_until: validUntil,
      ...fields,
    })
    .select('id')
    .single()
  if (insertErr || !created) {
    return NextResponse.json({ error: 'No se pudo crear la propuesta' }, { status: 500 })
  }
  const id = created.id as string

  try {
    const result = await generateCommercial(service, {
      clientId,
      proposal: fields,
      mode,
      selectedProductIds: productIds,
    })

    if (result.items.length) {
      const { error: itemsErr } = await service.from('proposal_price_items').insert(
        result.items.map(it => ({ ...it, proposal_id: id, client_id: clientId }))
      )
      if (itemsErr) throw new Error('No se pudieron guardar las partidas de precio')
    }

    const productNames = result.items.map(i => i.description)
    await service
      .from('proposals')
      .update({
        status: 'ready',
        commercial: result.content,
        product: Array.from(new Set(productNames)).slice(0, 3).join(', ') || null,
        generated_at: new Date().toISOString(),
        failure_reason: null,
      })
      .eq('id', id)
      .eq('client_id', clientId)

    return NextResponse.json({ ok: true, id, warnings: result.warnings })
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 300) : 'Error desconocido'
    await service
      .from('proposals')
      .update({ status: 'failed', failure_reason: reason })
      .eq('id', id)
      .eq('client_id', clientId)
    return NextResponse.json({ error: reason, id }, { status: 502 })
  }
}
