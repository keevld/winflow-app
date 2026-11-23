import { NextRequest, NextResponse } from 'next/server'
import { requireMemberContext, isMemberContext } from '@/lib/api-auth'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { createBot, detectPlatform, parseJoinAt, recallConfigured } from '@/lib/recall'

export const maxDuration = 30

// ¿Está activada la grabación para esta agencia, cuántas reuniones quedan este mes y cuáles son mis llamadas recientes (programadas, listas…)?
export async function GET() {
  const ctx = await requireMemberContext()
  if (!isMemberContext(ctx)) return ctx.error
  const { clientId, userId, service } = ctx
  const { data: agency } = await service.from('clients').select('company_name, calls_enabled, calls_monthly_limit').eq('id', clientId).single()
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const { count } = await service
    .from('call_recordings')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gte('created_at', monthStart.toISOString())
    .not('status', 'in', '(failed,cancelled,denied)')
  const limit = Number(agency?.calls_monthly_limit ?? 5)
  // Mis llamadas que aún no se usaron en una propuesta (la transcripción completa se pide al elegir una)
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
  const { data: calls } = await service
    .from('call_recordings')
    .select('id, platform, status, status_detail, scheduled_for, created_at, duration_seconds')
    .eq('client_id', clientId)
    .eq('created_by', userId)
    .is('proposal_id', null)
    .neq('status', 'cancelled')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(8)
  return NextResponse.json({
    calls: calls ?? [],
    enabled: Boolean(agency?.calls_enabled) && recallConfigured(),
    remaining: Math.max(0, limit - (count ?? 0)),
    limit,
    bot_name: agency?.company_name ? `Notas de ${String(agency.company_name).slice(0, 60)} (Winflow)` : 'Notas Winflow',
  })
}

// Enviar el bot de Winflow a una videollamada (Zoom, Meet o Teams): ahora, o programado con `join_at`.
export async function POST(req: NextRequest) {
  const ctx = await requireMemberContext()
  if (!isMemberContext(ctx)) return ctx.error
  const { clientId, userId, service } = ctx

  if (!(await rateLimit(service, `call:${userId}`, 10, 3600))) return tooMany()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const found = typeof body.meeting_url === 'string' ? detectPlatform(body.meeting_url) : null
  if (!found) {
    return NextResponse.json({ error: 'Pega el enlace de una reunión de Zoom, Google Meet o Microsoft Teams.' }, { status: 400 })
  }
  let joinAt: string | undefined
  if (body.join_at !== undefined && body.join_at !== null && body.join_at !== '') {
    const parsed = parseJoinAt(body.join_at)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    joinAt = parsed.iso
  }
  if (body.consent_confirmed !== true) {
    return NextResponse.json({ error: 'Confirma que los participantes saben que la reunión se graba.' }, { status: 400 })
  }

  const { data: agency } = await service
    .from('clients')
    .select('company_name, calls_enabled, calls_monthly_limit')
    .eq('id', clientId)
    .single()
  if (!agency?.calls_enabled) {
    return NextResponse.json({ error: 'La grabación de llamadas aún no está activada para tu agencia. Escríbenos y la activamos.' }, { status: 403 })
  }
  if (!recallConfigured()) {
    return NextResponse.json({ error: 'El servicio de grabación no está configurado todavía.' }, { status: 503 })
  }

  // Tope mensual por agencia (cada reunión tiene un costo real por hora)
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const { count } = await service
    .from('call_recordings')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gte('created_at', monthStart.toISOString())
    .not('status', 'in', '(failed,cancelled,denied)')
  const limit = Number(agency.calls_monthly_limit ?? 5)
  if ((count ?? 0) >= limit) {
    return NextResponse.json({ error: `Llegaste al tope de ${limit} reuniones grabadas este mes. Puedes pegar la transcripción o las notas mientras tanto.` }, { status: 429 })
  }

  const { data: row, error: insErr } = await service
    .from('call_recordings')
    .insert({ client_id: clientId, created_by: userId, platform: found.platform, meeting_url: found.url, consent_confirmed: true, status: joinAt ? 'scheduled' : 'starting', scheduled_for: joinAt ?? null })
    .select('id')
    .single()
  if (insErr || !row) return NextResponse.json({ error: 'No se pudo iniciar la grabación' }, { status: 500 })

  const name = String(agency.company_name ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 60)
  try {
    const bot = await createBot({
      meetingUrl: found.url,
      botName: name ? `Notas de ${name} (Winflow)` : 'Notas Winflow',
      callId: row.id,
      joinAt,
    })
    await service.from('call_recordings').update({ recall_bot_id: bot.id, status: joinAt ? 'scheduled' : 'joining', updated_at: new Date().toISOString() }).eq('id', row.id)
  } catch (e) {
    await service.from('call_recordings').update({ status: 'failed', status_detail: 'create_bot_failed', updated_at: new Date().toISOString() }).eq('id', row.id)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo enviar el bot' }, { status: 502 })
  }
  return NextResponse.json({ id: row.id, platform: found.platform, status: joinAt ? 'scheduled' : 'joining', scheduled_for: joinAt ?? null })
}
