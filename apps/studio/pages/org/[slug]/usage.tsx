import { Usage } from 'components/interfaces/Organization/Usage/Usage'
import DefaultLayout from 'components/layouts/DefaultLayout'
import OrganizationLayout from 'components/layouts/OrganizationLayout'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { NextPageWithLayout } from 'types'
import { LogoLoader } from 'ui'

const OrgUsage: NextPageWithLayout = () => {
  const router = useRouter()

  // Temporarily disable Usage feature - redirect to projects page
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

  return <Usage />
}

OrgUsage.getLayout = (page) => (
  <DefaultLayout>
    <OrganizationLayout>{page}</OrganizationLayout>
  </DefaultLayout>
)

export default OrgUsage
