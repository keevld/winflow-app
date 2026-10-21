'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCompactTotals } from '@/lib/dashboard'
import { ACTIVITY_LABEL, COST_ESTIMATE_USD, type Activity, type AdminAgency, type AdminData } from '@/lib/admin'

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'

const ACTIVITY_BADGE: Record<Activity, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  new: 'bg-blue-100 text-blue-800',
  slow: 'bg-yellow-100 text-yellow-800',
  dormant: 'bg-gray-200 text-gray-700',
}

const ATTENTION_ICON = { failed: '⚠', invite: '✉', dormant: '○', setup: '☐' } as const

const FIELDS: [string, string][] = [
  ['company_name', 'Nombre'], ['industry', 'Industria'], ['website', 'Sitio web'],
  ['contact_name', 'Contacto'], ['contact_email', 'Correo de contacto'], ['contact_phone', 'Teléfono'], ['booking_url', 'Link de agenda'],
]

const usd = (n: number) => `US$${n.toFixed(2)}`
const ago = (iso: string | null) => {
  if (!iso) return 'nunca'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d <= 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 30) return `hace ${d} días`
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

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

function BoardTile({ label, value, children, tone }: { label: string; value: string; children?: React.ReactNode; tone?: 'warn' }) {
  return (
    <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4 flex flex-col">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-3xl sm:text-4xl font-semibold tabular-nums mt-2 break-words ${tone === 'warn' ? 'text-amber-300' : 'text-white'}`}>{value}</p>
      <div className="mt-auto pt-3 text-xs text-slate-300 space-y-2">{children}</div>
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className="text-base font-semibold text-gray-900 tabular-nums">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
  )
}

