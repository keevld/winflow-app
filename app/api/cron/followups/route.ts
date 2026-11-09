import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runFollowups } from '@/lib/followups'

export const maxDuration = 300

// Lo llama el cron de Vercel una vez al día (vercel.json). Vercel manda Authorization: Bearer CRON_SECRET.
// ?dry=1 solo lista lo que se enviaría, sin escribir ni mandar nada.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const service = await createServiceClient()
  try {
    const out = await runFollowups(service, { origin: req.nextUrl.origin, dry })
    return NextResponse.json({ ok: true, dry, ...out })
  } catch (e) {
    console.error('followups cron failed', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Falló la corrida de seguimientos' }, { status: 500 })
  }
}
