import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import ViewTracker from './ViewTracker'
import CommercialDocument from './CommercialDocument'
import IntroDocument from './IntroDocument'
import { logoLuminance } from '@/lib/logo'
import { groupOptions, sanitizeContent, type PriceItem } from '@/lib/commercial'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function PublicProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string; print?: string }>
}) {
  const { slug } = await params
  const { preview, print } = await searchParams
  const isPreview = preview === '1'
  const isPrint = print === '1'
  const supabase = await createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, client_id, email_html, proposal_text, prospect_title, product, pdf_url, status, prospect_name, prospect_company, opened_at, proposal_type, pricing_mode, commercial, valid_until, accepted_at, accepted_by_name, accepted_option, created_at, sent_at')
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
    supabase.from('brand_voice').select('primary_color, logo_base64, about_agency').eq('client_id', proposal.client_id).maybeSingle(),
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
    const expired = !!proposal.valid_until && Date.now() > new Date(`${proposal.valid_until}T23:59:59`).getTime()

    return (
      <>
        <ViewTracker slug={slug} disabled={isPreview || isPrint} />
        <CommercialDocument
          slug={slug}
          content={content}
          options={groupOptions(items)}
          mode={proposal.pricing_mode as string}
          color={brandColor}
          logo={logo}
          about={brand?.about_agency?.trim() || null}
          agencyName={agency?.company_name ?? ''}
          prospectName={proposal.prospect_name ?? ''}
          prospectCompany={proposal.prospect_company ?? ''}
          issuedAt={proposal.sent_at ?? proposal.created_at ?? null}
          validUntil={proposal.valid_until ?? null}
          bookingUrl={bookingUrl}
          preview={isPreview}
          canAccept={proposal.status === 'sent' && !isPreview}
          expired={expired}
          acceptedBy={proposal.accepted_by_name ?? null}
          acceptedAt={proposal.accepted_at ?? null}
          acceptedOption={proposal.accepted_option ?? null}
          logoLum={logo ? await logoLuminance(logo) : null}
          pdfHref={process.env.PDFSHIFT_API_KEY && !isPrint ? `/api/public/proposals/${slug}/pdf` : null}
        />
      </>
    )
  }

  if (proposal.proposal_text?.trim()) {
    return (
      <>
        <ViewTracker slug={slug} disabled={isPreview || isPrint} />
        <IntroDocument
          text={proposal.proposal_text}
          color={brandColor}
          logo={logo}
          logoLum={logo ? await logoLuminance(logo) : null}
          agencyName={agency?.company_name ?? ''}
          prospectName={proposal.prospect_name ?? ''}
          prospectTitle={proposal.prospect_title ?? ''}
          prospectCompany={proposal.prospect_company ?? ''}
          product={proposal.product ?? ''}
          issuedAt={proposal.sent_at ?? proposal.created_at ?? null}
          bookingUrl={bookingUrl}
          preview={isPreview}
          pdfHref={process.env.PDFSHIFT_API_KEY && !isPrint ? `/api/public/proposals/${slug}/pdf` : null}
        />
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
