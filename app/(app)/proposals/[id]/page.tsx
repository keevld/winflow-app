'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Proposal } from '@/lib/types'
import { getEngagementStatus, ENGAGEMENT_TONE_CLASS } from '@/lib/engagement'

const TIMEOUT_MS = 45_000

export default function ProposalPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [emailHtml, setEmailHtml] = useState('')
  const [proposalText, setProposalText] = useState('')
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [sendError, setSendError] = useState('')
  const [savingText, setSavingText] = useState(false)
  const [textSaveMsg, setTextSaveMsg] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [regenerateError, setRegenerateError] = useState('')
  const [outcomeSaving, setOutcomeSaving] = useState(false)
  const [outcomeError, setOutcomeError] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [askingLost, setAskingLost] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshPdfUrl = useCallback(async () => {
    const res = await fetch(`/api/proposals/${id}/pdf-url`)
    if (res.ok) {
      const body = await res.json()
      setPdfSignedUrl(body.url)
    } else {
      setPdfSignedUrl(null)
    }
  }, [id])

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
        if (data.pdf_url) refreshPdfUrl()
        if (data.status === 'generating' && !data.pdf_url) {
          // Start 45s timeout
          timerRef.current = setTimeout(async () => {
            setTimedOut(true)
            await supabase
              .from('proposals')
              .update({ status: 'failed' })
              .eq('id', id)
            setProposal(p => p ? { ...p, status: 'failed' } : p)
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
          if (updated.pdf_url) {
            refreshPdfUrl()
          } else {
            setPdfSignedUrl(null)
          }
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
  }, [id, refreshPdfUrl])

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
    setPdfSignedUrl(null)
    const supabase = createClient()
    timerRef.current = setTimeout(async () => {
      setTimedOut(true)
      await supabase.from('proposals').update({ status: 'failed' }).eq('id', id)
      setProposal(p => p ? { ...p, status: 'failed' } : p)
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
      setTextSaveMsg('Guardado. Regenera el PDF para reflejar los cambios.')
    } catch (err: unknown) {
      setTextSaveMsg(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSavingText(false)
    }
  }

  async function handleRegeneratePdf() {
    if (!proposal) return
    setRegenerateError('')
    setRegenerating(true)
    try {
      const res = await fetch(`/api/proposals/${id}/regenerate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_text: proposalText }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'No se pudo regenerar el PDF')
      }
      setTextSaveMsg('')
      setProposal(p => p ? { ...p, status: 'generating', pdf_url: null, proposal_text: proposalText } : p)
      setPdfSignedUrl(null)
      const supabase = createClient()
      timerRef.current = setTimeout(async () => {
        setTimedOut(true)
        await supabase.from('proposals').update({ status: 'failed' }).eq('id', id)
        setProposal(p => p ? { ...p, status: 'failed' } : p)
      }, TIMEOUT_MS)
    } catch (err: unknown) {
      setRegenerateError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setRegenerating(false)
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
  const isFailed = proposal.status === 'failed' || timedOut
  const isReady = !!proposal.pdf_url
  const isSent = proposal.status === 'sent'

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
          <p className="text-sm text-gray-700 font-medium">Generando propuesta con IA...</p>
          <p className="text-xs text-gray-400 mt-1">Esto toma entre 20 y 45 segundos</p>
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
                  {savingText ? 'Guardando...' : 'Guardar texto'}
                </button>
                <button
                  onClick={handleRegeneratePdf}
                  disabled={regenerating}
                  className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {regenerating ? 'Regenerando...' : 'Regenerar PDF con este texto'}
                </button>
                {textSaveMsg && <span className="text-xs text-gray-500">{textSaveMsg}</span>}
                {regenerateError && <span className="text-xs text-red-600">{regenerateError}</span>}
              </div>
            )}
          </div>

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

          {/* PDF preview */}
          {pdfSignedUrl && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Propuesta PDF</h2>
                <a
                  href={pdfSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-gray-900 underline"
                >
                  Abrir en nueva pestaña
                </a>
              </div>
              <iframe src={pdfSignedUrl} className="w-full h-[600px]" />
            </div>
          )}

          {/* Send button */}
          {!isSent && (
            <div className="flex flex-col gap-2">
              {sendError && <p className="text-sm text-red-600">{sendError}</p>}
              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {sending ? 'Enviando...' : `Aprobar y enviar a ${proposal.prospect_email}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
