'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// Recorrido animado del proceso: se reproduce solo, paso a paso, como un video corto,
// y también se puede recorrer con clics. Las pantallas son ilustrativas (agencia de ejemplo).

const STEP_MS = 7000

type Step = { key: string; title: string; text: string; soon?: boolean }

const STEPS: Step[] = [
  {
    key: 'agencia',
    title: 'Llenas los datos de tu agencia',
    text: 'Logo, colores, servicios, precios y casos de éxito. Lo haces una sola vez.',
  },
  {
    key: 'voz',
    title: 'Aprendemos de cómo escribes',
    text: 'Tu tono de voz y tus propuestas anteriores. Entre más le das, más suena a ti.',
  },
  {
    key: 'cliente',
    title: 'Llenas los datos de tu cliente, solo la primera vez',
    text: 'Quién es, qué necesita y su sitio web, que Winflow lee por ti. Queda guardado para sus siguientes propuestas.',
  },
  {
    key: 'llamada',
    title: 'Tienes tu llamada o videollamada',
    text: 'Muy pronto: conectas Zoom, Meet o Teams y la propuesta se redacta sola al colgar, sin que subas nada. Hoy pegas tus notas o la transcripción.',
    soon: true,
  },
  {
    key: 'redacta',
    title: 'Winflow redacta y verifica',
    text: 'Escribe la propuesta con tu voz y pasa un segundo filtro de cifras y plazos.',
  },
  {
    key: 'envia',
    title: 'Envías y das seguimiento',
    text: 'Tú apruebas. Tu cliente recibe un enlace y un PDF, y los seguimientos salen solos.',
  },
]

// Aparición escalonada: cada pieza entra con un retraso (en ms).
function In({ d, children, className = '', as: Tag = 'div' }: { d: number; children?: ReactNode; className?: string; as?: 'div' | 'span' | 'li' | 'p' }) {
  return (
    <Tag className={`wd-in ${className}`} style={{ '--d': `${d}ms` } as CSSProperties}>
      {children}
    </Tag>
  )
}

// Texto que se «escribe» solo.
function Type({ d, children, n }: { d: number; children: string; n?: number }) {
  const len = n ?? children.length
  return (
    <span className="wd-type" style={{ '--d': `${d}ms`, '--n': len, '--t': `${Math.min(1600, len * 45)}ms` } as CSSProperties}>
      {children}
    </span>
  )
}

