import type { CSSProperties, ReactNode } from 'react'
import AcceptBox from './AcceptBox'
import PrintButton from './PrintButton'
import PrintSheet from './PrintSheet'
import { BarContinue, PickButton, SelectionProvider } from './Selection'
import { itemTotal, type CommercialContent, type PriceItem, type PriceOption } from '@/lib/commercial'
import { inkColor, luminance, onColor } from '@/lib/color'
import './proposal.css'

export interface CommercialDocumentProps {
  slug: string
  content: CommercialContent
  options: PriceOption[]
  mode: string
  color: string
  logo: string | null
  about: string | null
  agencyName: string
  prospectName: string
  prospectCompany: string
  issuedAt: string | null
  validUntil: string | null
  bookingUrl: string | null
  preview: boolean
  canAccept: boolean
  expired: boolean
  acceptedBy: string | null
  acceptedAt: string | null
  pdfHref?: string | null
  logoLum?: number | null
  logoBg?: string | null
  acceptedOption?: string | null
}

// Montos sin ceros de relleno y con la moneda, porque la agencia puede vender en varios países de LATAM.
const money = (n: number, cur: string) => {
  try {
    return `${new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)} ${cur}`
  } catch {
    return `${n.toLocaleString('es-MX')} ${cur}`
  }
}
const totalsText = (t: Record<string, number>) => {
  const parts = Object.entries(t).map(([cur, v]) => money(v, cur))
  return parts.length ? parts.join(' + ') : 'Por definir'
}

