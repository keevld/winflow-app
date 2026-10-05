import { NextRequest, NextResponse } from 'next/server'
import { capitalizeFirst } from '@/lib/text'
import { requireAdminContext, isAdminContext } from '@/lib/api-auth'

export async function GET() {
  const ctx = await requireAdminContext()
  if (!isAdminContext(ctx)) return ctx.error
  const { clientId, service } = ctx

  const { data, error } = await service
    .from('success_stories')
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

  if (typeof body.result !== 'string' || !body.result.trim()) {
    return NextResponse.json({ error: 'Describe el resultado obtenido' }, { status: 400 })
  }

  const { data, error } = await service
    .from('success_stories')
    .insert({
      client_id: clientId,
      company_example: typeof body.company_example === 'string' && body.company_example.trim() ? capitalizeFirst(body.company_example) : null,
      problem: typeof body.problem === 'string' && body.problem.trim() ? capitalizeFirst(body.problem) : null,
      solution: typeof body.solution === 'string' && body.solution.trim() ? capitalizeFirst(body.solution) : null,
      result: capitalizeFirst(body.result),
      relevant_for_industry: typeof body.relevant_for_industry === 'string' && body.relevant_for_industry.trim() ? capitalizeFirst(body.relevant_for_industry) : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
