'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PricingMode } from '@/lib/commercial'

const SIZES = ['1–10 personas', '11–50 personas', '51–200 personas', '201–500 personas', '500+ personas']

const MODES: { value: PricingMode; title: string; desc: string }[] = [
  { value: 'packages', title: 'Paquetes', desc: 'La IA arma 2 o 3 opciones (por ejemplo Básico, Recomendado y Completo) para que el prospecto compare.' },
  { value: 'single', title: 'Una sola opción', desc: 'Una propuesta con un precio total, sin alternativas.' },
  { value: 'lines', title: 'Líneas editables', desc: 'Una tabla de conceptos con cantidad y precio que tú ajustas a mano antes de enviar.' },
]

function NewCommercialForm() {
  const router = useRouter()
  const params = useSearchParams()
  const fromId = params.get('from')

  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [chosen, setChosen] = useState<string[]>([])
  const [mode, setMode] = useState<PricingMode>('packages')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    prospect_name: '', prospect_title: '', prospect_company: '', prospect_email: '',
    prospect_website: '', prospect_industry: '', prospect_company_size: '', prospect_pain: '',
    call_notes: '', budget_hint: '', desired_deadline: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/products')
        if (res.ok) setProducts((await res.json()).products ?? [])
      } catch {}
      if (fromId) {
        const supabase = createClient()
        const { data } = await supabase.from('proposals').select('*').eq('id', fromId).single()
        if (data) {
          setForm(f => ({
            ...f,
            prospect_name: data.prospect_name ?? '',
            prospect_title: data.prospect_title ?? '',
            prospect_company: data.prospect_company ?? '',
            prospect_email: data.prospect_email ?? '',
            prospect_website: data.prospect_website ?? '',
            prospect_industry: data.prospect_industry ?? '',
            prospect_company_size: data.prospect_company_size ?? '',
            prospect_pain: data.prospect_pain ?? '',
          }))
        }
      }
    }
    load()
  }, [fromId])

  function toggle(id: string) {
    setChosen(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/proposals/commercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          pricing_mode: mode,
          product_ids: chosen,
          parent_proposal_id: fromId ?? undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'No se pudo generar la propuesta')
      router.push(`/proposals/${json.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setLoading(false)
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Nueva propuesta comercial</h1>
      <p className="text-sm text-gray-500 mb-6">
        Para después de la llamada: con lo que se habló, Winflow arma el alcance, las opciones y los precios de tu catálogo.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">El prospecto</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nombre</label>
              <input required className={inputClass} value={form.prospect_name} onChange={e => set('prospect_name', e.target.value)} placeholder="Ana García" />
            </div>
            <div>
              <label className={labelClass}>Cargo</label>
              <input className={inputClass} value={form.prospect_title} onChange={e => set('prospect_title', e.target.value)} placeholder="Directora de Marketing" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Empresa</label>
              <input required className={inputClass} value={form.prospect_company} onChange={e => set('prospect_company', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Correo electrónico</label>
              <input type="email" className={inputClass} value={form.prospect_email} onChange={e => set('prospect_email', e.target.value)} placeholder="ana@empresa.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Industria</label>
              <input className={inputClass} value={form.prospect_industry} onChange={e => set('prospect_industry', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Tamaño de empresa</label>
              <select className={inputClass} value={form.prospect_company_size} onChange={e => set('prospect_company_size', e.target.value)}>
                <option value="">— Selecciona —</option>
                {SIZES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Lo que se habló en la llamada</h2>
          <div>
            <label className={labelClass}>Notas o transcripción</label>
            <textarea required rows={10} className={inputClass} value={form.call_notes}
              onChange={e => set('call_notes', e.target.value)}
              placeholder="Pega aquí tus notas o la transcripción: qué problema tiene, qué necesita, quién decide, qué le preocupó, qué le interesó…" />
            <p className="text-xs text-gray-400 mt-1">Mientras más detalle, más personalizada sale la propuesta.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Presupuesto mencionado <span className="text-gray-400 font-normal">· opcional</span></label>
              <input className={inputClass} value={form.budget_hint} onChange={e => set('budget_hint', e.target.value)} placeholder="Ej. alrededor de 5,000 USD" />
            </div>
            <div>
              <label className={labelClass}>Fecha deseada <span className="text-gray-400 font-normal">· opcional</span></label>
              <input className={inputClass} value={form.desired_deadline} onChange={e => set('desired_deadline', e.target.value)} placeholder="Ej. antes de diciembre" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Qué se propone</h2>
          <div>
            <label className={labelClass}>Servicios a incluir</label>
            {products.length === 0 ? (
              <p className="text-sm text-gray-400">Aún no hay servicios cargados. Agrégalos en Ajustes → Productos.</p>
            ) : (
              <div className="space-y-2">
                {products.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={chosen.includes(p.id)} onChange={() => toggle(p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">
              {chosen.length === 0 ? 'Si no eliges ninguno, la IA elegirá los más adecuados según la llamada.' : `${chosen.length} seleccionado(s).`}
            </p>
          </div>

          <div>
            <label className={labelClass}>Cómo presentar los precios</label>
            <div className="space-y-2">
              {MODES.map(m => (
                <label key={m.value} className={`flex gap-3 border rounded-lg p-3 cursor-pointer ${mode === m.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
                  <input type="radio" name="mode" checked={mode === m.value} onChange={() => setMode(m.value)} className="mt-1" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{m.title}</span>
                    <span className="block text-xs text-gray-500">{m.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
          {loading ? 'Generando propuesta comercial… (puede tardar hasta un minuto)' : 'Generar propuesta comercial'}
        </button>
      </form>
    </div>
  )
}

export default function NewCommercialPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400 py-20 text-center">Cargando...</div>}>
      <NewCommercialForm />
    </Suspense>
  )
}
