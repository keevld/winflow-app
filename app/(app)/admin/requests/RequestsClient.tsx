'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { REQUEST_STATUS_LABEL, type PilotRequest, type RequestStatus } from '@/lib/admin'
import { ago, btnCls, btnGhost, call, inputCls } from '../ui'

const STATUS_BADGE: Record<RequestStatus, string> = {
  new: 'bg-brand-coral-soft text-[#8d3a35]',
  contacted: 'bg-[#e3eef2] text-[#1d4c63]',
  accepted: 'bg-emerald-50 text-emerald-700',
  discarded: 'bg-gray-200 text-gray-600',
}
const STATUSES: RequestStatus[] = ['new', 'contacted', 'accepted', 'discarded']

export default function RequestsClient({ requests, agencies }: { requests: PilotRequest[]; agencies: { id: string; name: string }[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [filter, setFilter] = useState<RequestStatus | 'open'>('open')
  const [confirm, setConfirm] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true); setError(''); setMsg('')
    try { await fn(); if (ok) setMsg(ok); router.refresh() } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(false) }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { open: 0, new: 0, contacted: 0, accepted: 0, discarded: 0 }
    for (const r of requests) { c[r.status]++; if (r.status === 'new' || r.status === 'contacted') c.open++ }
    return c
  }, [requests])
  const shown = requests.filter(r => (filter === 'open' ? r.status === 'new' || r.status === 'contacted' : r.status === filter))
  const agencyName = (id: string | null) => agencies.find(a => a.id === id)?.name
  const site = (w: string) => (/^https?:\/\//i.test(w) ? w : `https://${w}`)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Solicitudes de piloto</h1>
        <p className="text-sm text-gray-500 mt-1">Las agencias que llenaron el formulario de la landing. Desde aquí las contactas y las das de alta.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}

      <div className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-gray-100 p-1 w-fit">
        {([['open', 'Por atender'], ['accepted', 'Aceptadas'], ['discarded', 'Descartadas']] as [RequestStatus | 'open', string][]).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`whitespace-nowrap text-xs px-3 py-1 rounded-full ${filter === k ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-600'}`}>{l} <span className="text-gray-400">{counts[k]}</span></button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          {filter === 'open' ? 'No hay solicitudes por atender.' : 'Nada en esta lista.'}
        </div>
      )}

      {shown.map(r => {
        const linked = agencyName(r.client_id)
        const note = notes[r.id] ?? r.owner_notes ?? ''
        return (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-gray-900">{r.agency_name}</h2>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status]}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
                </div>
                <p className="text-sm text-gray-700 mt-1">{r.contact_name} · <a className="underline" href={`mailto:${r.email}`}>{r.email}</a></p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Llegó {ago(r.created_at)}
                  {r.website && <> · <a className="underline" href={site(r.website)} target="_blank" rel="noopener noreferrer">{r.website}</a></>}
                  {r.team_size && ` · equipo: ${r.team_size}`}
                  {r.call_tool && ` · llamadas: ${r.call_tool}`}
                </p>
              </div>
              <select
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                value={r.status}
                disabled={busy}
                aria-label="Estado de la solicitud"
                onChange={e => run(() => call(`/api/admin/requests/${r.id}`, 'PATCH', { status: e.target.value }))}
              >
                {STATUSES.map(s => <option key={s} value={s}>{REQUEST_STATUS_LABEL[s]}</option>)}
              </select>
            </div>

            {r.message && <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{r.message}</p>}

            <div className="flex flex-wrap gap-2">
              <input className={`${inputCls} flex-1 min-w-[12rem]`} placeholder="Nota interna (qué hablaron, siguiente paso)" value={note} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} />
              <button disabled={busy || note === (r.owner_notes ?? '')} onClick={() => run(() => call(`/api/admin/requests/${r.id}`, 'PATCH', { owner_notes: note }))} className={btnGhost}>Guardar nota</button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 text-sm">
              {linked ? (
                <span className="text-gray-600">Ya es agencia: <Link href="/admin/agencies" className="font-medium text-gray-900 underline">{linked}</Link></span>
              ) : confirm === r.id ? (
                <>
                  <span className="text-gray-700">Se crea la agencia «{r.agency_name}» en piloto y la cuenta de {r.email}. ¿Seguro?</span>
                  <button
                    disabled={busy}
                    className={btnCls}
                    onClick={() => run(
                      () => call('/api/admin/agencies', 'POST', { company_name: r.agency_name, admin_email: r.email, admin_name: r.contact_name, website: r.website ? site(r.website) : undefined, request_id: r.id }).then(() => setConfirm(null)),
                      `Agencia creada. Avísale a ${r.contact_name} que entre con su correo en winflowapp.com/login.`
                    )}
                  >Sí, crear</button>
                  <button disabled={busy} className={btnGhost} onClick={() => setConfirm(null)}>Cancelar</button>
                </>
              ) : (
                <button disabled={busy} className={btnGhost} onClick={() => setConfirm(r.id)}>Dar de alta como agencia en piloto</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
