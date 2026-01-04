import { paths } from 'api-types'
import { withSecureProjectAccess } from '../../../../../../../lib/api/secure-api-wrapper'
import type { UserContent } from 'types'

type ResponseData =
  paths['/platform/projects/{ref}/content/item/{id}']['get']['responses']['200']['content']['application/json']

/**
 * API endpoint for content item with project isolation
 * 
 * GET /api/platform/projects/[ref]/content/item/[id] - Get content item
 * POST /api/platform/projects/[ref]/content/item/[id] - Create content item
 * PATCH /api/platform/projects/[ref]/content/item/[id] - Update content item
 * PUT /api/platform/projects/[ref]/content/item/[id] - Replace content item
 * 
 * Requirements: 2.5
 */
export default withSecureProjectAccess<ResponseData>(async (req, res, context) => {
  const { method } = req
  const { projectId } = context

  if (method === 'GET') {
    // Platform specific endpoint
    const snippet = {
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
      } as any,
      favorite: false,
      inserted_at: '',
      project_id: projectId,
      updated_at: '',
    }

    return res.status(200).json({
      ...snippet,
    })
  }

  if (method === 'POST') {
    // Platform specific endpoint
    return res.status(200).json({})
  }

  if (method === 'PATCH') {
    // Platform specific endpoint
    return res.status(200).json({})
  }

  if (method === 'PUT') {
    // Platform specific endpoint
    const snippet: UserContent = req.body
    return res.status(200).json({ data: snippet })
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'PUT'])
  return res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
}, {
  permissions: { read: true, write: true }
})
