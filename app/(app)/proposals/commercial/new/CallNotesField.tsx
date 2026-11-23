'use client'

import { useEffect, useRef, useState } from 'react'
import { formatCallNotes, type CallSegment } from '@/lib/call-format'
import { Segmented } from '../../../ui'

type Participant = { key: string; name: string; is_host: boolean; words: number }
type Call = {
  id: string
  platform: 'zoom' | 'meet' | 'teams'
  status: 'scheduled' | 'starting' | 'joining' | 'waiting_room' | 'recording' | 'processing' | 'ready' | 'denied' | 'failed' | 'cancelled'
  status_detail: string | null
  scheduled_for?: string | null
  participants: Participant[]
  transcript: CallSegment[] | null
}
type ListItem = {
  id: string
  platform: Call['platform']
  status: Call['status']
  status_detail: string | null
  scheduled_for: string | null
  created_at: string
  duration_seconds: number | null
}
type Info = { enabled: boolean; remaining: number; limit: number; bot_name: string; calls?: ListItem[] }

const DONE = ['ready', 'failed', 'denied', 'cancelled']
const MIN_LEAD_MIN = 12

/** Valor para <input type="datetime-local"> en hora local. */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
}
function statusLabel(c: ListItem): string {
  switch (c.status) {
    case 'scheduled': return `Programada · ${fmtWhen(c.scheduled_for)}`
    case 'ready': return 'Transcripción lista'
    case 'failed': return 'No se pudo grabar'
    case 'denied': return 'Grabación no permitida'
    case 'processing': return 'Transcribiendo…'
    case 'recording': return 'Grabando ahora'
    default: return 'En curso…'
  }
}

const PLATFORM: Record<Call['platform'], string> = { zoom: 'Zoom', meet: 'Google Meet', teams: 'Microsoft Teams' }

const FAIL_TEXT: Record<string, string> = {
  empty_transcript: 'La reunión no tuvo audio para transcribir.',
  create_bot_failed: 'No se pudo enviar el bot a la reunión. Revisa el enlace e inténtalo de nuevo.',
  not_admitted: 'Nadie admitió al bot desde la sala de espera, así que no pudo entrar.',
  nobody_joined: 'El bot esperó, pero la reunión no empezó a tiempo.',
}

