import { NextRequest, NextResponse } from 'next/server'
import { requireMemberContext, isMemberContext } from '@/lib/api-auth'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params
  const ctx = await requireMemberContext()
  if (!isMemberContext(ctx)) return ctx.error
  const { clientId, service } = ctx

  const { error } = await service
    .from('contact_notes')
    .delete()
    .eq('id', noteId)
    .eq('contact_id', id)
    .eq('client_id', clientId)
  if (error) return NextResponse.json({ error: 'No se pudo borrar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
