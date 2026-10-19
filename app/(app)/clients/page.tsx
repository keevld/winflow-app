import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Contact, Proposal } from '@/lib/types'
import { stageOf } from '@/lib/dashboard'
import ClientsClient, { type ClientRow } from './ClientsClient'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id')
    .eq('id', user.id)
    .single()
  if (!profile?.client_id) redirect('/dashboard')

  const service = await createServiceClient()
  const [{ data: contacts }, { data: notes }, { data: proposals }] = await Promise.all([
    service.from('contacts').select('*').eq('client_id', profile.client_id).order('updated_at', { ascending: false }),
    service.from('contact_notes').select('contact_id').eq('client_id', profile.client_id),
    // Con la sesión del usuario: un vendedor solo cuenta sus propias propuestas.
    supabase.from('proposals').select('id, contact_id, status, outcome, accepted_at, opened_at, last_viewed_at, sent_at, created_at'),
  ])

  const noteCount = new Map<string, number>()
  for (const n of (notes ?? []) as { contact_id: string }[]) {
    noteCount.set(n.contact_id, (noteCount.get(n.contact_id) ?? 0) + 1)
  }

  type P = Pick<Proposal, 'id' | 'status' | 'outcome' | 'accepted_at' | 'opened_at' | 'last_viewed_at' | 'sent_at' | 'created_at'> & { contact_id: string | null }
  const byContact = new Map<string, P[]>()
  for (const p of (proposals ?? []) as P[]) {
    if (!p.contact_id) continue
    const arr = byContact.get(p.contact_id) ?? []
    arr.push(p)
    byContact.set(p.contact_id, arr)
  }

  const rows: ClientRow[] = ((contacts ?? []) as Contact[]).map(c => {
    const ps = byContact.get(c.id) ?? []
    const stages = ps.map(p => stageOf(p))
    const last = ps
      .map(p => p.last_viewed_at ?? p.opened_at ?? p.sent_at ?? p.created_at)
      .sort()
      .pop() ?? c.updated_at
    return {
      id: c.id,
      name: c.name ?? '',
      company: c.company ?? '',
      title: c.title ?? '',
      email: c.email ?? '',
      industry: c.industry ?? '',
      isClient: stages.includes('won'),
      openProposals: stages.filter(s => s === 'sent' || s === 'viewed').length,
      proposals: ps.length,
      notes: noteCount.get(c.id) ?? 0,
      lastActivity: last,
    }
  })

  return <ClientsClient rows={rows} />
}
