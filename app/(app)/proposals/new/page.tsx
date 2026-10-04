'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { nanoid } from 'nanoid'

const SIZES = ['1–10 personas', '11–50 personas', '51–200 personas', '201–500 personas', '500+ personas']

export default function NewProposalPage() {
  const router = useRouter()
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
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
        })
        .select('id')
        .single()
      if (insertErr) throw insertErr

      await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposal.id, client_id: profile.client_id, ...form }),
      })

      router.push(`/proposals/${proposal.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setLoading(false)
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Nueva propuesta</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Datos del prospecto</h2>

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
              <label className={labelClass}>Sitio web <span className="text-gray-400 font-normal">· recomendado</span></label>
              <input type="url" className={inputClass} value={form.prospect_website}
                onChange={e => set('prospect_website', e.target.value)} placeholder="https://empresa.com" />
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

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">La oportunidad</h2>

          <div>
            <label className={labelClass}>Servicio a proponer</label>
            <select required className={inputClass} value={form.product}
              onChange={e => set('product', e.target.value)}>
              <option value="">— Selecciona —</option>
              {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Dolor o contexto del prospecto</label>
            <textarea required rows={4} className={inputClass} value={form.prospect_pain}
              onChange={e => set('prospect_pain', e.target.value)}
              placeholder="Qué problema tiene, qué mencionó en la llamada, cuál es el objetivo..." />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Creando propuesta...' : 'Generar propuesta personalizada'}
        </button>
      </form>
    </div>
  )
}
