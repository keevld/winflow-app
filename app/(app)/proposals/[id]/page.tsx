'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Proposal } from '@/lib/types'
import { getEngagementStatus, ENGAGEMENT_TONE_CLASS } from '@/lib/engagement'
import FollowupsCard from './FollowupsCard'
import { BrowserFrame, IconAlert, IconCheck, IconSend, IconShield, Loading, PageHeader, Segmented, Steps } from '../../ui'

const TIMEOUT_MS = 150_000

export default function ProposalPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [emailHtml, setEmailHtml] = useState('')
  const [proposalText, setProposalText] = useState('')
  const [previewKey, setPreviewKey] = useState(0)
  const [sending, setSending] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [sendError, setSendError] = useState('')
  const [savingText, setSavingText] = useState(false)
  const [textSaveMsg, setTextSaveMsg] = useState('')
  const [outcomeSaving, setOutcomeSaving] = useState(false)
  const [outcomeError, setOutcomeError] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [askingLost, setAskingLost] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const verifyStartedRef = useRef(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifyStuck, setVerifyStuck] = useState(false)
  const [verifyRun, setVerifyRun] = useState(0)
  const [emailMode, setEmailMode] = useState<'preview' | 'edit'>('preview')

  useEffect(() => {
    const supabase = createClient()

    async function loadAndSubscribe() {
      const { data } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id)
        .single()

      if (data && data.proposal_type === 'commercial') {
        router.replace(`/proposals/${id}/commercial`)
        return
      }
      if (data) {
        setProposal(data)
        setEmailHtml(data.email_html ?? '')
        setProposalText(data.proposal_text ?? '')
        if (data.status === 'generating' && !data.pdf_url) {
          // Start 45s timeout
          timerRef.current = setTimeout(async () => {
            setTimedOut(true)
            await supabase
              .from('proposals')
              .update({ status: 'failed' })
              .eq('id', id).eq('status', 'generating').is('pdf_url', null)
            setProposal(p => p && !p.pdf_url ? { ...p, status: 'failed' } : p)
          }, TIMEOUT_MS)
        }
      }
    }

    loadAndSubscribe()

    // Realtime: listen for updates on this proposal
    const channel = supabase
      .channel(`proposal:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'proposals', filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as Proposal
          setProposal(updated)
          setEmailHtml(updated.email_html ?? '')
          setProposalText(updated.proposal_text ?? '')
          if (updated.pdf_url && timerRef.current) {
            clearTimeout(timerRef.current)
            setTimedOut(false)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [id])

  // Verificador de afirmaciones: corre solo, una vez, cuando la propuesta inicial queda lista.
  const runVerification = useCallback(async (force = false) => {
    setVerifyError('')
    setVerifyStuck(false)
    setVerifyRun(n => n + 1)
    try {
      const res = await fetch(`/api/proposals/${id}/verify${force ? '?force=1' : ''}`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'No se pudo verificar la propuesta')
      }
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }, [id])

  useEffect(() => {
    if (!proposal) return
    if (proposal.proposal_type !== 'intro' || proposal.status !== 'ready' || !proposal.pdf_url) return
    if (proposal.verification_status || verifyStartedRef.current) return
    verifyStartedRef.current = true
    runVerification()
  }, [proposal, runVerification])

  // Si la verificación tarda demasiado, se ofrece reintentar.
  const vs = proposal?.verification_status ?? null
  useEffect(() => {
    if (vs && vs !== 'checking') return
    const t = setTimeout(() => setVerifyStuck(true), 150_000)
    return () => clearTimeout(t)
  }, [vs, verifyRun])

  // Respaldo del tiempo real: mientras se genera o verifica, consulta el estado cada 4 s.
  const st = proposal?.status ?? null
  useEffect(() => {
    if (st !== 'generating' && vs !== 'checking') return
    const supabase = createClient()
    const t = setInterval(async () => {
      const { data } = await supabase.from('proposals').select('*').eq('id', id).single()
      if (!data) return
      setProposal(data)
      setEmailHtml(data.email_html ?? '')
      setProposalText(data.proposal_text ?? '')
      if (data.pdf_url) setTimedOut(false)
    }, 4000)
    return () => clearInterval(t)
  }, [st, vs, id])

  async function handleRetry() {
    if (!proposal) return
    setTimedOut(false)
    setSendError('')
    const response = await fetch('/api/proposals/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposal_id: proposal.id,
        client_id: proposal.client_id,
        prospect_name: proposal.prospect_name,
        prospect_title: proposal.prospect_title,
        prospect_company: proposal.prospect_company,
        prospect_email: proposal.prospect_email,
        prospect_website: proposal.prospect_website,
        prospect_industry: proposal.prospect_industry,
        prospect_company_size: proposal.prospect_company_size,
        prospect_pain: proposal.prospect_pain,
        product: proposal.product,
      }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setSendError(body.error ?? 'No se pudo reiniciar la generación')
      return
    }
    setProposal(p => p ? { ...p, status: 'generating', pdf_url: null } : p)
    const supabase = createClient()
    timerRef.current = setTimeout(async () => {
      setTimedOut(true)
      await supabase.from('proposals').update({ status: 'failed' }).eq('id', id).eq('status', 'generating').is('pdf_url', null)
      setProposal(p => p && !p.pdf_url ? { ...p, status: 'failed' } : p)
    }, TIMEOUT_MS)
  }

  async function handleSaveText() {
    setSavingText(true)
    setTextSaveMsg('')
    try {
      const res = await fetch(`/api/proposals/${id}/update-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_text: proposalText }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'No se pudo guardar')
      }
      setProposal(p => p ? { ...p, proposal_text: proposalText } : p)
      setTextSaveMsg('Guardado. La vista previa ya muestra los cambios.')
      setPreviewKey(k => k + 1)
    } catch (err: unknown) {
      setTextSaveMsg(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSavingText(false)
    }
  }

  async function handleSend() {
    setSending(true)
    setSendError('')
    try {
      const res = await fetch(`/api/proposals/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_html: emailHtml }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Error al enviar')
      }
      setProposal(p => p ? { ...p, status: 'sent' } : p)
      router.push('/dashboard')
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSending(false)
    }
  }

  async function setOutcome(outcome: 'won' | 'lost' | null, reason?: string) {
    setOutcomeSaving(true)
    setOutcomeError('')
    try {
      const res = await fetch(`/api/proposals/${id}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, reason }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar')
      setProposal(p => p ? {
        ...p,
        outcome,
        outcome_at: outcome ? new Date().toISOString() : null,
        outcome_reason: json.outcome_reason ?? null,
      } : p)
      setAskingLost(false)
      setLostReason('')
    } catch (err: unknown) {
      setOutcomeError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setOutcomeSaving(false)
    }
  }

  if (!proposal) return <Loading />

  const isGenerating = proposal.status === 'generating' && !proposal.pdf_url && !timedOut
  const isFailed = (proposal.status === 'failed' || timedOut) && !proposal.pdf_url
  const isReady = !!proposal.pdf_url
  const isSent = proposal.status === 'sent'
  const vStatus = proposal.verification_status ?? null
  const verifying = proposal.proposal_type === 'intro' && !isSent && (vStatus === null || vStatus === 'checking') && !verifyError
  const closed = !!proposal.outcome || !!proposal.accepted_at
  const engagement = isSent ? getEngagementStatus(proposal) : null
  const step = !isReady ? 0 : isSent ? (closed ? 4 : 3) : verifying ? 1 : 2
  const sendLabel = sending ? 'Enviando… puede tardar hasta 1 minuto' : verifying ? 'Verificando…' : 'Aprobar y enviar'
  const publicUrl = proposal.public_slug ? `winflowapp.com/p/${proposal.public_slug}` : ''

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/dashboard', label: 'Propuestas' }}
        title={`Propuesta para ${proposal.prospect_company}`}
        subtitle={`${proposal.prospect_name}${proposal.prospect_title ? ` · ${proposal.prospect_title}` : ''}`}
        action={isSent ? (
          <span className={`wf-pill ${engagement ? ENGAGEMENT_TONE_CLASS[engagement.tone] : 'bg-emerald-50 text-emerald-700'}`}>
            {engagement ? engagement.label : 'Enviada'}
          </span>
        ) : undefined}
      />

      <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
        <Steps steps={['Redacción', 'Revisión', 'Envío', 'Cierre']} current={step} />
      </div>

      {/* Generando */}
      {isGenerating && (
        <div className="wf-board rounded-3xl p-10 text-center text-white">
          <div className="mx-auto mb-5 h-9 w-9 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
          <p className="font-display text-lg font-semibold">
            {proposal.verification_status ? 'Aplicando las correcciones y actualizando el PDF…' : 'Winflow está escribiendo tu propuesta…'}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {proposal.verification_status ? 'Toma alrededor de 40 segundos' : 'Usa tu tono, tus precios y lo que sabemos del prospecto. Toma entre 20 y 60 segundos.'}
          </p>
        </div>
      )}

      {/* Falló */}
      {isFailed && (
        <div className="wf-alert wf-alert-error p-6 text-center">
          <p className="font-semibold">La generación tardó demasiado o falló</p>
          <p className="mt-1 mb-4 text-xs">Puedes reintentar: los datos del prospecto están guardados.</p>
          <button onClick={handleRetry} className="wf-btn">Reintentar</button>
        </div>
      )}

      {isReady && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* ───────── Columna principal ───────── */}
          <div className="min-w-0 space-y-6">
            {/* Verificación de datos */}
            {proposal.proposal_type === 'intro' && !isSent && (
              <div className={`wf-alert flex gap-3 p-5 ${
                verifyError || vStatus === 'error' ? 'wf-alert-error'
                : vStatus === 'review' ? 'wf-alert-warn'
                : vStatus === 'fixed' ? 'wf-alert-info'
                : vStatus === 'ok' ? 'wf-alert-ok'
                : 'border-gray-200 bg-gray-50 text-gray-700'
              }`}>
                <span className="mt-0.5 shrink-0">
                  {verifying ? <span className="wf-spinner block !h-4 !w-4" aria-hidden />
                    : verifyError || vStatus === 'error' || vStatus === 'review' ? <IconAlert className="h-5 w-5" />
                    : <IconShield className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  {verifying && (
                    <div className="flex items-center gap-3">
                      <span>Revisando que todo lo que dice la propuesta salga de tu información…</span>
                      {verifyStuck && (
                        <button onClick={() => runVerification(true)} className="ml-auto text-xs underline">Reintentar</button>
                      )}
                    </div>
                  )}
                  {(verifyError || vStatus === 'error') && (
                    <div className="flex items-center gap-3">
                      <span>No pudimos revisar la propuesta automáticamente. Léela con cuidado antes de enviar.</span>
                      <button onClick={() => runVerification(true)} className="ml-auto whitespace-nowrap text-xs underline">Reintentar</button>
                    </div>
                  )}
                  {vStatus === 'ok' && (
                    <p><span className="font-semibold">Propuesta revisada.</span> Todo lo que dice sale de tu información, de las notas del prospecto o de su sitio web.</p>
                  )}
                  {(vStatus === 'fixed' || vStatus === 'review') && proposal.verification && (
                    <div className="space-y-3">
                      {proposal.verification.changes.length > 0 && (
                        <details>
                          <summary className="cursor-pointer">
                            <span className="font-semibold">
                              Corregimos {proposal.verification.changes.length} {proposal.verification.changes.length === 1 ? 'frase' : 'frases'} automáticamente.
                            </span>{' '}
                            <span className="opacity-80">La IA escribió algo que no está en tu información (una cifra, un dato o una promesa) y ya lo quitamos. Ver qué cambió</span>
                          </summary>
                          <ul className="mt-3 space-y-3">
                            {proposal.verification.changes.map((c, i) => (
                              <li key={i} className="space-y-1 rounded-xl bg-white/80 p-3 text-xs text-gray-700">
                                <p><span className="font-semibold text-gray-900">Decía:</span> &ldquo;{c.before}&rdquo;</p>
                                <p><span className="font-semibold text-gray-900">Ahora dice:</span> {c.after ? `“${c.after}”` : 'Quitamos esa frase.'}</p>
                                <p><span className="font-semibold text-gray-900">Por qué:</span> {c.problem}</p>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {proposal.verification.review.length > 0 && (
                        <div>
                          <p className="font-semibold">
                            Revisa {proposal.verification.review.length} {proposal.verification.review.length === 1 ? 'frase' : 'frases'} antes de enviar
                          </p>
                          <p className="mt-0.5 text-xs opacity-80">No pudimos confirmarlas con tu información. Si sabes que son ciertas, déjalas; si no, edítalas en el texto de abajo.</p>
                          <ul className="mt-2 space-y-2">
                            {proposal.verification.review.map((r, i) => (
                              <li key={i} className="space-y-1 rounded-xl bg-white/80 p-3 text-xs">
                                <p className="text-gray-900">&ldquo;{r.quote}&rdquo;</p>
                                <p className="text-gray-600">{r.problem}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Texto de la propuesta */}
            <div className="wf-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="wf-card-title">Texto de la propuesta</h2>
                  {!isSent && <p className="wf-hint mt-0.5">Edítalo antes de enviar. Al guardar, la vista previa se actualiza.</p>}
                </div>
              </div>
              {isSent ? (
                <div className="whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
                  {proposalText}
                </div>
              ) : (
                <textarea
                  rows={14}
                  value={proposalText}
                  onChange={e => setProposalText(e.target.value)}
                  className="wf-input font-mono !text-[13px] leading-relaxed"
                />
              )}
              {!isSent && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleSaveText}
                    disabled={savingText || proposalText === (proposal.proposal_text ?? '')}
                    className="wf-btn-ghost"
                  >
                    {savingText ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  {textSaveMsg && <span className="wf-hint">{textSaveMsg}</span>}
                </div>
              )}
            </div>

            {/* Datos de mercado usados (solo para la agencia) */}
            {proposal.market_sources && proposal.market_sources.length > 0 && (
              <details className="wf-card !space-y-0 text-sm">
                <summary className="cursor-pointer text-gray-700">
                  <span className="font-medium text-gray-900">Datos de mercado usados ({proposal.market_sources.length})</span>
                  <span className="text-gray-500"> · revisa que te convenzan antes de enviar</span>
                </summary>
                <ul className="mt-3 space-y-2">
                  {proposal.market_sources.map((s, i) => (
                    <li key={i} className="text-xs text-gray-600">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-800 underline">
                        {s.title || s.url}
                      </a>
                      {s.quote && <span className="mt-0.5 block text-gray-500">&ldquo;{s.quote}&rdquo;</span>}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-gray-400">Esto no aparece en la propuesta del prospecto.</p>
              </details>
            )}

            {/* Correo de presentación */}
            <div className="wf-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="wf-card-title">Correo de presentación</h2>
                  <p className="wf-hint mt-0.5">{isSent ? 'Así se envió.' : 'El correo que acompaña el enlace y el PDF.'}</p>
                </div>
                {!isSent && (
                  <Segmented value={emailMode} onChange={setEmailMode} options={[['preview', 'Vista previa'], ['edit', 'Editar HTML']]} />
                )}
              </div>
              {isSent || emailMode === 'preview' ? (
                <iframe
                  title={isSent ? 'Correo enviado' : 'Vista previa del correo'}
                  sandbox=""
                  srcDoc={emailHtml}
                  className="h-96 w-full rounded-xl border border-gray-200 bg-white"
                />
              ) : (
                <textarea
                  rows={12}
                  value={emailHtml}
                  onChange={e => setEmailHtml(e.target.value)}
                  className="wf-input font-mono !text-[13px]"
                />
              )}
            </div>

            {/* Así la verá tu cliente (y como saldrá en el PDF) */}
            {proposal.public_slug && (
              <BrowserFrame
                url={publicUrl}
                actions={
                  <span className="flex shrink-0 items-center gap-4">
                    <a href={`/p/${proposal.public_slug}?preview=1`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 underline hover:text-gray-900">Abrir</a>
                    <a href={`/api/public/proposals/${proposal.public_slug}/pdf`} className="text-xs text-gray-500 underline hover:text-gray-900">PDF</a>
                  </span>
                }
              >
                <div className="border-b border-gray-100 px-5 py-3">
                  <h2 className="text-sm font-semibold text-gray-900">Así la verá tu cliente</h2>
                  <p className="wf-hint">Se actualiza cuando guardas cambios en el texto. El PDF adjunto sale de esta misma vista.</p>
                </div>
                <iframe key={previewKey} title="Vista previa de la propuesta" src={`/p/${proposal.public_slug}?preview=1`} className="h-[720px] w-full" />
              </BrowserFrame>
            )}
          </div>

          {/* ───────── Columna lateral ───────── */}
          <aside className="space-y-6 lg:sticky lg:top-24">
            {!isSent && (
              <div className="wf-card">
                <div>
                  <h2 className="wf-card-title">Enviar al prospecto</h2>
                  <p className="wf-hint mt-0.5">Tú das la última palabra: nada sale sin tu aprobación.</p>
                </div>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500">Para</dt>
                    <dd className="break-all font-medium text-gray-900">{proposal.prospect_email || 'Falta el correo'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Incluye</dt>
                    <dd className="text-gray-700">Correo de presentación, enlace a la propuesta y PDF adjunto.</dd>
                  </div>
                </dl>
                <ul className="space-y-1.5 border-t border-gray-100 pt-3 text-xs text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className={`grid h-4 w-4 place-items-center rounded-full ${verifying ? 'bg-gray-200 text-gray-500' : 'bg-brand-mint text-white'}`}><IconCheck className="h-3 w-3" /></span>
                    {verifying ? 'Verificando la propuesta…' : 'Propuesta verificada'}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-mint text-white"><IconCheck className="h-3 w-3" /></span>
                    PDF listo
                  </li>
                </ul>
                {sendError && <p className="wf-alert wf-alert-error !p-3 text-xs">{sendError}</p>}
                <button onClick={handleSend} disabled={sending || verifying} className="wf-btn wf-btn-lg w-full">
                  <IconSend />
                  {sendLabel}
                </button>
                {sending && <p className="wf-hint text-center">Estamos generando el PDF y enviando el correo. No cierres esta página hasta que te lleve al panel.</p>}
              </div>
            )}

            {isSent && (
              <div className="wf-board rounded-2xl p-5 text-white">
                <h2 className="font-display text-base font-semibold">¿Ya tuvieron la llamada?</h2>
                <p className="mt-1 text-sm text-slate-300">Crea la propuesta comercial con alcance, precios y botón de aceptación.</p>
                <Link
                  href={`/proposals/commercial/new?from=${proposal.id}`}
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-brand-peach"
                >
                  Crear propuesta comercial
                </Link>
              </div>
            )}

            {isSent && (
              <FollowupsCard
                proposalId={proposal.id}
                initialPaused={!!proposal.followups_paused}
                initialRhythm={proposal.followup_rhythm ?? null}
                initialRhythmReason={proposal.followup_rhythm_reason ?? null}
                stopped={proposal.accepted_at ? 'el prospecto aceptó la propuesta' : proposal.outcome === 'won' ? 'la marcaste como ganada' : proposal.outcome === 'lost' ? 'la marcaste como perdida' : null}
              />
            )}

            {/* Resultado de la venta */}
            {isSent && (
              <div className="wf-card">
                <h2 className="wf-card-title">¿Cómo salió esta venta?</h2>
                {proposal.outcome ? (
                  <div className="space-y-2">
                    <p className={`wf-pill ${proposal.outcome === 'won' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {proposal.outcome === 'won' ? 'Marcada como ganada' : 'Marcada como perdida'}
                    </p>
                    {proposal.outcome === 'lost' && proposal.outcome_reason && <p className="text-sm text-gray-600">{proposal.outcome_reason}</p>}
                    <button disabled={outcomeSaving} onClick={() => setOutcome(null)} className="block text-xs text-gray-500 underline hover:text-gray-900 disabled:opacity-50">Deshacer</button>
                  </div>
                ) : askingLost ? (
                  <div className="space-y-2">
                    <input value={lostReason} onChange={e => setLostReason(e.target.value)} maxLength={500}
                      placeholder="Motivo (opcional): precio, eligieron a otra agencia, sin presupuesto…"
                      className="wf-input" />
                    <div className="flex flex-wrap items-center gap-2">
                      <button disabled={outcomeSaving} onClick={() => setOutcome('lost', lostReason)} className="wf-btn wf-btn-sm">Confirmar perdida</button>
                      <button onClick={() => setAskingLost(false)} className="text-xs text-gray-500 underline hover:text-gray-900">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button disabled={outcomeSaving} onClick={() => setOutcome('won')} className="wf-btn-win flex-1">Ganada</button>
                    <button disabled={outcomeSaving} onClick={() => setAskingLost(true)} className="wf-btn-ghost flex-1">Perdida</button>
                  </div>
                )}
                {outcomeError && <p className="text-xs text-brand-coral">{outcomeError}</p>}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
