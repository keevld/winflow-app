import { notFound } from 'next/navigation'
import { getPlatformAdmin } from '@/lib/platform-admin'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const admin = await getPlatformAdmin()
  if (!admin) notFound()
  const { service } = admin

  const [{ data: clients }, { data: profiles }, { data: proposals }] = await Promise.all([
    service.from('clients').select('id, company_name, industry, website, contact_name, contact_email, contact_phone, booking_url, created_at').order('created_at', { ascending: false }),
    service.from('profiles').select('id, client_id, role, full_name'),
    service.from('proposals').select('client_id, status, proposal_type, outcome, opened_at, sent_at, created_at, accepted_at'),
  ])

  const agencies = (clients ?? []).map(c => {
    const ps = (proposals ?? []).filter(p => p.client_id === c.id)
    const sent = ps.filter(p => p.status === 'sent')
    const last = ps.map(p => p.created_at as string).sort().pop() ?? null
    return {
      ...c,
      users: (profiles ?? []).filter(u => u.client_id === c.id).map(u => ({ id: u.id, role: u.role as string, full_name: (u.full_name as string | null) ?? '' })),
      stats: {
        total: ps.length,
        commercial: ps.filter(p => p.proposal_type === 'commercial').length,
        sent: sent.length,
        opened: sent.filter(p => p.opened_at).length,
        won: ps.filter(p => p.outcome === 'won').length,
        lost: ps.filter(p => p.outcome === 'lost').length,
        accepted: ps.filter(p => p.accepted_at).length,
        last,
      },
    }
  })

  return <AdminClient agencies={agencies} />
}
