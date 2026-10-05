import { NextRequest, NextResponse } from 'next/server'
import { sanitizeEmailHtml } from '@/lib/text'
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

  // ── 3. Proposal — load with anon client (RLS pre-filters) ─
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, client_id, created_by, status, prospect_email')
    .eq('id', id)
    .single()

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found or access denied' }, { status: 403 })
  }

  // ── 4. Explicit authorization (service role will bypass RLS below) ──
  if (proposal.client_id !== profile.client_id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (profile.role === 'seller' && proposal.created_by !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (proposal.status === 'sent') {
    return NextResponse.json({ error: 'Already sent' }, { status: 400 })
  }

  if (proposal.status !== 'ready') {
    return NextResponse.json({ error: 'Proposal must be ready before sending' }, { status: 400 })
  }

  // ── 5. Config ─────────────────────────────────────────────
  const webhookUrl = process.env.WINFLOW_WEBHOOK_SEND
  const secret = process.env.WINFLOW_WEBHOOK_SECRET
  if (!webhookUrl || !secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // ── 6. Persist email edits before sending ─────────────────
  // Service role used here — authorization already verified above.
  let email_html: string | undefined
  try {
    const body = await req.json()
    if (typeof body.email_html === 'string') email_html = sanitizeEmailHtml(body.email_html)
  } catch {}

  const service = await createServiceClient()

  // Claim the send atomically so a double click cannot send two emails.
  const { data: claimed, error: claimError } = await service
    .from('proposals')
    .update({ status: 'sending', sending_started_at: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', profile.client_id)
    .eq('status', 'ready')
    .select('id')
    .maybeSingle()

  if (claimError || !claimed) {
    return NextResponse.json({ error: 'Proposal is already being sent or changed state' }, { status: 409 })
  }

  if (email_html !== undefined) {
    const { error: updateErr } = await service
      .from('proposals')
      .update({ email_html })
      .eq('id', id)
      .eq('client_id', profile.client_id)  // redundant but explicit

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to save edits' }, { status: 500 })
    }
  }

  // ── 7. Trigger N8N send ───────────────────────────────────
  const n8nRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Winflow-Secret': secret,
    },
    body: JSON.stringify({ proposal_id: id }),
  })

  if (!n8nRes.ok) {
    await service.from('proposals').update({ status: 'ready' }).eq('id', id).eq('client_id', profile.client_id)
    return NextResponse.json({ error: 'N8N send failed' }, { status: 502 })
  }

  // ── 8. Mark sent (service role) ───────────────────────────
  await service
    .from('proposals')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', profile.client_id)  // redundant but explicit

  return NextResponse.json({ ok: true })
}
