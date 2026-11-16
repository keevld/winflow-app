'use client'

import type { AccountStage } from '@/lib/admin'

// Piezas compartidas por las pantallas del panel del dueño.

export const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white'
export const btnCls = 'bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-gray-800 disabled:opacity-50'
export const btnGhost = 'border border-gray-300 text-sm px-3 py-1.5 rounded-full text-gray-700 hover:border-gray-500 disabled:opacity-50'

export const STAGE_BADGE: Record<AccountStage | 'demo', string> = {
  pilot: 'bg-[#e3eef2] text-[#1d4c63]',
  paying: 'bg-emerald-50 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-800',
  churned: 'bg-brand-coral-soft text-[#8d3a35]',
  demo: 'bg-gray-200 text-gray-700',
}

export const usd = (n: number) => `US$${n.toFixed(2)}`

export const ago = (iso: string | null) => {
  if (!iso) return 'nunca'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d <= 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 30) return `hace ${d} días`
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const shortDate = (iso: string | null) =>
  iso ? new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'Error')
  return json
}

export function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
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
      <circle cx={lx} cy={ly} r="3.5" fill={color} stroke="#0f2a37" strokeWidth="2" />
    </svg>
  )
}

export function BoardTile({ label, value, children, tone }: { label: string; value: string; children?: React.ReactNode; tone?: 'warn' | 'good' }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] ring-1 ring-white/10 p-4 flex flex-col min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`font-display text-2xl sm:text-3xl font-semibold tabular-nums mt-2 break-words ${tone === 'warn' ? 'text-amber-300' : tone === 'good' ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
      <div className="mt-auto pt-3 text-xs text-slate-300 space-y-1.5">{children}</div>
    </div>
  )
}

export function Card({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className="text-base font-semibold text-gray-900 tabular-nums">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
  )
}
