'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ENGAGEMENT_TONE_CLASS } from '@/lib/engagement'
import { formatTotals } from '@/lib/commercial'
import {
  STAGE_LABEL, addTotals, daysUntil, formatCompactTotals, weeklyCounts,
  type DashRow, type Stage,
} from '@/lib/dashboard'

const STAGE_BADGE: Record<Stage, string> = {
  prep: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-emerald-50 text-emerald-700',
  won: 'bg-emerald-600 text-white',
  lost: 'bg-gray-700 text-white',
}
const STAGES: Stage[] = ['prep', 'sent', 'viewed', 'won', 'lost']
const DAY = 24 * 60 * 60 * 1000

type Period = 30 | 90 | 0 // 0 = todo

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—')

function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  const W = 140, H = 36, pad = 4
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? (W - pad * 2) / (values.length - 1) : 0
  const pts = values.map((v, i) => [pad + i * step, H - pad - (v / max) * (H - pad * 2)] as const)
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${pad},${H - pad} ${line} ${pts[pts.length - 1][0].toFixed(1)},${H - pad}`
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-9" role="img" aria-label={label} preserveAspectRatio="none">
      <polygon points={area} fill={color} opacity="0.15" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="3.5" fill={color} stroke="#0f172a" strokeWidth="2" />
    </svg>
  )
}

function Delta({ now, before }: { now: number; before: number }) {
  const diff = now - before
  if (diff === 0) return <span className="text-slate-400">igual que el periodo anterior</span>
  return (
    <span className={diff > 0 ? 'text-emerald-300' : 'text-amber-300'}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(diff)} vs periodo anterior
    </span>
  )
}

function BoardTile({ label, value, children, tone }: { label: string; value: string; children?: React.ReactNode; tone?: 'warn' }) {
  return (
    <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4 flex flex-col">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-4xl font-semibold tabular-nums mt-2 ${tone === 'warn' ? 'text-amber-300' : 'text-white'}`}>{value}</p>
      <div className="mt-auto pt-3 text-xs text-slate-300 space-y-2">{children}</div>
    </div>
  )
}

