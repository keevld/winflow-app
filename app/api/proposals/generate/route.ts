import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 2. Profile — derive client_id from session, never trust body ──
  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    return NextResponse.json({ error: 'No agency assigned to this user' }, { status: 403 })
  }

  // ── 3. Body ───────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { proposal_id, ...prospectData } = body

  if (!proposal_id || typeof proposal_id !== 'string') {
    return NextResponse.json({ error: 'Missing proposal_id' }, { status: 400 })
  }

  // ── 4. Verify proposal ownership ─────────────────────────
  // Uses the anon client — RLS already restricts to what this user can see,
  // but we add explicit checks as an extra layer since we're about to touch N8N.
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, client_id, created_by, status, generation_attempts')
    .eq('id', proposal_id)
    .single()

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found or access denied' }, { status: 403 })
  }

  // Belt-and-suspenders: proposal must belong to user's agency
  if (proposal.client_id !== profile.client_id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Seller can only trigger generation for their own proposals
  if (profile.role === 'seller' && proposal.created_by !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Only re-trigger if draft or failed
  if (proposal.status !== 'draft' && proposal.status !== 'failed') {
    return NextResponse.json({ error: 'Proposal is not in a retriable state' }, { status: 400 })
  }

  // Claim generation before contacting N8N. This is an atomic state transition
  // performed only after all user/profile/ownership checks above.
  const service = await createServiceClient()
  const { data: claimed, error: claimError } = await service
    .from('proposals')
    .update({
      status: 'generating',
      failure_reason: null,
      generation_started_at: new Date().toISOString(),
      generation_attempts: (proposal as { generation_attempts?: number }).generation_attempts
        ? (proposal as { generation_attempts: number }).generation_attempts + 1
        : 1,
    })
    .eq('id', proposal_id)
    .eq('client_id', profile.client_id)
    .in('status', ['draft', 'failed'])
    .select('id')
    .maybeSingle()

  if (claimError || !claimed) {
    return NextResponse.json({ error: 'Proposal is already generating or changed state' }, { status: 409 })
  }

  // ── 5. Config ─────────────────────────────────────────────
  const webhookUrl = process.env.WINFLOW_WEBHOOK_GENERATE
  const secret = process.env.WINFLOW_WEBHOOK_SECRET
  if (!webhookUrl || !secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // ── 6. Fire webhook (fire-and-forget; N8N writes back via service role) ──
  // Use verified client_id from profile, not from the body
  try {
    const n8nRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Winflow-Secret': secret,
      },
      body: JSON.stringify({
        proposal_id,
        client_id: profile.client_id,
        auto_send: false,
        ...prospectData,
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!n8nRes.ok) {
      await service.from('proposals')
        .update({ status: 'failed', failure_reason: `N8N rejected generation (HTTP ${n8nRes.status})` })
        .eq('id', proposal_id).eq('client_id', profile.client_id)
      return NextResponse.json({ error: 'N8N rejected generation' }, { status: 502 })
    }
  } catch (err) {
    // n8n responde al terminar (~40 s). Si solo venció nuestra espera, la generación sigue
    // en marcha y n8n actualizará la propuesta: no es un fallo.
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return NextResponse.json({ ok: true, pending: true }, { status: 202 })
    }
    await service.from('proposals')
      .update({ status: 'failed', failure_reason: 'Could not reach N8N' })
      .eq('id', proposal_id).eq('client_id', profile.client_id)
    return NextResponse.json({ error: 'Could not start generation' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
