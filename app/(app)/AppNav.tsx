'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavLink = { href: string; label: string; match: string[]; exact?: boolean; badge?: number }

// Barra superior de la app. Hay dos paneles separados:
//  · el de la agencia (lo que ve cualquier cliente): fondo claro;
//  · el del dueño de Winflow (/admin): fondo oscuro y sus propias secciones.
// `ownerLinks` solo llega cuando el servidor comprobó que quien entra es dueño de la plataforma.
export default function AppNav({ links, ownerLinks, userLabel }: { links: NavLink[]; ownerLinks?: NavLink[]; userLabel: string }) {
  const pathname = usePathname() ?? ''
  const initial = (userLabel.trim()[0] ?? 'W').toUpperCase()
  const owner = !!ownerLinks && (pathname === '/admin' || pathname.startsWith('/admin/'))
  const shown = owner ? ownerLinks! : links
  const isActive = (l: NavLink) => l.match.some(m => pathname === m || (!l.exact && pathname.startsWith(`${m}/`)))

  return (
    <header className={`sticky top-0 z-30 border-b backdrop-blur ${owner ? 'border-white/10 bg-gray-900/95' : 'border-gray-200 bg-white/90'}`}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-6 gap-y-2">
          <Link href={owner ? '/admin' : '/dashboard'} className="flex shrink-0 items-center gap-2.5" aria-label="Winflow, inicio">
            <img src={owner ? '/brand/winflow-mark-light.png' : '/brand/winflow-mark.png'} alt="" width={374} height={188} className="h-7 w-auto" />
            <img src={owner ? '/brand/winflow-word-light.png' : '/brand/winflow-word-dark.png'} alt="Winflow" width={582} height={114} className="h-[15px] w-auto" />
            {owner && <span className="ml-1 rounded-full border border-brand-coral/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-coral">Dueño</span>}
          </Link>
          <nav className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto px-1" aria-label="Secciones">
            {shown.map(l => {
              const active = isActive(l)
              const cls = owner
                ? active ? 'bg-white text-gray-900' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                : active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              return (
                <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${cls}`}>
                  {l.label}
                  {!!l.badge && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-coral px-1 text-[11px] font-semibold text-white">{l.badge}</span>}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {ownerLinks && (
            <Link
              href={owner ? '/dashboard' : '/admin'}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                owner ? 'border-white/25 text-slate-200 hover:border-white/60 hover:text-white' : 'border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
              }`}
            >
              {owner ? 'Ver como agencia' : 'Panel del dueño'}
            </Link>
          )}
          <span className={`flex items-center gap-2 text-sm ${owner ? 'text-slate-300' : 'text-gray-600'}`}>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-mint-soft text-sm font-semibold text-gray-800" aria-hidden="true">
              {initial}
            </span>
            <span className="hidden max-w-[14rem] truncate sm:inline">{userLabel}</span>
          </span>
          <form action="/api/auth/signout" method="POST">
            <button className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${owner ? 'border-white/20 text-slate-300 hover:border-white/50 hover:text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'}`}>
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
