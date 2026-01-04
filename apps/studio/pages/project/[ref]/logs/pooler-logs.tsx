import { useParams } from 'common'
import { LogsTableName } from 'components/interfaces/Settings/Logs/Logs.constants'
import { ProjectIsolatedLogsPreviewer } from 'components/interfaces/Settings/Logs/ProjectIsolatedLogsPreviewer'
import DefaultLayout from 'components/layouts/DefaultLayout'
import LogsLayout from 'components/layouts/LogsLayout/LogsLayout'
import { useSupavisorConfigurationQuery } from 'data/database/supavisor-configuration-query'
import type { NextPageWithLayout } from 'types'
import { LogoLoader } from 'ui'

export const LogPage: NextPageWithLayout = () => {
  const { ref } = useParams()
  
  // Return null if no ref (should redirect via layout)
  if (!ref) return null
  
  const { isLoading } = useSupavisorConfigurationQuery({ 
    projectRef: ref,
    enabled: !!ref
  })

  // this prevents initial load of pooler logs before config has been retrieved
  if (isLoading) return <LogoLoader />

  return (
    <ProjectIsolatedLogsPreviewer
      condensedLayout={true}
      tableName={LogsTableName.SUPAVISOR}
      queryType={'supavisor'}
    />
  )
}

LogPage.getLayout = (page) => (
  <DefaultLayout>
    <LogsLayout title="Pooler Logs">{page}</LogsLayout>
  </DefaultLayout>
)

export default LogPage
