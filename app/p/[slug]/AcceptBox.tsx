'use client'

import { useState } from 'react'

interface Opt { key: string; label: string; total: string }

export default function AcceptBox({
  slug, options, needsChoice, color, expired, acceptedBy, acceptedAt,
}: {
  slug: string
  options: Opt[]
  needsChoice: boolean
  color: string
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
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-semibold text-emerald-800">¡Propuesta aceptada!</p>
        <p className="text-sm text-emerald-700 mt-1">
          {who ? `Gracias, ${who}. ` : ''}Nos pondremos en contacto contigo muy pronto para los siguientes pasos.
        </p>
      </div>
    )
  }

  if (expired) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
        Esta propuesta ya venció. Escríbenos y te enviamos una versión actualizada.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 print:hidden">
      <h2 className="text-lg font-semibold text-gray-900">Aceptar propuesta</h2>
      {needsChoice && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Elige la opción que prefieres:</p>
          {options.map(o => (
            <label key={o.key} className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm cursor-pointer has-[:checked]:border-gray-900">
              <input type="radio" name="opt" value={o.key} checked={option === o.key} onChange={() => setOption(o.key)} />
              <span className="flex-1 text-gray-900">{o.label}</span>
              <span className="text-gray-600">{o.total}</span>
            </label>
          ))}
        </div>
      )}
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre completo"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" maxLength={120} />
      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Comentarios (opcional)"
        rows={2} maxLength={1000} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={accept} disabled={busy}
        className="w-full rounded-xl px-6 py-3 text-sm font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: color }}>
        {busy ? 'Enviando…' : 'Aceptar propuesta'}
      </button>
      <p className="text-xs text-gray-400 text-center">Al aceptar confirmas tu interés en avanzar con las condiciones descritas arriba.</p>
    </div>
  )
}
