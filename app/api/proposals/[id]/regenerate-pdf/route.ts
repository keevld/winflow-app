import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // ── 1. Auth ───────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 2. Profile ────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    return NextResponse.json({ error: 'No agency assigned to this user' }, { status: 403 })
  }

  // ── 3. Optional edited text in body ────────────────────────
  let bodyProposalText: string | undefined
  try {
    const body = await req.json()
    if (typeof body.proposal_text === 'string' && body.proposal_text.trim()) {
      bodyProposalText = body.proposal_text
    }
  } catch {}

  // ── 4. Proposal — load with anon client (RLS pre-filters) ─
  //      Includes prospect_* fields so N8N can rebuild the branded
  //      cover page (Build KB Prompt / Generate PDF HTML) exactly as
  //      it did on first generation.
  const { data: proposal } = await supabase
    .from('proposals')
    .select(`
      id, client_id, created_by, status, pdf_url, proposal_text,
      prospect_name, prospect_email, prospect_company, prospect_industry,
      prospect_website, prospect_pain, product
    `)
    .eq('id', id)
    .single()

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found or access denied' }, { status: 403 })
  }

  // ── 5. Explicit authorization ─────────────────────────────
  if (proposal.client_id !== profile.client_id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (profile.role === 'seller' && proposal.created_by !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (proposal.status !== 'ready') {
    return NextResponse.json({ error: 'La propuesta debe estar lista antes de regenerar el PDF' }, { status: 400 })
  }

  const previousPdfUrl = proposal.pdf_url

  // ── 6. Config ─────────────────────────────────────────────
  const webhookUrl = process.env.WINFLOW_WEBHOOK_REGENERATE
  const secret = process.env.WINFLOW_WEBHOOK_SECRET
  if (!webhookUrl || !secret) {
    return NextResponse.json({ error: 'Regeneración de PDF no configurada todavía' }, { status: 500 })
  }

  // ── 7. Claim atomically — clear pdf_url so the existing ───
  //      "generating" UI (status==='generating' && !pdf_url) takes over
  //      while N8N rebuilds the file at the same storage path.
  const service = await createServiceClient()
  const { data: claimed, error: claimError } = await service
    .from('proposals')
    .update({
      status: 'generating',
      pdf_url: null,
      generation_started_at: new Date().toISOString(),
      ...(bodyProposalText ? { proposal_text: bodyProposalText } : {}),
    })
    .eq('id', id)
    .eq('client_id', profile.client_id)
    .eq('status', 'ready')
    .select('id')
    .maybeSingle()

  if (claimError || !claimed) {
    return NextResponse.json({ error: 'La propuesta ya está siendo procesada o cambió de estado' }, { status: 409 })
  }

  // ── 8. Fire webhook (fire-and-forget; N8N writes back via service role) ──
  //      Field names match what the "Edit Fields" node in the N8N workflow
  //      expects (prospect_* with fallback to bare names), plus
  //      manual_proposal_text which "Code in JavaScript" / "Generate PDF HTML"
  //      now prefer over Claude's original output when present.
  try {
    const n8nRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Winflow-Secret': secret,
      },
      body: JSON.stringify({
        proposal_id: id,
        client_id: profile.client_id,
        auto_send: false,
        manual_proposal_text: bodyProposalText ?? proposal.proposal_text ?? '',
        prospect_name: proposal.prospect_name,
        prospect_email: proposal.prospect_email,
        prospect_company: proposal.prospect_company,
        prospect_industry: proposal.prospect_industry,
        prospect_website: proposal.prospect_website,
        prospect_pain: proposal.prospect_pain,
        product: proposal.product,
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!n8nRes.ok) {
      await service.from('proposals')
        .update({ status: 'ready', pdf_url: previousPdfUrl, failure_reason: 'N8N rejected regeneration' })
        .eq('id', id).eq('client_id', profile.client_id)
      return NextResponse.json({ error: 'N8N rejected regeneration' }, { status: 502 })
    }
  } catch {
    await service.from('proposals')
      .update({ status: 'ready', pdf_url: previousPdfUrl, failure_reason: 'Could not reach N8N' })
      .eq('id', id).eq('client_id', profile.client_id)
    return NextResponse.json({ error: 'No se pudo iniciar la regeneración' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
