import { createClient, createServiceClient } from '@/lib/supabase/server'

// El dueño de la plataforma (Winflow) se identifica por la tabla platform_admins,
// que solo el service role puede leer. Se verifica siempre en servidor.
export async function getPlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = await createServiceClient()
  const { data } = await service.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  return data ? { user, service } : null
}

export async function attachUser(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  clientId: string,
  email: string,
  fullName: string,
  role: 'admin' | 'seller'
): Promise<{ ok: true } | { error: string; status: number }> {
  // ¿Ya existe un usuario con ese correo?
  let userId: string | null = null
  const created = await service.auth.admin.createUser({ email, email_confirm: true })
  if (created.data?.user) {
    userId = created.data.user.id
  } else {
    const list = await service.auth.admin.listUsers({ page: 1, perPage: 1000 })
    userId = list.data?.users.find(u => u.email?.toLowerCase() === email)?.id ?? null
    if (!userId) return { error: created.error?.message ?? 'No se pudo crear el usuario', status: 500 }
  }
  const { data: existing } = await service.from('profiles').select('client_id').eq('id', userId).maybeSingle()
  if (existing?.client_id && existing.client_id !== clientId) {
    return { error: 'Ese correo ya pertenece a otra agencia', status: 409 }
  }
  const { error } = await service.from('profiles').upsert({ id: userId, client_id: clientId, role, full_name: fullName || null })
  if (error) return { error: error.message, status: 500 }
  return { ok: true }
}
