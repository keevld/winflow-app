import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext, isAdminContext } from '@/lib/api-auth'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { normalizePublicUrl, suggestFromWebsite, SiteReadError } from '@/lib/agency-onboarding'

export const maxDuration = 60

// Propone el perfil de la agencia a partir de su sitio web. No guarda nada: la agencia revisa y aplica.
export async function POST(req: NextRequest) {
  const ctx = await requireAdminContext()
  if (!isAdminContext(ctx)) return ctx.error
  const { clientId, service } = ctx

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const url = normalizePublicUrl(body.website)
  if (!url) {
    return NextResponse.json({ error: 'Escribe la dirección de tu sitio web (por ejemplo https://tuagencia.com)' }, { status: 400 })
  }

  if (!(await rateLimit(service, `onb:${clientId}`, 6, 3600))) return tooMany()

  try {
    const suggestion = await suggestFromWebsite(url)
    return NextResponse.json({ data: suggestion })
  } catch (e) {
    console.error('onboarding suggest failed', e instanceof Error ? e.message : e)
    const msg = e instanceof SiteReadError
      ? e.message
      : 'No pudimos analizar el sitio en este momento. Inténtalo de nuevo o llena el perfil a mano.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
