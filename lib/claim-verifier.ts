import type { SupabaseClient } from '@supabase/supabase-js'
import { callClaude, extractJson } from '@/lib/commercial-generate'
import { fetchSiteText, normalizePublicUrl } from '@/lib/agency-onboarding'

export interface VerificationChange { before: string; after: string; problem: string }
export interface VerificationReview { quote: string; problem: string }
export interface VerificationReport {
  status: 'ok' | 'fixed' | 'review'
  checked_at: string
  changes: VerificationChange[]
  review: VerificationReview[]
}

type Row = Record<string, unknown>

// Texto de respaldo sin ids ni fechas de registro, cuyos dígitos harían pasar cifras como 25 o 40.
const supportText = (v: unknown): string =>
  JSON.stringify(v, (k, val) => (k === 'id' || k.endsWith('_id') || k === 'created_at' || k === 'updated_at' ? undefined : val)).toLowerCase()

const digitsOf = (s: string): Set<string> =>
  new Set((s.match(/\d[\d.,]*\d|\d/g) ?? []).map(n => n.replace(/[.,]/g, '')))

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

// Cuenta señales de redacción rota (puntuación huérfana) para no aplicar arreglos que dejen el texto mal.
const brokenCount = (t: string): number =>
  (t.match(/(^|\n)\s*[,;.)]/g) ?? []).length + (t.match(/[,;]\s*(?:y|o|e|pero)?\s*\./g) ?? []).length +
  (t.match(/,\s*,/g) ?? []).length + (t.match(/\s[,.;](?=\s|$)/g) ?? []).length

const SYSTEM = `Eres un verificador de hechos para propuestas comerciales que una agencia enviará a un prospecto real. Tu único trabajo es encontrar afirmaciones FACTUALES que no estén respaldadas por las FUENTES que te doy, para que no se envíe nada inventado.

También cuentan las generalizaciones sobre cómo se comporta un mercado, una ciudad o un público (p. ej. "la gente en Guadalajara decide dónde comer en Instagram", "los restaurantes suelen…") cuando se presentan como hecho y no están en las fuentes.

Cuenta como afirmación factual verificable: cifras, porcentajes, estadísticas, montos, fechas, plazos, duraciones (p. ej. "llamada de 20 minutos"), garantías, resultados, nombres de clientes o casos, afirmaciones sobre el mercado o una ciudad, afirmaciones sobre la agencia (servicios, experiencia, equipo, condiciones) y afirmaciones sobre el prospecto (su situación, su historia, lo que ya intentó).

Lo respaldado es lo que aparece en las FUENTES: base de la agencia (servicios, precios, casos, objeciones, proceso, términos), datos y notas del prospecto, texto de su sitio web y datos de mercado con fuente. Una estadística externa solo es válida si la MISMA cifra aparece en los datos de mercado con fuente.

NO marques: argumentos persuasivos, opiniones razonables, conclusiones lógicas, transiciones, llamadas a la acción ni redacción comercial que no afirme un hecho concreto. Un caso de éxito de la agencia puede mencionarse si está en las fuentes y no se nombra al cliente. Sé preciso: es mejor marcar pocas cosas reales que muchas dudosas.

Para cada problema devuelve:
- "quote": una o varias ORACIONES COMPLETAS copiadas literalmente del texto, desde la primera palabra de la oración hasta su punto final (máx. 400 caracteres). Nunca un fragmento a mitad de oración. Debe aparecer tal cual.
- "problem": en una frase corta, qué no tiene respaldo.
- "fix": oración(es) completa(s) y bien puntuada(s) que REEMPLAZAN exactamente a "quote": mismo tono, sin la afirmación sin respaldo, sin añadir cifras, fechas ni hechos nuevos. Debe leerse natural entre las oraciones vecinas. Si la oración sobra sin ella, usa "".
- "severity": "invented" si es una cifra, estadística, plazo, fecha o hecho concreto sin respaldo; "weak" si es una afirmación general sin respaldo.

Responde SOLO un JSON: {"issues":[{"quote":"...","problem":"...","fix":"...","severity":"invented"}]}. Si no hay problemas: {"issues":[]}.`

