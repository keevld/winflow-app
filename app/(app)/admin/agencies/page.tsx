import { notFound } from 'next/navigation'
import { getPlatformAdmin } from '@/lib/platform-admin'
import { loadOwnerData } from '@/lib/owner-data'
import AgenciesClient from './AgenciesClient'

export const dynamic = 'force-dynamic'

// Panel del dueño → Agencias. Quien no esté en platform_admins recibe un 404.
export default async function OwnerAgenciesPage() {
  const admin = await getPlatformAdmin()
  if (!admin) notFound()
  const data = await loadOwnerData(admin.service)
  return <AgenciesClient agencies={data.agencies} />
}
