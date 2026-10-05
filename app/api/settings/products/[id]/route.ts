import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext, isAdminContext } from '@/lib/api-auth'
import { capitalizeFirst } from '@/lib/text'

const FIELDS = ['name', 'description', 'category', 'is_active'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await requireAdminContext()
  if (!isAdminContext(ctx)) return ctx.error
  const { clientId, service } = ctx

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const f of FIELDS) {
    if (!(f in body)) continue
    const v = body[f]
    if (f === 'is_active') update[f] = v === true
    else if (typeof v === 'string') update[f] = v.trim() ? capitalizeFirst(v) : (f === 'name' ? undefined : null)
  }
  if ('name' in update && update.name === undefined) {
    return NextResponse.json({ error: 'El nombre del producto es obligatorio' }, { status: 400 })
  }

  const { error } = await service.from('products').update(update).eq('id', id).eq('client_id', clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await requireAdminContext()
  if (!isAdminContext(ctx)) return ctx.error
  const { clientId, service } = ctx

  const { error } = await service.from('products').delete().eq('id', id).eq('client_id', clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
