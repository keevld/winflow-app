import Link from 'next/link'

// Piezas de pantalla compartidas por las vistas de la agencia (propuestas, perfil, clientes).
// Las clases wf-* (tarjetas, campos, botones, avisos) viven en globals.css.

export function PageHeader({
  title, subtitle, back, action,
}: {
  title: string
  subtitle?: React.ReactNode
  back?: { href: string; label: string }
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900">
            <span aria-hidden>←</span> {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// Barra de progreso del recorrido de una propuesta: redacción → revisión → envío → cierre.
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex w-full items-center" aria-label="Progreso de la propuesta">
      {steps.map((label, i) => {
        const done = i < current
        const now = i === current
        return (
          <li key={label} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`} aria-current={now ? 'step' : undefined}>
            <span className="flex items-center gap-2">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors ${
                  done ? 'bg-brand-teal text-white' : now ? 'bg-gray-900 text-white ring-4 ring-gray-900/10' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {done ? <IconCheck className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`text-xs font-medium ${now ? 'text-gray-900' : done ? 'hidden text-gray-700 sm:inline' : 'hidden text-gray-400 sm:inline'}`}>{label}</span>
            </span>
            {i < steps.length - 1 && <span className={`mx-2 h-px flex-1 sm:mx-3 ${done ? 'bg-brand-teal' : 'bg-gray-200'}`} aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

// Ventana de navegador para mostrar cómo verá el cliente su propuesta.
export function BrowserFrame({ url, actions, children }: { url: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,42,55,0.04)]">
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-100 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <i className="h-2.5 w-2.5 rounded-full bg-gray-300" /><i className="h-2.5 w-2.5 rounded-full bg-gray-300" /><i className="h-2.5 w-2.5 rounded-full bg-gray-300" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-full bg-white px-3 py-1 text-xs text-gray-500">{url}</span>
        {actions}
      </div>
      {children}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex gap-1 rounded-full bg-gray-100 p-1" role="tablist">
      {options.map(([k, label]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${value === k ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function Loading({ children = 'Cargando…' }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-sm text-gray-500">
      <span className="wf-spinner" aria-hidden />
      {children}
    </div>
  )
}

export function IconCheck({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  )
}

export function IconAlert({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M10 3.5l7.5 13h-15L10 3.5z" /><path d="M10 8.5v3.5M10 14.4v.1" />
    </svg>
  )
}

export function IconShield({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M10 2.5l6 2.2v4.6c0 3.8-2.5 6.6-6 8.2-3.5-1.6-6-4.4-6-8.2V4.7l6-2.2z" /><path d="M7.2 10.2l2 2 3.6-4" />
    </svg>
  )
}

export function IconSend({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M17 3L8.5 11.5M17 3l-5.5 14-3-5.5L3 8.5 17 3z" />
    </svg>
  )
}
