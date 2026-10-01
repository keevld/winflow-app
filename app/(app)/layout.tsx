import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-gray-900">Winflow</span>
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            Propuestas
          </Link>
          {profile?.role === 'admin' && (
            <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
              Perfil de agencia
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{profile?.full_name || user.email}</span>
          <form action="/api/auth/signout" method="POST">
            <button className="text-sm text-gray-500 hover:text-gray-900">Salir</button>
          </form>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
