import { notFound } from 'next/navigation'
import { getPlatformAdmin } from '@/lib/platform-admin'
import { groupOptions, type PriceItem } from '@/lib/commercial'
import { addTotals, weeklyCounts } from '@/lib/dashboard'
import { COST_ESTIMATE_USD, type AdminAgency, type AdminData, type Activity, type AttentionItem } from '@/lib/admin'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

export default async function AdminPage() {
  const admin = await getPlatformAdmin()
  if (!admin) notFound()
  const { service } = admin
  const now = Date.now()

  const [
    { data: clients }, { data: profiles }, { data: proposals }, { data: items },
    { data: brands }, { data: products }, { data: pricing }, { data: stories }, { data: sales }, { data: objections },
    authList,
  ] = await Promise.all([
    service.from('clients').select('id, company_name, industry, website, contact_name, contact_email, contact_phone, booking_url, created_at').order('created_at', { ascending: false }),
    service.from('profiles').select('id, client_id, role, full_name'),
    service.from('proposals').select('id, client_id, status, proposal_type, outcome, opened_at, sent_at, created_at, accepted_at, accepted_option, generated_at, generation_started_at, outcome_at'),
    service.from('proposal_price_items').select('*'),
    service.from('brand_voice').select('client_id, primary_color, logo_base64, about_agency'),
    service.from('products').select('client_id'),
    service.from('pricing').select('client_id'),
    service.from('success_stories').select('client_id'),
    service.from('sales_process').select('client_id'),
    service.from('objections').select('client_id'),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const authById = new Map((authList.data?.users ?? []).map(u => [u.id, u]))
  const itemsByProposal = new Map<string, PriceItem[]>()
  for (const it of (items ?? []) as (PriceItem & { proposal_id: string })[]) {
    const arr = itemsByProposal.get(it.proposal_id) ?? []
    arr.push({ ...it, quantity: Number(it.quantity), unit_price: it.unit_price === null ? null : Number(it.unit_price), discount_pct: Number(it.discount_pct ?? 0) })
    itemsByProposal.set(it.proposal_id, arr)
  }
  const countBy = (rows: { client_id: string }[] | null) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) m.set(r.client_id, (m.get(r.client_id) ?? 0) + 1)
    return m
  }
  const nProducts = countBy(products), nPricing = countBy(pricing), nStories = countBy(stories)
  const nObjections = countBy(objections), nSales = countBy(sales)
  const brandBy = new Map((brands ?? []).map(b => [b.client_id as string, b]))

  const all = proposals ?? []
  const within = (iso: string | null, days: number, from = 0) => {
    if (!iso) return false
    const age = now - new Date(iso).getTime()
    return age >= from * DAY && age <= days * DAY
  }
  const isGeneration = (p: { generated_at: string | null }) => !!p.generated_at
  const cost = (ps: typeof all) =>
    ps.reduce((a, p) => {
      if (!isGeneration(p)) return a
      const gen = p.proposal_type === 'commercial' ? COST_ESTIMATE_USD.commercialGeneration : COST_ESTIMATE_USD.introGeneration
      return a + gen + (p.status === 'sent' ? COST_ESTIMATE_USD.pdf : 0)
    }, 0)

  const attention: AttentionItem[] = []

  const agencies: AdminAgency[] = (clients ?? []).map(c => {
    const ps = all.filter(p => p.client_id === c.id)
    const sent = ps.filter(p => p.status === 'sent')
    const users = (profiles ?? []).filter(u => u.client_id === c.id).map(u => {
      const au = authById.get(u.id as string)
      return {
        id: u.id as string,
        role: u.role as string,
        full_name: (u.full_name as string | null) ?? '',
        email: au?.email ?? '',
        last_sign_in_at: au?.last_sign_in_at ?? null,
      }
    })

    const lastProposal = ps.map(p => p.sent_at ?? p.created_at as string).sort().pop() ?? null
    const lastLogin = users.map(u => u.last_sign_in_at).filter(Boolean).sort().pop() ?? null
    const last_activity = [lastProposal, lastLogin].filter(Boolean).sort().pop() ?? null

    const ageDays = (now - new Date(c.created_at as string).getTime()) / DAY
    let activity: Activity
    if (ps.some(p => within(p.created_at as string, 14))) activity = 'active'
    else if (ps.length === 0 && ageDays <= 14) activity = 'new'
    else if (ps.some(p => within(p.created_at as string, 30))) activity = 'slow'
    else activity = 'dormant'

    const brand = brandBy.get(c.id as string)
    const setup = [
      { key: 'brand', label: 'Logo y color de marca', done: !!(brand?.logo_base64 && brand?.primary_color) },
      { key: 'about', label: 'Texto "Sobre la agencia"', done: !!brand?.about_agency?.trim() },
      { key: 'products', label: 'Productos', done: (nProducts.get(c.id as string) ?? 0) > 0 },
      { key: 'pricing', label: 'Precios', done: (nPricing.get(c.id as string) ?? 0) > 0 },
      { key: 'stories', label: 'Casos de éxito', done: (nStories.get(c.id as string) ?? 0) > 0 },
      { key: 'objections', label: 'Objeciones', done: (nObjections.get(c.id as string) ?? 0) > 0 },
      { key: 'sales', label: 'Proceso de ventas', done: (nSales.get(c.id as string) ?? 0) > 0 },
      { key: 'booking', label: 'Link de agenda', done: !!c.booking_url },
    ]

    let pipeline: Record<string, number> = {}
    let wonValue: Record<string, number> = {}
    for (const p of ps.filter(x => x.proposal_type === 'commercial')) {
      const opts = groupOptions(itemsByProposal.get(p.id as string) ?? [])
      const chosen = opts.find(o => o.key === p.accepted_option) ?? opts.find(o => o.recommended) ?? opts[0]
      if (!chosen || chosen.hasMissingPrice) continue
      const won = p.outcome === 'won' || !!p.accepted_at
      if (won) wonValue = addTotals(wonValue, chosen.totals)
      else if (p.status === 'sent' && p.outcome !== 'lost') pipeline = addTotals(pipeline, chosen.totals)
    }

    const name = c.company_name || 'Agencia sin nombre'
    if (activity === 'dormant' && ps.length > 0) attention.push({ agencyId: c.id as string, agency: name, kind: 'dormant', text: 'Sin propuestas en más de 30 días' })
    if (users.length > 0 && users.every(u => !u.last_sign_in_at)) attention.push({ agencyId: c.id as string, agency: name, kind: 'invite', text: 'Nadie ha entrado todavía: la invitación sigue sin usarse' })
    const done = setup.filter(s => s.done).length
    if (done < 5 && ageDays > 3) attention.push({ agencyId: c.id as string, agency: name, kind: 'setup', text: `Configuración incompleta (${done}/${setup.length}): falta ${setup.filter(s => !s.done).slice(0, 3).map(s => s.label.toLowerCase()).join(', ')}` })
    const failed7 = ps.filter(p => p.status === 'failed' && within(p.created_at as string, 7)).length
    if (failed7 > 0) attention.push({ agencyId: c.id as string, agency: name, kind: 'failed', text: `${failed7} generación${failed7 === 1 ? '' : 'es'} fallida${failed7 === 1 ? '' : 's'} en la última semana` })

    return {
      ...(c as Omit<AdminAgency, 'users' | 'activity' | 'last_activity' | 'setup' | 'stats'>),
      users, activity, last_activity, setup,
      stats: {
        total: ps.length,
        commercial: ps.filter(p => p.proposal_type === 'commercial').length,
        sent: sent.length,
        sent30: sent.filter(p => within(p.sent_at as string | null, 30)).length,
        opened: sent.filter(p => p.opened_at).length,
        accepted: ps.filter(p => p.accepted_at).length,
        won: ps.filter(p => p.outcome === 'won' || p.accepted_at).length,
        lost: ps.filter(p => p.outcome === 'lost').length,
        failed: ps.filter(p => p.status === 'failed').length,
        pipeline, wonValue,
        cost30: cost(ps.filter(p => within(p.generated_at as string | null, 30))),
        costAll: cost(ps),
        generations30: ps.filter(p => within(p.generated_at as string | null, 30)).length,
      },
    }
  })

  const sentAll = all.filter(p => p.status === 'sent')
  const platform: AdminData['platform'] = {
    sentWeeks: weeklyCounts(sentAll.map(p => p.sent_at as string | null), 8).map(w => w.count),
    sent30: sentAll.filter(p => within(p.sent_at as string | null, 30)).length,
    sentPrev30: sentAll.filter(p => within(p.sent_at as string | null, 60, 30)).length,
    wonValue: agencies.reduce((a, g) => addTotals(a, g.stats.wonValue), {} as Record<string, number>),
    pipeline: agencies.reduce((a, g) => addTotals(a, g.stats.pipeline), {} as Record<string, number>),
    openRate: sentAll.length ? Math.round((sentAll.filter(p => p.opened_at).length / sentAll.length) * 100) : null,
    cost30: agencies.reduce((a, g) => a + g.stats.cost30, 0),
    generations30: agencies.reduce((a, g) => a + g.stats.generations30, 0),
    failed7: all.filter(p => p.status === 'failed' && within(p.created_at as string, 7)).length,
    stuck: all.filter(p => p.status === 'generating' && p.generation_started_at && now - new Date(p.generation_started_at as string).getTime() > 10 * 60 * 1000).length,
  }

  const order = { failed: 0, invite: 1, dormant: 2, setup: 3 } as const
  attention.sort((a, b) => order[a.kind] - order[b.kind])

  return <AdminClient data={{ agencies, attention, platform }} />
}