export default function CallNotesField({
  notes, onNotes, onCall,
}: {
  notes: string
  onNotes: (v: string) => void
  onCall: (id: string | null) => void
}) {
  const [mode, setMode] = useState<'paste' | 'bot'>('paste')
  const [info, setInfo] = useState<Info | null>(null)
  const [url, setUrl] = useState('')
  const [consent, setConsent] = useState(false)
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [at, setAt] = useState('')
  const [editAt, setEditAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [call, setCall] = useState<Call | null>(null)
  const [seller, setSeller] = useState<string>('')
  const [truncated, setTruncated] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadInfo = () => fetch('/api/calls').then(r => (r.ok ? r.json() : null)).then(j => j && setInfo(j)).catch(() => {})
  useEffect(() => { loadInfo() }, [])

  // Consulta el estado mientras el bot está en la reunión o procesando
  useEffect(() => {
    if (timer.current) clearInterval(timer.current)
    if (!call || DONE.includes(call.status)) return
    timer.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/calls/${call.id}`)
        if (!r.ok) return
        const { call: c } = await r.json()
        setCall(c)
      } catch {}
    }, call.status === 'scheduled' ? 30000 : 5000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [call])

  // Al quedar lista, propone como vendedor a quien organizó la reunión (el usuario lo puede cambiar)
  useEffect(() => {
    if (call?.status === 'ready' && !seller) {
      const host = call.participants.find(p => p.is_host)
      setSeller(host?.key ?? '')
    }
  }, [call, seller])

  // Hora elegida (local) → fecha válida o null
  const chosen = at ? new Date(at) : null
  const chosenOk = Boolean(chosen && !Number.isNaN(chosen.getTime()) && chosen.getTime() >= Date.now() + MIN_LEAD_MIN * 60_000)
  const minAt = toLocalInput(new Date(Date.now() + MIN_LEAD_MIN * 60_000))

  async function start() {
    setBusy(true)
    setError('')
    try {
      if (when === 'later' && !chosenOk) throw new Error(`Elige una hora con al menos ${MIN_LEAD_MIN} minutos de anticipación. Si la reunión es ya, usa «Que entre ahora».`)
      const r = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_url: url, consent_confirmed: consent, ...(when === 'later' && chosen ? { join_at: chosen.toISOString() } : {}) }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'No se pudo enviar el bot')
      setCall({ id: j.id, platform: j.platform, status: j.status ?? 'joining', status_detail: null, scheduled_for: j.scheduled_for ?? null, participants: [], transcript: null })
      loadInfo()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!call) return
    await fetch(`/api/calls/${call.id}`, { method: 'DELETE' }).catch(() => {})
    setCall(null)
    onCall(null)
    setSeller('')
    setEditAt(null)
    loadInfo()
  }

  function closeCall() {
    setCall(null)
    setSeller('')
    setEditAt(null)
    setError('')
    loadInfo()
  }

  // Elegir una llamada de «Tus llamadas»: carga su estado (y transcripción si ya está lista)
  async function openCall(id: string) {
    setError('')
    try {
      const r = await fetch(`/api/calls/${id}`)
      if (!r.ok) throw new Error()
      const { call: c } = await r.json()
      setSeller('')
      setCall(c)
    } catch {
      setError('No se pudo abrir esa llamada.')
    }
  }

  async function removeListed(id: string) {
    await fetch(`/api/calls/${id}`, { method: 'DELETE' }).catch(() => {})
    loadInfo()
  }

  async function reschedule() {
    if (!call || !editAt) return
    const d = new Date(editAt)
    if (Number.isNaN(d.getTime()) || d.getTime() < Date.now() + MIN_LEAD_MIN * 60_000) {
      setError(`Elige una hora con al menos ${MIN_LEAD_MIN} minutos de anticipación.`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const r = await fetch(`/api/calls/${call.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ join_at: d.toISOString() }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'No se pudo cambiar la hora')
      setCall({ ...call, scheduled_for: j.scheduled_for })
      setEditAt(null)
      loadInfo()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  function useTranscript() {
    if (!call?.transcript) return
    const { text, truncated: tr } = formatCallNotes(call.transcript, seller || null)
    setTruncated(tr)
    onNotes(text)
    onCall(call.id)
    setMode('paste')
  }

  const label = 'wf-label'
  const input = 'wf-input'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className={label}>Notas o transcripción</label>
        <Segmented value={mode} onChange={setMode} options={[['paste', 'Pegar o escribir'], ['bot', 'Desde una videollamada']]} />
      </div>

      {mode === 'paste' && (
        <>
          <textarea required rows={10} className={input} value={notes} onChange={e => onNotes(e.target.value)}
            placeholder="Pega aquí tus notas o la transcripción: qué problema tiene, qué necesita, quién decide, qué le preocupó, qué le interesó…" />
          <p className="text-xs text-gray-400">
            Mientras más detalle, más personalizada sale la propuesta. ¿Fue una llamada por teléfono? Escribe tus notas; es la mejor fuente en ese caso.
          </p>
          <p className="wf-alert wf-alert-warn text-xs">
            Si pegas la transcripción de Zoom, Meet o Teams, revisa que cada frase lleve el nombre de quien habló. Sin nombres, la IA puede confundir quién dijo qué (por ejemplo, atribuir al prospecto algo que dijiste tú).
          </p>
          {truncated && <p className="wf-alert wf-alert-warn text-xs">La reunión fue muy larga y se recortó al límite de {20000} caracteres. Revisa que lo importante siga en el texto.</p>}
        </>
      )}

      {mode === 'bot' && (
        <div className="space-y-3">
          {info && !info.enabled && !call && (
            <div className="wf-alert wf-alert-info">
              <p className="font-medium">La grabación automática de videollamadas está por llegar a tu plan.</p>
              <p className="mt-1 text-xs">Un bot de Winflow entra a tu reunión de Zoom, Meet o Teams, identifica quién habla y arma las notas por ti. Mientras tanto, pega la transcripción o tus notas.</p>
            </div>
          )}

          {info?.enabled && !call && (
            <>
              <div>
                <label className={label}>Enlace de la reunión</label>
                <input className={input} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" inputMode="url" />
                <p className="mt-1 text-xs text-gray-400">Funciona con Zoom, Google Meet y Microsoft Teams. No sirve para llamadas por teléfono.</p>
              </div>
              <div className="space-y-2">
                <label className={label}>¿Cuándo es la reunión?</label>
                <Segmented value={when} onChange={setWhen} options={[['now', 'Que entre ahora'], ['later', 'Programar para después']]} />
                {when === 'later' && (
                  <div>
                    <input type="datetime-local" className={input} value={at} min={minAt} onChange={e => setAt(e.target.value)} />
                    <p className="mt-1 text-xs text-gray-400">
                      El bot entra solo a esa hora (tu hora local). No tienes que acordarte de enviarlo. Puedes cambiar la hora o cancelar cuando quieras.
                    </p>
                  </div>
                )}
              </div>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)} />
                <span>Voy a avisar a todos los participantes que la reunión se graba y se transcribe, y ya tengo su consentimiento.</span>
              </label>
              <p className="text-xs text-gray-500">
                El bot entra como «{info.bot_name}». Quien organice la reunión tiene que admitirlo cuando aparezca en la sala de espera. Te quedan {info.remaining} de {info.limit} reuniones grabadas este mes.
              </p>
              {error && <p className="wf-alert wf-alert-error">{error}</p>}
              <button type="button" className="wf-btn" disabled={busy || !url.trim() || !consent || info.remaining <= 0 || (when === 'later' && !chosenOk)} onClick={start}>
                {busy ? 'Enviando…' : when === 'later' ? 'Programar el bot' : 'Enviar el bot a la reunión'}
              </button>

              {(info.calls?.length ?? 0) > 0 && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <p className={label}>Tus llamadas</p>
                  <ul className="space-y-2">
                    {info.calls!.map(c => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-gray-800">{PLATFORM[c.platform]}</p>
                          <p className="text-xs text-gray-500">{statusLabel(c)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button type="button" className="wf-btn-ghost wf-btn-sm" onClick={() => openCall(c.id)}>
                            {c.status === 'ready' ? 'Usar' : 'Ver'}
                          </button>
                          <button type="button" className="wf-link-danger text-xs" onClick={() => removeListed(c.id)}>
                            {c.status === 'scheduled' ? 'Cancelar' : 'Quitar'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {call?.status === 'scheduled' && (
            <div className="wf-alert wf-alert-info space-y-3">
              <div>
                <p className="font-medium">Programada para {fmtWhen(call.scheduled_for)} · {PLATFORM[call.platform]}</p>
                <p className="mt-1 text-xs">
                  El bot entrará solo a esa hora; no tienes que hacer nada. Quien organice la reunión debe admitirlo desde la sala de espera. Puedes cerrar esta página: cuando la reunión termine, vuelve aquí, abre «Desde una videollamada» y elige la llamada en «Tus llamadas».
                </p>
              </div>
              {editAt === null ? (
                <div className="flex flex-wrap items-center gap-4">
                  <button type="button" className="wf-btn-ghost wf-btn-sm" onClick={() => setEditAt(call.scheduled_for ? toLocalInput(new Date(call.scheduled_for)) : '')}>Cambiar la hora</button>
                  <button type="button" className="wf-btn-ghost wf-btn-sm" onClick={closeCall}>Volver</button>
                  <button type="button" className="wf-link-danger text-xs" onClick={cancel}>Cancelar la grabación</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input type="datetime-local" className={input} value={editAt} min={minAt} onChange={e => setEditAt(e.target.value)} />
                  {error && <p className="wf-alert wf-alert-error">{error}</p>}
                  <div className="flex gap-2">
                    <button type="button" className="wf-btn wf-btn-sm" disabled={busy || !editAt} onClick={reschedule}>{busy ? 'Guardando…' : 'Guardar hora'}</button>
                    <button type="button" className="wf-btn-ghost wf-btn-sm" onClick={() => { setEditAt(null); setError('') }}>Cancelar cambio</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {call && call.status !== 'scheduled' && !DONE.includes(call.status) && (
            <div className="wf-alert wf-alert-info space-y-2">
              <div className="flex items-center gap-3">
                <span className="wf-spinner" aria-hidden />
                <p className="font-medium">
                  {call.status === 'waiting_room' ? `El bot está esperando en la sala de ${PLATFORM[call.platform]}: admítelo para que empiece a grabar.`
                    : call.status === 'recording' ? 'Grabando la reunión. Puedes seguir con tu llamada; esto se actualiza solo.'
                    : call.status === 'processing' ? 'La reunión terminó. Transcribiendo (puede tardar unos minutos)…'
                    : `Entrando a ${PLATFORM[call.platform]}…`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button type="button" className="wf-btn-ghost wf-btn-sm" onClick={closeCall}>Volver</button>
                <button type="button" className="wf-link-danger text-xs" onClick={cancel}>Cancelar y sacar al bot</button>
              </div>
            </div>
          )}

          {call?.status === 'denied' && (
            <div className="wf-alert wf-alert-warn space-y-2">
              <p>Los anfitriones no permitieron la grabación. Pega tus notas o la transcripción manualmente.</p>
              <button type="button" className="wf-btn-ghost wf-btn-sm" onClick={cancel}>Intentar con otra reunión</button>
            </div>
          )}

          {call?.status === 'failed' && (
            <div className="wf-alert wf-alert-error space-y-2">
              <p>{FAIL_TEXT[call.status_detail ?? ''] ?? 'No se pudo completar la grabación.'} Puedes pegar tus notas manualmente.</p>
              <button type="button" className="wf-btn-ghost wf-btn-sm" onClick={cancel}>Intentar de nuevo</button>
            </div>
          )}

          {call?.status === 'ready' && call.transcript && (
            <div className="wf-alert wf-alert-ok space-y-3">
              <p className="font-medium">Transcripción lista · {call.transcript.length} intervenciones.</p>
              <div>
                <label className={label}>¿Cuál de estos participantes eres tú?</label>
                <select className={input} value={seller} onChange={e => setSeller(e.target.value)}>
                  <option value="">— No lo sé / dejar nombres tal cual —</option>
                  {call.participants.map(p => (
                    <option key={p.key} value={p.key}>{p.name}{p.is_host ? ' (organizador)' : ''} · {p.words} palabras</option>
                  ))}
                </select>
                <p className="mt-1 text-xs">Así la IA sabe quién es el vendedor y quién el prospecto. Podrás revisar y editar el texto antes de generar.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="wf-btn" onClick={useTranscript}>Usar en las notas</button>
                <button type="button" className="wf-btn-ghost" onClick={closeCall}>Volver</button>
                <button type="button" className="wf-link-danger text-xs" onClick={cancel}>Descartar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
