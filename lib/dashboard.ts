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
