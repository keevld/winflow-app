import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Contact, ContactNote, Proposal } from '@/lib/types'
import { stageOf } from '@/lib/dashboard'
import ContactClient, { type ContactProposal } from './ContactClient'

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id')
    .eq('id', user.id)
    .single()
  if (!profile?.client_id) redirect('/dashboard')

  const service = await createServiceClient()
  const { data: contact } = await service
    .from('contacts')
    .select('*')
    .eq('id', id)
    .eq('client_id', profile.client_id)
    .maybeSingle()
  if (!contact) notFound()

  const [{ data: notes }, { data: proposals }] = await Promise.all([
    service
      .from('contact_notes')
      .select('id, contact_id, body, kind, noted_on, created_at')
      .eq('contact_id', id)
      .eq('client_id', profile.client_id)
      .order('noted_on', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('proposals').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
  ])

  const props: ContactProposal[] = ((proposals ?? []) as Proposal[]).map(p => ({
    id: p.id,
    type: p.proposal_type,
    product: p.product ?? '',
    stage: stageOf(p),
    created_at: p.created_at,
  }))

  return <ContactClient contact={contact as Contact} initialNotes={(notes ?? []) as ContactNote[]} proposals={props} />
}
