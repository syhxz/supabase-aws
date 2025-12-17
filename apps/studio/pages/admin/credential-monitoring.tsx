/**
 * System-wide Credential Monitoring Page
 * Provides comprehensive credential monitoring dashboard for administrators
 */

import { CredentialMonitoringDashboard } from 'components/interfaces/Settings/Database/CredentialMonitoringDashboard'
import DefaultLayout from 'components/layouts/DefaultLayout'
import type { NextPageWithLayout } from 'types'
import { PageContainer } from 'ui-patterns/PageContainer'
import {
  PageHeader,
  PageHeaderMeta,
  PageHeaderSummary,
  PageHeaderTitle,
} from 'ui-patterns/PageHeader'
import { PageSection, PageSectionContent } from 'ui-patterns/PageSection'

const CredentialMonitoringPage: NextPageWithLayout = () => {
  return (
    <>
      <PageHeader>
        <PageHeaderMeta>
          <PageHeaderSummary>
            <PageHeaderTitle>System Credential Monitoring</PageHeaderTitle>
          </PageHeaderSummary>
        </PageHeaderMeta>
      </PageHeader>
      <PageContainer>
        <PageSection>
          <PageSectionContent>
            <CredentialMonitoringDashboard />
          </PageSectionContent>
        </PageSection>
      </PageContainer>
    </>
  )
}

CredentialMonitoringPage.getLayout = (page) => (
  <DefaultLayout>{page}</DefaultLayout>
)

export default CredentialMonitoringPage