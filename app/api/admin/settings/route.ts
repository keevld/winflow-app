import { NextRequest, NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/platform-admin'

const KEYS = ['usd_mxn', 'eur_mxn'] as const

// Ajustes del panel del dueño. Por ahora, los tipos de cambio para sumar pesos, dólares y euros.
// Cada clave que venga se guarda; vacía o null la borra.
export async function PUT(req: NextRequest) {
  const admin = await getPlatformAdmin()
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  for (const key of KEYS) {
    const raw = body[key]
    if (raw === undefined) continue
    if (raw === null || raw === '') {
      const { error } = await admin.service.from('platform_settings').delete().eq('key', key)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      continue
    }
    const fx = Number(raw)
    if (!Number.isFinite(fx) || fx <= 0 || fx > 1000) return NextResponse.json({ error: 'Tipo de cambio inválido' }, { status: 400 })
    const { error } = await admin.service.from('platform_settings').upsert(
      { key, value: Math.round(fx * 10000) / 10000, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
