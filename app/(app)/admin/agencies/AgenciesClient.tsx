'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCompactTotals } from '@/lib/dashboard'
import { ACCOUNT_STAGES, ACTIVITY_LABEL, COST_ESTIMATE_USD, STAGE_LABEL, money, type AccountStage, type Activity, type AdminAgency } from '@/lib/admin'
import { Metric, STAGE_BADGE, ago, btnCls, btnGhost, call, inputCls, shortDate, usd } from '../ui'

const ACTIVITY_TEXT: Record<Activity, string> = {
  active: 'text-emerald-700',
  new: 'text-[#1d4c63]',
  slow: 'text-yellow-700',
  dormant: 'text-gray-500',
}

const FIELDS: [string, string][] = [
  ['company_name', 'Nombre'], ['industry', 'Industria'], ['website', 'Sitio web'],
  ['contact_name', 'Contacto'], ['contact_email', 'Correo de contacto'], ['contact_phone', 'Teléfono'], ['booking_url', 'Link de agenda'],
]

type Filter = 'all' | AccountStage | 'demo'
type AccountDraft = { is_demo: boolean; stage: AccountStage; plan: string; monthly_price: string; currency: 'MXN' | 'USD'; pilot_started_at: string; paying_since: string; churned_at: string; churn_reason: string; notes: string }

