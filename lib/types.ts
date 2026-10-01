export type Role = 'admin' | 'seller'
export type ProposalStatus = 'draft' | 'generating' | 'ready' | 'sending' | 'sent' | 'failed'

export interface Profile {
  id: string
  client_id: string | null
  role: Role
  full_name: string | null
  created_at: string
}

export interface Proposal {
  id: string
  client_id: string
  created_by: string
  prospect_name: string | null
  prospect_title: string | null
  prospect_company: string | null
  prospect_email: string | null
  prospect_website: string | null
  prospect_industry: string | null
  prospect_company_size: string | null
  prospect_pain: string | null
  product: string | null
  proposal_text: string | null
  email_html: string | null
  pdf_url: string | null
  status: ProposalStatus
  public_slug: string | null
  opened_at: string | null
  view_count: number
  last_viewed_at: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export type ProposalEventType = 'view' | 'time_spent'

export interface ProposalEvent {
  id: string
  proposal_id: string
  client_id: string
  actor_id: string | null
  event_type: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface Product {
  id: string
  client_id: string
  name: string
  description: string | null
  category: string | null
  is_active: boolean
}

export interface Client {
  id: string
  company_name: string
  industry: string | null
  website: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  booking_url: string | null
  calendly_url: string | null
}

export interface BrandVoice {
  id: string
  client_id: string
  tone: string | null
  language_style: string | null
  avoid_words: string | null
  example_phrase: string | null
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
  extra_colors: unknown
  logo_url: string | null
  logo_base64: string | null
  competitive_differentiators: string | null
  price_context: string | null
  proposal_style_notes: string | null
  proposal_example_url: string | null
}

export interface SalesProcess {
  id: string
  client_id: string
  avg_cycle_days: number | null
  min_cycle_days: number | null
  max_cycle_days: number | null
  typical_steps: string | null
  decision_makers: string | null
  sends_quote: boolean | null
  expects_negotiation: boolean | null
  negotiation_notes: string | null
  followup_pace: string | null
  followup_day1: number | null
  followup_day2: number | null
  followup_day3: number | null
  followup_max_attempts: number | null
  followup_notes: string | null
  industry_decision_pace: string | null
  industry_notes: string | null
}

export interface Pricing {
  id: string
  client_id: string
  product_id: string | null
  price_type: string
  price_amount: number | null
  price_min: number | null
  price_max: number | null
  currency: string | null
  billing_period: string | null
  includes: string | null
  excludes: string | null
  negotiable: boolean | null
  notes: string | null
}

export interface PainPoint {
  id: string
  client_id: string
  pain: string
  impact: string | null
  persona_id: string | null
}

export interface SuccessStory {
  id: string
  client_id: string
  company_example: string | null
  problem: string | null
  solution: string | null
  result: string | null
  relevant_for_industry: string | null
}

export interface Objection {
  id: string
  client_id: string
  objection: string
  response: string
}
