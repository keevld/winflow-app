import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return (
      <div className="text-sm text-gray-500 py-20 text-center">
        Solo los administradores pueden editar el perfil de la agencia.
      </div>
    )
  }

  const [
    { data: client },
    { data: brand },
    { data: salesProcess },
    { data: products },
    { data: pricing },
    { data: painPoints },
    { data: successStories },
    { data: objections },
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('id', profile.client_id).single(),
    supabase.from('brand_voice').select('*').eq('client_id', profile.client_id).maybeSingle(),
    supabase.from('sales_process').select('*').eq('client_id', profile.client_id).maybeSingle(),
    supabase.from('products').select('*').eq('client_id', profile.client_id).order('created_at', { ascending: false }),
    supabase.from('pricing').select('*').eq('client_id', profile.client_id).order('created_at', { ascending: false }),
    supabase.from('pain_points').select('*').eq('client_id', profile.client_id).order('created_at', { ascending: false }),
    supabase.from('success_stories').select('*').eq('client_id', profile.client_id).order('created_at', { ascending: false }),
    supabase.from('objections').select('*').eq('client_id', profile.client_id).order('created_at', { ascending: false }),
  ])

  return (
    <SettingsClient
      initialClient={client}
      initialBrand={brand}
      initialSalesProcess={salesProcess}
      initialProducts={products ?? []}
      initialPricing={pricing ?? []}
      initialPainPoints={painPoints ?? []}
      initialSuccessStories={successStories ?? []}
      initialObjections={objections ?? []}
    />
  )
}