function Scene({ step }: { step: string }) {
  switch (step) {
    case 'agencia':
      return (
        <div className="wd-scene">
          <p className="wd-h">Perfil de agencia</p>
          <div className="wd-row">
            <In d={200} className="wd-logo wd-pop">EB</In>
            <div className="wd-stack">
              <span className="wd-field"><Type d={500}>Estudio Brújula</Type></span>
              <span className="wd-field wd-field-s"><Type d={1100}>Marketing para negocios locales</Type></span>
            </div>
          </div>
          <In d={1700} as="p" className="wd-l">Colores de marca</In>
          <div className="wd-swatches">
            <In d={1900} className="wd-pop" as="span"><i style={{ background: '#1f3a5f' }} /></In>
            <In d={2050} className="wd-pop" as="span"><i style={{ background: '#e0a458' }} /></In>
            <In d={2200} className="wd-pop" as="span"><i style={{ background: '#f4efe6' }} /></In>
            <In d={2350} className="wd-pop" as="span"><i style={{ background: '#2b2b2b' }} /></In>
          </div>
          <In d={2700} as="p" className="wd-l">Servicios y precios</In>
          <ul className="wd-list">
            <In d={2900} as="li"><span>Redes sociales</span><b>desde $9,500/mes</b></In>
            <In d={3150} as="li"><span>Campañas de anuncios</span><b>desde $6,000/mes</b></In>
            <In d={3400} as="li"><span>Sitio web</span><b>$14,500 una vez</b></In>
          </ul>
          <In d={4000} className="wd-toast"><i className="wd-ok" />Perfil guardado. Solo se hace una vez.</In>
        </div>
      )
    case 'voz':
      return (
        <div className="wd-scene">
          <p className="wd-h">Tu voz</p>
          <div className="wd-docs">
            <In d={200} className="wd-doc"><i /><span>Una propuesta que ya enviaste</span><em className="wd-scan" style={{ '--d': '700ms' } as CSSProperties} /></In>
            <In d={450} className="wd-doc"><i /><span>Uno de tus casos de éxito</span><em className="wd-scan" style={{ '--d': '1300ms' } as CSSProperties} /></In>
            <In d={700} className="wd-doc"><i /><span>Cómo le escribes a un cliente</span><em className="wd-scan" style={{ '--d': '1900ms' } as CSSProperties} /></In>
          </div>
          <In d={2500} as="p" className="wd-l">Lo que aprendimos de ti</In>
          <div className="wd-tags">
            <In d={2700} className="wd-pop" as="span">Tuteas al cliente</In>
            <In d={2900} className="wd-pop" as="span">Frases cortas</In>
            <In d={3100} className="wd-pop" as="span">Sin tecnicismos</In>
            <In d={3300} className="wd-pop" as="span">Cierras con una pregunta</In>
            <In d={3500} className="wd-pop" as="span">Cercano y directo</In>
          </div>
          <In d={3900} className="wd-meter"><span>Qué tanto suena a ti</span><b><i /></b></In>
          <In d={4700} className="wd-toast"><i className="wd-ok" />Entre más datos cargas, mejor escribe.</In>
        </div>
      )
    case 'cliente':
      return (
        <div className="wd-scene">
          <p className="wd-h">Nueva propuesta</p>
          <div className="wd-form">
            <In d={200}><label>Nombre</label><span className="wd-field"><Type d={400}>Mariana López</Type></span></In>
            <In d={300}><label>Empresa</label><span className="wd-field"><Type d={1100}>Casa Olmo</Type></span></In>
            <In d={400} className="wd-wide"><label>Qué necesita</label><span className="wd-field"><Type d={1700}>Llenar el restaurante entre semana</Type></span></In>
            <In d={500} className="wd-wide"><label>Sitio web</label><span className="wd-field wd-field-web"><Type d={3000} n={14}>Sitio de Casa Olmo</Type><In d={4000} as="span" className="wd-badge wd-pop">Leído por Winflow</In></span></In>
          </div>
          <In d={4500} className="wd-toast"><i className="wd-ok" />Guardado. En su siguiente propuesta ya no lo vuelves a llenar.</In>
        </div>
      )
    case 'llamada':
      return (
        <div className="wd-scene">
          <p className="wd-h">La llamada</p>
          <In d={200} className="wd-call">
            <div className="wd-call-top">
              <i className="wd-rec" />
              <b>Videollamada con Mariana</b>
              <em>Próximamente</em>
            </div>
            <div className="wd-wave">
              {Array.from({ length: 28 }, (_, k) => (
                <i key={k} style={{ '--k': k, '--h': `${30 + ((k * 37) % 70)}%` } as CSSProperties} />
              ))}
            </div>
            <div className="wd-call-apps"><span>Zoom</span><span>Google Meet</span><span>Teams</span></div>
          </In>
          <div className="wd-flow">
            <In d={1300} as="span">Cuelgas</In>
            <In d={1700} as="span" className="wd-arrow">→</In>
            <In d={1900} as="span">Winflow toma los datos</In>
            <In d={2300} as="span" className="wd-arrow">→</In>
            <In d={2500} as="span" className="wd-flow-end">Propuesta redactada, sin subir nada</In>
          </div>
          <In d={3100} as="p" className="wd-l">Mientras llega: hoy pegas tus notas o la transcripción</In>
          <In d={3200} className="wd-notes">
            <p><Type d={3500}>Quieren más reservas de lunes a jueves.</Type></p>
            <p><Type d={4500}>Decide Mariana, esta quincena.</Type></p>
          </In>
        </div>
      )
    case 'redacta':
      return (
        <div className="wd-scene">
          <p className="wd-h">Propuesta para Casa Olmo</p>
          <div className="wd-write">
            <i style={{ '--d': '200ms', '--w': '92%' } as CSSProperties} />
            <i style={{ '--d': '500ms', '--w': '100%' } as CSSProperties} />
            <i style={{ '--d': '800ms', '--w': '84%' } as CSSProperties} />
            <i style={{ '--d': '1100ms', '--w': '96%' } as CSSProperties} />
            <i style={{ '--d': '1400ms', '--w': '58%' } as CSSProperties} />
          </div>
          <In d={2100} className="wd-verify">
            <p className="wd-verify-h"><span className="wd-badge wd-badge-ok">Segundo filtro</span>1 frase corregida</p>
            <p className="wd-l">Decía</p>
            <p className="wd-q wd-q-old">«El 63% de los restaurantes pierde clientes por responder tarde.»</p>
            <In d={3000}>
              <p className="wd-l">Ahora dice</p>
              <p className="wd-q wd-q-new">«Responder tarde a los mensajes te está costando reservas.»</p>
            </In>
            <In d={3800} as="p" className="wd-why">Por qué: la cifra no estaba en tus datos ni en el sitio del prospecto.</In>
          </In>
          <In d={4700} className="wd-actions"><span className="wd-btn">Aprobar</span><span className="wd-btn wd-btn-o">Editar</span><em>La última palabra es tuya.</em></In>
        </div>
      )
    default:
      return (
        <div className="wd-scene">
          <p className="wd-h">Enviada a Mariana</p>
          <In d={200} className="wd-link"><i />winflowapp.com/p/casa-olmo<span>Enlace + PDF</span></In>
          <In d={1100} className="wd-event"><i className="wd-eye" /><div><b>Mariana abrió la propuesta</b><span>Hace 5 min · 2 aperturas</span></div></In>
          <In d={1900} className="wd-l-row"><p className="wd-l">Seguimientos automáticos</p><span className="wd-badge">Ritmo ajustado al sector</span></In>
          <ul className="wd-tl">
            <In d={2100} as="li" className="done"><b>Día 3</b><span>Enviado · «¿Pudiste revisar la propuesta?»</span></In>
            <In d={2500} as="li" className="next"><b>Día 7</b><span>Programado · sale solo</span></In>
            <In d={2900} as="li"><b>Día 14</b><span>Último recordatorio</span></In>
          </ul>
          <In d={3700} className="wd-toast wd-toast-win"><i className="wd-ok" />Mariana aceptó la propuesta.</In>
        </div>
      )
  }
}

