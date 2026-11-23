import crypto from 'crypto'

// Cliente mínimo de Recall.ai (bot de reuniones). Documentación revisada el 18-nov-2026:
// - Crear bot: POST {base}/api/v1/bot/  (meeting_url, bot_name, metadata, join_at opcional)
// - Programados (join_at > 10 min): DELETE {base}/api/v1/bot/{id}/ cancela; PATCH {base}/api/v1/bot/{id}/ reprograma
// - Al terminar la grabación llega `recording.done`; entonces se pide la transcripción:
//   POST {base}/api/v1/recording/{id}/create_transcript/
// - Al terminar llega `transcript.done`; GET {base}/api/v1/transcript/{id}/ trae data.download_url
// - Los webhooks vienen firmados (webhook-id / webhook-timestamp / webhook-signature, secreto whsec_…).

export type Platform = 'zoom' | 'meet' | 'teams'

const REGIONS = ['us-west-2', 'us-east-1', 'eu-central-1', 'ap-northeast-1']

export function recallConfigured(): boolean {
  return Boolean(process.env.RECALL_API_KEY)
}

function baseUrl(): string {
  const region = process.env.RECALL_REGION ?? 'us-west-2'
  if (!REGIONS.includes(region)) throw new Error('RECALL_REGION inválida')
  return `https://${region}.recall.ai`
}

async function recall(path: string, init: RequestInit = {}): Promise<Response> {
  const key = process.env.RECALL_API_KEY
  if (!key) throw new Error('RECALL_API_KEY no configurada')
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(12000),
  })
}

/** Reconoce el enlace de una videollamada de Zoom, Google Meet o Microsoft Teams. */
export function detectPlatform(raw: string): { platform: Platform; url: string } | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  const h = u.hostname.toLowerCase()
  const is = (d: string) => h === d || h.endsWith('.' + d)
  if (is('zoom.us') || is('zoom.com')) return { platform: 'zoom', url: u.toString() }
  if (h === 'meet.google.com') return { platform: 'meet', url: u.toString() }
  if (h === 'teams.microsoft.com' || h === 'teams.live.com' || h === 'teams.microsoft.us') return { platform: 'teams', url: u.toString() }
  return null
}

/** Un bot programado debe quedar a más de 10 min (regla de Recall); damos margen. */
export const MIN_SCHEDULE_MINUTES = 11
export const MAX_SCHEDULE_DAYS = 60

/** Valida una hora de entrada programada. Devuelve el ISO en UTC o un mensaje de error. */
export function parseJoinAt(raw: unknown): { iso: string } | { error: string } {
  if (typeof raw !== 'string') return { error: 'Hora inválida.' }
  const t = new Date(raw)
  if (Number.isNaN(t.getTime())) return { error: 'Hora inválida.' }
  const diff = t.getTime() - Date.now()
  if (diff < MIN_SCHEDULE_MINUTES * 60_000) {
    return { error: `Elige una hora con al menos ${MIN_SCHEDULE_MINUTES + 1} minutos de anticipación. Si la reunión es ya, usa «Que entre ahora».` }
  }
  if (diff > MAX_SCHEDULE_DAYS * 86_400_000) return { error: `Solo puedes programar hasta ${MAX_SCHEDULE_DAYS} días hacia adelante.` }
  return { iso: t.toISOString() }
}

/**
 * Crea el bot. Con `joinAt` queda programado y entra solo a esa hora; sin él, entra de inmediato.
 * En llamadas programadas el bot espera hasta 30 min por si la reunión empieza tarde.
 */
export async function createBot(opts: { meetingUrl: string; botName: string; callId: string; joinAt?: string }): Promise<{ id: string }> {
  const base: Record<string, unknown> = {
    meeting_url: opts.meetingUrl,
    bot_name: opts.botName.slice(0, 100),
    metadata: { call_id: opts.callId },
  }
  if (opts.joinAt) base.join_at = opts.joinAt
  const withWait = opts.joinAt ? { ...base, automatic_leave: { waiting_room_timeout: 1800, noone_joined_timeout: 1800 } } : base

  let res = await recall('/api/v1/bot/', { method: 'POST', body: JSON.stringify(withWait) })
  // Si Recall no acepta la espera extendida, reintentamos con la configuración por defecto.
  if (res.status === 400 && withWait !== base) {
    res = await recall('/api/v1/bot/', { method: 'POST', body: JSON.stringify(base) })
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok || typeof json?.id !== 'string') {
    console.error('recall createBot failed', res.status, JSON.stringify(json).slice(0, 300))
    throw new Error('No se pudo enviar el bot a la reunión')
  }
  return { id: json.id }
}

/** Cancela un bot programado que aún no se ha despachado. Devuelve false si Recall no lo permitió. */
export async function cancelScheduledBot(botId: string): Promise<boolean> {
  try {
    const res = await recall(`/api/v1/bot/${encodeURIComponent(botId)}/`, { method: 'DELETE' })
    if (!res.ok) console.error('recall cancelScheduledBot failed', res.status)
    return res.ok
  } catch (e) {
    console.error('recall cancelScheduledBot failed', e)
    return false
  }
}

