import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import ViewTracker from './ViewTracker'
import AcceptBox from './AcceptBox'
import PrintButton from './PrintButton'
import { groupOptions, itemTotal, formatMoney, formatTotals, sanitizeContent, type PriceItem } from '@/lib/commercial'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function PublicProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string }>
}) {
  const { slug } = await params
  const { preview } = await searchParams
  const isPreview = preview === '1'
  const supabase = await createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, client_id, email_html, proposal_text, pdf_url, status, prospect_name, prospect_company, opened_at, proposal_type, pricing_mode, commercial, valid_until, accepted_at, accepted_by_name')
    .eq('public_slug', slug)
    .single()

  if (!proposal) notFound()

  // Engagement (view count, time on page) is recorded client-side by
  // ViewTracker, which only fires once real browser JS runs — unlike a
  // server-side write on every GET, this avoids counting bots/link-preview
  // crawlers as "opens".

  let pdfSignedUrl: string | null = null
  if (proposal.pdf_url) {
    const { data: signed, error: signedUrlError } = await supabase.storage
      .from('proposals')
      .createSignedUrl(proposal.pdf_url, 60 * 10)
    if (!signedUrlError) pdfSignedUrl = signed.signedUrl
  }

  const [{ data: agency }, { data: brand }] = await Promise.all([
    supabase.from('clients').select('company_name, booking_url, calendly_url').eq('id', proposal.client_id).maybeSingle(),
    supabase.from('brand_voice').select('primary_color, logo_base64').eq('client_id', proposal.client_id).maybeSingle(),
  ])
  const HEX = /^#[0-9a-fA-F]{6}$/
  const LOGO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
  const brandColor = brand?.primary_color && HEX.test(brand.primary_color) ? brand.primary_color : '#111827'
  const logo = brand?.logo_base64 && LOGO.test(brand.logo_base64) ? brand.logo_base64 : null
  const bookingUrl = [agency?.booking_url, agency?.calendly_url].find(u => typeof u === 'string' && /^https?:\/\//i.test(u)) ?? null

  if (proposal.proposal_type === 'commercial') {
    const content = sanitizeContent(proposal.commercial)
    const { data: rows } = await supabase
      .from('proposal_price_items')
      .select('*')
      .eq('proposal_id', proposal.id)
      .order('position')
    const items: PriceItem[] = (rows ?? []).map(r => ({
      ...r,
      quantity: Number(r.quantity),
      unit_price: r.unit_price === null ? null : Number(r.unit_price),
      discount_pct: Number(r.discount_pct ?? 0),
    }))
    const options = groupOptions(items)
    const mode = proposal.pricing_mode as string
    const needsChoice = mode === 'packages' && options.length > 1
    const expired = !!proposal.valid_until && Date.now() > new Date(`${proposal.valid_until}T23:59:59`).getTime()
    const canAccept = proposal.status === 'sent' && !isPreview
    const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
      <section className="mt-8 break-inside-avoid">
        <h2 className="text-lg font-semibold mb-3" style={{ color: brandColor }}>{title}</h2>
        {children}
      </section>
    )
    const Bullets = ({ list }: { list: string[] }) => (
      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">{list.map((x, i) => <li key={i}>{x}</li>)}</ul>
    )
    const PriceTable = ({ its }: { its: PriceItem[] }) => (
      <table className="w-full text-sm">
        <tbody>
          {its.map((it, i) => {
            const t = itemTotal(it)
            return (
              <tr key={i} className="border-t border-gray-100">
                <td className="py-2 pr-3 text-gray-800">
                  {it.description}
                  {(it.quantity !== 1 || it.billing_period) && (
                    <span className="text-gray-400"> · {it.quantity !== 1 ? `${it.quantity} × ` : ''}{it.billing_period ?? ''}</span>
                  )}
                  {it.discount_pct > 0 && <span className="text-emerald-700"> (−{it.discount_pct}%)</span>}
                  {it.notes && <div className="text-xs text-gray-400">{it.notes}</div>}
                </td>
                <td className="py-2 text-right whitespace-nowrap text-gray-900">{t === null ? 'Por definir' : formatMoney(t, it.currency)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )

    return (
      <>
        <ViewTracker slug={slug} disabled={isPreview} />
        <div className="min-h-screen bg-gray-50 print:bg-white">
          <div className="h-1.5" style={{ backgroundColor: brandColor }} />
          {isPreview && (
            <div className="bg-amber-100 text-amber-900 text-xs text-center py-2 print:hidden">
              Vista previa — así la verá tu cliente. No se registran visitas ni se puede aceptar desde aquí.
            </div>
          )}
          <div className="max-w-3xl mx-auto px-4 py-10">
            <div className="flex flex-col items-center gap-3 mb-6">
              {logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logo} alt={agency?.company_name ?? 'Agencia'} className="h-12 max-w-[220px] object-contain" />
                : agency?.company_name && <span className="text-lg font-semibold" style={{ color: brandColor }}>{agency.company_name}</span>}
              <p className="text-xs text-gray-400 text-center">
                Propuesta comercial para {proposal.prospect_company || proposal.prospect_name}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 print:border-0 print:p-0">
              <h1 className="text-2xl font-bold text-gray-900">{content.title || `Propuesta para ${proposal.prospect_company}`}</h1>
              {content.summary && <p className="mt-3 text-sm text-gray-700 whitespace-pre-line">{content.summary}</p>}

              {content.situation && <Section title="Tu situación"><p className="text-sm text-gray-700 whitespace-pre-line">{content.situation}</p></Section>}
              {content.objectives.length > 0 && <Section title="Objetivos"><Bullets list={content.objectives} /></Section>}
              {content.solution.length > 0 && (
                <Section title="Nuestra propuesta">
                  <div className="space-y-4">
                    {content.solution.map((x, i) => (
                      <div key={i}>
                        <h3 className="text-sm font-semibold text-gray-900">{x.title}</h3>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{x.body}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              {content.deliverables.length > 0 && <Section title="Entregables"><Bullets list={content.deliverables} /></Section>}
              {content.timeline.length > 0 && (
                <Section title="Cronograma">
                  <div className="space-y-3">
                    {content.timeline.map((x, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium text-gray-900">{x.phase}</span>
                        {x.duration && <span className="text-gray-500"> · {x.duration}</span>}
                        {x.description && <p className="text-gray-700">{x.description}</p>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {options.length > 0 && (
                <Section title="Inversión">
                  {mode === 'packages' && options.length > 1 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {options.map(o => (
                        <div key={o.key} className="rounded-xl border p-4"
                          style={{ borderColor: o.recommended ? brandColor : '#e5e7eb', borderWidth: o.recommended ? 2 : 1 }}>
                          {o.recommended && <p className="text-xs font-medium mb-1" style={{ color: brandColor }}>Recomendada</p>}
                          <h3 className="font-semibold text-gray-900">{o.label}</h3>
                          <p className="text-xl font-bold text-gray-900 my-2">{formatTotals(o.totals)}</p>
                          <PriceTable its={o.items} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <PriceTable its={options.flatMap(o => o.items)} />
                      <p className="text-right text-base font-semibold text-gray-900 mt-3 border-t border-gray-200 pt-3">
                        Total: {formatTotals(options.reduce<Record<string, number>>((acc, o) => {
                          for (const [c, v] of Object.entries(o.totals)) acc[c] = Math.round(((acc[c] ?? 0) + v) * 100) / 100
                          return acc
                        }, {}))}
                      </p>
                    </div>
                  )}
                  {proposal.valid_until && (
                    <p className="text-xs text-gray-500 mt-3">
                      Vigente hasta el {new Date(`${proposal.valid_until}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.
                    </p>
                  )}
                </Section>
              )}

              {content.proof.length > 0 && (
                <Section title="Resultados con otros clientes">
                  <div className="space-y-3">
                    {content.proof.map((x, i) => (
                      <p key={i} className="text-sm text-gray-700"><span className="font-medium text-gray-900">{x.company}</span>{x.company ? ' — ' : ''}{x.result}</p>
                    ))}
                  </div>
                </Section>
              )}
              {content.faq.length > 0 && (
                <Section title="Preguntas frecuentes">
                  <div className="space-y-3">
                    {content.faq.map((x, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium text-gray-900">{x.q}</p>
                        <p className="text-sm text-gray-700">{x.a}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              {content.terms.length > 0 && <Section title="Condiciones"><Bullets list={content.terms} /></Section>}
              {content.next_steps.length > 0 && <Section title="Siguientes pasos"><Bullets list={content.next_steps} /></Section>}
            </div>

            <div className="mt-4 text-center"><PrintButton /></div>

            <div className="mt-6">
              {(canAccept || proposal.accepted_at) ? (
                <AcceptBox
                  slug={slug}
                  needsChoice={needsChoice}
                  options={options.map(o => ({ key: o.key, label: o.label, total: formatTotals(o.totals) }))}
                  color={brandColor}
                  expired={expired}
                  acceptedBy={proposal.accepted_by_name ?? null}
                  acceptedAt={proposal.accepted_at ?? null}
                />
              ) : null}
            </div>

            {bookingUrl && !proposal.accepted_at && (
              <div className="mt-8 text-center print:hidden">
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-block px-6 py-3 rounded-xl text-sm font-medium border"
                  style={{ borderColor: brandColor, color: brandColor }}>
                  ¿Dudas? Agenda una llamada
                </a>
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <ViewTracker slug={slug} />
      <div className="min-h-screen bg-gray-50">
        <div className="h-1.5" style={{ backgroundColor: brandColor }} />
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="flex flex-col items-center gap-3 mb-8">
            {logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logo} alt={agency?.company_name ?? 'Agencia'} className="h-12 max-w-[220px] object-contain" />
              : agency?.company_name && <span className="text-lg font-semibold" style={{ color: brandColor }}>{agency.company_name}</span>}
            <p className="text-xs text-gray-400 text-center">
              Propuesta para {proposal.prospect_company || proposal.prospect_name}
            </p>
          </div>

          {pdfSignedUrl && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <iframe src={pdfSignedUrl} className="w-full h-[800px]" title="Propuesta" />
            </div>
          )}

          {!pdfSignedUrl && proposal.email_html && (
            <iframe title="Vista previa de propuesta" sandbox="" srcDoc={proposal.email_html}
              className="w-full min-h-[700px] rounded-xl border border-gray-200 bg-white" />
          )}

          {bookingUrl && (
            <div className="mt-8 text-center">
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-block px-6 py-3 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: brandColor }}>
                Agendar una llamada
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
