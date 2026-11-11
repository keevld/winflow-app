// Dirección pública de la app para los enlaces que salen hacia afuera (correos, PDF, seguimientos).
// Nunca debe ser la dirección interna de un despliegue (winflow-xxxx-winflow.vercel.app): esa está
// protegida por el login de Vercel y el prospecto (o el generador de PDF) vería una pantalla de acceso.
const FALLBACK = 'https://winflow-app.vercel.app'

export function appOrigin(requestOrigin: string): string {
  if (process.env.NODE_ENV !== 'production') return requestOrigin
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured && /^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//i, '').replace(/\/+$/, '')}`
  return FALLBACK
}
