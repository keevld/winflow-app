/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from 'react'
import PilotForm from './PilotForm'
import ProcessDemo from './ProcessDemo'
import './landing.css'

// ── Piezas de marca ────────────────────────────────────────────────

export function Logo({ light = false, href = '/' }: { light?: boolean; href?: string }) {
  return (
    <a className="lp-logo" href={href} aria-label="Winflow, inicio">
      <img className="lp-logo-mark" src={light ? '/brand/winflow-mark-light.png' : '/brand/winflow-mark.png'} alt="" width={374} height={188} />
      <img
        className="lp-logo-word"
        src={light ? '/brand/winflow-word-light.png' : '/brand/winflow-word-dark.png'}
        alt="Winflow"
        width={582}
        height={114}
      />
    </a>
  )
}

// Líneas que fluyen, como las del isotipo. Decorativas.
function Ribbons({ id, className = '', count = 16 }: { id: string; className?: string; count?: number }) {
  const lines = Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1)
    const y = 150 + i * 11
    return `M-80 ${y} C 230 ${y - 170 + t * 90}, 470 ${y + 150 - t * 110}, 760 ${y - 6 + t * 26} S 1190 ${y - 170 + t * 120}, 1540 ${y - 60 + t * 30}`
  })
  return (
    <svg className={`lp-ribbons ${className}`} viewBox="0 0 1440 460" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#173a4c" />
          <stop offset="0.45" stopColor="#5fa3a0" />
          <stop offset="0.75" stopColor="#8fc0ac" />
          <stop offset="1" stopColor="#e8706f" />
        </linearGradient>
      </defs>
      {lines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={`url(#${id})`} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

const ICONS: Record<string, ReactNode> = {
  voice: <path d="M5 5h14v10.500h-8.500L6.500 19v-3.500H5zM9 9h6M9 12h4" />,
  check: <path d="M12 3l7 3v5.500c0 4.200-2.900 7.800-7 9.500-4.100-1.700-7-5.300-7-9.500V6l7-3zm-3.200 9.300l2.300 2.300 4.300-4.600" />,
  follow: <path d="M4 12a8 8 0 1 0 2.600-5.900M4 4v4.500h4.500M12 8v4.300l2.800 1.700" />,
  page: <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />,
  eye: <path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12zm9.500 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  send: <path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" />,
  notes: <path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h3" />,
  brand: <path d="M12 3a9 9 0 1 0 0 18c1.400 0 2-1 2-2 0-1.700 1-2.500 2.500-2.500H18a3 3 0 0 0 3-3c0-5.500-4-10.500-9-10.500zM7.500 12h.01M9.500 8h.01M14 7.500h.01" />,
  mic: <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />,
  spark: <path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800L12 3zM19 16l.700 2.300L22 19l-2.300.700L19 22l-.700-2.300L16 19l2.300-.700L19 16z" />,
}

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="lp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export function SiteNav({ simple = false, loggedIn = false }: { simple?: boolean; loggedIn?: boolean }) {
  return (
    <header className="lp-nav">
      <div className="lp-nav-in">
        <Logo />
        {simple ? (
          <nav aria-label="Principal">
            <a href="/">Volver al inicio</a>
          </nav>
        ) : (
          <nav aria-label="Principal">
            <a href="#como">Cómo funciona</a>
            <a href="#producto">Producto</a>
            <a href="#piloto">Piloto fundador</a>
            <a href="#preguntas">Preguntas</a>
            <a className="lp-nav-login" href={loggedIn ? '/dashboard' : '/login'}>{loggedIn ? 'Ir a mi panel' : 'Entrar'}</a>
            <a className="lp-btn lp-btn-primary lp-btn-small" href="#solicitar">Solicitar piloto</a>
          </nav>
        )}
      </div>
    </header>
  )
}

export function SiteFooter({ loggedIn = false }: { loggedIn?: boolean }) {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-in">
        <div className="lp-footer-brand">
          <Logo light />
          <p>Propuestas con la voz de tu agencia y seguimiento automático, para cerrar más rápido.</p>
        </div>
        <div className="lp-footer-cols">
          <div>
            <p className="lp-footer-h">Producto</p>
            <a href="/#como">Cómo funciona</a>
            <a href="/#piloto">Piloto fundador</a>
            <a href="/#solicitar">Solicitar piloto</a>
          </div>
          <div>
            <p className="lp-footer-h">Contacto</p>
            <a href="mailto:hola@winflowapp.com">hola@winflowapp.com</a>
            <a href="/privacidad">Aviso de privacidad</a>
            <a href={loggedIn ? '/dashboard' : '/login'}>{loggedIn ? 'Ir a mi panel' : 'Entrar a mi cuenta'}</a>
          </div>
        </div>
      </div>
      <p className="lp-footer-legal">© 2026 Winflow · Lisboa, Portugal</p>
    </footer>
  )
}

