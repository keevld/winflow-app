'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PricingMode } from '@/lib/commercial'
import { Loading, PageHeader } from '../../../ui'
import CallNotesField from './CallNotesField'

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
  const contactId = params.get('contact')

  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [chosen, setChosen] = useState<string[]>([])
  const [mode, setMode] = useState<PricingMode>('packages')
  const [callId, setCallId] = useState<string | null>(null)
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
      if (contactId) {
        try {
          const cr = await fetch(`/api/contacts/${contactId}`)
          if (cr.ok) {
            const { contact } = await cr.json()
            setForm(f => ({
              ...f,
              prospect_name: contact.name ?? '',
              prospect_title: contact.title ?? '',
              prospect_company: contact.company ?? '',
              prospect_email: contact.email ?? '',
              prospect_website: contact.website ?? '',
              prospect_industry: contact.industry ?? '',
              prospect_company_size: contact.company_size ?? '',
            }))
          }
        } catch {}
      }
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
  }, [fromId, contactId])

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
          call_id: callId ?? undefined,
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

  const inputClass = 'wf-input'
  const labelClass = 'wf-label'

  return (
    <div className="space-y-6">
      <PageHeader
        back={fromId ? { href: `/proposals/${fromId}`, label: 'Propuesta inicial' } : { href: '/dashboard', label: 'Propuestas' }}
        title="Nueva propuesta comercial"
        subtitle="Para después de la llamada: con lo que se habló, Winflow arma el alcance, las opciones y los precios de tu catálogo."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
        <div className="wf-card">
          <h2 className="wf-card-title">El prospecto</h2>
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

        <div className="wf-card">
          <h2 className="wf-card-title">Lo que se habló en la llamada</h2>
          <CallNotesField notes={form.call_notes} onNotes={v => set('call_notes', v)} onCall={setCallId} />
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

        <div className="wf-card">
          <h2 className="wf-card-title">Qué se propone</h2>
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
                <label key={m.value} className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors ${mode === m.value ? 'border-brand-teal bg-brand-mint-soft/50 ring-1 ring-brand-teal/30' : 'border-gray-200 hover:border-gray-300'}`}>
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

        {error && <p className="wf-alert wf-alert-error">{error}</p>}

        <button type="submit" disabled={loading}
          className="wf-btn wf-btn-lg w-full">
          {loading ? 'Generando propuesta comercial… (puede tardar hasta un minuto)' : 'Generar propuesta comercial'}
        </button>
      </form>

      <aside className="wf-card lg:sticky lg:top-24">
        <h2 className="wf-card-title">Qué recibe tu cliente</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>Alcance y entregables con base en la llamada.</li>
          <li>Precios solo de tu catálogo: Winflow no inventa cifras.</li>
          <li>Botón de aceptación y seguimiento automático.</li>
        </ul>
        <p className="wf-hint border-t border-gray-100 pt-3">Antes de enviarla podrás editar cada línea.</p>
      </aside>
      </div>
    </div>
  )
}

export default function NewCommercialPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewCommercialForm />
    </Suspense>
  )
}