/** Cambia la hora de entrada de un bot programado. Falla si ya está a punto de entrar (≤10 min). */
export async function rescheduleBot(botId: string, joinAt: string): Promise<boolean> {
  try {
    const res = await recall(`/api/v1/bot/${encodeURIComponent(botId)}/`, { method: 'PATCH', body: JSON.stringify({ join_at: joinAt }) })
    if (!res.ok) console.error('recall rescheduleBot failed', res.status, (await res.text().catch(() => '')).slice(0, 200))
    return res.ok
  } catch (e) {
    console.error('recall rescheduleBot failed', e)
    return false
  }
}

/** Pide al bot que salga de la reunión (best-effort). */
export async function leaveCall(botId: string): Promise<void> {
  try {
    await recall(`/api/v1/bot/${encodeURIComponent(botId)}/leave_call/`, { method: 'POST', body: '{}' })
  } catch (e) {
    console.error('recall leaveCall failed', e)
  }
}

export async function createTranscript(recordingId: string): Promise<{ id: string }> {
  const res = await recall(`/api/v1/recording/${encodeURIComponent(recordingId)}/create_transcript/`, {
    method: 'POST',
    body: JSON.stringify({
      provider: { recallai_async: { language_code: process.env.RECALL_LANGUAGE ?? 'auto' } },
      diarization: { use_separate_streams_when_available: true },
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || typeof json?.id !== 'string') {
    console.error('recall createTranscript failed', res.status, JSON.stringify(json).slice(0, 300))
    throw new Error('No se pudo pedir la transcripción')
  }
  return { id: json.id }
}

type Word = { text?: string; start_timestamp?: { relative?: number }; end_timestamp?: { relative?: number } }
type Utterance = {
  participant?: { id?: number | string; name?: string | null; is_host?: boolean | null }
  words?: Word[]
}

export async function fetchTranscript(transcriptId: string): Promise<Utterance[]> {
  const meta = await recall(`/api/v1/transcript/${encodeURIComponent(transcriptId)}/`)
  const mj = await meta.json().catch(() => ({}))
  const url = mj?.data?.download_url
  if (!meta.ok || typeof url !== 'string') throw new Error('Transcripción no disponible')
  const file = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!file.ok) throw new Error('No se pudo descargar la transcripción')
  const data = await file.json()
  return Array.isArray(data) ? (data as Utterance[]) : []
}

export type Segment = { key: string; name: string; text: string; start: number }
export type Participant = { key: string; name: string; is_host: boolean; words: number }

/** Junta frases seguidas de la misma persona y resume quién habló cuánto. */
export function buildTranscript(utterances: Utterance[]): { segments: Segment[]; participants: Participant[]; duration: number } {
  const segments: Segment[] = []
  let duration = 0
  const people = new Map<string, Participant>()
  for (const u of utterances) {
    const words = (u.words ?? []).map(w => w.text ?? '').filter(Boolean)
    if (words.length === 0) continue
    const key = String(u.participant?.id ?? 'desconocido')
    const name = (u.participant?.name ?? '').trim() || 'Participante'
    const p = people.get(key) ?? { key, name, is_host: Boolean(u.participant?.is_host), words: 0 }
    p.words += words.length
    people.set(key, p)
    const text = words.join(' ')
    const start = Math.round(u.words?.[0]?.start_timestamp?.relative ?? 0)
    const lastWord = u.words?.[u.words.length - 1]
    duration = Math.max(duration, Math.round(lastWord?.end_timestamp?.relative ?? lastWord?.start_timestamp?.relative ?? 0))
    const last = segments[segments.length - 1]
    if (last && last.key === key) last.text += ' ' + text
    else segments.push({ key, name, text, start })
  }
  return { segments, participants: [...people.values()].sort((a, b) => b.words - a.words), duration }
}

/** Verifica la firma de un webhook de Recall (HMAC-SHA256, estilo Svix). Lanza si no es válida. */
export function verifyRecallRequest(headers: Headers, rawBody: string): void {
  const secret = process.env.RECALL_WEBHOOK_SECRET
  if (!secret || !secret.startsWith('whsec_')) throw new Error('RECALL_WEBHOOK_SECRET no configurado')
  const id = headers.get('webhook-id') ?? headers.get('svix-id')
  const ts = headers.get('webhook-timestamp') ?? headers.get('svix-timestamp')
  const sigHeader = headers.get('webhook-signature') ?? headers.get('svix-signature')
  if (!id || !ts || !sigHeader) throw new Error('Faltan cabeceras de firma')
  // Tolerancia de 5 min contra reenvíos de peticiones capturadas
  const age = Math.abs(Date.now() / 1000 - Number(ts))
  if (!Number.isFinite(age) || age > 300) throw new Error('Marca de tiempo fuera de rango')
  const key = Buffer.from(secret.slice('whsec_'.length), 'base64')
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest()
  const ok = sigHeader.split(' ').some(entry => {
    const [version, sig] = entry.split(',')
    if (version !== 'v1' || !sig) return false
    const given = Buffer.from(sig, 'base64')
    return given.length === expected.length && crypto.timingSafeEqual(given, expected)
  })
  if (!ok) throw new Error('Firma inválida')
}
