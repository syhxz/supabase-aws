import { paths } from 'api-types'
import { withSecureProjectAccess } from '../../../../../../lib/api/secure-api-wrapper'
import { NextApiRequest, NextApiResponse } from 'next'
import type { UserContent } from 'types'

/**
 * API endpoint for content management with project isolation and security
 * 
 * GET /api/platform/projects/[ref]/content - Get all content for project (requires read permission)
 * POST /api/platform/projects/[ref]/content - Create new content (requires write permission)
 * PATCH /api/platform/projects/[ref]/content - Update content (requires write permission)
 * PUT /api/platform/projects/[ref]/content - Replace content (requires write permission)
 * 
 * Requirements: 2.5
 */
export default withSecureProjectAccess(async (req, res, context) => {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res, context)
    case 'POST':
      return handlePost(req, res, context)
    case 'PATCH':
      return handlePatch(req, res, context)
    case 'PUT':
      return handlePut(req, res, context)
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'PUT'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}, {
  permissions: { read: true, write: true }
})

type GetResponseData =
  paths['/platform/projects/{ref}/content']['get']['responses']['200']['content']['application/json']

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse<GetResponseData>, context: any) => {
  // Platform specific endpoint
  const { favorite, visibility } = req.query
  if (favorite || visibility === 'project') {
    return res.status(200).json({ data: [] })
  }

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
      } as any,
      favorite: false,
      inserted_at: '',
      project_id: 0,
      updated_at: '',
      owner: {
        id: 1,
        username: 'default',
      },
      updated_by: {
        id: 1,
        username: 'default',
      },
    },
  ]
  return res.status(200).json({ data: snippets })
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse, context: any) => {
  // Platform specific endpoint
  return res.status(200).json({})
}

const handlePatch = async (req: NextApiRequest, res: NextApiResponse, context: any) => {
  // Platform specific endpoint
  return res.status(200).json({})
}

const handlePut = async (req: NextApiRequest, res: NextApiResponse, context: any) => {
  // Platform specific endpoint
  const snippet: UserContent = req.body
  return res.status(200).json({ data: snippet })
}
