import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PilotForm from './_landing/PilotForm'
import './_landing/landing.css'

export const metadata: Metadata = {
  title: 'Winflow: propuestas personalizadas y seguimiento para agencias',
  description:
    'Convierte la nota de tu llamada en una propuesta personalizada, con precios y página propia, y da seguimiento automático hasta que tu prospecto responda. Piloto fundador para agencias en LATAM.',
  openGraph: {
    title: 'Winflow: cierra más rápido con propuestas hechas para cada prospecto',
    description: 'Propuestas hiperpersonalizadas con afirmaciones verificadas y seguimiento automático, para agencias pequeñas.',
    locale: 'es_MX',
    type: 'website',
  },
}

// Ejemplos públicos de la agencia ficticia «Estudio Brújula».
const SAMPLE_INTRO = '/p/ORyB2vrT1rpuFLiq'
const SAMPLE_COMMERCIAL = '/p/7lhz-WfMDkUEW5wK'

export default async function Home() {
  // Quien ya inició sesión entra directo a su panel.
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="lp">
      <header className="lp-nav">
        <a className="lp-logo" href="/">Winflow</a>
        <nav>
          <a href="#como">Cómo funciona</a>
          <a href="#ejemplo">Ejemplo</a>
          <a href="#piloto">Piloto fundador</a>
          <a className="lp-btn lp-btn-small" href="#solicitar">Solicitar piloto</a>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <p className="lp-eyebrow">Para agencias pequeñas de LATAM</p>
          <h1>Propuestas que tu prospecto sí lee, y un seguimiento que no se te olvida.</h1>
          <p className="lp-lead">
            Winflow convierte lo que te contó el prospecto en una propuesta hecha para él, con precios claros y una página propia,
            y le da seguimiento por ti hasta que responda. Tú revisas y das clic en enviar.
          </p>
          <div className="lp-cta">
            <a className="lp-btn lp-btn-primary" href="#solicitar">Solicitar piloto</a>
            <a className="lp-btn lp-btn-ghost" href={SAMPLE_INTRO} target="_blank" rel="noopener">Ver una propuesta de ejemplo</a>
          </div>
          <p className="lp-note">Primer mes gratis para las primeras agencias del piloto.</p>
        </section>

        <section className="lp-section" id="problema">
          <h2>Cerrar un trato casi nunca se pierde en la llamada. Se pierde en lo que viene después.</h2>
          <div className="lp-grid lp-grid-3">
            <div className="lp-card">
              <h3>La propuesta tarda</h3>
              <p>Cada una se arma desde cero, y mientras la terminas el prospecto se enfría.</p>
            </div>
            <div className="lp-card">
              <h3>Suena a plantilla</h3>
              <p>Un PDF genérico no le dice al prospecto que entendiste su negocio ni su problema.</p>
            </div>
            <div className="lp-card">
              <h3>El seguimiento se cae</h3>
              <p>Sin un recordatorio a tiempo, una propuesta enviada se queda sin respuesta y nadie se entera.</p>
            </div>
          </div>
        </section>

        <section className="lp-section" id="como">
          <h2>Cómo funciona</h2>
          <ol className="lp-steps">
            <li>
              <span className="lp-step-n">1</span>
              <div>
                <h3>Cuentas el caso</h3>
                <p>Datos del prospecto, las notas o la transcripción de la llamada y, si quieres, su sitio web. Winflow lee todo eso.</p>
              </div>
            </li>
            <li>
              <span className="lp-step-n">2</span>
              <div>
                <h3>Winflow redacta con tu voz</h3>
                <p>Una propuesta inicial y una propuesta comercial con opciones de precio, con tu marca, tus servicios y tus casos de éxito.</p>
              </div>
            </li>
            <li>
              <span className="lp-step-n">3</span>
              <div>
                <h3>Envías y das seguimiento</h3>
                <p>El prospecto recibe una página y un PDF. Tú ves cuándo la abre, y los seguimientos salen solos con el ritmo que elijas.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="lp-section" id="diferencias">
          <h2>Pensado para que lo que envías sea cierto</h2>
          <div className="lp-grid lp-grid-2">
            <div className="lp-card">
              <h3>Afirmaciones verificadas</h3>
              <p>
                Una segunda revisión de IA compara cada dato del texto con lo que tú capturaste y con el sitio del prospecto.
                Lo que no tiene respaldo se corrige antes de enviar, y te mostramos qué cambió y por qué.
              </p>
            </div>
            <div className="lp-card">
              <h3>Seguimiento automático</h3>
              <p>
                Recordatorios con el ritmo que prefieras (rápido, normal o pausado). Se detienen solos cuando el prospecto responde o
                cuando envías una propuesta nueva, y tú puedes pausarlos cuando quieras.
              </p>
            </div>
            <div className="lp-card">
              <h3>Página pública y PDF</h3>
              <p>
                Cada propuesta vive en un enlace con tu marca y se descarga como PDF. Sabes cuándo se abrió y el prospecto puede aceptar
                o agendar desde ahí.
              </p>
            </div>
            <div className="lp-card">
              <h3>Precios claros, sin sorpresas</h3>
              <p>
                Opciones de precio con totales separados entre pagos mensuales y pagos únicos, y la inversión publicitaria
                aclarada como lo que es.
              </p>
            </div>
          </div>
        </section>

        <section className="lp-section" id="ejemplo">
          <h2>Mira cómo se ve</h2>
          <p className="lp-sub">
            Estas dos propuestas las generó Winflow para <strong>Estudio Brújula</strong>, una agencia de ejemplo (no es una agencia real),
            para un prospecto de ejemplo.
          </p>
          <div className="lp-grid lp-grid-2">
            <a className="lp-card lp-link-card" href={SAMPLE_INTRO} target="_blank" rel="noopener">
              <h3>Propuesta inicial</h3>
              <p>El diagnóstico y la propuesta de valor, escritos para ese prospecto.</p>
              <span>Abrir ejemplo →</span>
            </a>
            <a className="lp-card lp-link-card" href={SAMPLE_COMMERCIAL} target="_blank" rel="noopener">
              <h3>Propuesta comercial</h3>
              <p>Opciones de precio, alcance y condiciones, con aceptación en línea.</p>
              <span>Abrir ejemplo →</span>
            </a>
          </div>
        </section>

        <section className="lp-section lp-pilot" id="piloto">
          <h2>Piloto fundador</h2>
          <p className="lp-sub">
            Estamos abriendo Winflow a las primeras agencias. A cambio de tu retroalimentación, pagas menos y moldeas el producto.
          </p>
          <div className="lp-grid lp-grid-3">
            <div className="lp-card lp-price">
              <p className="lp-price-k">Mes 1</p>
              <p className="lp-price-v">Gratis</p>
              <p>Pruebas todo con tus propios prospectos, sin tarjeta.</p>
            </div>
            <div className="lp-card lp-price">
              <p className="lp-price-k">Meses 2 a 4</p>
              <p className="lp-price-v">~$275 MXN<span>/mes</span></p>
              <p>Plan Starter a mitad de precio.</p>
            </div>
            <div className="lp-card lp-price">
              <p className="lp-price-k">Después</p>
              <p className="lp-price-v">Desde $549 MXN<span>/mes</span></p>
              <p>Precio de referencia del plan Starter. Lo confirmamos contigo antes de cobrar.</p>
            </div>
          </div>
          <ul className="lp-list">
            <li>Durante el piloto tienes todas las funciones, sin los límites del plan Starter.</li>
            <li>Cupo limitado: arrancamos con pocas agencias para acompañarlas de cerca.</li>
            <li>Te pedimos feedback honesto y, si te sirve, que nos cuentes tu resultado.</li>
          </ul>
        </section>

        <section className="lp-section" id="proximamente">
          <h2>Próximamente</h2>
          <div className="lp-card lp-soon">
            <h3>Conecta tus llamadas y videollamadas</h3>
            <p>
              Hoy puedes pegar la transcripción o tus notas. Estamos trabajando en traer los datos directo de tu llamada para que la
              propuesta salga lista al colgar. Cuéntanos en el formulario cómo registras tus llamadas y lo priorizamos con eso.
            </p>
          </div>
        </section>

        <section className="lp-section lp-request" id="solicitar">
          <h2>Solicita tu lugar en el piloto</h2>
          <p className="lp-sub">Te contactamos para agendar un arranque corto y cargar los datos de tu agencia.</p>
          <PilotForm />
        </section>
      </main>

      <footer className="lp-footer">
        <p>© Winflow · Lisboa, Portugal</p>
        <p>
          <a href="mailto:hola@winflowapp.com">hola@winflowapp.com</a> · <a href="/privacidad">Aviso de privacidad</a> · <a href="/login">Entrar</a>
        </p>
      </footer>
    </div>
  )
}
