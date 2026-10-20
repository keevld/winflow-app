import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

// PDF de la propuesta comercial: PDFShift abre la misma página pública en modo impresión
// (/p/[slug]?print=1). El resultado se guarda en Storage con un hash del contenido, así que
// solo se vuelve a generar cuando la propuesta, los precios o la marca cambian.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const apiKey = process.env.PDFSHIFT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'PDF no configurado' }, { status: 501 })
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(slug)) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const sb = await createServiceClient()
  const { data: p } = await sb
    .from('proposals')
    .select('id, client_id, proposal_type, commercial, proposal_text, valid_until, prospect_company, prospect_name')
    .eq('public_slug', slug)
    .maybeSingle()
  const isIntro = p?.proposal_type !== 'commercial'
  if (!p || (isIntro && !p.proposal_text?.trim())) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const [{ data: items }, { data: brand }, { data: agency }] = await Promise.all([
    sb.from('proposal_price_items')
      .select('option_key, option_label, is_recommended, position, description, quantity, unit_price, currency, billing_period, discount_pct, notes')
      .eq('proposal_id', p.id)
      .order('position'),
    sb.from('brand_voice').select('primary_color, logo_base64, about_agency').eq('client_id', p.client_id).maybeSingle(),
    sb.from('clients').select('company_name').eq('id', p.client_id).maybeSingle(),
  ])

  const hash = createHash('sha1')
    .update(JSON.stringify([p.commercial, p.proposal_text, p.valid_until, items, brand, agency, 'v2']))
    .digest('hex')
    .slice(0, 16)
  const path = `commercial-pdf/${p.id}/${hash}.pdf`
  const name = `Propuesta - ${p.prospect_company || p.prospect_name || (isIntro ? 'inicial' : 'comercial')}`.replace(/[^\w .-]/g, '').trim()

  let bytes: Buffer
  const { data: cached } = await sb.storage.from('proposals').download(path)
  if (cached) {
    bytes = Buffer.from(await cached.arrayBuffer())
  } else {
    const origin = new URL(req.url).origin
    const res = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      },
      body: JSON.stringify({ source: `${origin}/p/${slug}?print=1`, landscape: false, use_print: true, format: 'Letter', delay: 1500 }),
    })
    if (!res.ok) return NextResponse.json({ error: 'No se pudo generar el PDF' }, { status: 502 })
    bytes = Buffer.from(await res.arrayBuffer())
    await sb.storage.from('proposals').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}.pdf"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
