import { NextRequest, NextResponse } from 'next/server'
import { requireMemberContext, isMemberContext } from '@/lib/api-auth'

const KINDS = ['personal', 'call', 'other']
const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireMemberContext()
  if (!isMemberContext(ctx)) return ctx.error
  const { clientId, userId, service } = ctx

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 4000) : ''
  if (!text) return NextResponse.json({ error: 'Escribe la nota' }, { status: 400 })
  const kind = typeof body.kind === 'string' && KINDS.includes(body.kind) ? body.kind : 'personal'
  const notedOn = typeof body.noted_on === 'string' && DATE.test(body.noted_on)
    ? body.noted_on
    : new Date().toISOString().slice(0, 10)

  const { data: contact } = await service
    .from('contacts')
    .select('id')
    .eq('id', id)
    .eq('client_id', clientId)
    .maybeSingle()
  if (!contact) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const { data: note, error } = await service
    .from('contact_notes')
    .insert({ client_id: clientId, contact_id: id, body: text, kind, noted_on: notedOn, created_by: userId })
    .select('id, contact_id, body, kind, noted_on, created_at')
    .single()
  if (error || !note) return NextResponse.json({ error: 'No se pudo guardar la nota' }, { status: 500 })
  return NextResponse.json({ note })
}
