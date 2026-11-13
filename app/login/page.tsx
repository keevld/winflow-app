'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // PKCE login is completed by the server callback, which exchanges the
      // one-time code for a cookie-backed session before redirecting onward.
      // Solo entran usuarios dados de alta por la plataforma (piloto por invitación): no se crean cuentas desde aquí.
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`, shouldCreateUser: false },
    })

    if (error) {
      const noAccess = /signups? not allowed|user not found/i.test(error.message)
      setError(noAccess ? 'Este correo aún no tiene acceso. Winflow está en piloto por invitación.' : error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="wf-app wf-auth min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <a href="/" className="mb-8 flex flex-col items-center gap-3" aria-label="Winflow, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/winflow-mark.png" alt="" width={374} height={188} className="h-14 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/winflow-word-dark.png" alt="Winflow" width={582} height={114} className="h-6 w-auto" />
        </a>

        {sent ? (
          <div className="rounded-2xl border border-white/80 bg-white p-7 text-center shadow-xl shadow-gray-900/10">
            <h1 className="text-xl font-semibold text-gray-900">Revisa tu correo</h1>
            <p className="mt-2 text-sm text-gray-500">
              Te mandamos un enlace para entrar a <strong className="text-gray-700">{email}</strong>. Ábrelo en este mismo navegador.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/80 bg-white p-7 shadow-xl shadow-gray-900/10">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Entra a tu cuenta</h1>
              <p className="mt-1 text-sm text-gray-500">Te enviamos un enlace a tu correo. Sin contraseñas.</p>
            </div>
            <div>
              <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@agencia.com"
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-teal focus:outline-none focus:ring-4 focus:ring-brand-teal/20"
              />
            </div>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gray-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Enviando…' : 'Enviarme el enlace'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-700">
          ¿Aún no tienes acceso? <a href="/#solicitar" className="font-semibold text-gray-900 underline underline-offset-2">Solicita el piloto</a>
        </p>
      </div>
    </div>
  )
}
