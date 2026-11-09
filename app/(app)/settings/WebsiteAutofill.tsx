'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Suggestion = {
  industry: string | null
  about_agency: string | null
  tone: string | null
  language_style: string | null
  competitive_differentiators: string | null
  services: { name: string; description: string; category: string | null }[]
  pain_points: { pain: string; impact: string | null }[]
}

export type AutofillFields = {
  industry: string
  about_agency: string
  tone: string
  language_style: string
  competitive_differentiators: string
}

type FieldKey = keyof AutofillFields

const FIELD_LABELS: Record<FieldKey, string> = {
  industry: 'Industria',
  about_agency: 'Quiénes somos',
  tone: 'Tono',
  language_style: 'Estilo de lenguaje',
  competitive_differentiators: 'Diferenciales',
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'

// Onboarding por sitio web: la IA propone, la agencia revisa y elige qué aplicar. Nada se guarda sin su clic.
export default function WebsiteAutofill({
  website,
  current,
  existingProductNames,
  onApplyFields,
}: {
  website: string
  current: AutofillFields
  existingProductNames: string[]
  onApplyFields: (fields: Partial<AutofillFields>) => void
}) {
  const router = useRouter()
  const [url, setUrl] = useState(website)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [sug, setSug] = useState<Suggestion | null>(null)
  const [pickFields, setPickFields] = useState<Record<string, boolean>>({})
  const [pickServices, setPickServices] = useState<Record<number, boolean>>({})
  const [pickPains, setPickPains] = useState<Record<number, boolean>>({})
  const [applying, setApplying] = useState(false)

  const known = new Set(existingProductNames.map(n => n.trim().toLowerCase()))

  async function analyze() {
    setBusy(true); setError(''); setDone(''); setSug(null)
    try {
      const res = await fetch('/api/settings/onboarding/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: url }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'No se pudo analizar el sitio')
      const s = body.data as Suggestion
      setSug(s)
      const f: Record<string, boolean> = {}
      for (const k of Object.keys(FIELD_LABELS) as FieldKey[]) {
        f[k] = !!s[k] && !current[k].trim() // solo precargado si estaba vacío
      }
      setPickFields(f)
      setPickServices(Object.fromEntries(s.services.map((x, i) => [i, !known.has(x.name.trim().toLowerCase())])))
      setPickPains(Object.fromEntries(s.pain_points.map((_, i) => [i, true])))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    if (!sug) return
    setApplying(true); setError('')
    try {
      const fields: Partial<AutofillFields> = {}
      for (const k of Object.keys(FIELD_LABELS) as FieldKey[]) {
        if (pickFields[k] && sug[k]) fields[k] = sug[k] as string
      }
      const nFields = Object.keys(fields).length
      if (nFields) onApplyFields(fields)

      let nServices = 0
      for (const [i, s] of sug.services.entries()) {
        if (!pickServices[i]) continue
        const r = await fetch('/api/settings/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: s.name, description: s.description, category: s.category }),
        })
        if (r.ok) nServices++
      }
      let nPains = 0
      for (const [i, p] of sug.pain_points.entries()) {
        if (!pickPains[i]) continue
        const r = await fetch('/api/settings/pain-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pain: p.pain, impact: p.impact ?? '' }),
        })
        if (r.ok) nPains++
      }
      setSug(null)
      setDone(
        `Listo: ${nServices} servicio(s) y ${nPains} pain point(s) agregados.` +
        (nFields ? ` Se llenaron ${nFields} campo(s) del formulario: revísalos y pulsa «Guardar cambios» abajo.` : '') +
        ' Los precios y los casos de éxito los escribes tú: no los inventamos.'
      )
      if (nServices || nPains) router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-amber-900">Configura tu perfil desde tu sitio web</h2>
        <p className="text-xs text-amber-800 mt-1">
          Pega la dirección de tu sitio y proponemos tu descripción, tono y servicios a partir de lo que ahí dice.
          Tú revisas y eliges qué usar. No tocamos precios ni casos de éxito.
        </p>
      </div>

      <div className="flex gap-2">
        <input className={inputCls} placeholder="https://tuagencia.com" value={url} onChange={e => setUrl(e.target.value)} />
        <button
          onClick={analyze}
          disabled={busy || !url.trim()}
          className="shrink-0 text-sm px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? 'Leyendo tu sitio…' : 'Analizar mi sitio'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {done && <p className="text-xs text-green-700">{done}</p>}

      {sug && (
        <div className="space-y-4 bg-white rounded-lg border border-amber-200 p-4">
          <p className="text-xs text-gray-500">Marca lo que quieras usar. Lo que ya tenías escrito aparece sin marcar para no pisarlo.</p>

          {(Object.keys(FIELD_LABELS) as FieldKey[]).filter(k => sug[k]).map(k => (
            <label key={k} className="flex gap-3 items-start text-sm">
              <input type="checkbox" className="mt-1" checked={!!pickFields[k]} onChange={e => setPickFields(p => ({ ...p, [k]: e.target.checked }))} />
              <span>
                <span className="block text-xs font-medium text-gray-500">
                  {FIELD_LABELS[k]}{current[k].trim() ? ' · reemplazaría lo que ya escribiste' : ''}
                </span>
                <span className="text-gray-800">{sug[k]}</span>
              </span>
            </label>
          ))}

          {sug.services.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Servicios detectados</p>
              {sug.services.map((s, i) => (
                <label key={i} className="flex gap-3 items-start text-sm">
                  <input type="checkbox" className="mt-1" checked={!!pickServices[i]} onChange={e => setPickServices(p => ({ ...p, [i]: e.target.checked }))} />
                  <span>
                    <span className="font-medium text-gray-800">{s.name}</span>
                    {known.has(s.name.trim().toLowerCase()) && <span className="text-xs text-gray-400"> · ya lo tienes</span>}
                    {s.description && <span className="block text-gray-600">{s.description}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}

          {sug.pain_points.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Problemas de clientes que tu sitio dice resolver</p>
              {sug.pain_points.map((p, i) => (
                <label key={i} className="flex gap-3 items-start text-sm">
                  <input type="checkbox" className="mt-1" checked={!!pickPains[i]} onChange={e => setPickPains(x => ({ ...x, [i]: e.target.checked }))} />
                  <span className="text-gray-800">{p.pain}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={apply}
              disabled={applying}
              className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {applying ? 'Aplicando…' : 'Usar lo seleccionado'}
            </button>
            <button onClick={() => setSug(null)} className="text-sm text-gray-500 hover:text-gray-700">Descartar</button>
          </div>
        </div>
      )}
    </div>
  )
}
