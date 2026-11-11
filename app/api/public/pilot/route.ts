import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit'

// Lista de espera del piloto (formulario público de la landing). La tabla pilot_requests tiene RLS
// activo y ninguna policy: solo esta ruta (service role) escribe.
const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/

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

  const { error } = await sb.from('pilot_requests').insert({
    agency_name,
    contact_name,
    email,
    website: clip(body.website, 300) || null,
    team_size: clip(body.team_size, 40) || null,
    call_tool: clip(body.call_tool, 80) || null,
    message: clip(body.message, 1000) || null,
    source: clip(body.source, 80) || null,
  })
  if (error) {
    console.error('pilot_requests insert failed', error.message)
    return NextResponse.json({ error: 'No pudimos guardar tu solicitud. Escríbenos a hola@winflowapp.com.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
