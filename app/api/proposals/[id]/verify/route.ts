import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { verifyIntro } from '@/lib/claim-verifier'

export const maxDuration = 120

// Verificador de afirmaciones: se corre una vez por propuesta inicial, antes de poder enviarla.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const force = new URL(req.url).searchParams.get('force') === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('client_id, role').eq('id', user.id).single()
  if (!profile?.client_id) return NextResponse.json({ error: 'No agency assigned to this user' }, { status: 403 })

  const service = await createServiceClient()
  if (!(await rateLimit(service, `verify:${user.id}`, 40, 3600))) return tooMany()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, client_id, created_by, status, pdf_url, proposal_type, proposal_text, email_html, verification_status, market_sources, prospect_name, prospect_title, prospect_company, prospect_email, prospect_website, prospect_industry, prospect_company_size, prospect_pain, product')
    .eq('id', id)
    .single()
  if (!proposal) return NextResponse.json({ error: 'Proposal not found or access denied' }, { status: 403 })
  if (proposal.client_id !== profile.client_id) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  if (profile.role === 'seller' && proposal.created_by !== user.id) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  if (proposal.proposal_type !== 'intro') return NextResponse.json({ error: 'Solo aplica a propuestas iniciales' }, { status: 400 })
  if (proposal.status !== 'ready' || !proposal.pdf_url || !proposal.proposal_text) {
    return NextResponse.json({ error: 'La propuesta aún no está lista' }, { status: 400 })
  }

  // Reclama la verificación de forma atómica: dos pestañas no la corren dos veces.
  const base = service.from('proposals')
    .update({ verification_status: 'checking' })
    .eq('id', id).eq('client_id', profile.client_id).eq('status', 'ready')
  const claim = force
    ? base.in('verification_status', ['error', 'ok', 'fixed', 'review', 'checking'])
    : base.or('verification_status.is.null,verification_status.eq.error')
  const { data: claimed } = await claim.select('id').maybeSingle()
  if (!claimed) return NextResponse.json({ ok: true, skipped: true })

  try {
    const { text, emailHtml, report } = await verifyIntro(service, proposal as Record<string, unknown>)
    const changed = text !== proposal.proposal_text

    await service.from('proposals').update({
      verification: report,
      verification_status: report.status,
      ...(changed ? { proposal_text: text, ...(emailHtml !== null ? { email_html: emailHtml } : {}) } : {}),
    }).eq('id', id).eq('client_id', profile.client_id)

    return NextResponse.json({ ok: true, status: report.status, changes: report.changes.length, review: report.review.length })
  } catch {
    await service.from('proposals').update({
      verification_status: 'error',
      verification: { status: 'error', checked_at: new Date().toISOString(), changes: [], review: [] },
    }).eq('id', id).eq('client_id', profile.client_id)
    return NextResponse.json({ error: 'No se pudo verificar la propuesta' }, { status: 502 })
  }
}
