'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = { attempt: number; status: 'sending' | 'sent' | 'failed' | 'skipped'; subject: string | null; sent_at: string | null; created_at: string }

const LABEL: Record<Row['status'], string> = {
  sending: 'Enviando',
  sent: 'Enviado',
  failed: 'No se pudo enviar',
  skipped: 'Omitido',
}

// Historial de seguimientos automáticos de esta propuesta y botón para pausarlos.
export default function FollowupsCard({
  proposalId,
  initialPaused,
  initialRhythm,
  initialRhythmReason,
  stopped,
}: {
  proposalId: string
  initialPaused: boolean
  initialRhythm: 'fast' | 'normal' | 'slow' | null
  initialRhythmReason: string | null
  stopped: string | null // por qué ya no se envían (ganada, perdida, aceptada), o null
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [paused, setPaused] = useState(initialPaused)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rhythm, setRhythm] = useState<string>(initialRhythm ?? 'auto')
  const [rhythmReason, setRhythmReason] = useState(initialRhythmReason)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('proposal_followups')
      .select('attempt, status, subject, sent_at, created_at')
      .eq('proposal_id', proposalId)
      .order('attempt', { ascending: true })
      .then(({ data }) => setRows((data as Row[]) ?? []))
  }, [proposalId])

  async function togglePause() {
    setBusy(true); setError('')
    const next = !paused
    const supabase = createClient()
    const { error: err } = await supabase.from('proposals').update({ followups_paused: next }).eq('id', proposalId)
    if (err) setError('No se pudo cambiar. Inténtalo de nuevo.')
    else setPaused(next)
    setBusy(false)
  }

  async function changeRhythm(value: string) {
    setError('')
    const supabase = createClient()
    const manual = value !== 'auto'
    const { error: err } = await supabase
      .from('proposals')
      .update({ followup_rhythm: manual ? value : null, followup_rhythm_reason: manual ? 'Elegido por ti' : null })
      .eq('id', proposalId)
    if (err) { setError('No se pudo cambiar el ritmo.'); return }
    setRhythm(value)
    setRhythmReason(manual ? 'Elegido por ti' : null)
  }

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Seguimientos automáticos</h2>
        {!stopped && (
          <button
            onClick={togglePause}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {paused ? 'Reanudar seguimientos' : 'Pausar seguimientos'}
          </button>
        )}
      </div>
      {stopped && <p className="text-xs text-gray-500">Ya no se envían seguimientos: {stopped}.</p>}
      {!stopped && paused && <p className="text-xs text-amber-700">En pausa: no se enviarán más seguimientos de esta propuesta hasta que los reanudes.</p>}
      {!stopped && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <label htmlFor="rhythm">Ritmo de seguimiento</label>
          <select
            id="rhythm"
            value={rhythm}
            onChange={e => changeRhythm(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
          >
            <option value="auto">Automático (según sector y notas)</option>
            <option value="fast">Rápido: se acortan los días</option>
            <option value="normal">Normal: días de tu configuración</option>
            <option value="slow">Lento: se estiran los días (decisión larga)</option>
          </select>
          {rhythmReason && <span className="text-gray-400">· {rhythmReason}</span>}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">Aún no se ha enviado ningún seguimiento. Si tu agencia los activó, salen solos en los días que configuraste.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(r => (
            <li key={r.attempt} className="text-sm text-gray-700 flex gap-2">
              <span className="text-gray-400 w-24 shrink-0">Seguimiento {r.attempt}</span>
              <span>
                {LABEL[r.status]} {fmt(r.sent_at ?? r.created_at)}
                {r.subject ? <span className="text-gray-500"> · «{r.subject}»</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
