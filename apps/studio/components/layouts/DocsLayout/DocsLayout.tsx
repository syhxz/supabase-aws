import { useRouter } from 'next/router'
import { ReactElement } from 'react'

import { useParams } from 'common'
import { useIsAPIDocsSidePanelEnabled } from 'components/interfaces/App/FeaturePreview/FeaturePreviewContext'
import Error from 'components/ui/Error'
import { ProductMenu } from 'components/ui/ProductMenu'
import { useOpenAPISpecQuery } from 'data/open-api/api-spec-query'
import { useIsFeatureEnabled } from 'hooks/misc/useIsFeatureEnabled'
import { useSelectedProjectQuery } from 'hooks/misc/useSelectedProject'
import { withAuth } from 'hooks/misc/withAuth'
import { PROJECT_STATUS } from 'lib/constants'
import { ProjectLayout } from '../ProjectLayout'
import { generateDocsMenu } from './DocsLayout.utils'

function DocsLayout({ title, children }: { title: string; children: ReactElement }) {
  const router = useRouter()
  const { ref } = useParams()
  const { data: selectedProject } = useSelectedProjectQuery()
  const isPaused = selectedProject?.status === PROJECT_STATUS.INACTIVE

  const { data, isLoading, error } = useOpenAPISpecQuery(
    { projectRef: ref },
    { enabled: !isPaused }
  )

  const isNewAPIDocsEnabled = useIsAPIDocsSidePanelEnabled()
  const hideMenu = isNewAPIDocsEnabled && router.pathname.endsWith('/graphiql')

  const { projectAuthAll: authEnabled } = useIsFeatureEnabled(['project_auth:all'])

  const getPage = () => {
    if (router.pathname.endsWith('graphiql')) return 'graphiql'

    const { page, rpc, resource } = router.query
    if (!page && !resource && !rpc) return 'introduction'
    return (page || rpc || resource || '') as string
  }

  if (error) {
    return (
      <ProjectLayout product="API Docs">
        <Error error={error} />
      </ProjectLayout>
    )
  }

  // Return loading state if no project
  if (!selectedProject?.ref) {
    return (
      <ProjectLayout product="API Docs" isLoading={true}>
        <div className="flex h-full items-center justify-center">
          <div>Loading...</div>
        </div>
      </ProjectLayout>
    )
  }
  
  const projectRef = selectedProject.ref
  const tableNames = (data?.tables ?? []).map((table: any) => table.name)
  const functionNames = (data?.functions ?? []).map((fn: any) => fn.name)

  return (
    <ProjectLayout
      title={title || 'API Docs'}
      isLoading={isLoading}
      product="API Docs"
      productMenu={
        !hideMenu && (
          <ProductMenu
            page={getPage()}
            menu={generateDocsMenu(projectRef, tableNames, functionNames, { authEnabled })}
          />
        )
      }
    >
      {children}
    </ProjectLayout>
  )
}

export default withAuth(DocsLayout)