export default function ProcessDemo() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Solo avanza mientras la sección está a la vista.
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const playing = visible && !paused && !reduced
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => setI(v => (v + 1) % STEPS.length), STEP_MS)
    return () => clearTimeout(t)
  }, [i, playing])

  const step = STEPS[i]

  return (
    <div
      ref={root}
      className={`wd ${playing ? 'wd-playing' : ''} ${visible ? 'wd-visible' : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ol className="wd-steps">
        {STEPS.map((s, n) => (
          <li key={s.key}>
            <button type="button" className={n === i ? 'on' : n < i ? 'past' : ''} aria-current={n === i ? 'step' : undefined} onClick={() => setI(n)}>
              <span className="wd-n">{n + 1}</span>
              <span className="wd-t">
                <b>
                  {s.title}
                  {s.soon && <em>Próximamente</em>}
                </b>
                <span>{s.text}</span>
              </span>
              {n === i && <i key={`${i}-${playing}`} className="wd-bar" style={{ '--ms': `${STEP_MS}ms` } as CSSProperties} />}
            </button>
          </li>
        ))}
      </ol>

      <div className="wd-stage" aria-live="off">
        <div className="wd-window">
          <div className="wd-chrome">
            <i /><i /><i />
            <span>Winflow · paso {i + 1} de {STEPS.length}</span>
          </div>
          <div className="wd-screen" key={step.key}>
            <Scene step={step.key} />
          </div>
        </div>
        <p className="wd-caption">
          <b>{step.title}.</b> {step.text}
        </p>
        <div className="wd-dots" role="tablist" aria-label="Pasos">
          {STEPS.map((s, n) => (
            <button key={s.key} type="button" role="tab" aria-selected={n === i} aria-label={`Paso ${n + 1}: ${s.title}`} className={n === i ? 'on' : ''} onClick={() => setI(n)} />
          ))}
        </div>
      </div>
    </div>
  )
}
