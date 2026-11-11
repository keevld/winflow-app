'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Proposal } from '@/lib/types'
import { getEngagementStatus, ENGAGEMENT_TONE_CLASS } from '@/lib/engagement'
import FollowupsCard from './FollowupsCard'

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

  if (!proposal) {
    return <div className="text-sm text-gray-400 py-20 text-center">Cargando...</div>
  }

  const isGenerating = proposal.status === 'generating' && !proposal.pdf_url && !timedOut
  const isFailed = (proposal.status === 'failed' || timedOut) && !proposal.pdf_url
  const isReady = !!proposal.pdf_url
  const isSent = proposal.status === 'sent'
  const vStatus = proposal.verification_status ?? null
  const verifying = proposal.proposal_type === 'intro' && !isSent && (vStatus === null || vStatus === 'checking') && !verifyError

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Propuesta para {proposal.prospect_company}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {proposal.prospect_name}{proposal.prospect_title ? ` · ${proposal.prospect_title}` : ''}
          </p>
        </div>
        {isSent && (() => {
          const engagement = getEngagementStatus(proposal)
          if (!engagement) {
            return (
              <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-800">
                Enviada
              </span>
            )
          }
          return (
            <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${ENGAGEMENT_TONE_CLASS[engagement.tone]}`}>
              {engagement.label}
            </span>
          )
        })()}
      </div>

      {isSent && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">¿Ya tuvieron la llamada?</h2>
            <p className="text-xs text-gray-500 mt-0.5">Crea la propuesta comercial con alcance, precios y botón de aceptación.</p>
          </div>
          <Link
            href={`/proposals/commercial/new?from=${proposal.id}`}
            className="shrink-0 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800"
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
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">¿Cómo salió esta venta?</h2>
          {proposal.outcome ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-700">
                {proposal.outcome === 'won' ? 'Marcada como ganada' : 'Marcada como perdida'}
                {proposal.outcome === 'lost' && proposal.outcome_reason ? ` — ${proposal.outcome_reason}` : ''}
              </p>
              <button disabled={outcomeSaving} onClick={() => setOutcome(null)}
                className="text-xs text-gray-500 hover:underline disabled:opacity-50">Deshacer</button>
            </div>
          ) : askingLost ? (
            <div className="space-y-2">
              <input value={lostReason} onChange={e => setLostReason(e.target.value)} maxLength={500}
                placeholder="Motivo (opcional): precio, eligieron a otra agencia, sin presupuesto…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <div className="flex gap-2">
                <button disabled={outcomeSaving} onClick={() => setOutcome('lost', lostReason)}
                  className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">Confirmar perdida</button>
                <button onClick={() => setAskingLost(false)} className="text-sm px-3 py-2 text-gray-500 hover:underline">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button disabled={outcomeSaving} onClick={() => setOutcome('won')}
                className="text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">Ganada</button>
              <button disabled={outcomeSaving} onClick={() => setAskingLost(true)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">Perdida</button>
            </div>
          )}
          {outcomeError && <p className="text-xs text-red-600">{outcomeError}</p>}
        </div>
      )}

      {/* Generating state */}
      {isGenerating && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-gray-700 font-medium">
            {proposal.verification_status ? 'Aplicando las correcciones y actualizando el PDF…' : 'Generando propuesta con IA...'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {proposal.verification_status ? 'Toma alrededor de 40 segundos' : 'Esto toma entre 20 y 60 segundos'}
          </p>
        </div>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm text-red-700 font-medium">La generación tardó demasiado o falló</p>
          <p className="text-xs text-red-500 mt-1 mb-4">Puedes reintentar — los datos del prospecto están guardados</p>
          <button
            onClick={handleRetry}
            className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Content ready */}
      {isReady && (
        <>
          {/* Verificación de datos */}
          {proposal.proposal_type === 'intro' && !isSent && (
            <div className={`rounded-xl border p-5 text-sm ${
              verifyError || vStatus === 'error' ? 'bg-red-50 border-red-200'
              : vStatus === 'review' ? 'bg-amber-50 border-amber-200'
              : vStatus === 'fixed' ? 'bg-blue-50 border-blue-200'
              : vStatus === 'ok' ? 'bg-green-50 border-green-200'
              : 'bg-gray-50 border-gray-200'
            }`}>
              {verifying && (
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="animate-spin w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full" />
                  <span>Revisando que todo lo que dice la propuesta salga de tu información…</span>
                  {verifyStuck && (
                    <button onClick={() => runVerification(true)} className="ml-auto text-xs underline">Reintentar</button>
                  )}
                </div>
              )}
              {(verifyError || vStatus === 'error') && (
                <div className="flex items-center gap-3 text-red-700">
                  <span>No pudimos revisar la propuesta automáticamente. Léela con cuidado antes de enviar.</span>
                  <button onClick={() => runVerification(true)} className="ml-auto text-xs underline whitespace-nowrap">Reintentar</button>
                </div>
              )}
              {vStatus === 'ok' && (
                <p className="text-green-800">
                  <span className="font-medium">Propuesta revisada.</span> Todo lo que dice sale de tu información, de las notas del prospecto o de su sitio web.
                </p>
              )}
              {(vStatus === 'fixed' || vStatus === 'review') && proposal.verification && (
                <div className="space-y-3">
                  {proposal.verification.changes.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-gray-900">
                        <span className="font-medium">
                          Corregimos {proposal.verification.changes.length} {proposal.verification.changes.length === 1 ? 'frase' : 'frases'} automáticamente.
                        </span>{' '}
                        <span className="text-gray-600">La IA escribió algo que no está en tu información (una cifra, un dato o una promesa) y ya lo quitamos. Ver qué cambió</span>
                      </summary>
                      <ul className="mt-3 space-y-3">
                        {proposal.verification.changes.map((c, i) => (
                          <li key={i} className="text-xs bg-white/70 rounded-lg p-3 space-y-1">
                            <p><span className="font-medium text-gray-700">Decía:</span> <span className="text-gray-600">&ldquo;{c.before}&rdquo;</span></p>
                            <p><span className="font-medium text-gray-700">Ahora dice:</span> <span className="text-gray-800">{c.after ? `“${c.after}”` : 'Quitamos esa frase.'}</span></p>
                            <p><span className="font-medium text-gray-700">Por qué:</span> <span className="text-gray-600">{c.problem}</span></p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {proposal.verification.review.length > 0 && (
                    <div>
                      <p className="font-medium text-amber-900">
                        Revisa {proposal.verification.review.length} {proposal.verification.review.length === 1 ? 'frase' : 'frases'} antes de enviar
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">No pudimos confirmarlas con tu información. Si sabes que son ciertas, déjalas; si no, edítalas en el texto de abajo.</p>
                      <ul className="mt-2 space-y-2">
                        {proposal.verification.review.map((r, i) => (
                          <li key={i} className="text-xs bg-white/70 rounded-lg p-3 space-y-1">
                            <p className="text-gray-800">&ldquo;{r.quote}&rdquo;</p>
                            <p className="text-gray-500">{r.problem}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Proposal text editor */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Texto de la propuesta</h2>
              {!isSent && (
                <span className="text-xs text-gray-400">Editable antes de enviar</span>
              )}
            </div>
            {isSent ? (
              <div className="text-sm text-gray-700 border border-gray-100 rounded-lg p-4 bg-gray-50 whitespace-pre-wrap">
                {proposalText}
              </div>
            ) : (
              <textarea
                rows={14}
                value={proposalText}
                onChange={e => setProposalText(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            )}
            {!isSent && (
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleSaveText}
                  disabled={savingText || proposalText === (proposal.proposal_text ?? '')}
                  className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  {savingText ? 'Guardando...' : 'Guardar cambios'}
                </button>
                {textSaveMsg && <span className="text-xs text-gray-500">{textSaveMsg}</span>}
              </div>
            )}
          </div>

          {/* Datos de mercado usados (solo para la agencia) */}
          {proposal.market_sources && proposal.market_sources.length > 0 && (
            <details className="bg-white rounded-xl border border-gray-200 px-6 py-4 text-sm">
              <summary className="cursor-pointer text-gray-600">
                Datos de mercado usados ({proposal.market_sources.length}) · revisa que te convenzan antes de enviar
              </summary>
              <ul className="mt-3 space-y-2">
                {proposal.market_sources.map((s, i) => (
                  <li key={i} className="text-xs text-gray-600">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-800 underline">
                      {s.title || s.url}
                    </a>
                    {s.quote && <span className="block text-gray-500 mt-0.5">&ldquo;{s.quote}&rdquo;</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-gray-400">Esto no aparece en la propuesta del prospecto.</p>
            </details>
          )}

          {/* Email HTML editor */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Correo de presentación</h2>
              {!isSent && (
                <span className="text-xs text-gray-400">Editable antes de enviar</span>
              )}
            </div>
            {isSent ? (
              <iframe
                title="Correo enviado"
                sandbox=""
                srcDoc={emailHtml}
                className="w-full h-96 border border-gray-100 rounded-lg bg-white"
              />
            ) : (
              <textarea
                rows={12}
                value={emailHtml}
                onChange={e => setEmailHtml(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            )}
          </div>

          {/* Vista previa: la propuesta tal como la verá el cliente (y como saldrá en el PDF) */}
          {proposal.public_slug && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">Así la verá tu cliente</h2>
                  <p className="text-xs text-gray-400">Se actualiza cuando guardas cambios en el texto. El PDF adjunto sale de esta misma vista.</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <a href={`/p/${proposal.public_slug}?preview=1`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-900 underline">Abrir en nueva pestaña</a>
                  <a href={`/api/public/proposals/${proposal.public_slug}/pdf`} className="text-xs text-gray-500 hover:text-gray-900 underline">Descargar PDF</a>
                </div>
              </div>
              <iframe key={previewKey} title="Vista previa de la propuesta" src={`/p/${proposal.public_slug}?preview=1`} className="w-full h-[720px]" />
            </div>
          )}

          {/* Send button */}
          {!isSent && (
            <div className="flex flex-col gap-2">
              {sendError && <p className="text-sm text-red-600">{sendError}</p>}
              {sending && <p className="text-xs text-gray-500 text-center">Estamos generando el PDF y enviando el correo. No cierres esta página hasta que te lleve al panel.</p>}
              <button
                onClick={handleSend}
                disabled={sending || verifying}
                className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {sending ? 'Enviando… puede tardar hasta 1 minuto' : verifying ? 'Verificando…' : `Aprobar y enviar a ${proposal.prospect_email}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
