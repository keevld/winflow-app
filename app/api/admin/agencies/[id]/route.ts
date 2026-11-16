import { NextRequest, NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/platform-admin'
import { ACCOUNT_STAGES, type AccountStage } from '@/lib/admin'

const URL_RE = /^https?:\/\//i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : undefined)
const today = () => new Date().toISOString().slice(0, 10)

// Datos de la agencia y, aparte, su estado comercial (agency_accounts). Solo el dueño de la plataforma.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin()
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const update: Record<string, string | null> = {}
  for (const [k, n] of [['company_name', 120], ['industry', 120], ['contact_name', 120], ['contact_email', 160], ['contact_phone', 40], ['website', 300], ['booking_url', 300]] as const) {
    const v = clip(body[k], n)
    if (v === undefined) continue
    if ((k === 'website' || k === 'booking_url') && v && !URL_RE.test(v)) {
      return NextResponse.json({ error: `${k} debe empezar con http(s)://` }, { status: 400 })
    }
    if (k === 'company_name' && !v) return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })
    update[k] = v || null
  }

  const { data: client } = await admin.service.from('clients').select('id').eq('id', id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 404 })

  if (Object.keys(update).length) {
    const { error } = await admin.service.from('clients').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const acc = body.account
  if (acc && typeof acc === 'object') {
    const a = acc as Record<string, unknown>
    const row: Record<string, unknown> = { client_id: id, updated_at: new Date().toISOString() }

    if (typeof a.is_demo === 'boolean') row.is_demo = a.is_demo
    if (a.stage !== undefined) {
      if (!ACCOUNT_STAGES.includes(a.stage as AccountStage)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
      row.stage = a.stage
    }
    const plan = clip(a.plan, 60)
    if (plan !== undefined) row.plan = plan || null
    if (a.monthly_price !== undefined) {
      if (a.monthly_price === null || a.monthly_price === '') row.monthly_price = null
      else {
        const n = Number(a.monthly_price)
        if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return NextResponse.json({ error: 'Precio mensual inválido' }, { status: 400 })
        row.monthly_price = Math.round(n * 100) / 100
      }
    }
    if (a.currency !== undefined) {
      if (a.currency !== 'MXN' && a.currency !== 'USD') return NextResponse.json({ error: 'Moneda inválida' }, { status: 400 })
      row.currency = a.currency
    }
    for (const k of ['pilot_started_at', 'paying_since', 'churned_at'] as const) {
      if (a[k] === undefined) continue
      if (a[k] === null || a[k] === '') row[k] = null
      else if (typeof a[k] === 'string' && DATE_RE.test(a[k] as string)) row[k] = a[k]
      else return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
    }
    const reason = clip(a.churn_reason, 300)
    if (reason !== undefined) row.churn_reason = reason || null
    const notes = clip(a.notes, 2000)
    if (notes !== undefined) row.notes = notes || null

    // Una agencia que paga o que se dio de baja siempre lleva fecha, para que altas y bajas tengan de dónde salir.
    for (const [stage, col] of [['paying', 'paying_since'], ['churned', 'churned_at']] as const) {
      if (row.stage !== stage || row[col]) continue
      const { data: cur } = await admin.service.from('agency_accounts').select(col).eq('client_id', id).maybeSingle()
      row[col] = (cur as Record<string, string | null> | null)?.[col] ?? today()
    }

    const { error } = await admin.service.from('agency_accounts').upsert(row, { onConflict: 'client_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