export default function DashboardClient({ rows }: { rows: DashRow[] }) {
  const [stage, setStage] = useState<Stage | 'all'>('all')
  const [type, setType] = useState<'all' | 'intro' | 'commercial'>('all')
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState<Period>(30)

  const s = useMemo(() => {
    const now = Date.now()
    const span = period === 0 ? Infinity : period * DAY
    const inCur = (iso: string | null) => !!iso && (span === Infinity || now - new Date(iso).getTime() <= span)
    const inPrev = (iso: string | null) => {
      if (!iso || span === Infinity) return false
      const age = now - new Date(iso).getTime()
      return age > span && age <= span * 2
    }

    const open = rows.filter(r => r.stage === 'sent' || r.stage === 'viewed')
    const openValue = open.reduce((a, r) => addTotals(a, r.value), {} as Record<string, number>)
    const wonCur = rows.filter(r => r.stage === 'won' && inCur(r.closed_at))
    const wonPrev = rows.filter(r => r.stage === 'won' && inPrev(r.closed_at))
    const lostCur = rows.filter(r => r.stage === 'lost' && inCur(r.closed_at))
    const wonValue = wonCur.reduce((a, r) => addTotals(a, r.value), {} as Record<string, number>)
    const sentCur = rows.filter(r => inCur(r.sent_at))
    const sentPrev = rows.filter(r => inPrev(r.sent_at))
    const expiring = open.filter(r => {
      const d = daysUntil(r.valid_until)
      return d !== null && d >= 0 && d <= 5
    })
    const followUp = open
      .filter(r => r.engagement?.tone === 'urgent' || r.engagement?.tone === 'warning' || expiring.includes(r))
      .slice(0, 6)

    const sentAll = rows.filter(r => r.stage !== 'prep')
    const viewedAll = rows.filter(r => r.stage === 'viewed' || r.stage === 'won' || r.stage === 'lost')
    const wonAll = rows.filter(r => r.stage === 'won')

    const closedBase = wonCur.length + lostCur.length
    const weeksSent = weeklyCounts(rows.map(r => r.sent_at), 8)
    const weeksWon = weeklyCounts(rows.filter(r => r.stage === 'won').map(r => r.closed_at), 8)

    const counts = Object.fromEntries(STAGES.map(st => [st, rows.filter(r => r.stage === st).length])) as Record<Stage, number>
    return {
      open, openValue, wonCur, wonPrev, wonValue, sentCur, sentPrev, expiring, followUp,
      sentAll, viewedAll, wonAll, closedBase, lostCur, weeksSent, weeksWon, counts,
    }
  }, [rows, period])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const rank: Record<Stage, number> = { viewed: 0, sent: 1, won: 2, prep: 3, lost: 4 }
    return [...rows].sort((a, b) => rank[a.stage] - rank[b.stage]).filter(r => {
      if (stage !== 'all' && r.stage !== stage) return false
      if (type !== 'all' && r.type !== type) return false
      if (needle && !`${r.company} ${r.name} ${r.product}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [rows, stage, type, q])

  const funnel = [
    { label: 'Enviadas', n: s.sentAll.length },
    { label: 'Vistas', n: s.viewedAll.length },
    { label: 'Ganadas', n: s.wonAll.length },
  ]
  const maxWeek = Math.max(1, ...s.weeksSent.map(w => w.count))
  const periodLabel = period === 0 ? 'todo el tiempo' : `últimos ${period} días`

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
          <section className="rounded-2xl bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Resumen del equipo</h2>
                <p className="text-xs text-slate-400 mt-0.5">Cierres y envíos: {periodLabel}</p>
              </div>
              <div className="flex gap-1 rounded-lg bg-white/5 p-1">
                {([[30, '30 días'], [90, '90 días'], [0, 'Todo']] as [Period, string][]).map(([p, label]) => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`text-xs px-3 py-1 rounded-md ${period === p ? 'bg-white text-slate-900 font-medium' : 'text-slate-300 hover:text-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <BoardTile label="En seguimiento" value={String(s.open.length)}>
                <p>{Object.keys(s.openValue).length ? `${formatCompactTotals(s.openValue)} en juego` : 'enviadas sin cerrar'}</p>
                {period !== 0 && <p><span className="text-slate-200">{s.sentCur.length} enviadas</span> · <Delta now={s.sentCur.length} before={s.sentPrev.length} /></p>}
                <Sparkline values={s.weeksSent.map(w => w.count)} color="#a5b4fc" label="Propuestas enviadas por semana, últimas 8 semanas" />
              </BoardTile>

              <BoardTile label="Ganadas" value={String(s.wonCur.length)}>
                <p>{Object.keys(s.wonValue).length ? formatCompactTotals(s.wonValue) : 'sin monto registrado'}</p>
                {period !== 0 && <p><Delta now={s.wonCur.length} before={s.wonPrev.length} /></p>}
                {s.weeksWon.some(w => w.count > 0)
                  ? <Sparkline values={s.weeksWon.map(w => w.count)} color="#6ee7b7" label="Propuestas ganadas por semana, últimas 8 semanas" />
                  : <p className="h-9 flex items-end text-slate-500">Tu primer cierre aparecerá aquí</p>}
              </BoardTile>

              <BoardTile label="Tasa de cierre" value={pct(s.wonCur.length, s.closedBase)}>
                <p>{s.closedBase > 0 ? `${s.wonCur.length} de ${s.closedBase} cerradas` : 'aún sin propuestas cerradas'}</p>
                <div className="h-2 rounded-full bg-white/10" aria-hidden>
                  <div className="h-2 rounded-full bg-emerald-300" style={{ width: s.closedBase ? `${(s.wonCur.length / s.closedBase) * 100}%` : '0%' }} />
                </div>
                <p className="text-slate-400">{s.lostCur.length} perdidas · {s.wonCur.length} ganadas</p>
              </BoardTile>

              <BoardTile label="Vencen en 5 días" value={String(s.expiring.length)} tone={s.expiring.length > 0 ? 'warn' : undefined}>
                {s.expiring.length > 0 ? (
                  <ul className="space-y-1">
                    {s.expiring.slice(0, 3).map(r => (
                      <li key={r.id} className="flex justify-between gap-2">
                        <span className="truncate text-slate-200">{r.company}</span>
                        <span className="shrink-0 text-amber-300">{daysUntil(r.valid_until)} d</span>
                      </li>
                    ))}
                  </ul>
                ) : <p>Nada por vencer pronto</p>}
              </BoardTile>
            </div>
          </section>

          <div className="grid lg:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900">Envíos por semana</h2>
              <p className="text-xs text-gray-400 mt-0.5 mb-4">Últimas 8 semanas</p>
              <div className="flex items-end gap-2 h-28">
                {s.weeksSent.map(w => (
                  <div key={w.start} className="flex-1 flex flex-col items-center justify-end h-full" title={`Semana del ${new Date(w.start).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}: ${w.count}`}>
                    <span className="text-xs text-gray-700 tabular-nums mb-1">{w.count || ''}</span>
                    <div className="w-full bg-indigo-600" style={{ height: `${Math.max(w.count ? 6 : 2, (w.count / maxWeek) * 80)}%`, borderRadius: '4px 4px 0 0', opacity: w.count ? 1 : 0.2 }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                {s.weeksSent.map(w => (
                  <span key={w.start} className="flex-1 text-center text-[10px] text-gray-400">
                    {new Date(w.start).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900">Embudo</h2>
              <p className="text-xs text-gray-400 mt-0.5 mb-4">Acumulado: cada etapa incluye las siguientes</p>
              <div className="space-y-4">
                {funnel.map(f => (
                  <div key={f.label} title={`${f.label}: ${f.n}`}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{f.label}</span>
                      <span className="text-gray-900 font-medium tabular-nums">{f.n} · {pct(f.n, funnel[0].n)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-100">
                      <div className="h-2.5 rounded-full bg-indigo-600" style={{ width: funnel[0].n ? `${Math.max(2, (f.n / funnel[0].n) * 100)}%` : '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900">Toca dar seguimiento</h2>
              <p className="text-xs text-gray-400 mt-0.5 mb-3">Frías o por vencer</p>
              {s.followUp.length === 0 ? (
                <p className="text-sm text-gray-400">Nada urgente por ahora.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {s.followUp.map(r => {
                    const d = daysUntil(r.valid_until)
                    const cold = r.engagement && (r.engagement.tone === 'urgent' || r.engagement.tone === 'warning')
                    return (
                      <li key={r.id}>
                        <Link href={`/proposals/${r.id}`} className="flex items-center justify-between py-2 hover:bg-gray-50 -mx-2 px-2 rounded">
                          <span className="text-sm text-gray-900 truncate">{r.company}</span>
                          <span className={`text-xs ml-3 shrink-0 ${r.engagement?.tone === 'urgent' ? 'text-red-600 font-medium' : 'text-amber-700'}`}>
                            {cold ? r.engagement!.label : d !== null ? `Vence en ${d} d` : ''}
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
        {STAGES.map(st => (
          <button key={st} onClick={() => setStage(st)} className={`text-xs px-3 py-1.5 rounded-full border ${stage === st ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
            {STAGE_LABEL[st]} · {s.counts[st]}
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
                  {r.product ? `${r.product} · ` : ''}{new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {Object.keys(r.value).length > 0 && (
                  <span className="text-sm font-semibold text-gray-900 tabular-nums mr-1">{formatTotals(r.value)}</span>
                )}
                {r.engagement && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ENGAGEMENT_TONE_CLASS[r.engagement.tone]}`}>{r.engagement.label}</span>
                )}
                {r.type === 'commercial' && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800">Comercial</span>}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STAGE_BADGE[r.stage]}`}>{r.stage === 'won' && r.accepted ? 'Falta contrato' : STAGE_LABEL[r.stage].replace(/s$/, '')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
