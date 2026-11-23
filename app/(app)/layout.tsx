import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPlatformAdmin } from '@/lib/platform-admin'
import AppNav, { type NavLink, type OwnerNav } from './AppNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  // Panel de la agencia: lo que ve cualquier cliente. Nunca incluye nada de Winflow como negocio.
  const links: NavLink[] = [
    { href: '/dashboard', label: 'Propuestas', match: ['/dashboard', '/proposals'] },
    { href: '/clients', label: 'Clientes', match: ['/clients'] },
    ...(profile?.role === 'admin' ? [{ href: '/settings', label: 'Perfil de agencia', match: ['/settings'] }] : []),
  ]

  // Panel del dueño: solo si el servidor confirma que está en platform_admins.
  const admin = await getPlatformAdmin()
  let owner: OwnerNav | undefined
  if (admin) {
    const { count } = await admin.service.from('pilot_requests').select('id', { count: 'exact', head: true }).eq('status', 'new')
    owner = {
      basePath: '/admin',
      tag: 'Dueño',
      enterLabel: 'Panel del dueño',
      exitLabel: 'Ver como agencia',
      links: [
        { href: '/admin', label: 'Negocio', match: ['/admin'], exact: true },
        { href: '/admin/agencies', label: 'Agencias', match: ['/admin/agencies'] },
        { href: '/admin/requests', label: 'Solicitudes', match: ['/admin/requests'], badge: count ?? 0 },
      ],
    }
  }

  return (
    <div className="wf-app min-h-screen bg-gray-50">
      <AppNav links={links} owner={owner} userLabel={profile?.full_name || user.email || ''} />
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
