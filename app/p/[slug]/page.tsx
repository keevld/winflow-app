import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import ViewTracker from './ViewTracker'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, client_id, email_html, proposal_text, pdf_url, status, prospect_name, prospect_company, opened_at')
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
