import { NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/platform-admin'

// Puerta de entrada después de iniciar sesión: el dueño de Winflow va a su panel de negocio;
// cualquier otro usuario va al panel de su agencia. La comprobación se hace en servidor.
export async function GET(request: Request) {
  const admin = await getPlatformAdmin()
  return NextResponse.redirect(new URL(admin ? '/admin' : '/dashboard', request.url))
}
