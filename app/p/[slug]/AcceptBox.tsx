'use client'

import { useState } from 'react'

interface Opt { key: string; label: string; total: string }

export default function AcceptBox({
  slug, options, needsChoice, expired, acceptedBy, acceptedAt,
}: {
  slug: string
  options: Opt[]
  needsChoice: boolean
  expired: boolean
  acceptedBy: string | null
  acceptedAt: string | null
}) {
  const [name, setName] = useState('')
  const [option, setOption] = useState(needsChoice ? '' : (options[0]?.key ?? ''))
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(!!acceptedAt)
  const [who, setWho] = useState(acceptedBy)

  async function accept() {
    setError('')
    if (name.trim().length < 2) { setError('Escribe tu nombre para aceptar.'); return }
    if (needsChoice && !option) { setError('Elige una de las opciones.'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/public/proposals/${slug}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, option, comment }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'No se pudo aceptar')
      setWho(name.trim())
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
        <h2>¡Propuesta aceptada!</h2>
        <p>{who ? `Gracias, ${who}. ` : ''}Nos pondremos en contacto contigo muy pronto para los siguientes pasos.</p>
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

  return (
    <form className="pd-accept pd-noprint" onSubmit={e => { e.preventDefault(); accept() }}>
      <h2>Aceptar propuesta</h2>
      <p className="pd-accept-sub">{needsChoice ? 'Elige la opción que prefieres y confirma con tu nombre.' : 'Confirma con tu nombre para dar el siguiente paso.'}</p>
      {needsChoice && (
        <div style={{ display: 'grid', gap: 10 }}>
          {options.map(o => (
            <label key={o.key} className="pd-opt">
              <input type="radio" name="opt" value={o.key} checked={option === o.key} onChange={() => setOption(o.key)} />
              <span className="pd-opt-label">{o.label}</span>
              <span className="pd-opt-total">{o.total}</span>
            </label>
          ))}
        </div>
      )}
      <input className="pd-field" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre completo" maxLength={120} autoComplete="name" />
      <textarea className="pd-field" value={comment} onChange={e => setComment(e.target.value)} placeholder="Comentarios (opcional)" rows={2} maxLength={1000} />
      {error && <p className="pd-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="pd-btn pd-btn-primary">
        {busy ? 'Enviando…' : 'Aceptar propuesta'}
      </button>
      <p className="pd-fine">Al aceptar confirmas tu interés en avanzar con las condiciones descritas arriba.</p>
    </form>
  )
}