export default function AgenciesClient({ agencies }: { agencies: AdminAgency[] }) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [adminName, setAdminName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [acc, setAcc] = useState<AccountDraft | null>(null)
  const [newUser, setNewUser] = useState<{ email: string; role: 'seller' | 'admin' }>({ email: '', role: 'seller' })
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true); setError(''); setMsg('')
    try { await fn(); after?.(); router.refresh() } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(false) }
  }

  const createAgency = (e: React.FormEvent) => {
    e.preventDefault()
    run(() => call('/api/admin/agencies', 'POST', { company_name: name, admin_email: email, admin_name: adminName }), () => {
      setName(''); setEmail(''); setAdminName(''); setShowNew(false)
      setMsg('Agencia creada, en piloto desde hoy. Dile a su administrador que entre con su correo en winflowapp.com/login.')
    })
  }

  const kind = (a: AdminAgency): Exclude<Filter, 'all'> => (a.account.is_demo ? 'demo' : a.account.stage)
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: agencies.length, pilot: 0, paying: 0, paused: 0, churned: 0, demo: 0 }
    for (const a of agencies) c[kind(a)]++
    return c
  }, [agencies])

  const users = agencies.reduce((n, a) => n + a.users.length, 0)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return agencies.filter(a => {
      if (filter !== 'all' && kind(a) !== filter) return false
      return !needle || `${a.company_name} ${a.contact_email} ${a.industry}`.toLowerCase().includes(needle)
    })
  }, [agencies, q, filter])

  const costNote = `Estimado con supuestos: generación inicial ${usd(COST_ESTIMATE_USD.introGeneration)}, comercial ${usd(COST_ESTIMATE_USD.commercialGeneration)}, PDF ${usd(COST_ESTIMATE_USD.pdf)}. Winflow aún no registra el consumo real.`
  const filters: [Filter, string][] = [['all', 'Todas'], ['pilot', 'En piloto'], ['paying', 'Pagando'], ['paused', 'En pausa'], ['churned', 'De baja'], ['demo', 'De ejemplo']]

  function openEdit(a: AdminAgency) {
    if (editing === a.id) { setEditing(null); return }
    setEditing(a.id)
    setDraft(Object.fromEntries(FIELDS.map(([k]) => [k, (a as unknown as Record<string, string | null>)[k] ?? ''])))
    const x = a.account
    setAcc({
      is_demo: x.is_demo, stage: x.stage, plan: x.plan ?? '', monthly_price: x.monthly_price === null ? '' : String(x.monthly_price), currency: x.currency,
      pilot_started_at: x.pilot_started_at ?? '', paying_since: x.paying_since ?? '', churned_at: x.churned_at ?? '', churn_reason: x.churn_reason ?? '', notes: x.notes ?? '',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agencias</h1>
          <p className="text-sm text-gray-500 mt-1">{agencies.length} {agencies.length === 1 ? 'agencia' : 'agencias'} · {users} {users === 1 ? 'usuario' : 'usuarios'}</p>
        </div>
        <button onClick={() => setShowNew(v => !v)} className={btnCls}>{showNew ? 'Cancelar' : '+ Nueva agencia'}</button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}

      {showNew && (
        <form onSubmit={createAgency} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Nueva agencia</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <input required className={inputCls} placeholder="Nombre de la agencia" value={name} onChange={e => setName(e.target.value)} />
            <input required type="email" className={inputCls} placeholder="Correo del administrador" value={email} onChange={e => setEmail(e.target.value)} />
            <input className={inputCls} placeholder="Nombre del administrador" value={adminName} onChange={e => setAdminName(e.target.value)} />
          </div>
          <button disabled={busy} className={btnCls}>Crear agencia</button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputCls} sm:!w-60`} placeholder="Buscar agencia…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-gray-100 p-1">
          {filters.filter(([k]) => k === 'all' || counts[k] > 0 || filter === k).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`whitespace-nowrap text-xs px-3 py-1 rounded-full ${filter === k ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-600'}`}>{l} <span className="text-gray-400">{counts[k]}</span></button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && <p className="text-sm text-gray-500 py-6">Ninguna agencia coincide.</p>}

      {filtered.map(a => {
        const s = a.stats
        const x = a.account
        const open = s.sent ? Math.round((s.opened / s.sent) * 100) : null
        const done = a.setup.filter(i => i.done).length
        const missing = a.setup.filter(i => !i.done)
        const k = kind(a)
        const deal = x.is_demo
          ? 'No cuenta en las cifras de negocio'
          : [
              x.plan || 'Sin plan',
              x.monthly_price === null ? 'sin precio mensual' : x.monthly_price === 0 ? 'gratis' : `${money(x.monthly_price, x.currency)} al mes`,
              x.stage === 'paying' ? `paga desde ${shortDate(x.paying_since)}` : x.stage === 'churned' ? `baja ${shortDate(x.churned_at)}` : `piloto desde ${shortDate(x.pilot_started_at ?? a.created_at)}`,
            ].join(' · ')
        return (
          <div key={a.id} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{a.company_name || 'Agencia sin nombre'}</h3>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STAGE_BADGE[k]}`}>{k === 'demo' ? 'De ejemplo' : STAGE_LABEL[k]}</span>
                  <span className={`text-xs ${ACTIVITY_TEXT[a.activity]}`}>● {ACTIVITY_LABEL[a.activity]}</span>
                </div>
                <p className="text-sm text-gray-700 mt-1">{deal}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.industry || 'Sin industria'} · {a.contact_email || 'Sin correo'} · última actividad {ago(a.last_activity)}</p>
                {x.stage === 'churned' && x.churn_reason && <p className="text-xs text-[#8d3a35] mt-0.5">Motivo de baja: {x.churn_reason}</p>}
                {x.notes && <p className="text-xs text-gray-500 mt-0.5">Nota: {x.notes}</p>}
              </div>
              <button className="text-sm text-gray-600 underline shrink-0" onClick={() => openEdit(a)}>{editing === a.id ? 'Cerrar' : 'Editar'}</button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Metric label="Propuestas" value={String(s.total)} sub={`${s.commercial} comerciales`} />
              <Metric label="Enviadas (30 d)" value={String(s.sent30)} sub={`${s.sent} en total`} />
              <Metric label="Abiertas" value={open === null ? '—' : `${open}%`} />
              <Metric label="1.ª propuesta" value={a.days_to_first_send === null ? '—' : `${a.days_to_first_send} d`} sub={a.days_to_first_send === null ? 'aún no envía' : 'desde el alta'} />
              <Metric label="Sus ventas ganadas" value={Object.keys(s.wonValue).length ? formatCompactTotals(s.wonValue) : '—'} sub={`${s.won} ${s.won === 1 ? 'ganada' : 'ganadas'}${s.lost ? ` · ${s.lost} ${s.lost === 1 ? 'perdida' : 'perdidas'}` : ''}`} />
              <Metric label="Costo IA (30 d)" value={usd(s.cost30)} sub={`${usd(s.costAll)} acumulado`} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Configuración</span><span className="tabular-nums">{done}/{a.setup.length}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100" aria-hidden>
                  <div className={`h-2 rounded-full ${done === a.setup.length ? 'bg-emerald-500' : done >= 5 ? 'bg-brand-teal' : 'bg-amber-400'}`} style={{ width: `${(done / a.setup.length) * 100}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">{missing.length ? `Falta: ${missing.map(m => m.label.toLowerCase()).join(', ')}` : 'Perfil completo'}</p>
                <p className="text-xs text-gray-400 mt-1" title={costNote}>Costo de IA estimado{s.failed > 0 ? ` · ${s.failed} ${s.failed === 1 ? 'generación fallida' : 'generaciones fallidas'}` : ''}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Usuarios</p>
                {a.users.length ? (
                  <ul className="space-y-0.5">
                    {a.users.map(u => (
                      <li key={u.id} className="flex justify-between gap-2 text-gray-700">
                        <span className="truncate">{u.full_name || u.email || 'Sin nombre'} <span className="text-gray-400">· {u.role === 'admin' ? 'admin' : 'vendedor'}</span></span>
                        <span className={`shrink-0 text-xs ${u.last_sign_in_at ? 'text-gray-400' : 'text-amber-600'}`}>{u.last_sign_in_at ? `entró ${ago(u.last_sign_in_at)}` : 'aún no entra'}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-gray-400">Sin usuarios</p>}
              </div>
            </div>

            {editing === a.id && acc && (
              <div className="space-y-4 border-t border-gray-100 pt-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Estado comercial</p>
                  <p className="text-xs text-gray-500">Solo lo ves tú. De aquí salen el ingreso mensual, las altas y las bajas del panel de Negocio.</p>
                  <div className="grid gap-2 sm:grid-cols-3 mt-2">
                    <label className="text-xs text-gray-500">Estado
                      <select className={`${inputCls} mt-1`} value={acc.stage} onChange={e => setAcc({ ...acc, stage: e.target.value as AccountStage })}>
                        {ACCOUNT_STAGES.map(st => <option key={st} value={st}>{STAGE_LABEL[st]}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-gray-500">Plan
                      <input className={`${inputCls} mt-1`} placeholder="Ej. Fundador, Starter" value={acc.plan} onChange={e => setAcc({ ...acc, plan: e.target.value })} />
                    </label>
                    <label className="text-xs text-gray-500">Precio al mes
                      <span className="mt-1 flex gap-1">
                        <input type="number" min="0" step="0.01" className={inputCls} placeholder="0 si es gratis" value={acc.monthly_price} onChange={e => setAcc({ ...acc, monthly_price: e.target.value })} />
                        <select className="border border-gray-300 rounded-lg px-2 text-sm bg-white" value={acc.currency} onChange={e => setAcc({ ...acc, currency: e.target.value as 'MXN' | 'USD' })} aria-label="Moneda">
                          <option value="MXN">MXN</option><option value="USD">USD</option>
                        </select>
                      </span>
                    </label>
                    <label className="text-xs text-gray-500">Inicio del piloto
                      <input type="date" className={`${inputCls} mt-1`} value={acc.pilot_started_at} onChange={e => setAcc({ ...acc, pilot_started_at: e.target.value })} />
                    </label>
                    <label className="text-xs text-gray-500">Paga desde
                      <input type="date" className={`${inputCls} mt-1`} value={acc.paying_since} onChange={e => setAcc({ ...acc, paying_since: e.target.value })} />
                    </label>
                    <label className="text-xs text-gray-500">Fecha de baja
                      <input type="date" className={`${inputCls} mt-1`} value={acc.churned_at} onChange={e => setAcc({ ...acc, churned_at: e.target.value })} />
                    </label>
                    <label className="text-xs text-gray-500 sm:col-span-3">Motivo de baja
                      <input className={`${inputCls} mt-1`} placeholder="Qué dijeron al irse" value={acc.churn_reason} onChange={e => setAcc({ ...acc, churn_reason: e.target.value })} />
                    </label>
                    <label className="text-xs text-gray-500 sm:col-span-3">Notas internas
                      <textarea rows={2} className={`${inputCls} mt-1`} placeholder="Acuerdos, condiciones del piloto, siguiente paso" value={acc.notes} onChange={e => setAcc({ ...acc, notes: e.target.value })} />
                    </label>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={acc.is_demo} onChange={e => setAcc({ ...acc, is_demo: e.target.checked })} />
                    Es una agencia de ejemplo (no cuenta como cliente)
                  </label>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-900">Datos de la agencia</p>
                  <div className="grid gap-2 sm:grid-cols-2 mt-2">
                    {FIELDS.map(([f, l]) => (
                      <label key={f} className="text-xs text-gray-500">{l}
                        <input className={`${inputCls} mt-1`} value={draft[f] ?? ''} onChange={e => setDraft(d => ({ ...d, [f]: e.target.value }))} />
                      </label>
                    ))}
                  </div>
                </div>

                <button disabled={busy} onClick={() => run(() => call(`/api/admin/agencies/${a.id}`, 'PATCH', { ...draft, account: acc }), () => setEditing(null))} className={btnCls}>Guardar cambios</button>

                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  <input className={`${inputCls} flex-1 min-w-[12rem]`} placeholder="Correo del nuevo usuario" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
                  <select className="border border-gray-300 rounded-lg px-2 text-sm bg-white" value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value as 'seller' | 'admin' }))} aria-label="Rol">
                    <option value="seller">Vendedor</option><option value="admin">Admin</option>
                  </select>
                  <button disabled={busy || !newUser.email} onClick={() => run(() => call(`/api/admin/agencies/${a.id}/users`, 'POST', newUser), () => setNewUser({ email: '', role: 'seller' }))} className={btnGhost}>Agregar usuario</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