export default function AdminClient({ data }: { data: AdminData }) {
  const router = useRouter()
  const { agencies, attention, platform } = data
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [adminName, setAdminName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [newUser, setNewUser] = useState<{ email: string; role: 'seller' | 'admin' }>({ email: '', role: 'seller' })
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Activity | 'all'>('all')

  async function call(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error ?? 'Error')
  }

  async function createAgency(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setMsg('')
    try {
      await call('/api/admin/agencies', 'POST', { company_name: name, admin_email: email, admin_name: adminName })
      setName(''); setEmail(''); setAdminName(''); setShowNew(false)
      setMsg('Agencia creada. Dile a su administrador que entre con su correo en /login.')
      router.refresh()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(false) }
  }

  async function saveAgency(id: string) {
    setBusy(true); setError('')
    try {
      await call(`/api/admin/agencies/${id}`, 'PATCH', draft)
      setEditing(null); router.refresh()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(false) }
  }

  async function addUser(id: string) {
    setBusy(true); setError('')
    try {
      await call(`/api/admin/agencies/${id}/users`, 'POST', newUser)
      setNewUser({ email: '', role: 'seller' }); router.refresh()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(false) }
  }

  const counts = useMemo(() => {
    const c: Record<Activity, number> = { active: 0, new: 0, slow: 0, dormant: 0 }
    for (const a of agencies) c[a.activity]++
    return c
  }, [agencies])

  const users = agencies.reduce((n, a) => n + a.users.length, 0)
  const delta = platform.sent30 - platform.sentPrev30
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return agencies.filter(a => {
      if (filter !== 'all' && a.activity !== filter) return false
      return !needle || `${a.company_name} ${a.contact_email} ${a.industry}`.toLowerCase().includes(needle)
    })
  }, [agencies, q, filter])

  const health = platform.failed7 + platform.stuck
  const costNote = `Estimado con supuestos: generación inicial ${usd(COST_ESTIMATE_USD.introGeneration)}, comercial ${usd(COST_ESTIMATE_USD.commercialGeneration)}, PDF ${usd(COST_ESTIMATE_USD.pdf)}. Winflow aún no registra tokens reales.`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Panel Winflow</h1>
          <p className="text-xs text-gray-500 mt-0.5">{agencies.length} {agencies.length === 1 ? 'agencia' : 'agencias'} · {users} {users === 1 ? 'usuario' : 'usuarios'}</p>
        </div>
        <button onClick={() => setShowNew(v => !v)} className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800">
          {showNew ? 'Cancelar' : '+ Nueva agencia'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}

      {showNew && (
        <form onSubmit={createAgency} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Nueva agencia</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <input required className={inputCls} placeholder="Nombre de la agencia" value={name} onChange={e => setName(e.target.value)} />
            <input required type="email" className={inputCls} placeholder="Correo del administrador" value={email} onChange={e => setEmail(e.target.value)} />
            <input className={inputCls} placeholder="Nombre del administrador" value={adminName} onChange={e => setAdminName(e.target.value)} />
          </div>
          <button disabled={busy} className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">Crear agencia</button>
        </form>
      )}

      <section className="rounded-2xl bg-slate-900 p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Salud de la plataforma</h2>
          <p className="text-xs text-slate-400 mt-0.5">Todas las agencias · últimos 30 días</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BoardTile label="Agencias activas" value={`${counts.active + counts.new}/${agencies.length}`}>
            <p>{counts.slow} con baja actividad · {counts.dormant} {counts.dormant === 1 ? 'dormida' : 'dormidas'}</p>
            <div className="flex h-2 rounded-full overflow-hidden bg-white/10" aria-hidden>
              {agencies.length > 0 && <>
                <div className="bg-emerald-300" style={{ width: `${(counts.active / agencies.length) * 100}%` }} />
                <div className="bg-sky-300" style={{ width: `${(counts.new / agencies.length) * 100}%` }} />
                <div className="bg-amber-300" style={{ width: `${(counts.slow / agencies.length) * 100}%` }} />
              </>}
            </div>
          </BoardTile>

          <BoardTile label="Propuestas enviadas" value={String(platform.sent30)}>
            <p>{delta === 0 ? <span className="text-slate-400">igual que el periodo anterior</span> : <span className={delta > 0 ? 'text-emerald-300' : 'text-amber-300'}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)} vs periodo anterior</span>}</p>
            <Sparkline values={platform.sentWeeks} color="#a5b4fc" label="Propuestas enviadas por semana, últimas 8 semanas" />
          </BoardTile>

          <BoardTile label="Valor ganado" value={Object.keys(platform.wonValue).length ? formatCompactTotals(platform.wonValue) : '—'}>
            <p>{platform.openRate === null ? 'aún sin envíos' : `${platform.openRate}% de las enviadas se abrieron`}</p>
            <p className="text-slate-400">Suma de lo que aceptaron los prospectos</p>
          </BoardTile>

          <BoardTile label="Costo de IA (estimado)" value={usd(platform.cost30)}>
            <p>{platform.generations30} generaciones en 30 días</p>
            <p className="text-slate-400" title={costNote}>Supuestos editables en lib/admin.ts</p>
          </BoardTile>
        </div>

        {health > 0 && (
          <p className="mt-3 text-xs text-amber-300">
            {platform.failed7 > 0 && `${platform.failed7} generación${platform.failed7 === 1 ? '' : 'es'} fallida${platform.failed7 === 1 ? '' : 's'} en 7 días`}
            {platform.failed7 > 0 && platform.stuck > 0 && ' · '}
            {platform.stuck > 0 && `${platform.stuck} atorada${platform.stuck === 1 ? '' : 's'} en "generando" más de 10 min`}
          </p>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700">Requiere atención</h2>
        {attention.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">Todo en orden: ninguna agencia necesita seguimiento ahora.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {attention.map((a, i) => (
              <li key={i} className="py-2 flex items-start gap-3 text-sm">
                <span className="text-gray-400 w-5 text-center" aria-hidden>{ATTENTION_ICON[a.kind]}</span>
                <span className="font-medium text-gray-900 shrink-0">{a.agency}</span>
                <span className="text-gray-600">{a.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-60" placeholder="Buscar agencia…" value={q} onChange={e => setQ(e.target.value)} />
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {([['all', 'Todas'], ['active', 'Activas'], ['slow', 'Baja'], ['dormant', 'Dormidas'], ['new', 'Nuevas']] as [Activity | 'all', string][]).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`text-xs px-3 py-1 rounded-md ${filter === k ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-600'}`}>{l}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 && <p className="text-sm text-gray-500 py-6">Ninguna agencia coincide.</p>}

        {filtered.map((a: AdminAgency) => {
          const s = a.stats
          const open = s.sent ? Math.round((s.opened / s.sent) * 100) : null
          const done = a.setup.filter(x => x.done).length
          const missing = a.setup.filter(x => !x.done)
          return (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{a.company_name}</h3>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${ACTIVITY_BADGE[a.activity]}`}>{ACTIVITY_LABEL[a.activity]}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{a.industry || 'Sin industria'} · {a.contact_email || 'Sin correo'} · última actividad {ago(a.last_activity)}</p>
                </div>
                <button className="text-sm text-gray-600 underline shrink-0" onClick={() => {
                  if (editing === a.id) { setEditing(null); return }
                  setEditing(a.id)
                  setDraft(Object.fromEntries(FIELDS.map(([k]) => [k, (a as unknown as Record<string, string | null>)[k] ?? ''])))
                }}>{editing === a.id ? 'Cerrar' : 'Editar'}</button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                <Metric label="Propuestas" value={String(s.total)} sub={`${s.commercial} comerciales`} />
                <Metric label="Enviadas (30 d)" value={String(s.sent30)} sub={`${s.sent} en total`} />
                <Metric label="Abiertas" value={open === null ? '—' : `${open}%`} />
                <Metric label="Ganadas" value={String(s.won)} sub={s.lost ? `${s.lost} perdidas` : undefined} />
                <Metric label="En juego" value={Object.keys(s.pipeline).length ? formatCompactTotals(s.pipeline) : '—'} />
                <Metric label="Valor ganado" value={Object.keys(s.wonValue).length ? formatCompactTotals(s.wonValue) : '—'} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Configuración</span><span className="tabular-nums">{done}/{a.setup.length}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100" aria-hidden>
                    <div className={`h-2 rounded-full ${done === a.setup.length ? 'bg-emerald-500' : done >= 5 ? 'bg-blue-500' : 'bg-amber-400'}`} style={{ width: `${(done / a.setup.length) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">{missing.length ? `Falta: ${missing.map(m => m.label.toLowerCase()).join(', ')}` : 'Perfil completo'}</p>
                  <p className="text-xs text-gray-400 mt-1" title={costNote}>IA estimada: {usd(s.cost30)} en 30 días · {usd(s.costAll)} acumulado{s.failed > 0 ? ` · ${s.failed} ${s.failed === 1 ? "fallida" : "fallidas"}` : ''}</p>
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

              {editing === a.id && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {FIELDS.map(([k, l]) => (
                      <label key={k} className="text-xs text-gray-500">{l}
                        <input className={`${inputCls} mt-1`} value={draft[k] ?? ''} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} />
                      </label>
                    ))}
                  </div>
                  <button disabled={busy} onClick={() => saveAgency(a.id)} className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">Guardar</button>
                  <div className="flex gap-2 pt-2">
                    <input className={inputCls} placeholder="Correo del nuevo usuario" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
                    <select className="border border-gray-300 rounded-lg px-2 text-sm" value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value as 'seller' | 'admin' }))}>
                      <option value="seller">Vendedor</option><option value="admin">Admin</option>
                    </select>
                    <button disabled={busy || !newUser.email} onClick={() => addUser(a.id)} className="border border-gray-300 text-sm px-3 rounded-lg disabled:opacity-50 shrink-0">Agregar usuario</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