// ── Página ─────────────────────────────────────────────────────────

export default function Landing({ loggedIn = false }: { loggedIn?: boolean }) {
  return (
    <div className="lp">
      <SiteNav loggedIn={loggedIn} />

      <main>
        {/* ── Hero ── */}
        <section className="lp-hero">
          <Ribbons id="lp-rib-hero" className="lp-hero-ribbons" />
          <div className="lp-hero-in">
            <div className="lp-hero-copy">
              <h1>
                Propuestas que suenan a tu agencia.{' '}
                <span className="lp-h1-2"><span className="lp-hl">Y un seguimiento que no se olvida.</span></span>
              </h1>
              <p className="lp-lead">
                Winflow aprende cómo habla tu agencia y convierte lo que te contó el prospecto en una propuesta hecha para él, con tu
                marca y precios claros. Después le da seguimiento por ti.
              </p>
              <div className="lp-cta">
                <a className="lp-btn lp-btn-primary" href="#solicitar">Solicitar piloto</a>
                <a className="lp-btn lp-btn-ghost" href="#como">Ver cómo funciona</a>
              </div>
              <p className="lp-note">Primer mes gratis y sin tarjeta para las agencias del piloto fundador.</p>
            </div>

            {/* Vista ilustrativa del producto */}
            <div className="lp-hero-visual" aria-hidden="true">
              <div className="lp-mock lp-mock-doc">
                <div className="lp-mock-bar"><i /><i /><i /><span>winflowapp.com/p/casa-olmo</span></div>
                <div className="lp-mock-cover">
                  <p className="lp-mock-agency">Estudio Brújula</p>
                  <p className="lp-mock-title">Propuesta para Casa Olmo</p>
                  <p className="lp-mock-sub">Preparada para Mariana · válida 15 días</p>
                </div>
                <div className="lp-mock-body">
                  <div className="lp-mock-lines"><i /><i /><i className="s" /></div>
                  <div className="lp-mock-metrics">
                    <div><b>12</b><span>Publicaciones al mes</span></div>
                    <div><b>3</b><span>Campañas activas</span></div>
                    <div><b>$9,500</b><span>Inversión mensual</span></div>
                  </div>
                  <div className="lp-mock-actions"><span className="p">Aceptar propuesta</span><span>Agendar llamada</span></div>
                </div>
              </div>
              <div className="lp-chip lp-chip-1"><span className="lp-chip-i ok"><Icon name="check" /></span><div><b>Datos verificados</b><span>2 frases corregidas antes de enviar</span></div></div>
              <div className="lp-chip lp-chip-2"><span className="lp-chip-i eye"><Icon name="eye" /></span><div><b>Mariana abrió la propuesta</b><span>Hace 5 min · 2 aperturas</span></div></div>
              <div className="lp-chip lp-chip-3"><span className="lp-chip-i fol"><Icon name="follow" /></span><div><b>Seguimiento 1 de 3</b><span>Sale solo en 3 días</span></div></div>
            </div>
          </div>
          <ul className="lp-strip" aria-label="Lo que hace Winflow">
            <li><Icon name="voice" /><div><b>Tu tono, tu marca, tus colores y tu logo</b><span>Aprendemos de cómo lo haces tú.</span></div></li>
            <li><Icon name="check" /><div><b>Datos verificados con filtros</b><span>Y la decisión final sigue siendo tuya.</span></div></li>
            <li><Icon name="page" /><div><b>Página propia y PDF</b><span>Tu cliente la abre desde un enlace.</span></div></li>
            <li><Icon name="follow" /><div><b>Seguimiento sin que te acuerdes</b><span>Sale solo, al ritmo de cada cliente.</span></div></li>
          </ul>
        </section>

        {/* ── Cómo funciona (recorrido animado) ── */}
        <section className="lp-how" id="como">
          <Ribbons id="lp-rib-how" className="lp-how-ribbons" count={12} />
          <div className="lp-how-in">
            <p className="lp-kicker">Cómo funciona</p>
            <h2>De los datos de tu agencia a la propuesta enviada.</h2>
            <p className="lp-sub">El recorrido se reproduce solo. También puedes dar clic en cualquier paso.</p>
            <ProcessDemo />
          </div>
        </section>

        {/* ── Problema ── */}
        <section className="lp-section" id="problema">
          <p className="lp-kicker">El problema</p>
          <h2>Un trato casi nunca se pierde en la llamada. Se pierde en lo que viene después.</h2>
          <div className="lp-grid lp-grid-3">
            <div className="lp-card lp-prob">
              <span className="lp-prob-n">01</span>
              <h3>La propuesta tarda</h3>
              <p>Cada una se arma desde cero entre mil pendientes, y mientras la terminas el prospecto se enfría.</p>
            </div>
            <div className="lp-card lp-prob">
              <span className="lp-prob-n">02</span>
              <h3>Suena a plantilla</h3>
              <p>Un PDF genérico no le dice al prospecto que entendiste su negocio. Y uno hecho con IA genérica, menos.</p>
            </div>
            <div className="lp-card lp-prob">
              <span className="lp-prob-n">03</span>
              <h3>El seguimiento se cae</h3>
              <p>Sin un recordatorio a tiempo, la propuesta enviada se queda sin respuesta y nadie se entera.</p>
            </div>
          </div>
        </section>

        {/* ── Producto ── */}
        <section className="lp-section lp-product" id="producto">
          <p className="lp-kicker">El producto</p>
          <h2>Hecho para que lo que envías sea tuyo, y sea cierto.</h2>

          <div className="lp-feature">
            <div className="lp-feature-copy">
              <span className="lp-feature-i"><Icon name="voice" /></span>
              <h3>Suena a ti, no a una IA</h3>
              <p>
                Winflow escribe a partir del perfil de tu agencia: tu tono de voz, tus servicios y precios, tus casos de éxito y ejemplos
                reales de cómo redactas. El resultado lleva tu logo y tus colores, y se lee como si lo hubieras escrito tú en un buen día.
              </p>
            </div>
            <div className="lp-feature-visual" aria-hidden="true">
              <div className="lp-mini">
                <p className="lp-mini-h">Perfil de agencia</p>
                <div className="lp-mini-row"><span className="lp-mini-logo">EB</span><div><b>Estudio Brújula</b><span>Marketing para negocios locales</span></div></div>
                <p className="lp-mini-l">Colores de marca</p>
                <div className="lp-swatches"><i style={{ background: '#1f3a5f' }} /><i style={{ background: '#e0a458' }} /><i style={{ background: '#f4efe6' }} /><i style={{ background: '#2b2b2b' }} /></div>
                <p className="lp-mini-l">Tono de voz</p>
                <div className="lp-tags"><span>Cercano</span><span>Directo</span><span>Sin tecnicismos</span><span>Tutea al cliente</span></div>
              </div>
            </div>
          </div>

          <div className="lp-feature lp-feature-rev">
            <div className="lp-feature-copy">
              <span className="lp-feature-i"><Icon name="check" /></span>
              <h3>Un segundo filtro antes de enviar</h3>
              <p>
                Cada propuesta pasa por una segunda revisión: comprobamos que las cifras, los plazos y las afirmaciones coincidan con lo
                que tienes cargado de tu agencia y con lo que sabemos del prospecto. Si algo cambia, te mostramos automáticamente qué se
                detectó, qué se cambió y por qué. Tú tienes la última palabra.
              </p>
            </div>
            <div className="lp-feature-visual" aria-hidden="true">
              <div className="lp-mini">
                <p className="lp-mini-h"><span className="lp-badge ok">Verificada</span> Corregimos 1 frase</p>
                <p className="lp-mini-l">Decía</p>
                <p className="lp-quote lp-quote-old">«El 63% de los restaurantes pierde clientes por responder tarde.»</p>
                <p className="lp-mini-l">Ahora dice</p>
                <p className="lp-quote lp-quote-new">«Responder tarde a los mensajes te está costando reservas.»</p>
                <p className="lp-mini-l">Por qué</p>
                <p className="lp-mini-p">La cifra no aparecía en tus datos ni en el sitio del prospecto.</p>
              </div>
            </div>
          </div>

          <div className="lp-feature">
            <div className="lp-feature-copy">
              <span className="lp-feature-i"><Icon name="page" /></span>
              <h3>Un enlace propio, con opción de PDF</h3>
              <p>
                Cada propuesta vive en un enlace de internet con tu marca, y tu cliente también puede descargarla en PDF. Las opciones
                de precio separan lo mensual de lo que se paga una sola vez, y puede aceptar o agendar una llamada desde ahí. Tú ves
                cuándo la abre.
              </p>
            </div>
            <div className="lp-feature-visual" aria-hidden="true">
              <div className="lp-mini">
                <p className="lp-mini-h">Opciones de inversión</p>
                <div className="lp-opts">
                  <div><span>Esencial</span><b>$9,500<small>/mes</small></b></div>
                  <div className="rec"><em>Recomendada</em><span>Crecimiento</span><b>$17,500<small>/mes</small></b><small>+ $14,500 una sola vez</small></div>
                </div>
                <div className="lp-mock-actions"><span className="p">Aceptar propuesta</span><span>Descargar PDF</span></div>
              </div>
            </div>
          </div>

          <div className="lp-feature lp-feature-rev">
            <div className="lp-feature-copy">
              <span className="lp-feature-i"><Icon name="follow" /></span>
              <h3>Seguimiento automático, al ritmo de cada cliente</h3>
              <p>
                Recordatorios escritos con tu tono. Tú eliges el ritmo (rápido, normal o pausado) o dejas que Winflow lo ajuste solo
                según el sector y el tipo de prospecto, porque no todos los clientes deciden igual. Se detienen cuando el prospecto
                acepta o cuando le envías una propuesta nueva, y puedes pausarlos cuando quieras.
              </p>
            </div>
            <div className="lp-feature-visual" aria-hidden="true">
              <div className="lp-mini">
                <p className="lp-mini-h">Seguimientos de Casa Olmo</p>
                <ul className="lp-timeline">
                  <li className="done"><b>Día 3</b><span>Enviado · «¿Pudiste revisar la propuesta?»</span></li>
                  <li className="next"><b>Día 7</b><span>Programado · sale solo</span></li>
                  <li><b>Día 14</b><span>Último recordatorio</span></li>
                </ul>
                <div className="lp-tags"><span>Ritmo ajustado al sector</span><span>Pausar</span></div>
              </div>
            </div>
          </div>

          <div className="lp-feature">
            <div className="lp-feature-copy">
              <span className="lp-feature-i"><Icon name="mic" /></span>
              <h3>Tus llamadas y videollamadas, conectadas <span className="lp-soon-tag">Próximamente</span></h3>
              <p>
                Hacia allá vamos: que Winflow tome los datos directo de tu llamada por Zoom, Meet o Teams, y la propuesta esté lista al
                colgar. Hoy ya puedes pegar tus notas o la transcripción y obtener el mismo resultado. Cuéntanos en el formulario cómo
                registras tus llamadas y lo priorizamos con eso.
              </p>
            </div>
            <div className="lp-feature-visual" aria-hidden="true">
              <div className="lp-mini">
                <p className="lp-mini-h">De la llamada a la propuesta</p>
                <div className="lp-conns">
                  <div><b>Zoom</b><em>Próximamente</em></div>
                  <div><b>Google Meet</b><em>Próximamente</em></div>
                  <div><b>Teams</b><em>Próximamente</em></div>
                </div>
                <div className="lp-conn-now"><span className="lp-badge ok">Disponible hoy</span><b>Notas o transcripción pegadas</b></div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Piloto fundador ── */}
        <section className="lp-pilot" id="piloto">
          <div className="lp-pilot-in">
            <p className="lp-kicker">Piloto fundador</p>
            <h2>Entra primero, paga menos y ayúdanos a darle forma.</h2>
            <p className="lp-sub">
              Estamos abriendo Winflow a un grupo pequeño de agencias. Es un solo plan con todo incluido; lo único que cambia con el
              tiempo es el precio.
            </p>
            <ol className="lp-pt">
              <li className="now">
                <span className="lp-pt-when">Mes 1</span>
                <b className="lp-pt-price">Gratis</b>
                <p>Lo pruebas con tus propios prospectos. Sin tarjeta.</p>
              </li>
              <li>
                <span className="lp-pt-when">Meses 2 a 4</span>
                <b className="lp-pt-price">~$275 <small>MXN/mes</small></b>
                <p>La mitad del precio del plan Starter.</p>
              </li>
              <li>
                <span className="lp-pt-when">Del mes 5 en adelante</span>
                <b className="lp-pt-price">Desde $549 <small>MXN/mes</small></b>
                <p>Precio de referencia del plan Starter. Lo confirmamos contigo antes de cobrar.</p>
              </li>
            </ol>
            <ul className="lp-checks">
              <li>Todas las funciones durante el piloto, sin los límites del plan Starter.</li>
              <li>Te acompañamos a cargar tu marca, servicios y casos.</li>
              <li>Cupo limitado, para atender de cerca a cada agencia.</li>
            </ul>
            <a className="lp-btn lp-btn-primary" href="#solicitar">Quiero un lugar</a>
          </div>
        </section>

        {/* ── Preguntas ── */}
        <section className="lp-section lp-faq" id="preguntas">
          <div className="lp-faq-head">
            <p className="lp-kicker">Preguntas frecuentes</p>
            <h2>Lo que suelen preguntarnos.</h2>
            <p className="lp-sub">¿Tienes otra duda? Escríbenos a <a href="mailto:hola@winflowapp.com">hola@winflowapp.com</a>.</p>
          </div>
          <div className="lp-faq-list">
            <details>
              <summary>¿La IA puede inventar datos en mis propuestas?</summary>
              <p>
                Cualquier IA puede equivocarse, y por eso existe el segundo filtro: revisa que cifras, plazos y afirmaciones coincidan con
                lo que tú cargaste y con el sitio del prospecto. Lo que no tiene respaldo se corrige o se te marca para que lo revises.
                Además, nada se envía sin que tú lo apruebes.
              </p>
            </details>
            <details>
              <summary>¿Las propuestas salen a nombre de mi agencia?</summary>
              <p>Sí. Llevan tu logo, tus colores y el nombre de tu agencia, y cuando el prospecto responde, la respuesta te llega a ti.</p>
            </details>
            <details>
              <summary>¿Para qué tipo de agencias es?</summary>
              <p>
                Para agencias y estudios pequeños que venden servicios con propuesta de por medio: marketing, redes sociales, diseño,
                desarrollo web, contenido o consultoría.
              </p>
            </details>
            <details>
              <summary>¿Necesito tarjeta para el piloto?</summary>
              <p>No. El primer mes es gratis y sin tarjeta. Antes de cualquier cobro te confirmamos el precio y tú decides si sigues.</p>
            </details>
            <details>
              <summary>¿Qué pasa con mis datos y los de mis prospectos?</summary>
              <p>
                Son tuyos. No los vendemos ni los usamos para publicidad, y puedes pedir que se borren. El detalle está en el{' '}
                <a href="/privacidad">aviso de privacidad</a>.
              </p>
            </details>
            <details>
              <summary>¿Se conecta con mis llamadas o mi CRM?</summary>
              <p>
                Todavía no. Hoy capturas los datos del prospecto y pegas tus notas o la transcripción. La conexión con llamadas y
                videollamadas es lo siguiente en la lista.
              </p>
            </details>
          </div>
        </section>

        {/* ── Solicitar piloto ── */}
        <section className="lp-request" id="solicitar">
          <Ribbons id="lp-rib-req" className="lp-request-ribbons" count={12} />
          <div className="lp-request-in">
            <div className="lp-request-copy">
              <p className="lp-kicker">Solicitar piloto</p>
              <h2>Pide tu lugar en el piloto fundador.</h2>
              <ol className="lp-next">
                <li><b>Nos cuentas de tu agencia</b><span>Toma un minuto.</span></li>
                <li><b>Te escribimos</b><span>Para agendar un arranque corto.</span></li>
                <li><b>Cargamos tu marca juntos</b><span>Y envías tu primera propuesta.</span></li>
              </ol>
            </div>
            <PilotForm />
          </div>
        </section>
      </main>

      <SiteFooter loggedIn={loggedIn} />
    </div>
  )
}
