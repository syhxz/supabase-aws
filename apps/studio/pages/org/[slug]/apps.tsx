import { OAuthApps } from 'components/interfaces/Organization/OAuthApps/OAuthApps'
import DefaultLayout from 'components/layouts/DefaultLayout'
import OrganizationLayout from 'components/layouts/OrganizationLayout'
import OrganizationSettingsLayout from 'components/layouts/ProjectLayout/OrganizationSettingsLayout'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { NextPageWithLayout } from 'types'
import { LogoLoader } from 'ui'

const OrgOAuthApps: NextPageWithLayout = () => {
  const router = useRouter()

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

  return <OAuthApps />
}

OrgOAuthApps.getLayout = (page) => (
  <DefaultLayout>
    <OrganizationLayout>
      <OrganizationSettingsLayout>{page}</OrganizationSettingsLayout>
    </OrganizationLayout>
  </DefaultLayout>
)
export default OrgOAuthApps
