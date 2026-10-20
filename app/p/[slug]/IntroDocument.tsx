import type { CSSProperties, ReactNode } from 'react'
import PrintButton from './PrintButton'
import PrintSheet from './PrintSheet'
import { parseIntroText } from '@/lib/intro'
import { inkColor, luminance, onColor } from '@/lib/color'
import './proposal.css'

export interface IntroDocumentProps {
  text: string
  color: string
  logo: string | null
  logoLum: number | null
  agencyName: string
  prospectName: string
  prospectTitle: string
  prospectCompany: string
  product: string
  issuedAt: string | null
  bookingUrl: string | null
  preview: boolean
  pdfHref: string | null
}

const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

// **negritas** del texto generado → <strong>
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}

export default function IntroDocument(p: IntroDocumentProps) {
  const parsed = parseIntroText(p.text, p.bookingUrl)
  const brandStyle = { '--brand': p.color, '--on-brand': onColor(p.color), '--brand-ink': inkColor(p.color) } as CSSProperties
  const forWhom = p.prospectCompany || p.prospectName
  const first = p.prospectName.split(/\s+/)[0]

  let logoClass = 'pd-logo-plate'
  if (p.logoLum !== null) {
    const bl = luminance(p.color)
    const ratio = (Math.max(bl, p.logoLum) + 0.05) / (Math.min(bl, p.logoLum) + 0.05)
    logoClass = ratio >= 3 ? 'pd-logo-direct' : p.logoLum > 0.5 ? 'pd-logo-plate pd-logo-plate--dark' : 'pd-logo-plate'
  }

  const cta = p.bookingUrl && (
    <a href={p.bookingUrl} target="_blank" rel="noopener noreferrer" className="pd-btn pd-btn-primary">Agendar una llamada</a>
  )

  return (
    <div className="pd" style={brandStyle}>
      {p.preview && <div className="pd-preview">Vista previa — así la verá tu cliente.</div>}

      <header className="pd-cover">
        <div className="pd-brandmark">
          {p.logo
            ? <span className={logoClass}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.logo} alt={p.agencyName} /></span>
            : p.agencyName && <span className="pd-brandname">{p.agencyName}</span>}
        </div>

        <div className="pd-cover-body">
          <h1>Una propuesta para {forWhom}</h1>
          {p.product && <p className="pd-cover-for">{p.product}</p>}
        </div>

        <dl className="pd-meta">
          {p.prospectName && (
            <div><dt>Preparada para</dt><dd>{p.prospectName}{p.prospectTitle ? ` · ${p.prospectTitle}` : ''}</dd></div>
          )}
          {p.agencyName && <div><dt>Preparada por</dt><dd>{p.agencyName}</dd></div>}
          {p.issuedAt && <div><dt>Fecha</dt><dd>{longDate(p.issuedAt)}</dd></div>}
        </dl>
      </header>

      <PrintSheet>
      <div className="pd-bar">
        <div className="pd-bar-in">
          <span className="pd-bar-title">{p.agencyName}</span>
          <div className="pd-bar-actions">
            <PrintButton href={p.pdfHref} />
            {cta}
          </div>
        </div>
      </div>

      <main className="pd-main">
        {parsed.lead && <p className="pd-lead">{inline(parsed.lead)}</p>}

        <section className="pd-section pd-section--long">
          <h2>{first ? `Hola, ${first}` : 'Hola'}</h2>
          <div className="pd-letter">
            {parsed.blocks.map((b, i) =>
              b.type === 'list' ? (
                <ul key={i} className="pd-check-list">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>
              ) : (
                <p key={i}>{inline(b.text)}</p>
              ),
            )}
          </div>
        </section>

        {parsed.metrics.length > 0 && (
          <section className="pd-section pd-section--wide">
            <h2>Resultados que hemos logrado</h2>
            <div className="pd-metrics">
              {parsed.metrics.map((m, i) => (
                <div key={i} className="pd-metric">
                  <span className="pd-metric-v num">{m.value}</span>
                  <span className="pd-metric-l">{m.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {(parsed.closing || cta) && (
          <section className="pd-closing">
            {parsed.closing && <p>{inline(parsed.closing)}</p>}
            {cta && <div className="pd-closing-cta">{cta}</div>}
          </section>
        )}

        <footer className="pd-foot">
          <span>{p.agencyName}</span>
          <span>Propuesta para {forWhom}{p.issuedAt ? ` · ${longDate(p.issuedAt)}` : ''}</span>
        </footer>
      </main>
      </PrintSheet>
    </div>
  )
}
