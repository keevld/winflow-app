'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/engagement'

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
      <div>
        <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
        <p className="text-sm text-gray-500 mt-1">Cada persona con la que has hablado, sus propuestas y lo que te contó.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`text-xs px-3 py-1.5 rounded-full border ${filter === t.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
            {t.label} · {counts[t.key]}
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar persona, empresa o correo"
          className="ml-auto text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-16">Aún no hay clientes. Se crean solos al hacer tu primera propuesta.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">Nadie coincide con el filtro.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {filtered.map(r => (
            <Link key={r.id} href={`/clients/${r.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {r.name || 'Sin nombre'}{r.company ? ` · ${r.company}` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {[r.title, r.industry, r.email].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {r.notes > 0 && <span className="text-xs text-gray-500">{r.notes} {r.notes === 1 ? 'nota' : 'notas'}</span>}
                <span className="text-xs text-gray-400">{r.proposals} {r.proposals === 1 ? 'propuesta' : 'propuestas'}</span>
                {r.openProposals > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">{r.openProposals} abierta{r.openProposals > 1 ? 's' : ''}</span>}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.isClient ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
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
