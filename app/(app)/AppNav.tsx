'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavLink = { href: string; label: string; match: string[] }

// Barra superior de la app: logo, secciones (con la actual resaltada) y la cuenta.
export default function AppNav({ links, userLabel }: { links: NavLink[]; userLabel: string }) {
  const pathname = usePathname() ?? ''
  const initial = (userLabel.trim()[0] ?? 'W').toUpperCase()

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-7 gap-y-2">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="Winflow, inicio">
            <img src="/brand/winflow-mark.png" alt="" width={374} height={188} className="h-7 w-auto" />
            <img src="/brand/winflow-word-dark.png" alt="Winflow" width={582} height={114} className="h-[15px] w-auto" />
          </Link>
          <nav className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto px-1" aria-label="Secciones">
            {links.map(l => {
              const active = l.match.some(m => pathname === m || pathname.startsWith(`${m}/`))
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {l.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-sm text-gray-600">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-mint-soft text-sm font-semibold text-gray-800" aria-hidden="true">
              {initial}
            </span>
            <span className="hidden max-w-[14rem] truncate sm:inline">{userLabel}</span>
          </span>
          <form action="/api/auth/signout" method="POST">
            <button className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
