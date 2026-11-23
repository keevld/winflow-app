/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse, after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildTranscript, createTranscript, fetchTranscript, verifyRecallRequest } from '@/lib/recall'

export const maxDuration = 60

type Payload = { event?: string; data?: Record<string, any> }

const STATUS_BY_EVENT: Record<string, string> = {
  'bot.joining_call': 'joining',
  'bot.in_waiting_room': 'waiting_room',
  'bot.in_call_recording': 'recording',
  'bot.recording_permission_denied': 'denied',
  'bot.call_ended': 'processing',
}
const FINAL = ['ready', 'cancelled', 'failed', 'denied']

// Avisos de Recall.ai (público, pero cada petición se verifica con la firma del webhook).
export async function POST(req: NextRequest) {
  const raw = await req.text()
  try {
    verifyRecallRequest(req.headers, raw)
  } catch (e) {
    console.error('recall webhook rejected:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }
  let payload: Payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  // Responder rápido (Recall espera 15 s); el trabajo pesado sigue en segundo plano.
  after(() => handle(payload).catch(e => console.error('recall webhook handler failed', e)))
  return NextResponse.json({ ok: true })
}

type Row = { id: string; status: string; recall_transcript_id: string | null; recall_recording_id: string | null }

async function findCall(service: Awaited<ReturnType<typeof createServiceClient>>, d: Record<string, any>): Promise<Row | null> {
  const cols = 'id, status, recall_transcript_id, recall_recording_id'
  const callId = d.bot?.metadata?.call_id ?? d.metadata?.call_id
  if (typeof callId === 'string' && /^[0-9a-f-]{36}$/i.test(callId)) {
    const { data } = await service.from('call_recordings').select(cols).eq('id', callId).maybeSingle()
    if (data) return data as Row
  }
  const tries: [string, unknown][] = [
    ['recall_bot_id', d.bot?.id ?? d.bot_id],
    ['recall_transcript_id', d.transcript?.id],
    ['recall_recording_id', d.recording?.id],
  ]
  for (const [col, val] of tries) {
    if (typeof val !== 'string' || !val) continue
    const { data } = await service.from('call_recordings').select(cols).eq(col, val).maybeSingle()
    if (data) return data as Row
  }
  return null
}

async function handle(p: Payload) {
  const event = p.event ?? ''
  const d = p.data ?? {}
  const service = await createServiceClient()
  const row = await findCall(service, d)
  if (!row) return
  const now = () => new Date().toISOString()
  const subCode: string | null = d.sub_code ?? d.data?.sub_code ?? d.status?.sub_code ?? null

  if (event === 'bot.fatal' || event === 'transcript.failed') {
    if (row.status !== 'ready') {
      await service.from('call_recordings').update({ status: 'failed', status_detail: subCode ?? event, updated_at: now() }).eq('id', row.id)
    }
    return
  }

  if (STATUS_BY_EVENT[event]) {
    if (FINAL.includes(row.status)) return
    await service.from('call_recordings')
      .update({ status: STATUS_BY_EVENT[event], status_detail: event === 'bot.call_ended' ? subCode : null, updated_at: now() })
      .eq('id', row.id)
    return
  }

  if (event === 'recording.done') {
    if (row.recall_transcript_id || FINAL.includes(row.status)) return
    const recordingId = d.recording?.id
    if (typeof recordingId !== 'string') return
    try {
      const t = await createTranscript(recordingId)
      await service.from('call_recordings')
        .update({ recall_recording_id: recordingId, recall_transcript_id: t.id, status: 'processing', updated_at: now() })
        .eq('id', row.id)
    } catch {
      await service.from('call_recordings').update({ status: 'failed', status_detail: 'create_transcript_failed', updated_at: now() }).eq('id', row.id)
    }
    return
  }

  if (event === 'transcript.done') {
    const tid = row.recall_transcript_id ?? (typeof d.transcript?.id === 'string' ? d.transcript.id : null)
    if (row.status === 'ready' || !tid) return
    try {
      const { segments, participants } = buildTranscript(await fetchTranscript(tid))
      if (segments.length === 0) {
        await service.from('call_recordings').update({ status: 'failed', status_detail: 'empty_transcript', updated_at: now() }).eq('id', row.id)
        return
      }
      await service.from('call_recordings').update({
        status: 'ready',
        status_detail: null,
        participants,
        transcript: segments,
        duration_seconds: segments[segments.length - 1].start,
        updated_at: now(),
      }).eq('id', row.id)
    } catch (e) {
      console.error('transcript fetch failed', e)
      await service.from('call_recordings').update({ status: 'failed', status_detail: 'fetch_transcript_failed', updated_at: now() }).eq('id', row.id)
    }
  }
}
