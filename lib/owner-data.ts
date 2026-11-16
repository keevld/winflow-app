import type { createServiceClient } from '@/lib/supabase/server'
import { groupOptions, type PriceItem } from '@/lib/commercial'
import { addTotals, weeklyCounts } from '@/lib/dashboard'
import {
  COST_ESTIMATE_USD, DEFAULT_ACCOUNT,
  type AccountStage, type Activity, type AdminAgency, type AdminData, type AgencyAccount, type AttentionItem,
  type CostCurrency, type Currency, type FixedCost, type PilotRequest, type RequestStatus,
} from '@/lib/admin'

type Service = Awaited<ReturnType<typeof createServiceClient>>

const DAY = 24 * 60 * 60 * 1000

// Reúne todo lo que muestra el panel del dueño. Solo se llama después de getPlatformAdmin().
// Las agencias de ejemplo (is_demo) quedan fuera de las cifras de negocio y de uso, pero su costo sí cuenta.
export async function loadOwnerData(service: Service): Promise<AdminData> {
  const now = Date.now()

  const [
    { data: clients }, { data: profiles }, { data: proposals }, { data: items },
    { data: brands }, { data: products }, { data: pricing }, { data: stories }, { data: sales }, { data: objections },
    { data: accounts }, { data: costs }, { data: settings }, { data: requestRows },
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
    service.from('agency_accounts').select('*'),
    service.from('platform_costs').select('id, name, monthly_amount, currency').order('created_at', { ascending: true }),
    service.from('platform_settings').select('key, value'),
    service.from('pilot_requests').select('id, created_at, agency_name, contact_name, email, website, team_size, call_tool, message, status, client_id, owner_notes').order('created_at', { ascending: false }),
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
  const accountBy = new Map((accounts ?? []).map(a => [a.client_id as string, a]))

  const all = proposals ?? []
  const within = (iso: string | null, days: number, from = 0) => {
    if (!iso) return false
    const age = now - new Date(iso).getTime()
    return age >= from * DAY && age <= days * DAY
  }
  const cost = (ps: typeof all) =>
    ps.reduce((a, p) => {
      if (!p.generated_at) return a
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

    const raw = accountBy.get(c.id as string)
    const account: AgencyAccount = raw ? {
      is_demo: !!raw.is_demo,
      stage: raw.stage as AccountStage,
      plan: (raw.plan as string | null) ?? null,
      monthly_price: raw.monthly_price === null || raw.monthly_price === undefined ? null : Number(raw.monthly_price),
      currency: (raw.currency as Currency) ?? 'MXN',
      pilot_started_at: (raw.pilot_started_at as string | null) ?? null,
      paying_since: (raw.paying_since as string | null) ?? null,
      churned_at: (raw.churned_at as string | null) ?? null,
      churn_reason: (raw.churn_reason as string | null) ?? null,
      notes: (raw.notes as string | null) ?? null,
    } : { ...DEFAULT_ACCOUNT }

    const lastProposal = ps.map(p => p.sent_at ?? p.created_at as string).sort().pop() ?? null
    const lastLogin = users.map(u => u.last_sign_in_at).filter(Boolean).sort().pop() ?? null
    const last_activity = [lastProposal, lastLogin].filter(Boolean).sort().pop() ?? null

    const createdMs = new Date(c.created_at as string).getTime()
    const ageDays = (now - createdMs) / DAY
    let activity: Activity
    if (ps.some(p => within(p.created_at as string, 14))) activity = 'active'
    else if (ps.length === 0 && ageDays <= 14) activity = 'new'
    else if (ps.some(p => within(p.created_at as string, 30))) activity = 'slow'
    else activity = 'dormant'

    const first_sent_at = (sent.map(p => p.sent_at as string | null).filter(Boolean) as string[]).sort()[0] ?? null
    const days_to_first_send = first_sent_at ? Math.max(0, Math.round((new Date(first_sent_at).getTime() - createdMs) / DAY)) : null

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

    // Avisos de riesgo: solo para agencias reales que siguen con nosotros.
    const name = c.company_name || 'Agencia sin nombre'
    const watch = !account.is_demo && account.stage !== 'churned'
    if (watch) {
      if (activity === 'dormant' && ps.length > 0) attention.push({ agencyId: c.id as string, agency: name, kind: 'dormant', text: 'Sin propuestas en más de 30 días' })
      if (users.length > 0 && users.every(u => !u.last_sign_in_at)) attention.push({ agencyId: c.id as string, agency: name, kind: 'invite', text: 'Nadie ha entrado todavía: la invitación sigue sin usarse' })
      const done = setup.filter(s => s.done).length
      if (done < 5 && ageDays > 3) attention.push({ agencyId: c.id as string, agency: name, kind: 'setup', text: `Configuración incompleta (${done}/${setup.length}): falta ${setup.filter(s => !s.done).slice(0, 3).map(s => s.label.toLowerCase()).join(', ')}` })
    }
    const failed7 = ps.filter(p => p.status === 'failed' && within(p.created_at as string, 7)).length
    if (failed7 > 0) attention.push({ agencyId: c.id as string, agency: name, kind: 'failed', text: `${failed7} generación${failed7 === 1 ? '' : 'es'} fallida${failed7 === 1 ? '' : 's'} en la última semana` })

    return {
      ...(c as Omit<AdminAgency, 'users' | 'activity' | 'last_activity' | 'setup' | 'stats' | 'account' | 'first_sent_at' | 'days_to_first_send'>),
      users, activity, last_activity, setup, account, first_sent_at, days_to_first_send,
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

  // ── Uso del producto: solo agencias reales ──
  const real = agencies.filter(a => !a.account.is_demo)
  const realIds = new Set(real.map(a => a.id))
  const sentReal = all.filter(p => p.status === 'sent' && realIds.has(p.client_id as string))
  const platform: AdminData['platform'] = {
    sentWeeks: weeklyCounts(sentReal.map(p => p.sent_at as string | null), 8).map(w => w.count),
    sent30: sentReal.filter(p => within(p.sent_at as string | null, 30)).length,
    sentPrev30: sentReal.filter(p => within(p.sent_at as string | null, 60, 30)).length,
    wonValue: real.reduce((a, g) => addTotals(a, g.stats.wonValue), {} as Record<string, number>),
    pipeline: real.reduce((a, g) => addTotals(a, g.stats.pipeline), {} as Record<string, number>),
    openRate: sentReal.length ? Math.round((sentReal.filter(p => p.opened_at).length / sentReal.length) * 100) : null,
    cost30: agencies.reduce((a, g) => a + g.stats.cost30, 0),
    generations30: agencies.reduce((a, g) => a + g.stats.generations30, 0),
    failed7: all.filter(p => p.status === 'failed' && within(p.created_at as string, 7)).length,
    stuck: all.filter(p => p.status === 'generating' && p.generation_started_at && now - new Date(p.generation_started_at as string).getTime() > 10 * 60 * 1000).length,
  }

  // ── Negocio ──
  const counts: Record<AccountStage, number> = { pilot: 0, paying: 0, paused: 0, churned: 0 }
  let mrr: Record<string, number> = {}, newMrr30: Record<string, number> = {}, lostMrr30: Record<string, number> = {}
  let payingWithoutPrice = 0
  const dateWithin = (d: string | null, days: number) => !!d && within(`${d}T12:00:00Z`, days)
  for (const a of real) {
    const acc = a.account
    counts[acc.stage]++
    const price = acc.monthly_price ?? 0
    if (acc.stage === 'paying') {
      if (!acc.monthly_price) payingWithoutPrice++
      mrr = addTotals(mrr, { [acc.currency]: price })
      if (dateWithin(acc.paying_since, 30)) newMrr30 = addTotals(newMrr30, { [acc.currency]: price })
    }
    if (acc.stage === 'churned' && dateWithin(acc.churned_at, 30) && price) lostMrr30 = addTotals(lostMrr30, { [acc.currency]: price })
  }
  const churned = real.filter(a => a.account.stage === 'churned')
  const firstSendDays = real.map(a => a.days_to_first_send).filter((d): d is number => d !== null).sort((x, y) => x - y)
  const median = firstSendDays.length
    ? (firstSendDays.length % 2 ? firstSendDays[(firstSendDays.length - 1) / 2] : Math.round((firstSendDays[firstSendDays.length / 2 - 1] + firstSendDays[firstSendDays.length / 2]) / 2))
    : null

  const requests: PilotRequest[] = (requestRows ?? []).map(r => ({
    id: r.id as string,
    created_at: r.created_at as string,
    agency_name: r.agency_name as string,
    contact_name: r.contact_name as string,
    email: r.email as string,
    website: (r.website as string | null) ?? null,
    team_size: (r.team_size as string | null) ?? null,
    call_tool: (r.call_tool as string | null) ?? null,
    message: (r.message as string | null) ?? null,
    status: ((r.status as RequestStatus) ?? 'new'),
    client_id: (r.client_id as string | null) ?? null,
    owner_notes: (r.owner_notes as string | null) ?? null,
  }))

  const fixedCosts: FixedCost[] = (costs ?? []).map(c => ({
    id: c.id as string, name: c.name as string, monthly_amount: Number(c.monthly_amount), currency: c.currency as CostCurrency,
  }))
  const rate = (key: string) => {
    const row = (settings ?? []).find(s => s.key === key)
    const n = row ? Number(row.value) : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const activated = real.filter(a => a.stats.sent > 0).length

  const business: AdminData['business'] = {
    counts,
    demo: agencies.length - real.length,
    mrr, newMrr30, lostMrr30, payingWithoutPrice,
    churned90: churned.filter(a => dateWithin(a.account.churned_at, 90)).length,
    churnedList: churned.map(a => ({ agency: a.company_name || 'Agencia sin nombre', churned_at: a.account.churned_at, reason: a.account.churn_reason })),
    goal: { trying: real.length, sending: activated, paying: counts.paying },
    funnel: { requests: requests.filter(r => r.status !== 'discarded').length, agencies: real.length, activated, paying: counts.paying },
    medianDaysToFirstSend: median,
    variableCostUsd30: platform.cost30,
    demoCostUsd30: agencies.filter(a => a.account.is_demo).reduce((s, a) => s + a.stats.cost30, 0),
    fixedCosts,
    usdMxn: rate('usd_mxn'),
    eurMxn: rate('eur_mxn'),
    newRequests: requests.filter(r => r.status === 'new').length,
  }

  const order = { failed: 0, invite: 1, dormant: 2, setup: 3 } as const
  attention.sort((a, b) => order[a.kind] - order[b.kind])

  return { agencies, attention, platform, business, requests }
}
