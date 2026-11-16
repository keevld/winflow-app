'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCompactTotals } from '@/lib/dashboard'
import { COST_ESTIMATE_USD, PILOT_GOAL, money, moneyTotals, toMxn, type AdminData, type Currency } from '@/lib/admin'
import { BoardTile, Card, Sparkline, btnGhost, call, inputCls, shortDate, usd } from './ui'

const ATTENTION_ICON = { failed: '⚠', invite: '✉', dormant: '○', setup: '☐' } as const
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function Progress({ label, value, goal, note }: { label: string; value: number; goal: number; note: string }) {
  const pct = Math.min(100, Math.round((value / goal) * 100))
  const done = value >= goal
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="font-display text-lg font-semibold tabular-nums text-gray-900">{value}<span className="text-gray-400"> / {goal}</span></p>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-gray-100" aria-hidden>
        <div className={`h-2 rounded-full ${done ? 'bg-emerald-500' : 'bg-brand-teal'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1">{note}</p>
    </div>
  )
}

export default function BusinessClient({ data }: { data: AdminData }) {
  const router = useRouter()
  const { business: b, platform, attention, agencies } = data
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cost, setCost] = useState<{ name: string; amount: string; currency: Currency }>({ name: '', amount: '', currency: 'USD' })
  const [fx, setFx] = useState(b.usdMxn ? String(b.usdMxn) : '')

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await fn(); router.refresh() } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(false) }
  }

  const active = b.counts.pilot + b.counts.paying + b.counts.paused
  const everReal = active + b.counts.churned

  // Costos del mes: variables (estimados, en dólares) + fijos (los que tú cargas).
  let costTotals: Record<string, number> = { USD: Math.round(b.variableCostUsd30 * 100) / 100 }
  for (const c of b.fixedCosts) costTotals = { ...costTotals, [c.currency]: Math.round(((costTotals[c.currency] ?? 0) + c.monthly_amount) * 100) / 100 }
  const fixedTotals = b.fixedCosts.reduce((t, c) => ({ ...t, [c.currency]: (t[c.currency] ?? 0) + c.monthly_amount }), {} as Record<string, number>)
  const mrrMxn = toMxn(b.mrr, b.usdMxn)
  const costMxn = toMxn(costTotals, b.usdMxn)
  const result = mrrMxn !== null && costMxn !== null ? Math.round((mrrMxn - costMxn) * 100) / 100 : null
  const hasNew = Object.values(b.newMrr30).some(Boolean), hasLost = Object.values(b.lostMrr30).some(Boolean)
  const delta = platform.sent30 - platform.sentPrev30
  const health = platform.failed7 + platform.stuck
  const costNote = `Supuestos: propuesta inicial ${usd(COST_ESTIMATE_USD.introGeneration)}, comercial ${usd(COST_ESTIMATE_USD.commercialGeneration)}, PDF ${usd(COST_ESTIMATE_USD.pdf)}. Winflow aún no registra el consumo real.`
  const steps: [string, number, string][] = [
    ['Solicitudes de piloto', b.funnel.requests, 'Llegaron por la landing'],
    ['Agencias dadas de alta', b.funnel.agencies, 'Tienen cuenta'],
    ['Enviaron una propuesta', b.funnel.activated, 'Ya lo usaron con un prospecto'],
    ['Pagan', b.funnel.paying, 'Con precio mensual'],
  ]
  const stepMax = Math.max(1, ...steps.map(s => s[1]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Negocio</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cómo va Winflow como empresa. Solo tú ves este panel.
          {b.demo > 0 && ` ${plural(b.demo, 'agencia de ejemplo queda', 'agencias de ejemplo quedan')} fuera de las cifras.`}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="wf-board rounded-3xl p-5 shadow-sm">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BoardTile label="Ingreso mensual recurrente" value={moneyTotals(b.mrr)}>
            <p>{b.counts.paying === 0 ? 'Todavía nadie paga' : plural(b.counts.paying, 'agencia pagando', 'agencias pagando')}</p>
            {(hasNew || hasLost) && (
              <p>
                {hasNew && <span className="text-emerald-300">+{moneyTotals(b.newMrr30)} nuevo</span>}
                {hasNew && hasLost && ' · '}
                {hasLost && <span className="text-amber-300">−{moneyTotals(b.lostMrr30)} perdido</span>}
                <span className="text-slate-400"> en 30 días</span>
              </p>
            )}
            {b.payingWithoutPrice > 0 && <p className="text-amber-300">{plural(b.payingWithoutPrice, 'agencia que paga no tiene', 'agencias que pagan no tienen')} precio cargado</p>}
          </BoardTile>

          <BoardTile label="Agencias activas" value={String(active)}>
            <p>{b.counts.pilot} en piloto · {b.counts.paying} pagando{b.counts.paused > 0 ? ` · ${b.counts.paused} en pausa` : ''}</p>
            <div className="flex h-2 rounded-full overflow-hidden bg-white/10" aria-hidden>
              {active > 0 && <>
                <div className="bg-emerald-300" style={{ width: `${(b.counts.paying / active) * 100}%` }} />
                <div className="bg-sky-300" style={{ width: `${(b.counts.pilot / active) * 100}%` }} />
                <div className="bg-amber-300" style={{ width: `${(b.counts.paused / active) * 100}%` }} />
              </>}
            </div>
          </BoardTile>

          <BoardTile label="Bajas (90 días)" value={String(b.churned90)} tone={b.churned90 > 0 ? 'warn' : undefined}>
            <p>{b.counts.churned === 0 ? 'Ninguna agencia se ha dado de baja' : `${b.counts.churned} de ${everReal} en total`}</p>
          </BoardTile>

          <BoardTile label="Resultado del mes (estimado)" value={result === null ? '—' : money(result, 'MXN')} tone={result === null ? undefined : result >= 0 ? 'good' : 'warn'}>
            {result === null
              ? <p className="text-amber-300">Carga el tipo de cambio en Costos para sumar pesos y dólares</p>
              : <p>Ingreso {money(mrrMxn!, 'MXN')} − costos {money(costMxn!, 'MXN')}</p>}
            <p className="text-slate-400">Costos: {moneyTotals(costTotals, 'US$0')} al mes</p>
          </BoardTile>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Meta del piloto" hint="Lo que tiene que pasar para decir que el piloto funcionó">
          <div className="space-y-4">
            <Progress label="Agencias que lo prueban" value={b.goal.trying} goal={PILOT_GOAL.trying} note="Agencias reales con cuenta" />
            <Progress label="Envían propuestas reales" value={b.goal.sending} goal={PILOT_GOAL.sending} note="Con al menos una propuesta enviada a un prospecto" />
            <Progress label="Aceptan pagar" value={b.goal.paying} goal={PILOT_GOAL.paying} note="Marcadas como «Pagando» en Agencias" />
          </div>
        </Card>

        <Card title="Embudo" hint="De la solicitud al pago" action={b.newRequests > 0 ? <Link href="/admin/requests" className="text-sm font-medium text-brand-teal underline shrink-0">{plural(b.newRequests, 'solicitud nueva', 'solicitudes nuevas')}</Link> : undefined}>
          <ol className="space-y-3">
            {steps.map(([label, n, note]) => (
              <li key={label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-gray-900">{label}</span>
                  <span className="font-display text-lg font-semibold tabular-nums text-gray-900">{n}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-gray-100" aria-hidden>
                  <div className="h-2 rounded-full bg-brand-teal" style={{ width: `${(n / stepMax) * 100}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{note}</p>
              </li>
            ))}
          </ol>
          <p className="text-xs text-gray-500 mt-4 border-t border-gray-100 pt-3">
            {b.medianDaysToFirstSend === null
              ? 'Ninguna agencia real ha enviado su primera propuesta todavía.'
              : `Tiempo típico del alta a la primera propuesta enviada: ${plural(b.medianDaysToFirstSend, 'día', 'días')}.`}
          </p>
        </Card>

        <Card title="Costos" hint="Lo que cuesta operar Winflow cada mes">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-700">IA y PDF, últimos 30 días <span className="text-gray-400" title={costNote}>(estimado)</span></dt>
              <dd className="font-semibold tabular-nums text-gray-900">{usd(b.variableCostUsd30)}</dd>
            </div>
            <p className="text-xs text-gray-500">
              {plural(platform.generations30, 'propuesta generada', 'propuestas generadas')}
              {b.demoCostUsd30 > 0 && ` · ${usd(b.demoCostUsd30)} son de la agencia de ejemplo`}
              {active > 0 && ` · ${usd((b.variableCostUsd30 - b.demoCostUsd30) / active)} por agencia activa`}
            </p>
            <div className="flex justify-between gap-3 border-t border-gray-100 pt-2">
              <dt className="text-gray-700">Costos fijos</dt>
              <dd className="font-semibold tabular-nums text-gray-900">{moneyTotals(fixedTotals, 'Sin cargar')}</dd>
            </div>
          </dl>

          {b.fixedCosts.length > 0 && (
            <ul className="mt-2 divide-y divide-gray-100 text-sm">
              {b.fixedCosts.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-gray-700 truncate">{c.name}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="tabular-nums text-gray-900">{money(c.monthly_amount, c.currency)}</span>
                    <button disabled={busy} onClick={() => run(() => call(`/api/admin/costs/${c.id}`, 'DELETE'))} className="text-xs text-gray-400 underline hover:text-red-600">Quitar</button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={e => { e.preventDefault(); run(async () => { await call('/api/admin/costs', 'POST', { name: cost.name, monthly_amount: cost.amount, currency: cost.currency }); setCost({ name: '', amount: '', currency: cost.currency }) }) }}
          >
            <input required className={`${inputCls} flex-1 min-w-[9rem]`} placeholder="Ej. Hosting, base de datos, correo" value={cost.name} onChange={e => setCost(c => ({ ...c, name: e.target.value }))} />
            <input required type="number" min="0" step="0.01" className={`${inputCls} !w-24`} placeholder="Al mes" value={cost.amount} onChange={e => setCost(c => ({ ...c, amount: e.target.value }))} />
            <select className="border border-gray-300 rounded-lg px-2 text-sm bg-white" value={cost.currency} onChange={e => setCost(c => ({ ...c, currency: e.target.value as Currency }))} aria-label="Moneda">
              <option value="USD">USD</option><option value="MXN">MXN</option>
            </select>
            <button disabled={busy} className={btnGhost}>Agregar</button>
          </form>

          <form
            className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-sm text-gray-700"
            onSubmit={e => { e.preventDefault(); run(() => call('/api/admin/settings', 'PUT', { usd_mxn: fx })) }}
          >
            <label htmlFor="fx">Tipo de cambio: 1 USD =</label>
            <input id="fx" type="number" min="0" step="0.0001" className={`${inputCls} !w-24`} placeholder="MXN" value={fx} onChange={e => setFx(e.target.value)} />
            <span>MXN</span>
            <button disabled={busy} className={btnGhost}>Guardar</button>
          </form>
          <p className="text-xs text-gray-500 mt-2">Se usa solo para sumar pesos y dólares en el resultado del mes. Actualízalo cuando quieras.</p>
        </Card>

        <Card title="Uso del producto" hint="Agencias reales · últimos 30 días">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Propuestas enviadas</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-gray-900">{platform.sent30}</p>
              <p className="text-xs">{delta === 0 ? <span className="text-gray-400">igual que el periodo anterior</span> : <span className={delta > 0 ? 'text-emerald-700' : 'text-amber-700'}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)} vs periodo anterior</span>}</p>
              <div className="mt-1"><Sparkline values={platform.sentWeeks} color="#4f93a1" label="Propuestas enviadas por semana, últimas 8 semanas" /></div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Se abrieron</p>
                <p className="font-display text-2xl font-semibold tabular-nums text-gray-900">{platform.openRate === null ? '—' : `${platform.openRate}%`}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Ventas que cerraron tus agencias</p>
                <p className="font-display text-xl font-semibold tabular-nums text-gray-900">{Object.keys(platform.wonValue).length ? formatCompactTotals(platform.wonValue) : 'Sin cierres'}</p>
                <p className="text-xs text-gray-500">{Object.keys(platform.pipeline).length ? `${formatCompactTotals(platform.pipeline)} en juego` : 'Nada en juego por ahora'}</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 border-t border-gray-100 pt-3">Las ventas son de las agencias con sus clientes, no ingreso de Winflow. Sirven como prueba de que el producto les funciona.</p>
          {health > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              {platform.failed7 > 0 && `${plural(platform.failed7, 'generación fallida', 'generaciones fallidas')} en 7 días`}
              {platform.failed7 > 0 && platform.stuck > 0 && ' · '}
              {platform.stuck > 0 && `${plural(platform.stuck, 'atorada', 'atoradas')} en «generando» más de 10 min`}
            </p>
          )}
        </Card>
      </div>

      <Card title="Agencias en riesgo" hint="Señales de que una agencia puede no quedarse" action={<Link href="/admin/agencies" className="text-sm font-medium text-brand-teal underline shrink-0">Ver agencias</Link>}>
        {attention.length === 0 ? (
          <p className="text-sm text-gray-500">{agencies.length === 0 ? 'Todavía no hay agencias.' : 'Sin señales de riesgo por ahora.'}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {attention.map((a, i) => (
              <li key={i} className="py-2 flex flex-wrap items-start gap-x-3 gap-y-0.5 text-sm">
                <span className="text-gray-400 w-5 text-center" aria-hidden>{ATTENTION_ICON[a.kind]}</span>
                <span className="font-medium text-gray-900 shrink-0">{a.agency}</span>
                <span className="text-gray-600">{a.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {b.churnedList.length > 0 && (
        <Card title="Por qué se fueron" hint="Motivos de baja que registraste">
          <ul className="divide-y divide-gray-100 text-sm">
            {b.churnedList.map((c, i) => (
              <li key={i} className="py-2 flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="font-medium text-gray-900">{c.agency}</span>
                <span className="text-gray-500">{shortDate(c.churned_at)}</span>
                <span className="text-gray-700">{c.reason || 'Sin motivo registrado'}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs text-gray-400">
        Ingresos, estados y bajas salen de lo que cargas en Agencias: todavía no hay cobro automático conectado. Los costos de IA son estimados.
      </p>
    </div>
  )
}
