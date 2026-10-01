'use client'

import { useState } from 'react'
import type {
  Client, BrandVoice, SalesProcess, Product, Pricing, PainPoint, SuccessStory, Objection,
} from '@/lib/types'

type Props = {
  initialClient: Client | null
  initialBrand: BrandVoice | null
  initialSalesProcess: SalesProcess | null
  initialProducts: Product[]
  initialPricing: Pricing[]
  initialPainPoints: PainPoint[]
  initialSuccessStories: SuccessStory[]
  initialObjections: Objection[]
}

const TABS = [
  { key: 'agency', label: 'Agencia y marca' },
  { key: 'sales', label: 'Proceso de ventas' },
  { key: 'products', label: 'Productos y precios' },
  { key: 'knowledge', label: 'Pain points, casos y objeciones' },
] as const

type TabKey = typeof TABS[number]['key']

export default function SettingsClient(props: Props) {
  const [tab, setTab] = useState<TabKey>('agency')

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Perfil de la agencia</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'agency' && (
        <AgencySection initialClient={props.initialClient} initialBrand={props.initialBrand} />
      )}
      {tab === 'sales' && (
        <SalesProcessSection initial={props.initialSalesProcess} />
      )}
      {tab === 'products' && (
        <ProductsSection initialProducts={props.initialProducts} initialPricing={props.initialPricing} />
      )}
      {tab === 'knowledge' && (
        <KnowledgeSection
          initialPainPoints={props.initialPainPoints}
          initialSuccessStories={props.initialSuccessStories}
          initialObjections={props.initialObjections}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────

function SaveBar({ saving, msg, onSave }: { saving: boolean; msg: string; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onSave}
        disabled={saving}
        className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
const textareaCls = inputCls + ' resize-y'


// ─────────────────────────────────────────────────────────────────────────
// Agency & brand
// ─────────────────────────────────────────────────────────────────────────

function AgencySection({ initialClient, initialBrand }: { initialClient: Client | null; initialBrand: BrandVoice | null }) {
  const [form, setForm] = useState({
    company_name: initialClient?.company_name ?? '',
    industry: initialClient?.industry ?? '',
    website: initialClient?.website ?? '',
    contact_name: initialClient?.contact_name ?? '',
    contact_email: initialClient?.contact_email ?? '',
    contact_phone: initialClient?.contact_phone ?? '',
    booking_url: initialClient?.booking_url ?? '',
    calendly_url: initialClient?.calendly_url ?? '',
    tone: initialBrand?.tone ?? '',
    language_style: initialBrand?.language_style ?? '',
    avoid_words: initialBrand?.avoid_words ?? '',
    example_phrase: initialBrand?.example_phrase ?? '',
    primary_color: initialBrand?.primary_color ?? '#1E3A5F',
    secondary_color: initialBrand?.secondary_color ?? '#2563EB',
    accent_color: initialBrand?.accent_color ?? '',
    competitive_differentiators: initialBrand?.competitive_differentiators ?? '',
    price_context: initialBrand?.price_context ?? '',
    proposal_style_notes: initialBrand?.proposal_style_notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/settings/agency', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'No se pudo guardar')
      }
      setMsg('Guardado')
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Datos generales</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Empresa"><input className={inputCls} value={form.company_name} onChange={e => set('company_name', e.target.value)} /></Field>
          <Field label="Industria"><input className={inputCls} value={form.industry} onChange={e => set('industry', e.target.value)} /></Field>
          <Field label="Sitio web"><input className={inputCls} value={form.website} onChange={e => set('website', e.target.value)} /></Field>
          <Field label="Nombre de contacto"><input className={inputCls} value={form.contact_name} onChange={e => set('contact_name', e.target.value)} /></Field>
          <Field label="Correo de contacto"><input className={inputCls} value={form.contact_email} onChange={e => set('contact_email', e.target.value)} /></Field>
          <Field label="Teléfono"><input className={inputCls} value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} /></Field>
          <Field label="Link de agendamiento (booking)"><input className={inputCls} value={form.booking_url} onChange={e => set('booking_url', e.target.value)} /></Field>
          <Field label="Link de Calendly"><input className={inputCls} value={form.calendly_url} onChange={e => set('calendly_url', e.target.value)} /></Field>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Marca y voz</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Color primario">
            <div className="flex items-center gap-2">
              <input type="color" value={form.primary_color} onChange={e => set('primary_color', e.target.value)} className="w-9 h-9 rounded border border-gray-200" />
              <input className={inputCls} value={form.primary_color} onChange={e => set('primary_color', e.target.value)} />
            </div>
          </Field>
          <Field label="Color secundario">
            <div className="flex items-center gap-2">
              <input type="color" value={form.secondary_color} onChange={e => set('secondary_color', e.target.value)} className="w-9 h-9 rounded border border-gray-200" />
              <input className={inputCls} value={form.secondary_color} onChange={e => set('secondary_color', e.target.value)} />
            </div>
          </Field>
          <Field label="Tono"><input className={inputCls} placeholder="ej. cercano, directo, experto" value={form.tone} onChange={e => set('tone', e.target.value)} /></Field>
          <Field label="Estilo de lenguaje"><input className={inputCls} placeholder="ej. informal, técnico" value={form.language_style} onChange={e => set('language_style', e.target.value)} /></Field>
        </div>
        <Field label="Palabras a evitar"><input className={inputCls} value={form.avoid_words} onChange={e => set('avoid_words', e.target.value)} /></Field>
        <Field label="Frase de ejemplo (cómo suena tu marca)"><textarea rows={2} className={textareaCls} value={form.example_phrase} onChange={e => set('example_phrase', e.target.value)} /></Field>
        <Field label="Diferenciadores competitivos"><textarea rows={3} className={textareaCls} value={form.competitive_differentiators} onChange={e => set('competitive_differentiators', e.target.value)} /></Field>
        <Field label="Contexto de precios (cómo hablar de precio)"><textarea rows={2} className={textareaCls} value={form.price_context} onChange={e => set('price_context', e.target.value)} /></Field>
        <Field label="Notas de estilo para las propuestas"><textarea rows={2} className={textareaCls} value={form.proposal_style_notes} onChange={e => set('proposal_style_notes', e.target.value)} /></Field>
      </div>

      <SaveBar saving={saving} msg={msg} onSave={handleSave} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Sales process
// ─────────────────────────────────────────────────────────────────────────

function SalesProcessSection({ initial }: { initial: SalesProcess | null }) {
  const [form, setForm] = useState({
    avg_cycle_days: initial?.avg_cycle_days ?? '',
    typical_steps: initial?.typical_steps ?? '',
    decision_makers: initial?.decision_makers ?? '',
    sends_quote: initial?.sends_quote ?? true,
    expects_negotiation: initial?.expects_negotiation ?? false,
    negotiation_notes: initial?.negotiation_notes ?? '',
    followup_day1: initial?.followup_day1 ?? 1,
    followup_day2: initial?.followup_day2 ?? 3,
    followup_day3: initial?.followup_day3 ?? 7,
    followup_max_attempts: initial?.followup_max_attempts ?? 4,
    followup_notes: initial?.followup_notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/settings/sales-process', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          avg_cycle_days: form.avg_cycle_days === '' ? null : Number(form.avg_cycle_days),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'No se pudo guardar')
      }
      setMsg('Guardado')
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Ciclo de venta</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Duración promedio del ciclo (días)">
            <input type="number" className={inputCls} value={form.avg_cycle_days} onChange={e => set('avg_cycle_days', e.target.value)} />
          </Field>
          <Field label="Quién decide">
            <input className={inputCls} placeholder="ej. dueño, gerente de marketing" value={form.decision_makers} onChange={e => set('decision_makers', e.target.value)} />
          </Field>
        </div>
        <Field label="Pasos típicos del proceso"><textarea rows={3} className={textareaCls} value={form.typical_steps} onChange={e => set('typical_steps', e.target.value)} /></Field>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.sends_quote} onChange={e => set('sends_quote', e.target.checked)} />
            Se envía cotización formal
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.expects_negotiation} onChange={e => set('expects_negotiation', e.target.checked)} />
            Se espera negociación de precio
          </label>
        </div>
        {form.expects_negotiation && (
          <Field label="Notas de negociación"><textarea rows={2} className={textareaCls} value={form.negotiation_notes} onChange={e => set('negotiation_notes', e.target.value)} /></Field>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Cadencia de seguimiento</h2>
        <p className="text-xs text-gray-400">Días después del envío para cada recordatorio de seguimiento.</p>
        <div className="grid grid-cols-4 gap-4">
          <Field label="1er seguimiento (día)"><input type="number" className={inputCls} value={form.followup_day1} onChange={e => set('followup_day1', Number(e.target.value))} /></Field>
          <Field label="2do seguimiento (día)"><input type="number" className={inputCls} value={form.followup_day2} onChange={e => set('followup_day2', Number(e.target.value))} /></Field>
          <Field label="3er seguimiento (día)"><input type="number" className={inputCls} value={form.followup_day3} onChange={e => set('followup_day3', Number(e.target.value))} /></Field>
          <Field label="Máx. intentos"><input type="number" className={inputCls} value={form.followup_max_attempts} onChange={e => set('followup_max_attempts', Number(e.target.value))} /></Field>
        </div>
        <Field label="Notas de seguimiento"><textarea rows={2} className={textareaCls} value={form.followup_notes} onChange={e => set('followup_notes', e.target.value)} /></Field>
      </div>

      <SaveBar saving={saving} msg={msg} onSave={handleSave} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Products & pricing
// ─────────────────────────────────────────────────────────────────────────

function ProductsSection({ initialProducts, initialPricing }: { initialProducts: Product[]; initialPricing: Pricing[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [pricing, setPricing] = useState(initialPricing)

  const [newProduct, setNewProduct] = useState({ name: '', description: '', category: '' })
  const [addingProduct, setAddingProduct] = useState(false)
  const [productError, setProductError] = useState('')

  const [newPrice, setNewPrice] = useState({
    product_id: '', price_type: 'fixed', price_amount: '', price_min: '', price_max: '',
    currency: 'USD', billing_period: '', includes: '', excludes: '', negotiable: false, notes: '',
  })
  const [addingPrice, setAddingPrice] = useState(false)
  const [priceError, setPriceError] = useState('')

  async function handleAddProduct() {
    if (!newProduct.name.trim()) { setProductError('El nombre es obligatorio'); return }
    setAddingProduct(true)
    setProductError('')
    try {
      const res = await fetch('/api/settings/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo crear')
      setProducts(p => [body.data, ...p])
      setNewProduct({ name: '', description: '', category: '' })
    } catch (err: unknown) {
      setProductError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setAddingProduct(false)
    }
  }

  async function handleDeleteProduct(id: string) {
    setProducts(p => p.filter(x => x.id !== id))
    await fetch(`/api/settings/products/${id}`, { method: 'DELETE' })
  }

  async function handleAddPrice() {
    if (!newPrice.price_type.trim()) { setPriceError('El tipo de precio es obligatorio'); return }
    setAddingPrice(true)
    setPriceError('')
    try {
      const res = await fetch('/api/settings/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPrice,
          product_id: newPrice.product_id || null,
          price_amount: newPrice.price_amount === '' ? null : Number(newPrice.price_amount),
          price_min: newPrice.price_min === '' ? null : Number(newPrice.price_min),
          price_max: newPrice.price_max === '' ? null : Number(newPrice.price_max),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo crear')
      setPricing(p => [body.data, ...p])
      setNewPrice({ product_id: '', price_type: 'fixed', price_amount: '', price_min: '', price_max: '', currency: 'USD', billing_period: '', includes: '', excludes: '', negotiable: false, notes: '' })
    } catch (err: unknown) {
      setPriceError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setAddingPrice(false)
    }
  }

  async function handleDeletePrice(id: string) {
    setPricing(p => p.filter(x => x.id !== id))
    await fetch(`/api/settings/pricing/${id}`, { method: 'DELETE' })
  }

  const productName = (id: string | null) => products.find(p => p.id === id)?.name ?? 'General'

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Productos</h2>
        {products.length === 0 && <p className="text-sm text-gray-400">Sin productos todavía.</p>}
        <div className="divide-y divide-gray-100">
          {products.map(p => (
            <div key={p.id} className="py-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{p.name}{p.category ? ` · ${p.category}` : ''}</p>
                {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
              </div>
              <button onClick={() => handleDeleteProduct(p.id)} className="text-xs text-red-500 hover:text-red-700 shrink-0">Eliminar</button>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-4 grid grid-cols-3 gap-3">
          <input className={inputCls} placeholder="Nombre del producto" value={newProduct.name} onChange={e => setNewProduct(f => ({ ...f, name: e.target.value }))} />
          <input className={inputCls} placeholder="Categoría (opcional)" value={newProduct.category} onChange={e => setNewProduct(f => ({ ...f, category: e.target.value }))} />
          <input className={inputCls} placeholder="Descripción (opcional)" value={newProduct.description} onChange={e => setNewProduct(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleAddProduct} disabled={addingProduct} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
            {addingProduct ? 'Agregando...' : '+ Agregar producto'}
          </button>
          {productError && <span className="text-xs text-red-600">{productError}</span>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Precios</h2>
        {pricing.length === 0 && <p className="text-sm text-gray-400">Sin precios todavía.</p>}
        <div className="divide-y divide-gray-100">
          {pricing.map(p => (
            <div key={p.id} className="py-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {productName(p.product_id)} · {p.price_type}
                  {p.price_amount != null && ` · ${p.currency} ${p.price_amount}`}
                  {p.price_min != null && p.price_max != null && ` · ${p.currency} ${p.price_min}–${p.price_max}`}
                  {p.billing_period ? ` / ${p.billing_period}` : ''}
                </p>
                {p.includes && <p className="text-xs text-gray-500 mt-0.5">Incluye: {p.includes}</p>}
                {p.negotiable && <p className="text-xs text-amber-600 mt-0.5">Negociable</p>}
              </div>
              <button onClick={() => handleDeletePrice(p.id)} className="text-xs text-red-500 hover:text-red-700 shrink-0">Eliminar</button>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <select className={inputCls} value={newPrice.product_id} onChange={e => setNewPrice(f => ({ ...f, product_id: e.target.value }))}>
              <option value="">General (sin producto específico)</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className={inputCls} value={newPrice.price_type} onChange={e => setNewPrice(f => ({ ...f, price_type: e.target.value }))}>
              <option value="fixed">Precio fijo</option>
              <option value="range">Rango</option>
              <option value="custom">A medida / cotización</option>
            </select>
            <input className={inputCls} placeholder="Moneda (USD, MXN...)" value={newPrice.currency} onChange={e => setNewPrice(f => ({ ...f, currency: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input type="number" className={inputCls} placeholder="Monto" value={newPrice.price_amount} onChange={e => setNewPrice(f => ({ ...f, price_amount: e.target.value }))} />
            <input type="number" className={inputCls} placeholder="Mínimo (si es rango)" value={newPrice.price_min} onChange={e => setNewPrice(f => ({ ...f, price_min: e.target.value }))} />
            <input type="number" className={inputCls} placeholder="Máximo (si es rango)" value={newPrice.price_max} onChange={e => setNewPrice(f => ({ ...f, price_max: e.target.value }))} />
          </div>
          <input className={inputCls} placeholder="Periodo de facturación (mensual, anual, único)" value={newPrice.billing_period} onChange={e => setNewPrice(f => ({ ...f, billing_period: e.target.value }))} />
          <input className={inputCls} placeholder="Qué incluye" value={newPrice.includes} onChange={e => setNewPrice(f => ({ ...f, includes: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={newPrice.negotiable} onChange={e => setNewPrice(f => ({ ...f, negotiable: e.target.checked }))} />
            Es negociable
          </label>
          <div className="flex items-center gap-3">
            <button onClick={handleAddPrice} disabled={addingPrice} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
              {addingPrice ? 'Agregando...' : '+ Agregar precio'}
            </button>
            {priceError && <span className="text-xs text-red-600">{priceError}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Pain points, success stories, objections
// ─────────────────────────────────────────────────────────────────────────

function KnowledgeSection({
  initialPainPoints, initialSuccessStories, initialObjections,
}: {
  initialPainPoints: PainPoint[]
  initialSuccessStories: SuccessStory[]
  initialObjections: Objection[]
}) {
  return (
    <div className="space-y-6">
      <PainPointsCard initial={initialPainPoints} />
      <SuccessStoriesCard initial={initialSuccessStories} />
      <ObjectionsCard initial={initialObjections} />
    </div>
  )
}

function PainPointsCard({ initial }: { initial: PainPoint[] }) {
  const [items, setItems] = useState(initial)
  const [form, setForm] = useState({ pain: '', impact: '' })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    if (!form.pain.trim()) { setError('Describe el punto de dolor'); return }
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/settings/pain-points', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo agregar')
      setItems(i => [body.data, ...i])
      setForm({ pain: '', impact: '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    setItems(i => i.filter(x => x.id !== id))
    await fetch(`/api/settings/pain-points/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Pain points</h2>
      <p className="text-xs text-gray-400">Los dolores que tus clientes mencionan antes de comprar. Es lo que la IA usa para conectar con el prospecto.</p>
      {items.length === 0 && <p className="text-sm text-gray-400">Sin pain points todavía.</p>}
      <div className="divide-y divide-gray-100">
        {items.map(i => (
          <div key={i.id} className="py-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-900">{i.pain}</p>
              {i.impact && <p className="text-xs text-gray-500 mt-0.5">Impacto: {i.impact}</p>}
            </div>
            <button onClick={() => handleDelete(i.id)} className="text-xs text-red-500 hover:text-red-700 shrink-0">Eliminar</button>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <textarea rows={2} className={textareaCls} placeholder="ej. Pierden tiempo armando propuestas a mano" value={form.pain} onChange={e => setForm(f => ({ ...f, pain: e.target.value }))} />
        <input className={inputCls} placeholder="Impacto en el negocio (opcional)" value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value }))} />
        <div className="flex items-center gap-3">
          <button onClick={handleAdd} disabled={adding} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
            {adding ? 'Agregando...' : '+ Agregar pain point'}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  )
}

function SuccessStoriesCard({ initial }: { initial: SuccessStory[] }) {
  const [items, setItems] = useState(initial)
  const [form, setForm] = useState({ company_example: '', problem: '', solution: '', result: '', relevant_for_industry: '' })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    if (!form.result.trim()) { setError('Describe el resultado obtenido'); return }
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/settings/success-stories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo agregar')
      setItems(i => [body.data, ...i])
      setForm({ company_example: '', problem: '', solution: '', result: '', relevant_for_industry: '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    setItems(i => i.filter(x => x.id !== id))
    await fetch(`/api/settings/success-stories/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Casos de éxito</h2>
      <p className="text-xs text-gray-400">Ejemplos reales de clientes que resolviste — la IA los usa como prueba social en la propuesta.</p>
      {items.length === 0 && <p className="text-sm text-gray-400">Sin casos de éxito todavía.</p>}
      <div className="divide-y divide-gray-100">
        {items.map(i => (
          <div key={i.id} className="py-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{i.company_example || 'Cliente'}{i.relevant_for_industry ? ` · ${i.relevant_for_industry}` : ''}</p>
              {i.problem && <p className="text-xs text-gray-500 mt-0.5">Problema: {i.problem}</p>}
              {i.solution && <p className="text-xs text-gray-500">Solución: {i.solution}</p>}
              <p className="text-xs text-gray-700 mt-0.5">Resultado: {i.result}</p>
            </div>
            <button onClick={() => handleDelete(i.id)} className="text-xs text-red-500 hover:text-red-700 shrink-0">Eliminar</button>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input className={inputCls} placeholder="Empresa (puede ser anónimo, ej. 'agencia de marketing en CDMX')" value={form.company_example} onChange={e => setForm(f => ({ ...f, company_example: e.target.value }))} />
          <input className={inputCls} placeholder="Industria relevante" value={form.relevant_for_industry} onChange={e => setForm(f => ({ ...f, relevant_for_industry: e.target.value }))} />
        </div>
        <input className={inputCls} placeholder="Problema que tenían" value={form.problem} onChange={e => setForm(f => ({ ...f, problem: e.target.value }))} />
        <input className={inputCls} placeholder="Qué hiciste (solución)" value={form.solution} onChange={e => setForm(f => ({ ...f, solution: e.target.value }))} />
        <textarea rows={2} className={textareaCls} placeholder="Resultado (con números si es posible, ej. 'redujo 40% el tiempo de cierre')" value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))} />
        <div className="flex items-center gap-3">
          <button onClick={handleAdd} disabled={adding} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
            {adding ? 'Agregando...' : '+ Agregar caso de éxito'}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  )
}

function ObjectionsCard({ initial }: { initial: Objection[] }) {
  const [items, setItems] = useState(initial)
  const [form, setForm] = useState({ objection: '', response: '' })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    if (!form.objection.trim() || !form.response.trim()) { setError('Completa la objeción y la respuesta'); return }
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/settings/objections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo agregar')
      setItems(i => [body.data, ...i])
      setForm({ objection: '', response: '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    setItems(i => i.filter(x => x.id !== id))
    await fetch(`/api/settings/objections/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Objeciones frecuentes</h2>
      <p className="text-xs text-gray-400">Lo que dicen los prospectos para dudar, y cómo respondes — la IA las anticipa en la propuesta.</p>
      {items.length === 0 && <p className="text-sm text-gray-400">Sin objeciones todavía.</p>}
      <div className="divide-y divide-gray-100">
        {items.map(i => (
          <div key={i.id} className="py-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-900">&ldquo;{i.objection}&rdquo;</p>
              <p className="text-xs text-gray-500 mt-0.5">→ {i.response}</p>
            </div>
            <button onClick={() => handleDelete(i.id)} className="text-xs text-red-500 hover:text-red-700 shrink-0">Eliminar</button>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <input className={inputCls} placeholder="ej. 'Ya usamos plantillas'" value={form.objection} onChange={e => setForm(f => ({ ...f, objection: e.target.value }))} />
        <textarea rows={2} className={textareaCls} placeholder="Tu respuesta a esa objeción" value={form.response} onChange={e => setForm(f => ({ ...f, response: e.target.value }))} />
        <div className="flex items-center gap-3">
          <button onClick={handleAdd} disabled={adding} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
            {adding ? 'Agregando...' : '+ Agregar objeción'}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  )
}
