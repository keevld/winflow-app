'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/engagement'
import { PageHeader } from '../ui'

export interface ClientRow {
  id: string
  name: string
  company: string
  title: string
  email: string
  industry: string
  isClient: boolean
  openProposals: number
  proposals: number
  notes: number
  lastActivity: string
}

type Filter = 'all' | 'clients' | 'prospects' | 'open'

export default function ClientsClient({ rows }: { rows: ClientRow[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')

  const counts = useMemo(() => ({
    all: rows.length,
    clients: rows.filter(r => r.isClient).length,
    prospects: rows.filter(r => !r.isClient).length,
    open: rows.filter(r => r.openProposals > 0).length,
  }), [rows])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter(r => {
      if (filter === 'clients' && !r.isClient) return false
      if (filter === 'prospects' && r.isClient) return false
      if (filter === 'open' && r.openProposals === 0) return false
      if (needle && !`${r.name} ${r.company} ${r.email} ${r.industry}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [rows, filter, q])

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'clients', label: 'Clientes' },
    { key: 'prospects', label: 'Prospectos' },
    { key: 'open', label: 'Con propuesta abierta' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Clientes" subtitle="Cada persona con la que has hablado, sus propuestas y lo que te contó." />

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${filter === t.key ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-500'}`}>
            {t.label} · {counts[t.key]}
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar persona, empresa o correo"
          className="wf-input-sm !rounded-full !px-4 ml-auto w-full sm:w-72" />
      </div>

      {rows.length === 0 ? (
        <div className="wf-card items-center py-14 text-center">
          <p className="wf-card-title">Aún no hay clientes</p>
          <p className="wf-hint">Se crean solos al hacer tu primera propuesta.</p>
          <Link href="/proposals/new" className="wf-btn mx-auto">Crear propuesta</Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Nadie coincide con el filtro.</p>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,42,55,0.04)]">
          {filtered.map(r => (
            <Link key={r.id} href={`/clients/${r.id}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-4 transition-colors hover:bg-brand-paper">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {r.name || 'Sin nombre'}{r.company ? ` · ${r.company}` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {[r.title, r.industry, r.email].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {r.notes > 0 && <span className="text-xs text-gray-500">{r.notes} {r.notes === 1 ? 'nota' : 'notas'}</span>}
                <span className="text-xs text-gray-400">{r.proposals} {r.proposals === 1 ? 'propuesta' : 'propuestas'}</span>
                {r.openProposals > 0 && <span className="wf-pill bg-brand-peach/60 text-[#7a4a12]">{r.openProposals} abierta{r.openProposals > 1 ? 's' : ''}</span>}
                <span className={`wf-pill ${r.isClient ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {r.isClient ? 'Cliente' : 'Prospecto'}
                </span>
                <span className="text-xs text-gray-400 w-24 text-right">{formatRelativeTime(r.lastActivity)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
