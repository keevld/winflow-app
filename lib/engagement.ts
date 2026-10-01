import type { Proposal } from '@/lib/types'

export type EngagementTone = 'neutral' | 'info' | 'warning' | 'urgent'

export interface EngagementStatus {
  label: string
  tone: EngagementTone
}

const HOUR = 1000 * 60 * 60
const DAY = HOUR * 24

export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  const diffMs = Math.max(0, now - then)

  if (diffMs < HOUR) {
    const mins = Math.max(1, Math.round(diffMs / (1000 * 60)))
    return `hace ${mins} min`
  }
  if (diffMs < DAY) {
    const hours = Math.round(diffMs / HOUR)
    return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  }
  const days = Math.round(diffMs / DAY)
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`
}

// Simple time-based follow-up signal for the seller:
//  - sent & never opened after 48h  -> urgent
//  - sent & never opened, still fresh -> neutral "esperando apertura"
//  - opened but no further activity in 3+ days -> warning "sin respuesta"
//  - opened recently -> info "visto hace X"
// Not a replacement for a real won/lost signal — just enough to tell a
// seller which proposals are going cold without them checking manually.
export function getEngagementStatus(proposal: Proposal, now: number = Date.now()): EngagementStatus | null {
  if (proposal.status !== 'sent') return null

  if (!proposal.opened_at) {
    if (proposal.sent_at && now - new Date(proposal.sent_at).getTime() > 48 * HOUR) {
      return { label: 'Seguimiento urgente: no visto', tone: 'urgent' }
    }
    return { label: 'Enviada, esperando apertura', tone: 'neutral' }
  }

  const lastActivity = proposal.last_viewed_at ?? proposal.opened_at
  const idleFor = now - new Date(lastActivity).getTime()

  if (idleFor > 3 * DAY) {
    return { label: `Visto ${formatRelativeTime(lastActivity, now)} · sin respuesta`, tone: 'warning' }
  }

  const viewNote = proposal.view_count > 1 ? ` (${proposal.view_count}x)` : ''
  return { label: `Visto ${formatRelativeTime(lastActivity, now)}${viewNote}`, tone: 'info' }
}

export const ENGAGEMENT_TONE_CLASS: Record<EngagementTone, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  info: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-800',
}
