import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireMemberContext, isMemberContext } from '@/lib/api-auth'
import { cancelScheduledBot, leaveCall, parseJoinAt, rescheduleBot } from '@/lib/recall'

const UUID = /^[0-9a-f-]{36}$/i

// Estado de una grabación. Va con la sesión del usuario: la política RLS limita a lo suyo (o a su agencia si es admin).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase
    .from('call_recordings')
    .select('id, platform, status, status_detail, scheduled_for, participants, transcript, duration_seconds, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ call: data })
}

// Cancelar (el bot sale de la reunión) o borrar la grabación y su transcripción.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ctx = await requireMemberContext()
  if (!isMemberContext(ctx)) return ctx.error
  const { clientId, userId, role, service } = ctx

  let q = service.from('call_recordings').select('id, recall_bot_id, status, created_by').eq('id', id).eq('client_id', clientId)
  if (role !== 'admin') q = q.eq('created_by', userId)
  const { data: row } = await q.maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (row.recall_bot_id && row.status === 'scheduled') {
    // Aún no entra: se borra la programación; si Recall ya lo despachó, lo sacamos de la reunión.
    if (!(await cancelScheduledBot(row.recall_bot_id))) await leaveCall(row.recall_bot_id)
  } else if (row.recall_bot_id && ['starting', 'joining', 'waiting_room', 'recording'].includes(row.status)) {
    await leaveCall(row.recall_bot_id)
  }
  await service.from('call_recordings').delete().eq('id', id).eq('client_id', clientId)
  return NextResponse.json({ ok: true })
}

// Cambiar la hora de una llamada programada.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ctx = await requireMemberContext()
  if (!isMemberContext(ctx)) return ctx.error
  const { clientId, userId, role, service } = ctx

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = parseJoinAt(body.join_at)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  let q = service.from('call_recordings').select('id, recall_bot_id, status').eq('id', id).eq('client_id', clientId)
  if (role !== 'admin') q = q.eq('created_by', userId)
  const { data: row } = await q.maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.status !== 'scheduled' || !row.recall_bot_id) {
    return NextResponse.json({ error: 'Esta llamada ya no se puede reprogramar.' }, { status: 409 })
  }
  if (!(await rescheduleBot(row.recall_bot_id, parsed.iso))) {
    return NextResponse.json({ error: 'No se pudo cambiar la hora. Si faltan menos de 10 minutos para la reunión, cancélala y programa una nueva.' }, { status: 502 })
  }
  await service.from('call_recordings').update({ scheduled_for: parsed.iso, updated_at: new Date().toISOString() }).eq('id', id).eq('client_id', clientId)
  return NextResponse.json({ ok: true, scheduled_for: parsed.iso })
}
