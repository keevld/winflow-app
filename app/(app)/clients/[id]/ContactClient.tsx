'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Contact, ContactNote, ContactNoteKind } from '@/lib/types'
import { STAGE_LABEL, type Stage } from '@/lib/dashboard'

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
  personal: 'bg-pink-100 text-pink-800',
  call: 'bg-blue-100 text-blue-800',
  other: 'bg-gray-100 text-gray-600',
}
const STAGE_BADGE: Record<Stage, string> = {
  prep: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-emerald-50 text-emerald-700',
  won: 'bg-emerald-600 text-white',
  lost: 'bg-gray-700 text-white',
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
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
      <div>
        <Link href="/clients" className="text-xs text-gray-500 hover:text-gray-900">← Clientes</Link>
        <div className="flex items-start justify-between mt-2 gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{contact.name || 'Sin nombre'}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {[contact.title, contact.company].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {[contact.email, contact.industry, contact.company_size, contact.website].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isClient ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {isClient ? 'Cliente' : 'Prospecto'}
            </span>
            <Link href={`/proposals/commercial/new?contact=${contact.id}`} className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800">
              + Propuesta comercial
            </Link>
          </div>
        </div>
      </div>

      {personal.length > 0 && (
        <div className="bg-pink-50 border border-pink-100 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-pink-900 mb-2">Para traer a la conversación</h2>
          <ul className="space-y-1.5">
            {personal.map(n => (
              <li key={n.id} className="text-sm text-pink-950">
                {n.body} <span className="text-xs text-pink-700">· {fmtDate(n.noted_on)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Notas</h2>
        <textarea rows={3} className={inputClass} value={body} onChange={e => setBody(e.target.value)}
          placeholder="Algo que te contó: su hijo se graduó, le encanta el pastel de chocolate, viaja en diciembre…" />
        <div className="flex flex-wrap items-center gap-2">
          <select value={kind} onChange={e => setKind(e.target.value as ContactNoteKind)} className="text-sm border border-gray-300 rounded-lg px-2 py-2 bg-white">
            <option value="personal">Personal</option>
            <option value="call">De llamada</option>
            <option value="other">Otra</option>
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-2 py-2" />
          <button onClick={addNote} disabled={saving || !body.trim()} className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40">
            {saving ? 'Guardando...' : 'Guardar nota'}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
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
                <button onClick={() => removeNote(n.id)} className="text-xs text-gray-400 hover:text-red-600 shrink-0">Borrar</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Propuestas</h2>
        {proposals.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay propuestas con esta persona.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {proposals.map(p => (
              <li key={p.id}>
                <Link href={`/proposals/${p.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded">
                  <span className="text-sm text-gray-900">
                    {p.product || (p.type === 'commercial' ? 'Propuesta comercial' : 'Propuesta inicial')}
                    <span className="text-xs text-gray-400 ml-2">{fmtDate(p.created_at)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {p.type === 'commercial' && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800">Comercial</span>}
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STAGE_BADGE[p.stage]}`}>{STAGE_LABEL[p.stage].replace(/s$/, '')}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Casos similares</h2>
          <button onClick={loadCases} disabled={loadingCases} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">
            {loadingCases ? 'Buscando...' : cases === null ? 'Buscar casos similares' : 'Buscar de nuevo'}
          </button>
        </div>
        {casesError && <p className="text-sm text-red-600">{casesError}</p>}
        {cases !== null && cases.length === 0 && (
          <p className="text-sm text-gray-400">Tu banco de casos aún no tiene uno parecido a lo que necesita esta persona.</p>
        )}
        {cases && cases.length > 0 && (
          <ul className="space-y-4">
            {cases.map(c => (
              <li key={c.id} className="border border-gray-100 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900">
                  {c.company}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${c.relevancia === 'alta' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
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
