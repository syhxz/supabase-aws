import { useEffect } from 'react'
import { useRouter } from 'next/router'

import { useParams } from 'common'
import { BillingSettings } from 'components/interfaces/Organization/BillingSettings/BillingSettings'
import DefaultLayout from 'components/layouts/DefaultLayout'
import OrganizationLayout from 'components/layouts/OrganizationLayout'
import { UnknownInterface } from 'components/ui/UnknownInterface'
import { useIsFeatureEnabled } from 'hooks/misc/useIsFeatureEnabled'
import {
  ORG_SETTINGS_PANEL_KEYS,
  useOrgSettingsPageStateSnapshot,
} from 'state/organization-settings'
import type { NextPageWithLayout } from 'types'
import { LogoLoader } from 'ui'

const OrgBillingSettings: NextPageWithLayout = () => {
  const { panel, slug } = useParams()
  const router = useRouter()
  const snap = useOrgSettingsPageStateSnapshot()

  const showBilling = useIsFeatureEnabled('billing:all')
  
  // Temporarily disable Billing feature - redirect to projects page
  // TODO: Control via NEXT_PUBLIC_ENABLE_ORG_FEATURES environment variable in the future
  const enableOrgFeatures = process.env.NEXT_PUBLIC_ENABLE_ORG_FEATURES === 'true'

  useEffect(() => {
    if (!enableOrgFeatures && slug) {
      router.replace(`/org/${slug}`)
    }
  }, [enableOrgFeatures, router, slug])

  useEffect(() => {
    const allowedValues = ['subscriptionPlan', 'costControl']
    if (panel && typeof panel === 'string' && allowedValues.includes(panel)) {
      snap.setPanelKey(panel as ORG_SETTINGS_PANEL_KEYS)
      document.getElementById('billing-page-top')?.scrollIntoView({ behavior: 'smooth' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel])

  if (!enableOrgFeatures) {
    return <LogoLoader />
  }

  if (!showBilling) {
    return <UnknownInterface urlBack={`/org/${slug}`} />
  }

  return <BillingSettings />
}

OrgBillingSettings.getLayout = (page) => (
  <DefaultLayout>
    <OrganizationLayout>{page}</OrganizationLayout>
  </DefaultLayout>
)
export default OrgBillingSettings
