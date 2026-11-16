import { NextRequest, NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/platform-admin'

const STATUSES = ['new', 'contacted', 'accepted', 'discarded']

// Cambia el estado o las notas de una solicitud de piloto. Solo el dueño de la plataforma.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin()
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const update: Record<string, string | null> = {}
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !STATUSES.includes(body.status)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    update.status = body.status
  }
  if (typeof body.owner_notes === 'string') update.owner_notes = body.owner_notes.trim().slice(0, 2000) || null
  if (!Object.keys(update).length) return NextResponse.json({ ok: true })

  const { error } = await admin.service.from('pilot_requests').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
