import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Landing from './_landing/Landing'
import { outfit } from './_landing/font'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.winflowapp.com'),
  title: 'Winflow: propuestas con la voz de tu agencia y seguimiento automático',
  description:
    'Winflow aprende cómo habla tu agencia y convierte la nota de tu llamada en una propuesta personalizada, con afirmaciones verificadas, página propia y seguimiento automático. Piloto fundador para agencias en LATAM.',
  openGraph: {
    title: 'Winflow: propuestas que suenan a tu agencia, y un seguimiento que no se olvida',
    description: 'Propuestas personalizadas con tu marca, afirmaciones verificadas y seguimiento automático, para agencias pequeñas.',
    url: 'https://www.winflowapp.com',
    siteName: 'Winflow',
    locale: 'es_MX',
    type: 'website',
    images: [{ url: '/brand/og.jpg', width: 1200, height: 630, alt: 'Winflow' }],
  },
  twitter: { card: 'summary_large_image', images: ['/brand/og.jpg'] },
}

export default async function Home() {
  // La landing es siempre la landing. Si hay sesión iniciada, la barra ofrece «Ir a mi panel» en vez de «Entrar».
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()

  return (
    <div className={outfit.variable}>
      <Landing loggedIn={!!user} />
    </div>
  )
}
