import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext, isAdminContext } from '@/lib/api-auth'

export async function GET() {
  const ctx = await requireAdminContext()
  if (!isAdminContext(ctx)) return ctx.error
  const { clientId, service } = ctx

  const { data, error } = await service
    .from('pricing')
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

  if (typeof body.price_type !== 'string' || !body.price_type.trim()) {
    return NextResponse.json({ error: 'El tipo de precio es obligatorio' }, { status: 400 })
  }

  // product_id, if provided, must belong to this client — checked explicitly
  // since the service client bypasses RLS.
  let productId: string | null = null
  if (typeof body.product_id === 'string' && body.product_id) {
    const { data: product } = await service
      .from('products')
      .select('id')
      .eq('id', body.product_id)
      .eq('client_id', clientId)
      .maybeSingle()
    if (!product) return NextResponse.json({ error: 'Producto inválido' }, { status: 400 })
    productId = product.id
  }

  const { data, error } = await service
    .from('pricing')
    .insert({
      client_id: clientId,
      product_id: productId,
      price_type: body.price_type,
      price_amount: typeof body.price_amount === 'number' ? body.price_amount : null,
      price_min: typeof body.price_min === 'number' ? body.price_min : null,
      price_max: typeof body.price_max === 'number' ? body.price_max : null,
      currency: typeof body.currency === 'string' && body.currency ? body.currency : 'USD',
      billing_period: typeof body.billing_period === 'string' ? body.billing_period : null,
      includes: typeof body.includes === 'string' ? body.includes : null,
      excludes: typeof body.excludes === 'string' ? body.excludes : null,
      negotiable: body.negotiable === true,
      notes: typeof body.notes === 'string' ? body.notes : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
