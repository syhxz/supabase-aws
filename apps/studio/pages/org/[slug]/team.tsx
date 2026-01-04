import { TeamSettings } from 'components/interfaces/Organization/TeamSettings/TeamSettings'
import DefaultLayout from 'components/layouts/DefaultLayout'
import OrganizationLayout from 'components/layouts/OrganizationLayout'
import { usePermissionsQuery } from 'data/permissions/permissions-query'
import { useSelectedOrganizationQuery } from 'hooks/misc/useSelectedOrganization'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { NextPageWithLayout } from 'types'
import { LogoLoader } from 'ui'

const OrgTeamSettings: NextPageWithLayout = () => {
  const router = useRouter()
  const { isLoading: isLoadingPermissions } = usePermissionsQuery()
  const { data: selectedOrganization } = useSelectedOrganizationQuery()

  // Temporarily disable Team feature - redirect to projects page
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

  return selectedOrganization === undefined && isLoadingPermissions ? (
    <LogoLoader />
  ) : (
    <TeamSettings />
  )
}

OrgTeamSettings.getLayout = (page) => (
  <DefaultLayout>
    <OrganizationLayout>{page}</OrganizationLayout>
  </DefaultLayout>
)

export default OrgTeamSettings
