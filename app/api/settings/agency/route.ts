import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext, isAdminContext } from '@/lib/api-auth'

const CLIENT_FIELDS = [
  'company_name', 'industry', 'website', 'contact_name', 'contact_email',
  'contact_phone', 'booking_url', 'calendly_url',
] as const

const BRAND_FIELDS = [
  'tone', 'language_style', 'avoid_words', 'example_phrase',
  'primary_color', 'secondary_color', 'accent_color',
  'competitive_differentiators', 'price_context',
  'proposal_style_notes', 'proposal_example_url',
] as const

function pick(body: Record<string, unknown>, fields: readonly string[]) {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    if (f in body) out[f] = body[f]
  }
  return out
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdminContext()
  if (!isAdminContext(ctx)) return ctx.error
  const { clientId, service } = ctx

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const clientUpdate = pick(body, CLIENT_FIELDS)
  const brandUpdate = pick(body, BRAND_FIELDS)

  if (Object.keys(clientUpdate).length > 0) {
    const { error } = await service.from('clients').update(clientUpdate).eq('id', clientId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (Object.keys(brandUpdate).length > 0) {
    // brand_voice has no unique constraint on client_id, so we check
    // existence in app code rather than relying on upsert(onConflict:...).
    const { data: existing } = await service
      .from('brand_voice')
      .select('id')
      .eq('client_id', clientId)
      .maybeSingle()

    if (existing) {
      const { error } = await service.from('brand_voice').update(brandUpdate).eq('client_id', clientId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await service.from('brand_voice').insert({ ...brandUpdate, client_id: clientId })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
