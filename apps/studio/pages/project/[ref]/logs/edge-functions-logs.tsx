import { LogsTableName } from 'components/interfaces/Settings/Logs/Logs.constants'
import { ProjectIsolatedLogsPreviewer } from 'components/interfaces/Settings/Logs/ProjectIsolatedLogsPreviewer'
import DefaultLayout from 'components/layouts/DefaultLayout'
import LogsLayout from 'components/layouts/LogsLayout/LogsLayout'
import type { NextPageWithLayout } from 'types'

export const LogPage: NextPageWithLayout = () => {
  return (
    <ProjectIsolatedLogsPreviewer
      condensedLayout
      queryType="fn_edge"
      tableName={LogsTableName.FN_EDGE}
    />
  )
}

LogPage.getLayout = (page) => (
  <DefaultLayout>
    <LogsLayout title="Edge Functions Logs">{page}</LogsLayout>
  </DefaultLayout>
)

export default LogPage
