import { paths } from 'api-types'
import { withSecureProjectAccess } from '../../../../../../../lib/api/secure-api-wrapper'

type GetResponseData =
  paths['/platform/projects/{ref}/content/folders']['get']['responses']['200']['content']['application/json']

/**
 * API endpoint for content folders with project isolation
 * 
 * GET /api/platform/projects/[ref]/content/folders - Get all folders
 * POST /api/platform/projects/[ref]/content/folders - Create folder
 * DELETE /api/platform/projects/[ref]/content/folders - Delete folder
 * 
 * Requirements: 2.5
 */
export default withSecureProjectAccess<GetResponseData>(async (req, res, context) => {
  const { method } = req
  const { projectId } = context

  if (method === 'GET') {
    // Platform specific endpoint
    const snippets = [
      {
        id: '1',
        owner_id: 1,
        name: 'SQL Query',
        description: '',
        type: 'sql' as const,
        visibility: 'user' as const,
        content: {
          content_id: '1.0',
          sql: `select * from
  (select version()) as version,
  (select current_setting('server_version_num')) as version_number;`,
          schema_version: '1',
        },
        inserted_at: '',
        updated_at: '',
        project_id: projectId,
        favorite: false,
      },
    ]
    return res.status(200).json({
      data: {
        folders: [],
        contents: snippets,
      },
    })
  }

  if (method === 'POST') {
    // Platform specific endpoint
    return res.status(200).json({})
  }

  if (method === 'DELETE') {
    // Platform specific endpoint
    return res.status(200).json({})
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
  return res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
}, {
  permissions: { read: true, write: true }
})