const longDate = (iso: string, withTime = false) =>
  new Date(withTime ? iso : `${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

function Section({ id, title, wide, long, children }: { id?: string; title: string; wide?: boolean; long?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={`pd-section${wide ? ' pd-section--wide' : ''}${long ? ' pd-section--long' : ''}`}>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  )
}

function Checks({ list, two }: { list: string[]; two?: boolean }) {
  return <ul className={`pd-check-list${two && list.length > 4 ? ' pd-two' : ''}`}>{list.map((x, i) => <li key={i}>{x}</li>)}</ul>
}

function Lines({ items }: { items: PriceItem[] }) {
  return (
    <div className="pd-lines">
      {items.map((it, i) => {
        const t = itemTotal(it)
        const sub = [it.quantity !== 1 ? `${it.quantity} ×` : '', it.billing_period ?? ''].filter(Boolean).join(' ')
        return (
          <div key={i} className="pd-line">
            <span>
              {it.description}
              {it.discount_pct > 0 && <span className="pd-line-disc"> −{it.discount_pct}%</span>}
              {sub && <span className="pd-line-sub">{sub}</span>}
              {it.notes && <span className="pd-line-sub">{it.notes}</span>}
            </span>
            <span className="pd-line-amt">{t === null ? 'Por definir' : money(t, it.currency)}</span>
          </div>
        )
      })}
    </div>
  )
}

function Case({ company, result }: { company: string; result: string }) {
  const parts = result.split(/\s*→\s*/).filter(Boolean)
  const labels = parts.length === 2 ? ['El reto', 'El resultado'] : ['El reto', 'Lo que hicimos', 'El resultado']
  return (
    <div className="pd-case">
      {company && <h3>{company}</h3>}
      {parts.length === 2 || parts.length === 3 ? (
        <dl className="pd-case-grid">
          {parts.map((p, i) => (
            <div key={i} className={i === parts.length - 1 ? 'pd-win' : undefined}>
              <dt>{labels[i]}</dt>
              <dd>{p}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p style={{ color: '#36322d' }}>{result}</p>
      )}
    </div>
  )
}

export default function CommercialDocument(p: CommercialDocumentProps) {
  const { content: c, options } = p
  const brandStyle = {
    '--brand': p.color,
    '--on-brand': onColor(p.color),
    '--brand-ink': inkColor(p.color),
  } as CSSProperties

  const packages = p.mode === 'packages' && options.length > 1
  const title = c.title || `Propuesta para ${p.prospectCompany || p.prospectName}`
  const forWhom = p.prospectCompany || p.prospectName
  const grand = options.reduce<Record<string, number>>((acc, o) => {
    for (const [cur, v] of Object.entries(o.totals)) acc[cur] = Math.round(((acc[cur] ?? 0) + v) * 100) / 100
    return acc
  }, {})
  const needsChoice = packages
  // El logo se pone directo sobre la portada si contrasta con el color de marca; si no, sobre una placa.
  let logoClass = 'pd-logo-plate'
  if (p.logoLum !== null && p.logoLum !== undefined) {
    const bl = luminance(p.color)
    const ratio = (Math.max(bl, p.logoLum) + 0.05) / (Math.min(bl, p.logoLum) + 0.05)
    logoClass = ratio >= 3 ? 'pd-logo-direct' : p.logoLum > 0.5 ? 'pd-logo-plate pd-logo-plate--dark' : 'pd-logo-plate'
  }
  // Logo con fondo sólido propio: se muestra como insignia, sin placa extra.
  if (p.logoBg) logoClass = 'pd-logo-badge'
  // El flujo de elegir y continuar se ve siempre (también en la vista previa); solo se envía si canAccept.
  const selectable = !p.acceptedAt && !p.expired
  const planOptions = options.map(o => ({ key: o.key, label: o.label, total: totalsText(o.totals) }))
  const acceptedLabel = planOptions.find(o => o.key === p.acceptedOption)?.label ?? null

  return (
    <SelectionProvider options={planOptions} needsChoice={needsChoice} initial={p.acceptedOption ?? options.find(o => o.recommended)?.key ?? null}>
    <div className="pd" style={brandStyle}>
      {p.preview && (
        <div className="pd-preview">Vista previa — así la verá tu cliente. No se registran visitas ni se puede aceptar desde aquí.</div>
      )}

      <header className="pd-cover">
        <div className="pd-brandmark">
          {p.logo && p.logoLum !== null && p.logoLum !== undefined
            ? <span className={logoClass}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.logo} alt={p.agencyName} /></span>
            : p.agencyName && <span className="pd-brandname">{p.agencyName}</span>}
        </div>

        <div className="pd-cover-body">
          <h1>{title}</h1>
          <p className="pd-cover-for">Propuesta comercial para <strong>{forWhom}</strong></p>
        </div>

        <dl className="pd-meta">
          {p.prospectName && (
            <div><dt>Preparada para</dt><dd>{p.prospectName}{p.prospectCompany ? ` · ${p.prospectCompany}` : ''}</dd></div>
          )}
          {p.agencyName && <div><dt>Preparada por</dt><dd>{p.agencyName}</dd></div>}
          {p.issuedAt && <div><dt>Fecha</dt><dd>{longDate(p.issuedAt)}</dd></div>}
          {p.validUntil && <div><dt>Vigente hasta</dt><dd>{longDate(p.validUntil)}</dd></div>}
        </dl>
      </header>

      <PrintSheet>
      <div className="pd-bar">
        <div className="pd-bar-in">
          <span className="pd-bar-title">{p.agencyName || title}</span>
          <div className="pd-bar-actions">
            <PrintButton href={p.pdfHref ?? null} />
            {selectable && <BarContinue />}
          </div>
        </div>
      </div>

      <main className="pd-main">
        {c.summary && <p className="pd-lead">{c.summary}</p>}

        {c.situation && <Section title="Tu situación"><p className="pd-prose">{c.situation}</p></Section>}
        {c.objectives.length > 0 && <Section title="Objetivos"><Checks list={c.objectives} /></Section>}

        {c.solution.length > 0 && (
          <Section title="Nuestra propuesta" long>
            <div className="pd-solution">
              {c.solution.map((x, i) => (
                <div key={i}>
                  <h3>{x.title}</h3>
                  <p>{x.body}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {c.deliverables.length > 0 && <Section title="Entregables"><Checks list={c.deliverables} two /></Section>}

        {c.timeline.length > 0 && (
          <Section title="Cronograma">
            <ol className="pd-timeline">
              {c.timeline.map((x, i) => (
                <li key={i} className="pd-phase">
                  <div className="pd-phase-head">
                    <h3>{x.phase}</h3>
                    {x.duration && <span className="pd-phase-time">{x.duration}</span>}
                  </div>
                  {x.description && <p>{x.description}</p>}
                </li>
              ))}
            </ol>
          </Section>
        )}

        {options.length > 0 && (
          <Section id="inversion" title="Inversión" wide>
            {packages ? (
              <div className="pd-packages">
                {options.map(o => (
                  <div key={o.key} className={`pd-pkg${o.recommended ? ' pd-pkg--rec' : ''}${p.acceptedOption === o.key ? ' pd-pkg--chosen' : ''}`}>
                    {o.recommended && <span className="pd-pkg-badge">Recomendada</span>}
                    <h3>{o.label}</h3>
                    <p className="pd-price">{totalsText(o.totals)}</p>
                    <Lines items={o.items} />
                    {selectable && <PickButton optionKey={o.key} />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="pd-table">
                <Lines items={options.flatMap(o => o.items)} />
                <div className="pd-total"><span>Total</span><span>{totalsText(grand)}</span></div>
              </div>
            )}
            {p.validUntil && <p className="pd-validity">Precios vigentes hasta el {longDate(p.validUntil)}.</p>}
          </Section>
        )}

        {c.proof.length > 0 && (
          <Section title="Resultados con otros clientes" long>
            <div className="pd-cases">{c.proof.map((x, i) => <Case key={i} company={x.company} result={x.result} />)}</div>
          </Section>
        )}

        {c.faq.length > 0 && (
          <Section title="Preguntas frecuentes" long>
            <dl className="pd-faq">{c.faq.map((x, i) => <div key={i}><dt>{x.q}</dt><dd>{x.a}</dd></div>)}</dl>
          </Section>
        )}

        {p.about && <Section title={p.agencyName ? `Sobre ${p.agencyName}` : 'Quiénes somos'}><p className="pd-about">{p.about}</p></Section>}

        {c.terms.length > 0 && (
          <Section title="Condiciones">
            <ul className="pd-terms">{c.terms.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </Section>
        )}

        {c.next_steps.length > 0 && (
          <Section title="Siguientes pasos">
            <ol className="pd-steps">{c.next_steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
            <p className="pd-note">Continuar con esta propuesta no equivale a un contrato firmado: después te enviaremos el contrato, y el proyecto arranca una vez firmado.</p>
          </Section>
        )}

        {(p.canAccept || !!p.acceptedAt || !p.expired || p.preview) && (
          <div className="pd-accept-wrap" id="continuar">
            <AcceptBox
              slug={p.slug}
              agencyName={p.agencyName}
              expired={p.expired}
              acceptedBy={p.acceptedBy}
              acceptedAt={p.acceptedAt}
              acceptedLabel={acceptedLabel}
              previewOnly={!p.canAccept}
            />
          </div>
        )}

        {p.bookingUrl && !p.acceptedAt && (
          <div className="pd-call">
            <a href={p.bookingUrl} target="_blank" rel="noopener noreferrer" className="pd-btn">¿Dudas? Agenda una llamada</a>
          </div>
        )}

        <footer className="pd-foot">
          <span>{p.agencyName}</span>
          <span>Propuesta para {forWhom}{p.issuedAt ? ` · ${longDate(p.issuedAt)}` : ''}</span>
        </footer>
      </main>
      </PrintSheet>
    </div>
    </SelectionProvider>
  )
}
