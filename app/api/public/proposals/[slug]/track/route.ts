import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit'

// Public endpoint — no auth. Called from the prospect-facing /p/[slug] page
// (which has no logged-in user) to record engagement signals: a 'view' when
// the page loads, and a 'time_spent' beacon when the prospect leaves/hides
// the tab. Access is scoped by knowledge of the unguessable public_slug,
// mirroring how /p/[slug] itself is protected (no auth, security by slug).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  // Contra relleno de vistas y eventos falsos: tope por IP y propuesta (se responde OK sin registrar).
  if (!(await rateLimit(await createServiceClient(), `track:${clientIp(req)}:${slug}`, 40, 3600))) {
    return NextResponse.json({ ok: true })
  }

  let body: { event_type?: string; duration_seconds?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = body.event_type
  if (eventType !== 'view' && eventType !== 'time_spent') {
    return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
  }

  // Sanity-bound duration so a malformed/malicious beacon can't skew data
  let durationSeconds: number | null = null
  if (eventType === 'time_spent') {
    const raw = body.duration_seconds
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
      return NextResponse.json({ error: 'Invalid duration_seconds' }, { status: 400 })
    }
    durationSeconds = Math.min(Math.round(raw), 3600) // cap at 1h/beacon
  }

  const service = await createServiceClient()

  const { data: proposal } = await service
    .from('proposals')
    .select('id, client_id, opened_at, view_count')
    .eq('public_slug', slug)
    .single()

  if (!proposal) {
    // Don't leak whether a slug exists — respond OK either way.
    return NextResponse.json({ ok: true })
  }

  // proposal_events pre-dates this feature (client_id direct + metadata jsonb,
  // actor_id for internal actors — left null here since the prospect isn't
  // an authenticated user).
  await service.from('proposal_events').insert({
    proposal_id: proposal.id,
    client_id: proposal.client_id,
    event_type: eventType,
    metadata: durationSeconds !== null ? { duration_seconds: durationSeconds } : {},
  })

  if (eventType === 'view') {
    await service.rpc('record_proposal_view', { p_proposal_id: proposal.id })
  } else {
    await service
      .from('proposals')
      .update({ last_viewed_at: new Date().toISOString() })
      .eq('id', proposal.id)
  }

  return NextResponse.json({ ok: true })
}
