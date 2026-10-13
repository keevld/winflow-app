import { NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/platform-admin'

// Diagnóstico solo para el dueño de la plataforma: dice si el servidor ve la
// variable de la API de Anthropic, sin revelar su valor.
export async function GET() {
  const admin = await getPlatformAdmin()
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const key = process.env.ANTHROPIC_API_KEY || process.env.WINFLOW_ANTHROPIC_KEY
  const similar = Object.keys(process.env)
    .filter(k => /anthr|claude|api_key/i.test(k))
    .map(k => JSON.stringify(k))
  return NextResponse.json({
    has_key: !!key,
    key_length: key?.length ?? 0,
    key_prefix: key ? key.slice(0, 7) : null,
    key_has_whitespace: key ? /\s/.test(key) : null,
    similar_names: similar,
    env_var_names: Object.keys(process.env)
      .filter(k => !/^(npm_|__|_|LAMBDA|AWS_|NODE|PATH|PWD|HOME|LANG|TZ|SHLVL|OLDPWD|LD_)/i.test(k))
      .sort(),
    checked_at: new Date().toISOString(),
    vercel_url: process.env.VERCEL_URL ?? null,
    vercel_env: process.env.VERCEL_ENV ?? null,
    deployment: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  })
}
