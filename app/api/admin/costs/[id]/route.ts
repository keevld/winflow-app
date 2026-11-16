import { NextRequest, NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/platform-admin'

// Quita un costo fijo de la lista. Solo el dueño de la plataforma.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin()
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { id } = await params
  const { error } = await admin.service.from('platform_costs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
