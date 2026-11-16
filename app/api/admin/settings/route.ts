import { NextRequest, NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/platform-admin'

// Ajustes del panel del dueño. Por ahora, el tipo de cambio para sumar pesos y dólares.
export async function PUT(req: NextRequest) {
  const admin = await getPlatformAdmin()
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (body.usd_mxn === null || body.usd_mxn === '') {
    const { error } = await admin.service.from('platform_settings').delete().eq('key', 'usd_mxn')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  const fx = Number(body.usd_mxn)
  if (!Number.isFinite(fx) || fx <= 0 || fx > 1000) return NextResponse.json({ error: 'Tipo de cambio inválido' }, { status: 400 })
  const { error } = await admin.service.from('platform_settings').upsert(
    { key: 'usd_mxn', value: Math.round(fx * 10000) / 10000, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
