import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext, isAdminContext } from '@/lib/api-auth'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { draftFollowup, loadAgencyPublic, FOLLOWUP_PROPOSAL_COLS } from '@/lib/followups'
import { appOrigin } from '@/lib/app-url'

export const maxDuration = 60

// Vista previa de un seguimiento (cómo quedaría el paso 1, 2 o 3 de una propuesta). No envía ni guarda nada.
export async function POST(req: NextRequest) {
  const ctx = await requireAdminContext()
  if (!isAdminContext(ctx)) return ctx.error
  const { clientId, service } = ctx

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const id = typeof body.proposal_id === 'string' ? body.proposal_id : ''
  const attempt = [1, 2, 3].includes(Number(body.attempt)) ? Number(body.attempt) : 1
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'proposal_id inválido' }, { status: 400 })

  if (!(await rateLimit(service, `fup:${clientId}`, 20, 3600))) return tooMany()

  const { data: p } = await service.from('proposals').select(FOLLOWUP_PROPOSAL_COLS).eq('id', id).eq('client_id', clientId).maybeSingle()
  if (!p) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  if (!p.public_slug) return NextResponse.json({ error: 'La propuesta no tiene enlace público' }, { status: 400 })

  try {
    const ag = await loadAgencyPublic(service, clientId)
    const rhythm = p.followup_rhythm === 'fast' || p.followup_rhythm === 'slow' ? p.followup_rhythm : 'normal'
    const d = await draftFollowup(service, ag, p as never, attempt, appOrigin(req.nextUrl.origin), rhythm)
    return NextResponse.json({ data: { subject: d.subject, body: d.body, reply_to: d.replyTo, html: d.html } })
  } catch (e) {
    console.error('followup preview failed', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'No se pudo generar la vista previa' }, { status: 502 })
  }
}
