// Tipos y reglas del panel del dueño (/admin). Todo se calcula en servidor.

export type Activity = 'active' | 'slow' | 'dormant' | 'new'

export const ACTIVITY_LABEL: Record<Activity, string> = {
  active: 'Activa',
  slow: 'Baja actividad',
  dormant: 'Dormida',
  new: 'Nueva',
}

// Estado comercial de una agencia. Se lleva a mano hasta que haya cobro automático.
export type AccountStage = 'pilot' | 'paying' | 'paused' | 'churned'
export const ACCOUNT_STAGES: AccountStage[] = ['pilot', 'paying', 'paused', 'churned']
export const STAGE_LABEL: Record<AccountStage, string> = {
  pilot: 'En piloto',
  paying: 'Pagando',
  paused: 'En pausa',
  churned: 'De baja',
}

export type Currency = 'MXN' | 'USD'

// Meta del piloto: cuántas agencias lo prueban, cuántas envían propuestas reales y cuántas aceptan pagar.
export const PILOT_GOAL = { trying: 5, sending: 3, paying: 2 } as const

// Costo aproximado por acción, en USD. Winflow todavía no registra tokens reales: son SUPUESTOS
// para dimensionar márgenes. Ajústalos aquí cuando tengas la factura real de Anthropic y PDFShift.
export const COST_ESTIMATE_USD = {
  introGeneration: 0.06,
  commercialGeneration: 0.12,
  pdf: 0.02,
} as const

export interface AdminUser {
  id: string
  role: string
  full_name: string
  email: string
  last_sign_in_at: string | null
}

export interface SetupCheck {
  key: string
  label: string
  done: boolean
}

export interface AgencyAccount {
  is_demo: boolean
  stage: AccountStage
  plan: string | null
  monthly_price: number | null
  currency: Currency
  pilot_started_at: string | null
  paying_since: string | null
  churned_at: string | null
  churn_reason: string | null
  notes: string | null
}

export const DEFAULT_ACCOUNT: AgencyAccount = {
  is_demo: false, stage: 'pilot', plan: null, monthly_price: null, currency: 'MXN',
  pilot_started_at: null, paying_since: null, churned_at: null, churn_reason: null, notes: null,
}

export interface AdminAgency {
  id: string
  company_name: string | null
  industry: string | null
  website: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  booking_url: string | null
  created_at: string
  users: AdminUser[]
  activity: Activity
  last_activity: string | null
  setup: SetupCheck[]
  account: AgencyAccount
  first_sent_at: string | null
  days_to_first_send: number | null
  stats: {
    total: number
    commercial: number
    sent: number
    sent30: number
    opened: number
    accepted: number
    won: number
    lost: number
    failed: number
    pipeline: Record<string, number>
    wonValue: Record<string, number>
    cost30: number
    costAll: number
    generations30: number
  }
}

export interface AttentionItem {
  agencyId: string
  agency: string
  kind: 'dormant' | 'invite' | 'setup' | 'failed'
  text: string
}

export type RequestStatus = 'new' | 'contacted' | 'accepted' | 'discarded'
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new: 'Nueva',
  contacted: 'Contactada',
  accepted: 'Aceptada',
  discarded: 'Descartada',
}

export interface PilotRequest {
  id: string
  created_at: string
  agency_name: string
  contact_name: string
  email: string
  website: string | null
  team_size: string | null
  call_tool: string | null
  message: string | null
  status: RequestStatus
  client_id: string | null
  owner_notes: string | null
}

export interface FixedCost {
  id: string
  name: string
  monthly_amount: number
  currency: Currency
}

export interface Business {
  counts: Record<AccountStage, number>   // sin agencias de ejemplo
  demo: number
  mrr: Record<string, number>
  newMrr30: Record<string, number>
  lostMrr30: Record<string, number>
  payingWithoutPrice: number
  churned90: number
  churnedList: { agency: string; churned_at: string | null; reason: string | null }[]
  goal: { trying: number; sending: number; paying: number }
  funnel: { requests: number; agencies: number; activated: number; paying: number }
  medianDaysToFirstSend: number | null
  variableCostUsd30: number
  demoCostUsd30: number
  fixedCosts: FixedCost[]
  usdMxn: number | null
  newRequests: number
}

export interface AdminData {
  agencies: AdminAgency[]
  attention: AttentionItem[]
  platform: {
    sentWeeks: number[]
    sent30: number
    sentPrev30: number
    wonValue: Record<string, number>
    pipeline: Record<string, number>
    openRate: number | null
    cost30: number
    generations30: number
    failed7: number
    stuck: number
  }
  business: Business
  requests: PilotRequest[]
}

// ── Dinero ──────────────────────────────────────────────────────────
export function money(n: number, cur: string): string {
  const abs = Math.abs(n)
  const digits = abs < 100 && abs % 1 !== 0 ? 2 : 0
  const num = abs.toLocaleString('es-MX', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const sign = n < 0 ? '−' : ''
  if (cur === 'USD') return `${sign}US$${num}`
  if (cur === 'MXN') return `${sign}$${num} MXN`
  return `${sign}${num} ${cur}`
}

export function moneyTotals(totals: Record<string, number>, empty = '$0 MXN'): string {
  const parts = Object.entries(totals).filter(([, v]) => v !== 0)
  return parts.length ? parts.map(([c, v]) => money(v, c)).join(' + ') : empty
}

// Suma todo en pesos. Devuelve null si hay dólares y falta el tipo de cambio.
export function toMxn(totals: Record<string, number>, usdMxn: number | null): number | null {
  let sum = 0
  for (const [cur, amt] of Object.entries(totals)) {
    if (!amt) continue
    if (cur === 'MXN') sum += amt
    else if (cur === 'USD' && usdMxn) sum += amt * usdMxn
    else return null
  }
  return Math.round(sum * 100) / 100
}
