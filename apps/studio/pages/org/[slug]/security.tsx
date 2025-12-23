import { useParams } from 'common'
import { SecuritySettings } from 'components/interfaces/Organization/SecuritySettings'
import DefaultLayout from 'components/layouts/DefaultLayout'
import OrganizationLayout from 'components/layouts/OrganizationLayout'
import OrganizationSettingsLayout from 'components/layouts/ProjectLayout/OrganizationSettingsLayout'
import { UnknownInterface } from 'components/ui/UnknownInterface'
import { useIsFeatureEnabled } from 'hooks/misc/useIsFeatureEnabled'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { NextPageWithLayout } from 'types'
import { LogoLoader } from 'ui'

const OrgSecuritySettings: NextPageWithLayout = () => {
  const { slug } = useParams()
  const router = useRouter()
  const showSecuritySettings = useIsFeatureEnabled('organization:show_security_settings')

  // Temporarily disable Organization Settings feature - redirect to projects page
  // TODO: Control via NEXT_PUBLIC_ENABLE_ORG_FEATURES environment variable in the future
  const enableOrgFeatures = process.env.NEXT_PUBLIC_ENABLE_ORG_FEATURES === 'true'

  useEffect(() => {
    if (!enableOrgFeatures && slug) {
      router.replace(`/org/${slug}`)
    }
  }, [enableOrgFeatures, router, slug])

  if (!enableOrgFeatures) {
    return <LogoLoader />
  }

  if (!showSecuritySettings) {
    return <UnknownInterface urlBack={`/org/${slug}`} />
  }

  return <SecuritySettings />
}

OrgSecuritySettings.getLayout = (page) => (
  <DefaultLayout>
    <OrganizationLayout>
      <OrganizationSettingsLayout>{page}</OrganizationSettingsLayout>
    </OrganizationLayout>
  </DefaultLayout>
)
export default OrgSecuritySettings
