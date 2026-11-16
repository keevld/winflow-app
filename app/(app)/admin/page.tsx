import { notFound } from 'next/navigation'
import { getPlatformAdmin } from '@/lib/platform-admin'
import { loadOwnerData } from '@/lib/owner-data'
import BusinessClient from './BusinessClient'

export const dynamic = 'force-dynamic'

// Panel del dueño → Negocio. Quien no esté en platform_admins recibe un 404.
export default async function OwnerBusinessPage() {
  const admin = await getPlatformAdmin()
  if (!admin) notFound()
  return <BusinessClient data={await loadOwnerData(admin.service)} />
}
