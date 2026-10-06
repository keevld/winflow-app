'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Proposal } from '@/lib/types'
import {
  EMPTY_CONTENT,
  groupOptions,
  formatTotals,
  formatMoney,
  itemTotal,
  sanitizeContent,
  type CommercialContent,
  type PriceItem,
} from '@/lib/commercial'

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
const smallInput = 'border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function Lines({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea rows={Math.max(3, value.length + 1)} className={inputClass}
        value={value.join('\n')}
        onChange={e => onChange(e.target.value.split('\n'))} />
      <p className="text-xs text-gray-400 mt-1">{hint ?? 'Un elemento por línea.'}</p>
    </div>
  )
}

export default function CommercialEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [content, setContent] = useState<CommercialContent>(EMPTY_CONTENT)
  const [items, setItems] = useState<PriceItem[]>([])
  const [validUntil, setValidUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('proposals').select('*').eq('id', id).single()
    if (!data) return
    const p = data as Proposal
    if (p.proposal_type !== 'commercial') {
      router.replace(`/proposals/${id}`)
      return
    }
    setProposal(p)
    setContent(sanitizeContent(p.commercial ?? {}))
    setValidUntil(p.valid_until ?? '')
    if (p.status !== 'generating') {
      const { data: rows } = await supabase
        .from('proposal_price_items')
        .select('*')
        .eq('proposal_id', id)
        .order('position')
      setItems(
        (rows ?? []).map((r: Record<string, unknown>) => ({
          ...(r as unknown as PriceItem),
          quantity: Number(r.quantity),
          unit_price: r.unit_price === null ? null : Number(r.unit_price),
          discount_pct: Number(r.discount_pct),
        }))
      )
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Si sigue generándose (otra pestaña, recarga), consulta cada 4 s.
  useEffect(() => {
    if (proposal?.status !== 'generating') return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.status])

  const options = useMemo(() => groupOptions(items), [items])
  const missingPrices = items.some(i => i.unit_price === null)
  const editable = !!proposal && ['ready', 'draft', 'failed'].includes(proposal.status) && !proposal.accepted_at

  function setC<K extends keyof CommercialContent>(key: K, value: CommercialContent[K]) {
    setContent(c => ({ ...c, [key]: value }))
    setDirty(true)
  }

  function updateItem(idx: number, patch: Partial<PriceItem>) {
    setItems(list => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
    setDirty(true)
  }

  function removeItem(idx: number) {
    setItems(list => list.filter((_, i) => i !== idx))
    setDirty(true)
  }

  function addItem(optionKey: string, label: string | null) {
    const base = items.find(i => i.option_key === optionKey)
    setItems(list => [
      ...list,
      {
        option_key: optionKey,
        option_label: label,
        is_recommended: base?.is_recommended ?? false,
        position: list.length,
        product_id: null,
        pricing_id: null,
        description: 'Nuevo concepto',
        quantity: 1,
        unit_price: null,
        currency: base?.currency ?? 'USD',
        billing_period: null,
        discount_pct: 0,
        notes: null,
      },
    ])
    setDirty(true)
  }

  function setRecommended(optionKey: string) {
    setItems(list => list.map(i => ({ ...i, is_recommended: i.option_key === optionKey })))
    setDirty(true)
  }

  function renameOption(optionKey: string, label: string) {
    setItems(list => list.map(i => (i.option_key === optionKey ? { ...i, option_label: label } : i)))
    setDirty(true)
  }

  async function save(): Promise<boolean> {
    setSaving(true)
    setMsg('')
    setError('')
    try {
      const res = await fetch(`/api/proposals/${id}/commercial`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commercial: content, items, valid_until: validUntil || null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar')
      setDirty(false)
      setMsg('Guardado')
      return true
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function preview() {
    if (dirty && !(await save())) return
    window.open(`/p/${proposal?.public_slug}?preview=1`, '_blank', 'noopener')
  }

  async function send() {
    setError('')
    if (!proposal?.prospect_email) { setError('Falta el correo del prospecto.'); return }
    if (missingPrices) { setError('Hay conceptos sin precio. Complétalos antes de enviar.'); return }
    if (dirty && !(await save())) return
    setSending(true)
    try {
      const res = await fetch(`/api/proposals/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Error al enviar')
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setSending(false)
    }
  }

  if (!proposal) return <div className="text-sm text-gray-400 py-20 text-center">Cargando...</div>

  if (proposal.status === 'generating') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-2xl">
        <div className="animate-spin w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-700 font-medium">Generando la propuesta comercial…</p>
        <p className="text-xs text-gray-400 mt-1">Puede tardar hasta un minuto. Esta página se actualiza sola.</p>
      </div>
    )
  }

  if (proposal.status === 'failed' && !proposal.commercial) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-2xl">
        <p className="text-sm text-red-700 font-medium">No se pudo generar la propuesta comercial</p>
        {proposal.failure_reason && <p className="text-xs text-red-500 mt-1">{proposal.failure_reason}</p>}
        <Link href={`/proposals/commercial/new${proposal.parent_proposal_id ? `?from=${proposal.parent_proposal_id}` : ''}`}
          className="inline-block mt-4 text-sm px-4 py-2 rounded-lg bg-gray-900 text-white">Intentar de nuevo</Link>
      </div>
    )
  }

  const isSent = proposal.status === 'sent' || proposal.status === 'sending'

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Propuesta comercial para {proposal.prospect_company}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {proposal.prospect_name}{proposal.prospect_title ? ` · ${proposal.prospect_title}` : ''}
          </p>
        </div>
        {proposal.accepted_at ? (
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-600 text-white">Aceptada</span>
        ) : isSent ? (
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-100 text-blue-800">Enviada</span>
        ) : (
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800">Lista para revisar</span>
        )}
      </div>

      {proposal.accepted_at && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-sm text-emerald-900 space-y-1">
          <p className="font-semibold">
            {proposal.accepted_by_name || 'El prospecto'} aceptó la propuesta el {new Date(proposal.accepted_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
          {proposal.accepted_option && <p>Opción elegida: {options.find(o => o.key === proposal.accepted_option)?.label ?? proposal.accepted_option}</p>}
          {proposal.accepted_comment && <p>Comentario: “{proposal.accepted_comment}”</p>}
        </div>
      )}

      {isSent && !proposal.accepted_at && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
          Esta propuesta ya se envió. Puedes verla tal como la ve el prospecto con el botón de vista previa.
        </div>
      )}

      <fieldset disabled={!editable} className="space-y-6 disabled:opacity-90">
        <Card title="Resumen">
          <div>
            <label className={labelClass}>Título</label>
            <input className={inputClass} value={content.title} onChange={e => setC('title', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Resumen ejecutivo</label>
            <textarea rows={4} className={inputClass} value={content.summary} onChange={e => setC('summary', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Situación del prospecto</label>
            <textarea rows={4} className={inputClass} value={content.situation} onChange={e => setC('situation', e.target.value)} />
          </div>
          <Lines label="Objetivos" value={content.objectives} onChange={v => setC('objectives', v)} />
        </Card>

        <Card title="Solución">
          {content.solution.map((s, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <input className={inputClass} value={s.title} placeholder="Título"
                  onChange={e => setC('solution', content.solution.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                <button type="button" className="text-xs text-red-600 hover:underline"
                  onClick={() => setC('solution', content.solution.filter((_, j) => j !== i))}>Quitar</button>
              </div>
              <textarea rows={3} className={inputClass} value={s.body}
                onChange={e => setC('solution', content.solution.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} />
            </div>
          ))}
          <button type="button" className="text-sm text-gray-700 underline"
            onClick={() => setC('solution', [...content.solution, { title: '', body: '' }])}>+ Agregar bloque</button>
          <Lines label="Entregables" value={content.deliverables} onChange={v => setC('deliverables', v)} />
        </Card>

        <Card title="Cronograma">
          {content.timeline.map((t, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <input className={`${smallInput} col-span-4`} value={t.phase} placeholder="Fase"
                onChange={e => setC('timeline', content.timeline.map((x, j) => j === i ? { ...x, phase: e.target.value } : x))} />
              <input className={`${smallInput} col-span-3`} value={t.duration} placeholder="Duración"
                onChange={e => setC('timeline', content.timeline.map((x, j) => j === i ? { ...x, duration: e.target.value } : x))} />
              <input className={`${smallInput} col-span-4`} value={t.description} placeholder="Qué ocurre"
                onChange={e => setC('timeline', content.timeline.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
              <button type="button" className="text-xs text-red-600 hover:underline col-span-1"
                onClick={() => setC('timeline', content.timeline.filter((_, j) => j !== i))}>Quitar</button>
            </div>
          ))}
          <button type="button" className="text-sm text-gray-700 underline"
            onClick={() => setC('timeline', [...content.timeline, { phase: '', duration: '', description: '' }])}>+ Agregar fase</button>
        </Card>

        <Card title="Inversión">
          {options.map(opt => (
            <div key={opt.key} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                {options.length > 1 ? (
                  <input className={`${smallInput} font-medium`} value={opt.label} onChange={e => renameOption(opt.key, e.target.value)} />
                ) : (
                  <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                )}
                {options.length > 1 && (
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input type="radio" name="recommended" checked={opt.recommended} onChange={() => setRecommended(opt.key)} />
                    Recomendado
                  </label>
                )}
              </div>
              <div className="space-y-2">
                {opt.items.map(it => {
                  const idx = items.indexOf(it)
                  const missing = it.unit_price === null
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <input className={`${smallInput} col-span-4`} value={it.description}
                          onChange={e => updateItem(idx, { description: e.target.value })} />
                        <input type="number" min={0} step="any" className={`${smallInput} col-span-1`} value={it.quantity}
                          onChange={e => updateItem(idx, { quantity: Number(e.target.value) || 1 })} />
                        <input type="number" min={0} step="any" placeholder="Precio"
                          className={`${smallInput} col-span-2 ${missing ? 'border-red-400 bg-red-50' : ''}`}
                          value={it.unit_price ?? ''}
                          onChange={e => updateItem(idx, { unit_price: e.target.value === '' ? null : Number(e.target.value) })} />
                        <input className={`${smallInput} col-span-1 uppercase`} maxLength={3} value={it.currency}
                          onChange={e => updateItem(idx, { currency: e.target.value.toUpperCase() })} />
                        <input type="number" min={0} max={100} step="any" title="Descuento %" className={`${smallInput} col-span-1`} value={it.discount_pct}
                          onChange={e => updateItem(idx, { discount_pct: Number(e.target.value) || 0 })} />
                        <span className="col-span-2 text-sm text-gray-700 text-right">
                          {itemTotal(it) === null ? '—' : formatMoney(itemTotal(it)!, it.currency)}
                        </span>
                        <button type="button" className="text-xs text-red-600 hover:underline col-span-1" onClick={() => removeItem(idx)}>Quitar</button>
                      </div>
                      {it.notes && <p className={`text-xs ${missing ? 'text-red-600' : 'text-gray-400'}`}>{it.notes}</p>}
                    </div>
                  )
                })}
                <p className="text-[11px] text-gray-400">Columnas: concepto · cantidad · precio unitario · moneda · descuento % · total</p>
              </div>
              <div className="flex items-center justify-between">
                <button type="button" className="text-sm text-gray-700 underline" onClick={() => addItem(opt.key, opt.items[0]?.option_label ?? null)}>+ Agregar concepto</button>
                <span className="text-sm font-semibold text-gray-900">Total: {formatTotals(opt.totals)}{opt.hasMissingPrice ? ' (incompleto)' : ''}</span>
              </div>
            </div>
          ))}
          {options.length === 0 && <p className="text-sm text-gray-400">No hay conceptos todavía.</p>}
          <div className="max-w-xs">
            <label className={labelClass}>Vigencia de la propuesta (hasta)</label>
            <input type="date" className={inputClass} value={validUntil} onChange={e => { setValidUntil(e.target.value); setDirty(true) }} />
          </div>
        </Card>

        <Card title="Confianza y condiciones">
          <p className="text-xs text-gray-400 -mt-2">Los casos de éxito y las respuestas a objeciones vienen de tu perfil de agencia, no los inventa la IA.</p>
          {content.proof.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input className={`${smallInput} col-span-4`} value={p.company} placeholder="Empresa"
                onChange={e => setC('proof', content.proof.map((x, j) => j === i ? { ...x, company: e.target.value } : x))} />
              <input className={`${smallInput} col-span-7`} value={p.result} placeholder="Resultado"
                onChange={e => setC('proof', content.proof.map((x, j) => j === i ? { ...x, result: e.target.value } : x))} />
              <button type="button" className="text-xs text-red-600 hover:underline col-span-1"
                onClick={() => setC('proof', content.proof.filter((_, j) => j !== i))}>Quitar</button>
            </div>
          ))}
          {content.faq.map((f, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <input className={inputClass} value={f.q} placeholder="Pregunta"
                  onChange={e => setC('faq', content.faq.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} />
                <button type="button" className="text-xs text-red-600 hover:underline"
                  onClick={() => setC('faq', content.faq.filter((_, j) => j !== i))}>Quitar</button>
              </div>
              <textarea rows={2} className={inputClass} value={f.a}
                onChange={e => setC('faq', content.faq.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} />
            </div>
          ))}
          <Lines label="Condiciones" value={content.terms} onChange={v => setC('terms', v)} />
          <Lines label="Siguientes pasos" value={content.next_steps} onChange={v => setC('next_steps', v)} />
        </Card>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && !error && <p className="text-sm text-gray-500">{msg}</p>}

      <div className="flex flex-wrap gap-3 pb-10">
        {editable && (
          <button onClick={() => save()} disabled={saving || !dirty}
            className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
        <button onClick={preview} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
          Vista previa
        </button>
        {editable && (
          <button onClick={send} disabled={sending}
            className="text-sm px-5 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
            {sending ? 'Enviando…' : `Aprobar y enviar${proposal.prospect_email ? ` a ${proposal.prospect_email}` : ''}`}
          </button>
        )}
      </div>
    </div>
  )
}
