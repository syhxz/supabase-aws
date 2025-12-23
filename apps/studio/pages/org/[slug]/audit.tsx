import { AuditLogs } from 'components/interfaces/Organization/AuditLogs/AuditLogs'
import DefaultLayout from 'components/layouts/DefaultLayout'
import OrganizationLayout from 'components/layouts/OrganizationLayout'
import OrganizationSettingsLayout from 'components/layouts/ProjectLayout/OrganizationSettingsLayout'
import { usePermissionsQuery } from 'data/permissions/permissions-query'
import { useSelectedOrganizationQuery } from 'hooks/misc/useSelectedOrganization'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { NextPageWithLayout } from 'types'
import { LogoLoader } from 'ui'

const OrgAuditLogs: NextPageWithLayout = () => {
  const router = useRouter()
  const { isLoading: isLoadingPermissions } = usePermissionsQuery()
  const { data: selectedOrganization } = useSelectedOrganizationQuery()

  // Temporarily disable Organization Settings feature - redirect to projects page
  // TODO: Control via NEXT_PUBLIC_ENABLE_ORG_FEATURES environment variable in the future
  const enableOrgFeatures = process.env.NEXT_PUBLIC_ENABLE_ORG_FEATURES === 'true'

  useEffect(() => {
    if (!enableOrgFeatures && router.query.slug) {
      router.replace(`/org/${router.query.slug}`)
    }
  }, [enableOrgFeatures, router])

  if (!enableOrgFeatures) {
    return <LogoLoader />
  }

  return (
    <>
      {selectedOrganization === undefined && isLoadingPermissions ? <LogoLoader /> : <AuditLogs />}
    </>
  )
}

OrgAuditLogs.getLayout = (page) => (
  <DefaultLayout>
    <OrganizationLayout>
      <OrganizationSettingsLayout>{page}</OrganizationSettingsLayout>
    </OrganizationLayout>
  </DefaultLayout>
)
export default OrgAuditLogs
