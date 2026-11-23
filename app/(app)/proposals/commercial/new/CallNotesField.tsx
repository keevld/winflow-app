'use client'

import { useEffect, useRef, useState } from 'react'
import { formatCallNotes, type CallSegment } from '@/lib/call-format'
import { Segmented } from '../../../ui'

type Participant = { key: string; name: string; is_host: boolean; words: number }
type Call = {
  id: string
  platform: 'zoom' | 'meet' | 'teams'
  status: 'starting' | 'joining' | 'waiting_room' | 'recording' | 'processing' | 'ready' | 'denied' | 'failed' | 'cancelled'
  status_detail: string | null
  participants: Participant[]
  transcript: CallSegment[] | null
}
type Info = { enabled: boolean; remaining: number; limit: number; bot_name: string }

const PLATFORM: Record<Call['platform'], string> = { zoom: 'Zoom', meet: 'Google Meet', teams: 'Microsoft Teams' }

const FAIL_TEXT: Record<string, string> = {
  empty_transcript: 'La reunión no tuvo audio para transcribir.',
  create_bot_failed: 'No se pudo enviar el bot a la reunión. Revisa el enlace e inténtalo de nuevo.',
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [call, setCall] = useState<Call | null>(null)
  const [seller, setSeller] = useState<string>('')
  const [truncated, setTruncated] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/calls').then(r => (r.ok ? r.json() : null)).then(j => j && setInfo(j)).catch(() => {})
  }, [])

  // Consulta el estado mientras el bot está en la reunión o procesando
  useEffect(() => {
    if (timer.current) clearInterval(timer.current)
    if (!call || ['ready', 'failed', 'denied', 'cancelled'].includes(call.status)) return
    timer.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/calls/${call.id}`)
        if (!r.ok) return
        const { call: c } = await r.json()
        setCall(c)
      } catch {}
    }, 5000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [call])

  // Al quedar lista, propone como vendedor a quien organizó la reunión (el usuario lo puede cambiar)
  useEffect(() => {
    if (call?.status === 'ready' && !seller) {
      const host = call.participants.find(p => p.is_host)
      setSeller(host?.key ?? '')
    }
  }, [call, seller])

  async function start() {
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_url: url, consent_confirmed: consent }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'No se pudo enviar el bot')
      setCall({ id: j.id, platform: j.platform, status: 'joining', status_detail: null, participants: [], transcript: null })
      onCall(j.id)
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
  }

  function useTranscript() {
    if (!call?.transcript) return
    const { text, truncated: tr } = formatCallNotes(call.transcript, seller || null)
    setTruncated(tr)
    onNotes(text)
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
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)} />
                <span>Voy a avisar a todos los participantes que la reunión se graba y se transcribe, y ya tengo su consentimiento.</span>
              </label>
              <p className="text-xs text-gray-500">
                El bot entra como «{info.bot_name}» y tendrás que admitirlo desde la sala de espera. Te quedan {info.remaining} de {info.limit} reuniones grabadas este mes.
              </p>
              {error && <p className="wf-alert wf-alert-error">{error}</p>}
              <button type="button" className="wf-btn" disabled={busy || !url.trim() || !consent || info.remaining <= 0} onClick={start}>
                {busy ? 'Enviando…' : 'Enviar el bot a la reunión'}
              </button>
            </>
          )}

          {call && !['ready', 'failed', 'denied', 'cancelled'].includes(call.status) && (
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
              <button type="button" className="wf-link-danger text-xs" onClick={cancel}>Cancelar y sacar al bot</button>
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
                <button type="button" className="wf-btn-ghost" onClick={cancel}>Descartar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
