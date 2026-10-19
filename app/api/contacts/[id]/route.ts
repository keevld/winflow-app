import { NextRequest, NextResponse } from 'next/server'
import { requireMemberContext, isMemberContext } from '@/lib/api-auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireMemberContext()
  if (!isMemberContext(ctx)) return ctx.error
  const { clientId, service } = ctx

  const { data: contact } = await service
    .from('contacts')
    .select('id, name, title, company, email, website, industry, company_size')
    .eq('id', id)
    .eq('client_id', clientId)
    .maybeSingle()
  if (!contact) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ contact })
}
