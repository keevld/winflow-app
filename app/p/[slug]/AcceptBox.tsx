'use client'

import { useState } from 'react'
import { scrollToId, useSelection } from './Selection'

// "Continuar" ≠ contrato firmado: el cliente confirma su elección y la agencia sigue con el contrato.
export default function AcceptBox({
  slug, agencyName, expired, acceptedBy, acceptedAt, acceptedLabel,
}: {
  slug: string
  agencyName: string
  expired: boolean
  acceptedBy: string | null
  acceptedAt: string | null
  acceptedLabel: string | null
}) {
  const { needsChoice, selected, current } = useSelection()
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(!!acceptedAt)
  const [who, setWho] = useState(acceptedBy)
  const [chosenLabel, setChosenLabel] = useState(acceptedLabel)
  const agency = agencyName || 'la agencia'

  async function go() {
    setError('')
    if (needsChoice && !selected) { setError('Elige un paquete para continuar.'); return }
    if (name.trim().length < 2) { setError('Escribe tu nombre para continuar.'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/public/proposals/${slug}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, option: selected ?? '', comment }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'No se pudo registrar tu elección')
      setWho(name.trim())
      setChosenLabel(current?.label ?? null)
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="pd-done" role="status">
        <h2>¡Listo, recibimos tu elección!</h2>
        <p>
          {who ? `Gracias, ${who}. ` : ''}
          {chosenLabel ? `Elegiste el paquete ${chosenLabel}. ` : ''}
          Siguiente paso: {agency} te enviará el contrato para firma. El proyecto arranca una vez que el contrato esté firmado.
        </p>
      </div>
    )
  }

  if (expired) {
    return (
      <div className="pd-expired">
        Esta propuesta ya venció. Escríbenos y te enviamos una versión actualizada.
      </div>
    )
  }

  const blocked = needsChoice && !selected

  return (
    <form className="pd-accept pd-noprint" onSubmit={e => { e.preventDefault(); go() }}>
      <h2>Continuar</h2>

      {needsChoice && (
        blocked ? (
          <div className="pd-gate">
            <p>Antes de continuar, elige el paquete que prefieres.</p>
            <button type="button" className="pd-btn" onClick={() => scrollToId('inversion')}>Ver los paquetes</button>
          </div>
        ) : (
          <div className="pd-chosen">
            <span className="pd-chosen-tick" aria-hidden="true">✓</span>
            <span className="pd-chosen-label">{current?.label}</span>
            <span className="pd-chosen-total">{current?.total}</span>
            <button type="button" className="pd-link" onClick={() => scrollToId('inversion')}>Cambiar</button>
          </div>
        )
      )}

      <input className="pd-field" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre completo" maxLength={120} autoComplete="name" disabled={blocked} />
      <textarea className="pd-field" value={comment} onChange={e => setComment(e.target.value)} placeholder="Comentarios (opcional)" rows={2} maxLength={1000} disabled={blocked} />
      {error && <p className="pd-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy || blocked} className="pd-btn pd-btn-primary">
        {busy ? 'Enviando…' : 'Continuar'}
      </button>

      <div className="pd-next">
        <p><strong>Esto todavía no es el contrato.</strong> Al continuar le avisamos a {agency} que quieres avanzar con {needsChoice ? 'este paquete' : 'la propuesta'}. Ellos te enviarán el contrato para firma, y el proyecto arranca una vez que esté firmado.</p>
      </div>
    </form>
  )
}
