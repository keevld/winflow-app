'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Contact, ContactNote, ContactNoteKind } from '@/lib/types'
import { STAGE_LABEL, type Stage } from '@/lib/dashboard'
import { PageHeader } from '../../ui'

export interface ContactProposal {
  id: string
  type: 'intro' | 'commercial'
  product: string
  stage: Stage
  created_at: string
}

interface SimilarCase {
  id: string
  company: string
  relevancia: string
  motivo: string
  problem: string
  solution: string
  result: string
}

const KIND_LABEL: Record<ContactNoteKind, string> = { personal: 'Personal', call: 'De llamada', other: 'Otra' }
const KIND_BADGE: Record<ContactNoteKind, string> = {
  personal: 'bg-brand-coral-soft text-[#8d3a35]',
  call: 'bg-[#e8f1f4] text-[#1d4c63]',
  other: 'bg-gray-100 text-gray-600',
}
const STAGE_BADGE: Record<Stage, string> = {
  prep: 'bg-brand-peach/60 text-[#7a4a12]',
  sent: 'bg-[#e8f1f4] text-[#1d4c63]',
  viewed: 'bg-emerald-50 text-emerald-700',
  won: 'bg-emerald-600 text-white',
  lost: 'bg-gray-700 text-white',
}

const inputClass = 'wf-input'
const fmtDate = (iso: string) => new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

export default function ContactClient({
  contact, initialNotes, proposals,
}: { contact: Contact; initialNotes: ContactNote[]; proposals: ContactProposal[] }) {
  const [notes, setNotes] = useState(initialNotes)
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<ContactNoteKind>('personal')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [cases, setCases] = useState<SimilarCase[] | null>(null)
  const [loadingCases, setLoadingCases] = useState(false)
  const [casesError, setCasesError] = useState('')

  const isClient = proposals.some(p => p.stage === 'won')
  const personal = notes.filter(n => n.kind === 'personal').slice(0, 3)

  async function addNote() {
    if (!body.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/contacts/${contact.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, kind, noted_on: date }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar la nota')
      setNotes(n => [json.note as ContactNote, ...n].sort((a, b) => (a.noted_on < b.noted_on ? 1 : -1)))
      setBody('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  async function removeNote(id: string) {
    if (!window.confirm('¿Borrar esta nota?')) return
    const res = await fetch(`/api/contacts/${contact.id}/notes/${id}`, { method: 'DELETE' })
    if (res.ok) setNotes(n => n.filter(x => x.id !== id))
  }

  async function loadCases() {
    setLoadingCases(true)
    setCasesError('')
    try {
      const res = await fetch(`/api/contacts/${contact.id}/similar-cases`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'No se pudieron buscar casos')
      setCases((json.cases ?? []) as SimilarCase[])
    } catch (e) {
      setCasesError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoadingCases(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/clients', label: 'Clientes' }}
        title={contact.name || 'Sin nombre'}
        subtitle={
          <>
            {[contact.title, contact.company].filter(Boolean).join(' · ')}
            <span className="mt-1 block text-xs text-gray-400">
              {[contact.email, contact.industry, contact.company_size, contact.website].filter(Boolean).join(' · ')}
            </span>
          </>
        }
        action={
          <div className="flex shrink-0 items-center gap-2">
            <span className={`wf-pill ${isClient ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {isClient ? 'Cliente' : 'Prospecto'}
            </span>
            <Link href={`/proposals/commercial/new?contact=${contact.id}`} className="wf-btn wf-btn-sm">
              + Propuesta comercial
            </Link>
          </div>
        }
      />

      {personal.length > 0 && (
        <div className="wf-alert wf-alert-warn !p-5">
          <h2 className="wf-card-title mb-2">Para traer a la conversación</h2>
          <ul className="space-y-1.5">
            {personal.map(n => (
              <li key={n.id} className="text-sm">
                {n.body} <span className="text-xs opacity-70">· {fmtDate(n.noted_on)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="wf-card">
        <h2 className="wf-card-title">Notas</h2>
        <textarea rows={3} className={inputClass} value={body} onChange={e => setBody(e.target.value)}
          placeholder="Algo que te contó: su hijo se graduó, le encanta el pastel de chocolate, viaja en diciembre…" />
        <div className="flex flex-wrap items-center gap-2">
          <select value={kind} onChange={e => setKind(e.target.value as ContactNoteKind)} className="wf-input-sm !py-2">
            <option value="personal">Personal</option>
            <option value="call">De llamada</option>
            <option value="other">Otra</option>
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="wf-input-sm !py-2" />
          <button onClick={addNote} disabled={saving || !body.trim()} className="wf-btn wf-btn-sm !py-2">
            {saving ? 'Guardando...' : 'Guardar nota'}
          </button>
          {error && <span className="text-sm text-brand-coral">{error}</span>}
        </div>
        <p className="text-xs text-gray-400">Las notas solo las ve tu agencia. No se envían al cliente ni a la IA.</p>

        {notes.length > 0 && (
          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {notes.map(n => (
              <li key={n.id} className="py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-900 whitespace-pre-line">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    <span className={`px-2 py-0.5 rounded-full mr-2 ${KIND_BADGE[n.kind]}`}>{KIND_LABEL[n.kind]}</span>
                    {fmtDate(n.noted_on)}
                  </p>
                </div>
                <button onClick={() => removeNote(n.id)} className="wf-link-danger shrink-0">Borrar</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="wf-card !space-y-3">
        <h2 className="wf-card-title">Propuestas</h2>
        {proposals.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay propuestas con esta persona.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {proposals.map(p => (
              <li key={p.id}>
                <Link href={`/proposals/${p.id}`} className="-mx-2 flex items-center justify-between rounded-lg px-2 py-3 transition-colors hover:bg-brand-paper">
                  <span className="text-sm text-gray-900">
                    {p.product || (p.type === 'commercial' ? 'Propuesta comercial' : 'Propuesta inicial')}
                    <span className="text-xs text-gray-400 ml-2">{fmtDate(p.created_at)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {p.type === 'commercial' && <span className="wf-pill bg-indigo-100 text-indigo-800">Comercial</span>}
                    <span className={`wf-pill ${STAGE_BADGE[p.stage]}`}>{STAGE_LABEL[p.stage].replace(/s$/, '')}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="wf-card !space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="wf-card-title">Casos similares</h2>
          <button onClick={loadCases} disabled={loadingCases} className="wf-btn-ghost wf-btn-sm">
            {loadingCases ? 'Buscando...' : cases === null ? 'Buscar casos similares' : 'Buscar de nuevo'}
          </button>
        </div>
        {casesError && <p className="wf-alert wf-alert-error">{casesError}</p>}
        {cases !== null && cases.length === 0 && (
          <p className="text-sm text-gray-400">Tu banco de casos aún no tiene uno parecido a lo que necesita esta persona.</p>
        )}
        {cases && cases.length > 0 && (
          <ul className="space-y-4">
            {cases.map(c => (
              <li key={c.id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <p className="text-sm font-medium text-gray-900">
                  {c.company}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${c.relevancia === 'alta' ? 'bg-brand-mint-soft text-[#1f5a45]' : 'bg-gray-100 text-gray-600'}`}>
                    {c.relevancia === 'alta' ? 'Misma industria y trabajo' : 'Mismo tipo de trabajo'}
                  </span>
                </p>
                {c.motivo && <p className="text-xs text-gray-500 mt-1">{c.motivo}</p>}
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">
                  {[c.problem, c.solution, c.result].filter(Boolean).join(' → ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
