'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ENGAGEMENT_TONE_CLASS } from '@/lib/engagement'
import { formatTotals } from '@/lib/commercial'
import { STAGE_LABEL, addTotals, daysUntil, type DashRow, type Stage } from '@/lib/dashboard'

const STAGE_BADGE: Record<Stage, string> = {
  prep: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-emerald-50 text-emerald-700',
  won: 'bg-emerald-600 text-white',
  lost: 'bg-gray-700 text-white',
}

const STAGES: Stage[] = ['prep', 'sent', 'viewed', 'won', 'lost']

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : '—'
}

export default function DashboardClient({ rows }: { rows: DashRow[] }) {
  const [stage, setStage] = useState<Stage | 'all'>('all')
  const [type, setType] = useState<'all' | 'intro' | 'commercial'>('all')
  const [q, setQ] = useState('')

  const stats = useMemo(() => {
    const open = rows.filter(r => r.stage === 'sent' || r.stage === 'viewed')
    const won = rows.filter(r => r.stage === 'won')
    const lost = rows.filter(r => r.stage === 'lost')
    const sentAll = rows.filter(r => r.stage !== 'prep')
    const viewedAll = rows.filter(r => r.stage === 'viewed' || r.stage === 'won' || r.stage === 'lost')
    const openValue = open.reduce((acc, r) => addTotals(acc, r.value), {} as Record<string, number>)
    const wonValue = won.reduce((acc, r) => addTotals(acc, r.value), {} as Record<string, number>)
    const expiring = open.filter(r => {
      const d = daysUntil(r.valid_until)
      return d !== null && d >= 0 && d <= 5
    })
    const followUp = rows
      .filter(r => r.stage === 'sent' || r.stage === 'viewed')
      .filter(r => r.engagement?.tone === 'urgent' || r.engagement?.tone === 'warning' || expiring.includes(r))
      .slice(0, 6)
    const counts = {
      prep: rows.filter(r => r.stage === 'prep').length,
      sent: rows.filter(r => r.stage === 'sent').length,
      viewed: rows.filter(r => r.stage === 'viewed').length,
      won: won.length,
      lost: lost.length,
    } as Record<Stage, number>
    return { open, won, lost, sentAll, viewedAll, openValue, wonValue, expiring, followUp, counts }
  }, [rows])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter(r => {
      if (stage !== 'all' && r.stage !== stage) return false
      if (type !== 'all' && r.type !== type) return false
      if (needle && !`${r.company} ${r.name} ${r.product}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [rows, stage, type, q])

  const closeBase = stats.won.length + stats.lost.length
  const closeRate = closeBase > 0 ? pct(stats.won.length, closeBase) : pct(stats.won.length, stats.sentAll.length)
  const closeSub = closeBase > 0 ? `${stats.won.length} de ${closeBase} cerradas` : `${stats.won.length} de ${stats.sentAll.length} enviadas`

  const funnel = [
    { label: 'Enviadas', n: stats.sentAll.length },
    { label: 'Vistas', n: stats.viewedAll.length },
    { label: 'Ganadas', n: stats.won.length },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Propuestas</h1>
        <div className="flex items-center gap-2">
          <Link href="/proposals/commercial/new" className="bg-white text-gray-900 text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
            + Propuesta comercial
          </Link>
          <Link href="/proposals/new" className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800">
            + Nueva propuesta
          </Link>
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="En seguimiento" value={String(stats.open.length)} sub={Object.keys(stats.openValue).length ? `${formatTotals(stats.openValue)} en juego` : 'enviadas sin cerrar'} />
            <Tile label="Ganadas" value={String(stats.won.length)} sub={Object.keys(stats.wonValue).length ? formatTotals(stats.wonValue) : undefined} />
            <Tile label="Tasa de cierre" value={closeRate} sub={closeSub} />
            <Tile label="Vencen en 5 días" value={String(stats.expiring.length)} sub="propuestas con vigencia por terminar" />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Embudo de propuestas enviadas</h2>
              <div className="space-y-3">
                {funnel.map(f => (
                  <div key={f.label} title={`${f.label}: ${f.n}`}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{f.label}</span>
                      <span className="text-gray-900 font-medium">{f.n} · {pct(f.n, funnel[0].n)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-indigo-600" style={{ width: funnel[0].n ? `${Math.max(2, (f.n / funnel[0].n) * 100)}%` : '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Toca dar seguimiento</h2>
              {stats.followUp.length === 0 ? (
                <p className="text-sm text-gray-400">Nada urgente por ahora.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {stats.followUp.map(r => {
                    const d = daysUntil(r.valid_until)
                    return (
                      <li key={r.id}>
                        <Link href={`/proposals/${r.id}`} className="flex items-center justify-between py-2 hover:bg-gray-50 -mx-2 px-2 rounded">
                          <span className="text-sm text-gray-900 truncate">{r.company}</span>
                          <span className="text-xs text-gray-500 ml-3 shrink-0">
                            {r.engagement && (r.engagement.tone === 'urgent' || r.engagement.tone === 'warning') ? r.engagement.label : d !== null ? `Vence en ${d} d` : ''}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setStage('all')} className={`text-xs px-3 py-1.5 rounded-full border ${stage === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
          Todas · {rows.length}
        </button>
        {STAGES.map(s => (
          <button key={s} onClick={() => setStage(s)} className={`text-xs px-3 py-1.5 rounded-full border ${stage === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
            {STAGE_LABEL[s]} · {stats.counts[s]}
          </button>
        ))}
        <select value={type} onChange={e => setType(e.target.value as 'all' | 'intro' | 'commercial')} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700 ml-auto">
          <option value="all">Todos los tipos</option>
          <option value="intro">Iniciales</option>
          <option value="commercial">Comerciales</option>
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar empresa, persona o servicio" className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">No hay propuestas todavía.</p>
          <Link href="/proposals/new" className="text-sm text-gray-900 underline mt-2 inline-block">Crear la primera</Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">Ninguna propuesta coincide con el filtro.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {filtered.map(r => (
            <Link key={r.id} href={`/proposals/${r.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {r.company}{r.name ? ` · ${r.name}` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {r.product || '—'} · {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {Object.keys(r.value).length > 0 && <> · {formatTotals(r.value)}</>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {r.engagement && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ENGAGEMENT_TONE_CLASS[r.engagement.tone]}`}>{r.engagement.label}</span>
                )}
                {r.type === 'commercial' && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800">Comercial</span>}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STAGE_BADGE[r.stage]}`}>{r.stage === 'won' && r.accepted ? 'Aceptada' : STAGE_LABEL[r.stage].replace(/s$/, '')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
