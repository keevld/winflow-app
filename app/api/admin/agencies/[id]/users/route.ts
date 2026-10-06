import { NextRequest, NextResponse } from 'next/server'
import { getPlatformAdmin, attachUser } from '@/lib/platform-admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin()
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const name = typeof body.full_name === 'string' ? body.full_name.trim().slice(0, 120) : ''
  const role = body.role === 'admin' ? 'admin' : 'seller'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })
  const { data: client } = await admin.service.from('clients').select('id').eq('id', id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 404 })
  const res = await attachUser(admin.service, id, email, name, role)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ ok: true })
}
