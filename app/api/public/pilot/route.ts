import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit'

// Lista de espera del piloto (formulario público de la landing). La tabla pilot_requests tiene RLS
// activo y ninguna policy: solo esta ruta (service role) escribe.
const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/
const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Aviso por correo a Kevin cuando llega una solicitud. Usa el mismo webhook de envío de n8n que las propuestas.
// Es «de mejor esfuerzo»: si falla, la solicitud ya quedó guardada y no se le muestra error a quien la envió.
async function notifyNewRequest(r: { agency_name: string; contact_name: string; email: string; website: string | null; team_size: string | null; call_tool: string | null; message: string | null }) {
  const webhookUrl = process.env.WINFLOW_WEBHOOK_SEND
  const secret = process.env.WINFLOW_WEBHOOK_SECRET
  if (!webhookUrl || !secret) return
  const to = process.env.PILOT_NOTIFY_EMAIL || 'kevin.ld@winflowapp.com'
  const row = (k: string, v: string | null) => (v ? `<tr><td style="padding:4px 12px 4px 0;color:#6a645c">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>` : '')
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#1b1a18">
    <p><strong>Nueva solicitud de piloto en Winflow</strong></p>
    <table>${row('Agencia', r.agency_name)}${row('Nombre', r.contact_name)}${row('Correo', r.email)}${row('Sitio web', r.website)}${row('Equipo', r.team_size)}${row('Registra llamadas con', r.call_tool)}${row('Mensaje', r.message)}</table>
    <p style="color:#6a645c;font-size:13px">Responde a este correo para escribirle directamente. Todas las solicitudes están en Supabase, tabla pilot_requests.</p></div>`
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Winflow-Secret': secret },
      body: JSON.stringify({
        to,
        subject: `Nueva solicitud de piloto: ${r.agency_name}`.slice(0, 150),
        html,
        from_name: 'Winflow',
        reply_to: r.email,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error('pilot notify failed', res.status)
  } catch (e) {
    console.error('pilot notify threw', e)
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  // Honeypot: los bots rellenan este campo; se responde "ok" sin guardar nada.
  if (clip(body.company_site, 200)) return NextResponse.json({ ok: true })

  const sb = await createServiceClient()
  if (!(await rateLimit(sb, `pilot:${clientIp(req)}`, 5, 3600))) return tooMany()

  const agency_name = clip(body.agency_name, 120)
  const contact_name = clip(body.contact_name, 120)
  const email = clip(body.email, 320).toLowerCase()
  if (!agency_name || !contact_name || !EMAIL.test(email)) {
    return NextResponse.json({ error: 'Revisa el nombre de la agencia, tu nombre y tu correo.' }, { status: 400 })
  }
  if (body.consent !== true) {
    return NextResponse.json({ error: 'Necesitamos que aceptes el aviso de privacidad.' }, { status: 400 })
  }

  const row = {
    agency_name,
    contact_name,
    email,
    website: clip(body.website, 300) || null,
    team_size: clip(body.team_size, 40) || null,
    call_tool: clip(body.call_tool, 80) || null,
    message: clip(body.message, 1000) || null,
    source: clip(body.source, 80) || null,
  }
  const { error } = await sb.from('pilot_requests').insert(row)
  if (error) {
    console.error('pilot_requests insert failed', error.message)
    return NextResponse.json({ error: 'No pudimos guardar tu solicitud. Escríbenos a hola@winflowapp.com.' }, { status: 500 })
  }
  await notifyNewRequest(row)
  return NextResponse.json({ ok: true })
}
