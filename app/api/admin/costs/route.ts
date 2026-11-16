import { NextRequest, NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/platform-admin'

// Agrega un costo fijo mensual de operar Winflow. Solo el dueño de la plataforma.
export async function POST(req: NextRequest) {
  const admin = await getPlatformAdmin()
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  const amount = Number(body.monthly_amount)
  const currency = body.currency === 'MXN' ? 'MXN' : body.currency === 'USD' ? 'USD' : null
  if (!name) return NextResponse.json({ error: 'Falta el nombre del costo' }, { status: 400 })
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
  if (!currency) return NextResponse.json({ error: 'Moneda inválida' }, { status: 400 })

  const { error } = await admin.service.from('platform_costs').insert({ name, monthly_amount: Math.round(amount * 100) / 100, currency })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
