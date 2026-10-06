import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Proposal } from '@/lib/types'
import { getEngagementStatus, ENGAGEMENT_TONE_CLASS } from '@/lib/engagement'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:  { label: 'Borrador', color: 'bg-yellow-100 text-yellow-800' },
  generating: { label: 'Generando', color: 'bg-violet-100 text-violet-800' },
  ready: { label: 'Lista para revisar', color: 'bg-emerald-100 text-emerald-800' },
  sending: { label: 'Enviando', color: 'bg-blue-100 text-blue-800' },
  sent:   { label: 'Enviada',  color: 'bg-blue-100 text-blue-800' },
  failed: { label: 'Error',    color: 'bg-red-100 text-red-800' },
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: proposals } = await supabase
    .from('proposals')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Propuestas</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/proposals/commercial/new"
            className="bg-white text-gray-900 text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            + Propuesta comercial
          </Link>
          <Link
            href="/proposals/new"
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            + Nueva propuesta
          </Link>
        </div>
      </div>

      {!proposals?.length ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">No hay propuestas todavía.</p>
          <Link href="/proposals/new" className="text-sm text-gray-900 underline mt-2 inline-block">
            Crear la primera
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {proposals.map((p: Proposal) => {
            const s = STATUS_LABEL[p.status] ?? STATUS_LABEL.draft
            return (
              <Link
                key={p.id}
                href={`/proposals/${p.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {p.prospect_company || 'Sin empresa'}{p.prospect_name ? ` · ${p.prospect_name}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.product || '—'} · {new Date(p.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const engagement = getEngagementStatus(p)
                    if (!engagement) return null
                    return (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ENGAGEMENT_TONE_CLASS[engagement.tone]}`}>
                        {engagement.label}
                      </span>
                    )
                  })()}
                  {p.proposal_type === 'commercial' && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800">Comercial</span>
                  )}
                  {p.accepted_at && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">Aceptada</span>
                  )}
                  {p.outcome === 'won' && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-600 text-white">Ganada</span>
                  )}
                  {p.outcome === 'lost' && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-700 text-white">Perdida</span>
                  )}
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.color}`}>
                    {s.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
