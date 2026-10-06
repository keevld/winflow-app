// Tipos y utilidades puras de la propuesta comercial (sirven en servidor y cliente).

export type PricingMode = 'packages' | 'single' | 'lines'

export interface CommercialContent {
  title: string
  summary: string
  situation: string
  objectives: string[]
  solution: { title: string; body: string }[]
  deliverables: string[]
  timeline: { phase: string; duration: string; description: string }[]
  proof: { company: string; result: string }[]
  faq: { q: string; a: string }[]
  terms: string[]
  next_steps: string[]
}

export interface PriceItem {
  id?: string
  option_key: string
  option_label: string | null
  is_recommended: boolean
  position: number
  product_id: string | null
  pricing_id: string | null
  description: string
  quantity: number
  unit_price: number | null
  currency: string
  billing_period: string | null
  discount_pct: number
  notes: string | null
}

export interface PriceOption {
  key: string
  label: string
  recommended: boolean
  items: PriceItem[]
  totals: Record<string, number> // por moneda
  hasMissingPrice: boolean
}

export const EMPTY_CONTENT: CommercialContent = {
  title: '',
  summary: '',
  situation: '',
  objectives: [],
  solution: [],
  deliverables: [],
  timeline: [],
  proof: [],
  faq: [],
  terms: [],
  next_steps: [],
}

export function itemTotal(i: Pick<PriceItem, 'quantity' | 'unit_price' | 'discount_pct'>): number | null {
  if (i.unit_price === null || i.unit_price === undefined) return null
  return Math.round(i.unit_price * i.quantity * (1 - (i.discount_pct || 0) / 100) * 100) / 100
}

export function groupOptions(items: PriceItem[]): PriceOption[] {
  const order: string[] = []
  const map = new Map<string, PriceItem[]>()
  for (const it of [...items].sort((a, b) => a.position - b.position)) {
    if (!map.has(it.option_key)) { map.set(it.option_key, []); order.push(it.option_key) }
    map.get(it.option_key)!.push(it)
  }
  return order.map(key => {
    const its = map.get(key)!
    const totals: Record<string, number> = {}
    let missing = false
    for (const it of its) {
      const t = itemTotal(it)
      if (t === null) { missing = true; continue }
      totals[it.currency] = Math.round(((totals[it.currency] ?? 0) + t) * 100) / 100
    }
    return {
      key,
      label: its[0].option_label || 'Inversión',
      recommended: its.some(i => i.is_recommended),
      items: its,
      totals,
      hasMissingPrice: missing,
    }
  })
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${amount.toLocaleString('es-MX')} ${currency}`
  }
}

export function formatTotals(totals: Record<string, number>): string {
  const parts = Object.entries(totals).map(([cur, amt]) => formatMoney(amt, cur))
  return parts.length ? parts.join(' + ') : 'Por definir'
}

const str = (v: unknown, max = 4000): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

const strList = (v: unknown, maxItems = 12, max = 500): string[] =>
  Array.isArray(v) ? v.map(x => str(x, max)).filter(Boolean).slice(0, maxItems) : []

// Convierte cualquier JSON (de la IA o del editor) en un contenido válido y acotado.
export function sanitizeContent(raw: unknown): CommercialContent {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const arr = (v: unknown) => (Array.isArray(v) ? v : [])
  return {
    title: str(r.title, 200),
    summary: str(r.summary, 3000),
    situation: str(r.situation, 3000),
    objectives: strList(r.objectives),
    solution: arr(r.solution).slice(0, 8).map(x => {
      const o = (x ?? {}) as Record<string, unknown>
      return { title: str(o.title, 200), body: str(o.body, 2000) }
    }).filter(x => x.title || x.body),
    deliverables: strList(r.deliverables, 20),
    timeline: arr(r.timeline).slice(0, 10).map(x => {
      const o = (x ?? {}) as Record<string, unknown>
      return { phase: str(o.phase, 200), duration: str(o.duration, 100), description: str(o.description, 1000) }
    }).filter(x => x.phase),
    proof: arr(r.proof).slice(0, 4).map(x => {
      const o = (x ?? {}) as Record<string, unknown>
      return { company: str(o.company, 200), result: str(o.result, 1000) }
    }).filter(x => x.result),
    faq: arr(r.faq).slice(0, 8).map(x => {
      const o = (x ?? {}) as Record<string, unknown>
      return { q: str(o.q, 500), a: str(o.a, 1500) }
    }).filter(x => x.q && x.a),
    terms: strList(r.terms, 12, 600),
    next_steps: strList(r.next_steps, 8, 400),
  }
}

// Valida partidas de precio enviadas desde el editor.
export function sanitizeItems(raw: unknown): PriceItem[] {
  if (!Array.isArray(raw)) return []
  const out: PriceItem[] = []
  raw.slice(0, 60).forEach((x, idx) => {
    const o = (x ?? {}) as Record<string, unknown>
    const description = str(o.description, 400)
    if (!description) return
    const num = (v: unknown, def: number | null): number | null => {
      if (v === null || v === undefined || v === '') return def
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) ? n : def
    }
    const qty = num(o.quantity, 1)
    const price = num(o.unit_price, null)
    const disc = num(o.discount_pct, 0)
    const currency = typeof o.currency === 'string' && /^[A-Za-z]{3}$/.test(o.currency) ? o.currency.toUpperCase() : 'USD'
    const idOrNull = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null)
    out.push({
      option_key: str(o.option_key, 40) || 'main',
      option_label: str(o.option_label, 80) || null,
      is_recommended: o.is_recommended === true,
      position: idx,
      product_id: idOrNull(o.product_id),
      pricing_id: idOrNull(o.pricing_id),
      description,
      quantity: qty !== null && qty > 0 ? qty : 1,
      unit_price: price !== null && price >= 0 ? price : null,
      currency,
      billing_period: str(o.billing_period, 60) || null,
      discount_pct: disc !== null && disc >= 0 && disc <= 100 ? disc : 0,
      notes: str(o.notes, 500) || null,
    })
  })
  return out
}
