'use client'
import { capitalizeFirst, titleCase } from '@/lib/text'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { nanoid } from 'nanoid'
import { PageHeader } from '../../ui'

const OTHER = '__other__'
const SIZES = ['1–10 personas', '11–50 personas', '51–200 personas', '201–500 personas', '500+ personas']

export default function NewProposalPage() {
  const router = useRouter()
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [customService, setCustomService] = useState('')
  const [saveService, setSaveService] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    prospect_name: '',
    prospect_title: '',
    prospect_company: '',
    prospect_email: '',
    prospect_website: '',
    prospect_industry: '',
    prospect_company_size: '',
    prospect_pain: '',
    product: '',
  })

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch('/api/products')
        if (!res.ok) throw new Error(String(res.status))
        const json = await res.json()
        setProducts(json.products ?? [])
        setIsAdmin(json.is_admin === true)
      } catch {
        setError('No se pudieron cargar los servicios. Recarga la página.')
      }
    }
    loadProducts()
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const isOther = form.product === OTHER
    const productName = isOther ? capitalizeFirst(customService) : form.product
    if (!productName) {
      setError('Escribe el servicio a proponer.')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single()
      if (!profile?.client_id) throw new Error('Sin agencia asignada')

      const slug = nanoid(16)

      // Create the proposal row (draft)
      const { data: proposal, error: insertErr } = await supabase
        .from('proposals')
        .insert({
          client_id: profile.client_id,
          created_by: user.id,
          public_slug: slug,
          status: 'draft',
          ...form,
          product: productName,
          prospect_name: titleCase(form.prospect_name),
          prospect_title: capitalizeFirst(form.prospect_title),
          prospect_company: capitalizeFirst(form.prospect_company),
          prospect_industry: capitalizeFirst(form.prospect_industry),
        })
        .select('id')
        .single()
      if (insertErr) throw insertErr

      await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposal.id, client_id: profile.client_id, ...form, product: productName }),
      })

      if (isOther && saveService && isAdmin) {
        // Best effort: guarda el servicio en el catálogo para la próxima vez.
        await fetch('/api/settings/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: productName }),
        }).catch(() => {})
      }

      router.push(`/proposals/${proposal.id}`)
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
        back={{ href: '/dashboard', label: 'Propuestas' }}
        title="Nueva propuesta"
        subtitle="Cuéntanos del prospecto. Winflow escribe la propuesta con tu tono, tus precios y lo que encuentra de su negocio."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
        <div className="wf-card">
          <h2 className="wf-card-title">Datos del prospecto</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nombre completo</label>
              <input required className={inputClass} value={form.prospect_name}
                onChange={e => set('prospect_name', e.target.value)} placeholder="Ana García" />
            </div>
            <div>
              <label className={labelClass}>Cargo <span className="text-gray-400 font-normal">· opcional</span></label>
              <input className={inputClass} value={form.prospect_title}
                onChange={e => set('prospect_title', e.target.value)} placeholder="Directora de Marketing" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Empresa</label>
            <input required className={inputClass} value={form.prospect_company}
              onChange={e => set('prospect_company', e.target.value)} placeholder="Nombre de la empresa" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Correo electrónico</label>
              <input type="email" required className={inputClass} value={form.prospect_email}
                onChange={e => set('prospect_email', e.target.value)} placeholder="ana@empresa.com" />
            </div>
            <div>
              <label className={labelClass}>Sitio web <span className="font-medium text-brand-teal">· muy recomendado</span></label>
              <input type="url" className={inputClass} value={form.prospect_website}
                onChange={e => set('prospect_website', e.target.value)} placeholder="https://empresa.com" />
              {!form.prospect_website.trim() && (
                <p className="wf-alert wf-alert-warn mt-1.5 !rounded-xl !p-2.5 text-xs">
                  Altamente recomendable para una propuesta más precisa: con el sitio web la adaptamos a su negocio. Sin él, solo nos apoyamos en tus notas.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Industria</label>
            <input required className={inputClass} value={form.prospect_industry}
              onChange={e => set('prospect_industry', e.target.value)} placeholder="Alimentos y bebidas, Retail, Fintech..." />
          </div>

          <div>
            <label className={labelClass}>Tamaño de empresa</label>
            <select className={inputClass} value={form.prospect_company_size}
              onChange={e => set('prospect_company_size', e.target.value)}>
              <option value="">— Selecciona —</option>
              {SIZES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="wf-card">
          <h2 className="wf-card-title">La oportunidad</h2>

          <div>
            <label className={labelClass}>Servicio a proponer</label>
            <select required className={inputClass} value={form.product}
              onChange={e => set('product', e.target.value)}>
              <option value="">— Selecciona —</option>
              {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              <option value={OTHER}>Otro servicio…</option>
            </select>
            {form.product === OTHER && (
              <div className="mt-3 space-y-2">
                <input required autoFocus className={inputClass} value={customService}
                  onChange={e => setCustomService(e.target.value)}
                  placeholder="Ej. Diseño de identidad de marca" />
                <p className="wf-alert wf-alert-warn !rounded-xl !p-3 text-xs">
                  Este servicio no está en tu catálogo, así que la propuesta no incluirá precios ni casos de éxito específicos. Para mejores resultados, cárgalo en Ajustes → Productos.
                </p>
                {isAdmin && (
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={saveService} onChange={e => setSaveService(e.target.checked)} />
                    Guardar como servicio en mi catálogo
                  </label>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Dolor o contexto del prospecto</label>
            <textarea required rows={4} className={inputClass} value={form.prospect_pain}
              onChange={e => set('prospect_pain', e.target.value)}
              placeholder="Qué problema tiene, qué mencionó en la llamada, cuál es el objetivo..." />
          </div>
        </div>

        {error && <p className="wf-alert wf-alert-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="wf-btn wf-btn-lg w-full"
        >
          {loading ? 'Creando propuesta...' : 'Generar propuesta personalizada'}
        </button>
      </form>

      <aside className="wf-card lg:sticky lg:top-24">
        <h2 className="wf-card-title">Qué pasa al generar</h2>
        <ol className="space-y-3 text-sm text-gray-600">
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-mint-soft text-xs font-semibold text-brand-navy">1</span>Winflow lee el sitio del prospecto y cruza tus notas con tu catálogo.</li>
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-mint-soft text-xs font-semibold text-brand-navy">2</span>En menos de un minuto tienes propuesta, PDF y correo listos.</li>
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-mint-soft text-xs font-semibold text-brand-navy">3</span>Revisas, editas lo que quieras y tú das el clic para enviar.</li>
        </ol>
        <p className="wf-hint border-t border-gray-100 pt-3">Mientras más contexto des en «dolor o contexto», más específica sale.</p>
      </aside>
      </div>
    </div>
  )
}
