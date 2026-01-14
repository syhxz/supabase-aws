import { ExternalLink } from 'lucide-react'
import React, { useMemo } from 'react'

import { useParams } from 'common'
import { DeployEdgeFunctionButton } from 'components/interfaces/EdgeFunctions/DeployEdgeFunctionButton'
import { EdgeFunctionsListItem } from 'components/interfaces/Functions/EdgeFunctionsListItem'
import {
  FunctionsEmptyState,
  FunctionsEmptyStateLocal,
} from 'components/interfaces/Functions/FunctionsEmptyState'
import DefaultLayout from 'components/layouts/DefaultLayout'
import EdgeFunctionsLayout from 'components/layouts/EdgeFunctionsLayout/EdgeFunctionsLayout'
import AlertError from 'components/ui/AlertError'
import { DocsButton } from 'components/ui/DocsButton'
import { GenericSkeletonLoader } from 'components/ui/ShimmeringLoader'
import { useEdgeFunctionsQuery } from 'data/edge-functions/edge-functions-query'
import { DOCS_URL, IS_PLATFORM } from 'lib/constants'
import type { NextPageWithLayout } from 'types'
import { Button, Card, Table, TableBody, TableHead, TableHeader, TableRow, Badge } from 'ui'
import { PageContainer } from 'ui-patterns/PageContainer'
import {
  PageHeader,
  PageHeaderAside,
  PageHeaderDescription,
  PageHeaderMeta,
  PageHeaderSummary,
  PageHeaderTitle,
} from 'ui-patterns/PageHeader'
import { PageSection, PageSectionContent } from 'ui-patterns/PageSection'

const EdgeFunctionsPage: NextPageWithLayout = () => {
  const { ref } = useParams()
  const {
    data: functions,
    error,
    isLoading,
    isError,
    isSuccess,
  } = useEdgeFunctionsQuery({ projectRef: ref })

  const hasFunctions = (functions ?? []).length > 0

  // Normalize function metadata for consistent display
  const normalizedFunctions = useMemo(() => {
    if (!functions) return []
    
    return functions.map((func) => ({
      ...func,
      // Ensure name is properly set with fallback to slug
      name: func.name && func.name.trim() ? func.name : func.slug,
      // Normalize deployment source detection
      deploymentSource: func.deploymentSource || 
                      (func.deployedViaStudio || func.source === 'studio' ? 'ui' : 
                       func.deployedViaAPI || func.source === 'api' ? 'api' : 'ui'),
    }))
  }, [functions])

  // Statistics for deployment sources
  const deploymentStats = useMemo(() => {
    if (!normalizedFunctions.length) return null
    
    const uiDeployed = normalizedFunctions.filter(f => f.deploymentSource === 'ui').length
    const apiDeployed = normalizedFunctions.filter(f => f.deploymentSource === 'api').length
    
    return { uiDeployed, apiDeployed, total: normalizedFunctions.length }
  }, [normalizedFunctions])

  return (
    <PageContainer size="large">
      <PageSection>
        <PageSectionContent>
          {isLoading && <GenericSkeletonLoader />}
          {isError && <AlertError error={error} subject="Failed to retrieve edge functions" />}
          {isSuccess && (
            <>
              {hasFunctions ? (
                <div className="space-y-4">
                  {deploymentStats && deploymentStats.total > 1 && (
                    <div className="flex items-center gap-4 text-sm text-foreground-light">
                      <span>
                        {deploymentStats.total} function{deploymentStats.total !== 1 ? 's' : ''}
                      </span>
                      {deploymentStats.uiDeployed > 0 && (
                        <Badge variant="default" className="text-xs">
                          {deploymentStats.uiDeployed} Studio
                        </Badge>
                      )}
                      {deploymentStats.apiDeployed > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {deploymentStats.apiDeployed} API
                        </Badge>
                      )}
                    </div>
                  )}
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>URL</TableHead>
                          <TableHead className="hidden 2xl:table-cell">Created</TableHead>
                          <TableHead className="lg:table-cell">Last updated</TableHead>
                          <TableHead className="lg:table-cell">Deployments</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        <>
                          {normalizedFunctions.length > 0 &&
                            normalizedFunctions.map((item) => (
                              <EdgeFunctionsListItem key={item.id} function={item} />
                            ))}
                        </>
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              ) : IS_PLATFORM ? (
                <FunctionsEmptyState />
              ) : (
                <FunctionsEmptyStateLocal />
              )}
            </>
          )}
          {/* Show local empty state if query is disabled due to service unavailability */}
          {!isLoading && !isError && !isSuccess && !IS_PLATFORM && (
            <FunctionsEmptyStateLocal />
          )}
        </PageSectionContent>
      </PageSection>
    </PageContainer>
  )
}

EdgeFunctionsPage.getLayout = (page: React.ReactElement) => {
  const EdgeFunctionsPageLayout = () => {
    const secondaryActions = [
      <DocsButton key="docs" href={`${DOCS_URL}/guides/functions`} />,
      <Button asChild key="edge-function-examples" type="default" icon={<ExternalLink />}>
        <a
          target="_blank"
          rel="noreferrer"
          href="https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions"
        >
          Examples
        </a>
      </Button>,
    ]

    return (
      <div className="w-full min-h-full flex flex-col items-stretch">
        <PageHeader size="large">
          <PageHeaderMeta>
            <PageHeaderSummary>
              <PageHeaderTitle>Edge Functions</PageHeaderTitle>
              <PageHeaderDescription>
                Deploy edge functions to handle complex business logic
              </PageHeaderDescription>
            </PageHeaderSummary>
            <PageHeaderAside>
              {secondaryActions.map((action) => action)}
              <DeployEdgeFunctionButton />
            </PageHeaderAside>
          </PageHeaderMeta>
        </PageHeader>

        {page}
      </div>
    )
  }

  return (
    <DefaultLayout>
      <EdgeFunctionsLayout>
        <EdgeFunctionsPageLayout />
      </EdgeFunctionsLayout>
    </DefaultLayout>
  )
}

export default EdgeFunctionsPage
