import { notFound } from 'next/navigation'
import { getPlatformAdmin } from '@/lib/platform-admin'
import { loadOwnerData } from '@/lib/owner-data'
import RequestsClient from './RequestsClient'

export const dynamic = 'force-dynamic'

// Panel del dueño → Solicitudes de piloto. Quien no esté en platform_admins recibe un 404.
export default async function OwnerRequestsPage() {
  const admin = await getPlatformAdmin()
  if (!admin) notFound()
  const data = await loadOwnerData(admin.service)
  return <RequestsClient requests={data.requests} agencies={data.agencies.map(a => ({ id: a.id, name: a.company_name || 'Agencia sin nombre' }))} />
}
