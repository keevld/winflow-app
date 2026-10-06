import { NextRequest, NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/platform-admin'

const URL_RE = /^https?:\/\//i
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : undefined)

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
  if (!Object.keys(update).length) return NextResponse.json({ ok: true })
  const { error } = await admin.service.from('clients').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