async function loadSources(service: SupabaseClient, p: Row): Promise<{ support: string; prompt: string }> {
  const clientId = String(p.client_id)
  const [client, brand, products, pricing, pains, objections, stories, process] = await Promise.all([
    service.from('clients').select('company_name, industry, website, contact_name').eq('id', clientId).maybeSingle(),
    service.from('brand_voice').select('about_agency, competitive_differentiators, price_context, standard_terms, proposal_style_notes').eq('client_id', clientId).maybeSingle(),
    service.from('products').select('name, description, category').eq('client_id', clientId).eq('is_active', true),
    service.from('pricing').select('product_id, price_type, price_amount, price_min, price_max, currency, billing_period, includes, excludes, negotiable, notes').eq('client_id', clientId),
    service.from('pain_points').select('pain, impact').eq('client_id', clientId).limit(20),
    service.from('objections').select('objection, response').eq('client_id', clientId).limit(20),
    service.from('success_stories').select('problem, solution, result, relevant_for_industry').eq('client_id', clientId).limit(20),
    service.from('sales_process').select('avg_cycle_days, min_cycle_days, max_cycle_days, typical_steps, decision_makers, sends_quote, negotiation_notes, industry_notes').eq('client_id', clientId).maybeSingle(),
  ])
  const kb = {
    agencia: client.data, voz_y_condiciones: brand.data, servicios: products.data, precios: pricing.data,
    dolores_que_resuelve: pains.data, objeciones: objections.data, casos_de_exito: stories.data, proceso: process.data,
  }
  const prospect = {
    nombre: p.prospect_name, cargo: p.prospect_title, empresa: p.prospect_company, correo: p.prospect_email,
    sitio: p.prospect_website, industria: p.prospect_industry, tamano: p.prospect_company_size,
    notas_y_dolor: p.prospect_pain, servicio_propuesto: p.product,
  }
  let site = ''
  const url = normalizePublicUrl(p.prospect_website)
  if (url) {
    try { site = (await fetchSiteText(url)).slice(0, 12_000) } catch { site = '' }
  }
  const market = Array.isArray(p.market_sources) ? p.market_sources : []
  const support = supportText([kb, prospect, site, market])
  const prompt = [
    '=== BASE DE LA AGENCIA ===', JSON.stringify(kb),
    '=== DATOS Y NOTAS DEL PROSPECTO ===', JSON.stringify(prospect),
    '=== SITIO WEB DEL PROSPECTO ===', site || '(no disponible)',
    '=== DATOS DE MERCADO CON FUENTE ===', market.length ? JSON.stringify(market) : '(ninguno)',
  ].join('\n')
  return { support, prompt }
}

/** Revisa el texto de una propuesta inicial contra sus fuentes y reescribe lo que no tiene respaldo. */
export async function verifyIntro(
  service: SupabaseClient,
  proposal: Row,
): Promise<{ text: string; emailHtml: string | null; report: VerificationReport }> {
  const original = String(proposal.proposal_text ?? '')
  const email = typeof proposal.email_html === 'string' ? proposal.email_html : null
  const { support, prompt } = await loadSources(service, proposal)
  const supportDigits = digitsOf(support)

  const raw = extractJson(await callClaude(SYSTEM, `${prompt}\n\n=== TEXTO A VERIFICAR ===\n${original}`)) as { issues?: unknown }
  const issues = Array.isArray(raw.issues) ? (raw.issues as Row[]) : []

  let text = original
  let emailOut = email
  const changes: VerificationChange[] = []
  const review: VerificationReview[] = []

  for (const it of issues.slice(0, 25)) {
    const quote = typeof it.quote === 'string' ? it.quote : ''
    const problem = typeof it.problem === 'string' ? it.problem.slice(0, 300) : 'Sin respaldo en tus datos'
    const fix = typeof it.fix === 'string' ? it.fix : null
    if (!quote || quote.length < 6) continue
    if (!text.includes(quote)) { review.push({ quote: quote.slice(0, 240), problem }); continue }
    // El arreglo no puede traer cifras nuevas que tampoco tengan respaldo.
    const fixDigits = fix ? [...digitsOf(fix)].filter(d => !supportDigits.has(d) && !digitsOf(quote).has(d)) : []
    if (fix === null || fixDigits.length) { review.push({ quote: quote.slice(0, 240), problem }); continue }
    const candidate = text.replace(quote, fix).replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').replace(/\n{3,}/g, '\n\n')
    if (brokenCount(candidate) > brokenCount(text)) { review.push({ quote: quote.slice(0, 240), problem: `${problem} (no se pudo corregir sin romper la redacción; edítalo a mano)` }); continue }
    text = candidate
    if (emailOut && emailOut.includes(quote)) emailOut = emailOut.replace(quote, fix)
    changes.push({ before: quote.slice(0, 400), after: fix.slice(0, 400), problem })
  }

  // Revisión determinista final: cifras que siguen sin respaldo en el texto resultante.
  const leftover = new Set<string>()
  for (const line of text.split('\n')) {
    for (const m of line.matchAll(/\d[\d.,]*\d/g)) {
      if (!supportDigits.has(m[0].replace(/[.,]/g, ''))) leftover.add(norm(line).slice(0, 240))
    }
  }
  for (const q of leftover) {
    if (!review.some(r => r.quote === q)) review.push({ quote: q, problem: 'Contiene una cifra que no aparece en tus datos, notas ni fuentes.' })
  }

  const status: VerificationReport['status'] = review.length ? 'review' : changes.length ? 'fixed' : 'ok'
  return { text, emailHtml: emailOut, report: { status, checked_at: new Date().toISOString(), changes, review } }
}
