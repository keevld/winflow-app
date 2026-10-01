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
    .select('id, email_html, proposal_text, pdf_url, status, prospect_name, prospect_company, opened_at')
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

  return (
    <>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <ViewTracker slug={slug} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <p className="text-xs text-gray-400 mb-8 text-center">
            Propuesta para {proposal.prospect_company || proposal.prospect_name}
          </p>

          {pdfSignedUrl && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <iframe src={pdfSignedUrl} className="w-full h-[800px]" title="Propuesta" />
            </div>
          )}

          {!pdfSignedUrl && proposal.email_html && (
            <iframe title="Vista previa de propuesta" sandbox="" srcDoc={proposal.email_html}
              className="w-full min-h-[700px] rounded-xl border border-gray-200 bg-white" />
          )}
        </div>
      </div>
    </>
  )
}
