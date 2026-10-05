import { NextRequest, NextResponse } from 'next/server'
import { capitalizeFirst } from '@/lib/text'
import { requireAdminContext, isAdminContext } from '@/lib/api-auth'

export async function GET() {
  const ctx = await requireAdminContext()
  if (!isAdminContext(ctx)) return ctx.error
  const { clientId, service } = ctx

  const { data, error } = await service
    .from('objections')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

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

  if (typeof body.objection !== 'string' || !body.objection.trim()) {
    return NextResponse.json({ error: 'Describe la objeción' }, { status: 400 })
  }
  if (typeof body.response !== 'string' || !body.response.trim()) {
    return NextResponse.json({ error: 'Describe la respuesta a la objeción' }, { status: 400 })
  }

  const { data, error } = await service
    .from('objections')
    .insert({
      client_id: clientId,
      objection: capitalizeFirst(body.objection),
      response: capitalizeFirst(body.response),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
