'use client'

import { useState } from 'react'

export default function PilotForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setState('sending')
    const f = new FormData(e.currentTarget)
    const get = (k: string) => String(f.get(k) ?? '')
    try {
      const res = await fetch('/api/public/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agency_name: get('agency_name'),
          contact_name: get('contact_name'),
          email: get('email'),
          website: get('website'),
          team_size: get('team_size'),
          call_tool: get('call_tool'),
          message: get('message'),
          company_site: get('company_site'),
          consent: f.get('consent') === 'on',
          source: 'landing',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'No pudimos enviar tu solicitud. Intenta de nuevo.')
        setState('idle')
        return
      }
      setState('done')
    } catch {
      setError('No pudimos enviar tu solicitud. Revisa tu conexión e intenta de nuevo.')
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <div className="lp-done" role="status">
        <h3>Listo, recibimos tu solicitud.</h3>
        <p>Te escribimos en los próximos días para agendar un arranque corto y cargar los datos de tu agencia. Si quieres adelantar algo, escribe a hola@winflowapp.com.</p>
      </div>
    )
  }

  return (
    <form className="lp-form" onSubmit={onSubmit}>
      <div className="lp-row">
        <label>
          <span>Nombre de la agencia</span>
          <input name="agency_name" required maxLength={120} autoComplete="organization" />
        </label>
        <label>
          <span>Tu nombre</span>
          <input name="contact_name" required maxLength={120} autoComplete="name" />
        </label>
      </div>
      <div className="lp-row">
        <label>
          <span>Correo</span>
          <input name="email" type="email" required maxLength={320} autoComplete="email" />
        </label>
        <label>
          <span>Sitio web <span className="lp-opt">(opcional)</span></span>
          <input name="website" maxLength={300} placeholder="tuagencia.com" autoComplete="url" />
        </label>
      </div>
      <div className="lp-row">
        <label>
          <span>Tamaño del equipo</span>
          <select name="team_size" defaultValue="">
            <option value="">Elige una opción</option>
            <option value="1">Solo yo</option>
            <option value="2-5">2 a 5 personas</option>
            <option value="6-15">6 a 15 personas</option>
            <option value="16+">16 o más</option>
          </select>
        </label>
        <label>
          <span>¿Cómo registras tus llamadas con prospectos?</span>
          <select name="call_tool" defaultValue="">
            <option value="">Elige una opción</option>
            <option value="notas">Tomo notas a mano</option>
            <option value="meet">Google Meet</option>
            <option value="zoom">Zoom</option>
            <option value="teams">Microsoft Teams</option>
            <option value="transcriptor">Uso un transcriptor (Fireflies, Otter, tl;dv u otro)</option>
            <option value="whatsapp">Por WhatsApp o teléfono, sin registro</option>
            <option value="otro">Otro</option>
          </select>
        </label>
      </div>
      <label>
        <span>¿Algo que quieras contarnos? <span className="lp-opt">(opcional)</span></span>
        <textarea name="message" rows={3} maxLength={1000} placeholder="Por ejemplo: cuántas propuestas envías al mes o qué te frena hoy al cerrar." />
      </label>
      {/* Honeypot: las personas no lo ven; los bots sí lo rellenan. */}
      <div className="lp-hp" aria-hidden="true">
        <label>
          No llenar
          <input name="company_site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="lp-check">
        <input name="consent" type="checkbox" required />
        <span>
          Acepto que Winflow use estos datos para contactarme sobre el piloto, según el{' '}
          <a href="/privacidad" target="_blank" rel="noopener">aviso de privacidad</a>.
        </span>
      </label>
      {error && <p className="lp-error" role="alert">{error}</p>}
      <button className="lp-btn lp-btn-primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Enviando…' : 'Solicitar piloto'}
      </button>
    </form>
  )
}
