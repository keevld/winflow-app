import type { EngagementTone } from '@/lib/engagement'

export type Stage = 'prep' | 'sent' | 'viewed' | 'won' | 'lost'

export const STAGE_LABEL: Record<Stage, string> = {
  prep: 'En preparación',
  sent: 'Enviadas',
  viewed: 'Vistas',
  won: 'Ganadas',
  lost: 'Perdidas',
}

export interface DashRow {
  id: string
  contact_id: string | null
  company: string
  name: string
  product: string
  type: 'intro' | 'commercial'
  stage: Stage
  accepted: boolean
  sent_at: string | null
  closed_at: string | null
  last_activity: string | null
  view_count: number
  valid_until: string | null
  created_at: string
  value: Record<string, number>
  engagement: { label: string; tone: EngagementTone } | null
}

export function stageOf(p: {
  status: string
  outcome: string | null
  accepted_at: string | null
  opened_at: string | null
}): Stage {
  if (p.outcome === 'won' || p.accepted_at) return 'won'
  if (p.outcome === 'lost') return 'lost'
  if (p.status === 'sent') return p.opened_at ? 'viewed' : 'sent'
  return 'prep'
}

export function daysUntil(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null
  const t = new Date(iso + (iso.length <= 10 ? 'T23:59:59' : '')).getTime()
  if (Number.isNaN(t)) return null
  return Math.ceil((t - now) / (1000 * 60 * 60 * 24))
}

export function addTotals(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a }
  for (const [cur, amt] of Object.entries(b)) out[cur] = Math.round(((out[cur] ?? 0) + amt) * 100) / 100
  return out
}

// Monto compacto para tarjetas grandes: "$136 mil", "$1.2 M".
export function formatCompactTotals(totals: Record<string, number>): string {
  const parts = Object.entries(totals).map(([cur, amt]) => {
    try {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 1 }).format(amt)
    } catch {
      return `${Math.round(amt).toLocaleString('es-MX')} ${cur}`
    }
  })
  return parts.join(' + ')
}

// Lunes de la semana de una fecha (hora local), como milisegundos.
export function weekStart(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  return x.getTime()
}

// Conteo por semana de las últimas n semanas (la última es la semana actual).
export function weeklyCounts(dates: (string | null)[], n: number, now: Date = new Date()): { start: number; count: number }[] {
  const WEEK = 7 * 24 * 60 * 60 * 1000
  const thisWeek = weekStart(now)
  const buckets = Array.from({ length: n }, (_, i) => ({ start: thisWeek - (n - 1 - i) * WEEK, count: 0 }))
  for (const iso of dates) {
    if (!iso) continue
    const t = weekStart(new Date(iso))
    const b = buckets.find(x => Math.abs(x.start - t) < 12 * 60 * 60 * 1000)
    if (b) b.count++
  }
  return buckets
}
