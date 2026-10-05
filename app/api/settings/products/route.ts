import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext, isAdminContext } from '@/lib/api-auth'
import { capitalizeFirst } from '@/lib/text'

export async function GET() {
  const ctx = await requireAdminContext()
  if (!isAdminContext(ctx)) return ctx.error
  const { clientId, service } = ctx

  const { data, error } = await service
    .from('products')
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

  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'El nombre del producto es obligatorio' }, { status: 400 })
  }

  const { data, error } = await service
    .from('products')
    .insert({
      client_id: clientId,
      name: capitalizeFirst(body.name),
      description: typeof body.description === 'string' && body.description.trim() ? capitalizeFirst(body.description) : null,
      category: typeof body.category === 'string' && body.category.trim() ? capitalizeFirst(body.category) : null,
      is_active: body.is_active !== false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
