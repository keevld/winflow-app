'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Agency {
  id: string
  company_name: string | null
  industry: string | null
  website: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  booking_url: string | null
  users: { id: string; role: string; full_name: string }[]
  stats: { total: number; commercial: number; sent: number; opened: number; won: number; lost: number; accepted: number; last: string | null }
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'

export default function AdminClient({ agencies }: { agencies: Agency[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [adminName, setAdminName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [newUser, setNewUser] = useState<{ email: string; role: 'seller' | 'admin' }>({ email: '', role: 'seller' })
  const [msg, setMsg] = useState('')

  async function call(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error ?? 'Error')
  }

  async function createAgency(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await call('/api/admin/agencies', 'POST', { company_name: name, admin_email: email, admin_name: adminName })
      setName(''); setEmail(''); setAdminName('')
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

  const fields: [string, string][] = [
    ['company_name', 'Nombre'], ['industry', 'Industria'], ['website', 'Sitio web'],
    ['contact_name', 'Contacto'], ['contact_email', 'Correo de contacto'], ['contact_phone', 'Teléfono'], ['booking_url', 'Link de agenda'],
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900">Panel Winflow · Agencias clientes</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}

      <form onSubmit={createAgency} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Nueva agencia</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input required className={inputCls} placeholder="Nombre de la agencia" value={name} onChange={e => setName(e.target.value)} />
          <input required type="email" className={inputCls} placeholder="Correo del administrador" value={email} onChange={e => setEmail(e.target.value)} />
          <input className={inputCls} placeholder="Nombre del administrador" value={adminName} onChange={e => setAdminName(e.target.value)} />
        </div>
        <button disabled={busy} className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">Crear agencia</button>
      </form>

      <div className="space-y-4">
        {agencies.map(a => {
          const s = a.stats
          const open = s.sent ? Math.round((s.opened / s.sent) * 100) : 0
          return (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{a.company_name}</h3>
                  <p className="text-xs text-gray-500">{a.industry || 'Sin industria'} · {a.contact_email || 'Sin correo'}</p>
                </div>
                <button className="text-sm text-gray-600 underline" onClick={() => {
                  if (editing === a.id) { setEditing(null); return }
                  setEditing(a.id)
                  setDraft(Object.fromEntries(fields.map(([k]) => [k, (a as unknown as Record<string, string | null>)[k] ?? ''])))
                }}>{editing === a.id ? 'Cancelar' : 'Editar'}</button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-center text-xs">
                {[['Propuestas', s.total], ['Comerciales', s.commercial], ['Enviadas', s.sent], ['Abiertas', `${open}%`], ['Aceptadas', s.accepted], ['Ganadas', s.won], ['Perdidas', s.lost]].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg bg-gray-50 py-2"><div className="text-base font-semibold text-gray-900">{v}</div><div className="text-gray-500">{l}</div></div>
                ))}
              </div>
              <p className="text-xs text-gray-400">Última propuesta: {s.last ? new Date(s.last).toLocaleDateString('es-MX') : 'ninguna'}</p>

              <div className="text-sm text-gray-700">
                <p className="text-xs font-medium text-gray-500 mb-1">Usuarios</p>
                {a.users.length ? a.users.map(u => <p key={u.id}>{u.full_name || 'Sin nombre'} · {u.role}</p>) : <p className="text-gray-400">Sin usuarios</p>}
              </div>

              {editing === a.id && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {fields.map(([k, l]) => (
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
                    <button disabled={busy || !newUser.email} onClick={() => addUser(a.id)} className="border border-gray-300 text-sm px-3 rounded-lg disabled:opacity-50">Agregar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
