import { NextRequest, NextResponse } from 'next/server'
import { getPlatformAdmin, attachUser } from '@/lib/platform-admin'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Crea una agencia nueva y su primer administrador (que entra con link mágico).
// Si viene de una solicitud de piloto (request_id), la marca como aceptada y la liga a la agencia.
export async function POST(req: NextRequest) {
  const admin = await getPlatformAdmin()
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const company = typeof body.company_name === 'string' ? body.company_name.trim().slice(0, 120) : ''
  const email = typeof body.admin_email === 'string' ? body.admin_email.trim().toLowerCase() : ''
  const fullName = typeof body.admin_name === 'string' ? body.admin_name.trim().slice(0, 120) : ''
  const website = typeof body.website === 'string' && /^https?:\/\//i.test(body.website.trim()) ? body.website.trim().slice(0, 300) : null
  const requestId = typeof body.request_id === 'string' && UUID.test(body.request_id) ? body.request_id : null
  if (!company) return NextResponse.json({ error: 'Falta el nombre de la agencia' }, { status: 400 })
  if (!EMAIL.test(email)) return NextResponse.json({ error: 'Correo del administrador inválido' }, { status: 400 })

  const { service } = admin
  const { data: client, error: cErr } = await service
    .from('clients')
    .insert({ company_name: company, contact_name: fullName || null, contact_email: email, website })
    .select('id')
    .single()
  if (cErr || !client) return NextResponse.json({ error: cErr?.message ?? 'No se pudo crear la agencia' }, { status: 500 })

  const res = await attachUser(service, client.id, email, fullName, 'admin')
  if ('error' in res) {
    await service.from('clients').delete().eq('id', client.id)
    return NextResponse.json({ error: res.error }, { status: res.status })
  }

  // Toda agencia nueva entra como piloto desde hoy.
  await service.from('agency_accounts').upsert(
    { client_id: client.id, stage: 'pilot', pilot_started_at: new Date().toISOString().slice(0, 10) },
    { onConflict: 'client_id' }
  )
  if (requestId) {
    await service.from('pilot_requests').update({ status: 'accepted', client_id: client.id }).eq('id', requestId)
  }
  return NextResponse.json({ ok: true, id: client.id })
}
