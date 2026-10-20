import { NextRequest, NextResponse } from 'next/server'
import { sanitizeEmailHtml, injectViewLink } from '@/lib/text'
import { sanitizeContent } from '@/lib/commercial'
import { onColor } from '@/lib/color'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // ── 1. Auth ───────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 2. Profile ────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    return NextResponse.json({ error: 'No agency assigned to this user' }, { status: 403 })
  }

  // ── 3. Proposal — load with anon client (RLS pre-filters) ─
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, client_id, created_by, status, prospect_email')
    .eq('id', id)
    .single()

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found or access denied' }, { status: 403 })
  }

  // ── 4. Explicit authorization (service role will bypass RLS below) ──
  if (proposal.client_id !== profile.client_id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (profile.role === 'seller' && proposal.created_by !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (proposal.status === 'sent') {
    return NextResponse.json({ error: 'Already sent' }, { status: 400 })
  }

  if (proposal.status !== 'ready') {
    return NextResponse.json({ error: 'Proposal must be ready before sending' }, { status: 400 })
  }

  // ── 5. Config ─────────────────────────────────────────────
  const webhookUrl = process.env.WINFLOW_WEBHOOK_SEND
  const secret = process.env.WINFLOW_WEBHOOK_SECRET
  if (!webhookUrl || !secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // ── 6. Persist email edits before sending ─────────────────
  // Service role used here — authorization already verified above.
  let email_html: string | undefined
  try {
    const body = await req.json()
    if (typeof body.email_html === 'string') email_html = sanitizeEmailHtml(body.email_html)
  } catch {}

  const service = await createServiceClient()

  // Claim the send atomically so a double click cannot send two emails.
  const { data: claimed, error: claimError } = await service
    .from('proposals')
    .update({ status: 'sending', sending_started_at: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', profile.client_id)
    .eq('status', 'ready')
    .select('id')
    .maybeSingle()

  if (claimError || !claimed) {
    return NextResponse.json({ error: 'Proposal is already being sent or changed state' }, { status: 409 })
  }

  if (email_html !== undefined) {
    const { error: updateErr } = await service
      .from('proposals')
      .update({ email_html })
      .eq('id', id)
      .eq('client_id', profile.client_id)  // redundant but explicit

    if (updateErr) {
      await service.from('proposals').update({ status: 'ready' }).eq('id', id).eq('client_id', profile.client_id)
      return NextResponse.json({ error: 'Failed to save edits' }, { status: 500 })
    }
  }

  // ── 7. Trigger N8N send ───────────────────────────────────
  // n8n solo envía: todo lo necesario viaja en el cuerpo, así no necesita leer la base de datos.
  async function revertToReady() {
    await service.from('proposals').update({ status: 'ready' }).eq('id', id).eq('client_id', profile!.client_id)
  }

  const { data: full } = await service
    .from('proposals')
    .select('prospect_name, prospect_email, prospect_company, email_html, email_subject, pdf_url, public_slug, proposal_type, commercial, valid_until')
    .eq('id', id)
    .eq('client_id', profile.client_id)
    .single()

  const to = (full?.prospect_email ?? '').trim()
  if (!full || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    await revertToReady()
    return NextResponse.json({ error: 'El prospecto no tiene un correo válido' }, { status: 400 })
  }

  const [{ data: agency }, { data: brand }] = await Promise.all([
    service.from('clients').select('company_name').eq('id', profile.client_id).maybeSingle(),
    service.from('brand_voice').select('primary_color').eq('client_id', profile.client_id).maybeSingle(),
  ])

  const isCommercial = full.proposal_type === 'commercial'
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const color = /^#[0-9a-fA-F]{6}$/.test(brand?.primary_color ?? '') ? (brand!.primary_color as string) : '#111827'
  const viewUrl = full.public_slug ? `${new URL(req.url).origin}/p/${full.public_slug}` : null

  let pdfUrl: string | null = null
  let pdfName = 'Propuesta.pdf'
  const hasPdf = isCommercial && !!process.env.PDFSHIFT_API_KEY && !!viewUrl
  let html: string
  let subject: string

  if (isCommercial) {
    if (!viewUrl) {
      await revertToReady()
      return NextResponse.json({ error: 'La propuesta no tiene enlace público' }, { status: 400 })
    }
    const { data: priced } = await service
      .from('proposal_price_items')
      .select('unit_price')
      .eq('proposal_id', id)
      .eq('client_id', profile.client_id)
    if (!priced?.length || priced.some(i => i.unit_price === null)) {
      await revertToReady()
      return NextResponse.json({ error: 'Hay conceptos sin precio. Complétalos antes de enviar.' }, { status: 400 })
    }
    const content = sanitizeContent(full.commercial)
    const agencyName = agency?.company_name ?? ''
    const hello = full.prospect_name ? `Hola ${esc(full.prospect_name)},` : 'Hola,'
    const validity = full.valid_until
      ? `<p style="margin:16px 0 0;font-size:13px;color:#6b7280">Esta propuesta está vigente hasta el ${new Date(`${full.valid_until}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>`
      : ''
    if (hasPdf && full.public_slug) {
      pdfUrl = `${new URL(req.url).origin}/api/public/proposals/${full.public_slug}/pdf`
      pdfName = `Propuesta - ${(full.prospect_company ?? 'comercial').replace(/[^\w .-]/g, '').trim()}.pdf`
      // Se genera (y queda en caché) antes de enviar; si falla, el correo sale sin adjunto en vez de fallar.
      const probe = await fetch(pdfUrl).catch(() => null)
      if (!probe?.ok) pdfUrl = null
    }
    const onBrand = onColor(color)
    const when = full.valid_until
      ? new Date(`${full.valid_until}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
      : null
    html = `<div style="background:#f3f1ec;padding:28px 12px;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;border-collapse:collapse">
<tr><td style="background:${color};color:${onBrand};padding:26px 32px;border-radius:14px 14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:21px;letter-spacing:-0.2px">${esc(agencyName)}</td></tr>
<tr><td style="background:#ffffff;padding:34px 32px 30px;border-radius:0 0 14px 14px;color:#1b1a18;font-size:16px;line-height:1.6">
<p style="margin:0 0 18px">${hello}</p>
<p style="margin:0 0 6px;font-size:13px;color:#6a645c;text-transform:uppercase;letter-spacing:0.5px">Propuesta comercial</p>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:27px;line-height:1.2;letter-spacing:-0.4px;color:#1b1a18">${esc(content.title || `Propuesta para ${full.prospect_company ?? 'tu empresa'}`)}</h1>
<p style="margin:0 0 26px;color:#36322d">Gracias por la conversación. Aquí está la propuesta con el alcance, la inversión y los siguientes pasos. Desde el enlace puedes revisarla, descargarla, elegir tu paquete y continuar.</p>
<p style="margin:0 0 26px"><a href="${esc(viewUrl)}" style="background:${color};color:${onBrand};text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:bold;font-size:16px;display:inline-block">Ver la propuesta</a></p>
${when ? `<p style="margin:0 0 6px;font-size:14px;color:#6a645c">Vigente hasta el ${when}.</p>` : ''}
<p style="margin:0;font-size:14px;color:#6a645c">${pdfUrl ? 'También la encuentras adjunta en PDF. ' : ''}Si tienes dudas, responde a este correo.</p>
</td></tr>
<tr><td style="padding:16px 8px 0;text-align:center;font-size:12px;color:#8a847b">${esc(agencyName)}</td></tr>
</table></div>`
    subject = `Propuesta comercial para ${full.prospect_company ?? 'tu empresa'}`
  } else {
    // Con PDFShift configurado, la propuesta inicial también usa el PDF del nuevo diseño.
    if (process.env.PDFSHIFT_API_KEY && full.public_slug) {
      const ours = `${new URL(req.url).origin}/api/public/proposals/${full.public_slug}/pdf`
      const probe = await fetch(ours).catch(() => null)
      if (probe?.ok) {
        pdfUrl = ours
        pdfName = `Propuesta - ${(full.prospect_company ?? 'inicial').replace(/[^\w .-]/g, '').trim()}.pdf`
      }
    }
    if (!pdfUrl && full.pdf_url) {
      const { data: signed } = await service.storage.from('proposals').createSignedUrl(full.pdf_url, 60 * 15)
      pdfUrl = signed?.signedUrl ?? null
    }
    if (!pdfUrl) {
      await revertToReady()
      return NextResponse.json({ error: 'La propuesta no tiene PDF generado' }, { status: 400 })
    }
    html = viewUrl
      ? injectViewLink(full.email_html ?? '', viewUrl, brand?.primary_color ?? '')
      : (full.email_html ?? '')
    subject = full.email_subject || `Propuesta para ${full.prospect_company ?? 'tu empresa'}`
  }

  const n8nRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Winflow-Secret': secret,
    },
    body: JSON.stringify({
      proposal_id: id,
      to,
      subject,
      html,
      from_name: agency?.company_name ?? '',
      reply_to: user.email ?? '',
      ...(pdfUrl ? { pdf_url: pdfUrl, pdf_filename: pdfName } : {}),
    }),
  })

  if (!n8nRes.ok) {
    await revertToReady()
    return NextResponse.json({ error: 'N8N send failed' }, { status: 502 })
  }

  // ── 8. Mark sent (service role) ───────────────────────────
  await service
    .from('proposals')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', profile.client_id)  // redundant but explicit

  return NextResponse.json({ ok: true })
}
