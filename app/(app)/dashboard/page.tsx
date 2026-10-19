import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Proposal } from '@/lib/types'
import { getEngagementStatus } from '@/lib/engagement'
import { groupOptions, type PriceItem } from '@/lib/commercial'
import { stageOf, type DashRow } from '@/lib/dashboard'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('proposals')
    .select('*')
    .order('created_at', { ascending: false })
  const list = (data ?? []) as (Proposal & { contact_id?: string | null })[]

  // Montos: solo propuestas comerciales (tienen partidas de precio).
  const itemsByProposal = new Map<string, PriceItem[]>()
  const commercialIds = list.filter(p => p.proposal_type === 'commercial').map(p => p.id)
  if (commercialIds.length > 0) {
    const service = await createServiceClient()
    const { data: items } = await service
      .from('proposal_price_items')
      .select('*')
      .in('proposal_id', commercialIds)
    for (const it of (items ?? []) as (PriceItem & { proposal_id: string })[]) {
      const arr = itemsByProposal.get(it.proposal_id) ?? []
      arr.push(it)
      itemsByProposal.set(it.proposal_id, arr)
    }
  }

  const rows: DashRow[] = list.map(p => {
    const options = groupOptions(itemsByProposal.get(p.id) ?? [])
    const chosen = options.find(o => o.key === p.accepted_option) ?? options.find(o => o.recommended) ?? options[0]
    const stage = stageOf(p)
    return {
      id: p.id,
      contact_id: p.contact_id ?? null,
      company: p.prospect_company || 'Sin empresa',
      name: p.prospect_name || '',
      product: p.product || '',
      type: p.proposal_type,
      stage,
      accepted: !!p.accepted_at,
      sent_at: p.sent_at,
      last_activity: p.last_viewed_at ?? p.opened_at ?? p.sent_at ?? p.created_at,
      view_count: p.view_count ?? 0,
      valid_until: p.valid_until,
      created_at: p.created_at,
      value: chosen && !chosen.hasMissingPrice ? chosen.totals : {},
      engagement: stage === 'won' || stage === 'lost' ? null : getEngagementStatus(p),
    }
  })

  return <DashboardClient rows={rows} />
}
