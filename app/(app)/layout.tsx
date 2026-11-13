import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPlatformAdmin } from '@/lib/platform-admin'
import AppNav, { type NavLink } from './AppNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const isPlatformAdmin = !!(await getPlatformAdmin())

  const links: NavLink[] = [
    { href: '/dashboard', label: 'Propuestas', match: ['/dashboard', '/proposals'] },
    { href: '/clients', label: 'Clientes', match: ['/clients'] },
    ...(isPlatformAdmin ? [{ href: '/admin', label: 'Panel Winflow', match: ['/admin'] }] : []),
    ...(profile?.role === 'admin' ? [{ href: '/settings', label: 'Perfil de agencia', match: ['/settings'] }] : []),
  ]

  return (
    <div className="wf-app min-h-screen bg-gray-50">
      <AppNav links={links} userLabel={profile?.full_name || user.email || ''} />
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
