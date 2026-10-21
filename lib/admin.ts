// Tipos y reglas del panel de la plataforma (/admin). Todo se calcula en servidor.

export type Activity = 'active' | 'slow' | 'dormant' | 'new'

export const ACTIVITY_LABEL: Record<Activity, string> = {
  active: 'Activa',
  slow: 'Baja actividad',
  dormant: 'Dormida',
  new: 'Nueva',
}

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
}
