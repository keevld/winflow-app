import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext, isAdminContext } from '@/lib/api-auth'

const FIELDS = [
  'avg_cycle_days', 'min_cycle_days', 'max_cycle_days', 'typical_steps',
  'decision_makers', 'sends_quote', 'expects_negotiation', 'negotiation_notes',
  'followup_pace', 'followup_day1', 'followup_day2', 'followup_day3',
  'followup_max_attempts', 'followup_notes', 'industry_decision_pace', 'industry_notes',
] as const

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

  const update: Record<string, unknown> = {}
  for (const f of FIELDS) {
    if (f in body) update[f] = body[f]
  }

  const { data: existing } = await service
    .from('sales_process')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle()

  if (existing) {
    const { error } = await service.from('sales_process').update(update).eq('client_id', clientId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await service.from('sales_process').insert({ ...update, client_id: clientId })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
