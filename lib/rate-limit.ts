import { NextResponse } from 'next/server'
import type { createServiceClient } from '@/lib/supabase/server'

type Service = Awaited<ReturnType<typeof createServiceClient>>

// Límite de uso por «bucket» (usuario, agencia o IP) y ventana de tiempo. La cuenta vive en la base
// (función rate_limit_hit, atómica), así que vale entre instancias serverless.
// Si el limitador falla, se deja pasar: es mejor no tumbar el producto que bloquear a todos.
export async function rateLimit(service: Service, bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await service.rpc('rate_limit_hit', {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    if (error) {
      console.error('rate_limit_hit failed', error.message)
      return true
    }
    return data !== false
  } catch (e) {
    console.error('rate_limit_hit threw', e)
    return true
  }
}

/** IP del cliente (en Vercel la cabecera la fija la plataforma). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim().slice(0, 64)
}

export const tooMany = () =>
  NextResponse.json(
    { error: 'Demasiadas solicitudes en poco tiempo. Intenta de nuevo en unos minutos.' },
    { status: 429, headers: { 'Retry-After': '120' } },
  )
