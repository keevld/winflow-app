import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Solo rutas internas: evita redirigir fuera del sitio con `next=@otro.com` o `next=//otro.com`.
  const rawNext = searchParams.get('next') ?? ''
  const next = /^\/(?![/\\])[A-Za-z0-9\-_/?=&.%]*$/.test(rawNext) ? rawNext : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Code missing or exchange failed — send back to login with a flag
  // instead of looping silently.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
