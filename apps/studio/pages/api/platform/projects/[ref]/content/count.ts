import { paths } from 'api-types'
import { withSecureProjectAccess } from '../../../../../../lib/api/secure-api-wrapper'

type ResponseData =
  paths['/platform/projects/{ref}/content/count']['get']['responses']['200']['content']['application/json']

/**
 * API endpoint for content count with project isolation and security
 * 
 * GET /api/platform/projects/[ref]/content/count - Get content count for project (requires read permission)
 * 
 * Requirements: 2.5
 */
export default withSecureProjectAccess<ResponseData>(async (req, res, context) => {
  const { method } = req

  if (method === 'GET') {
    return res.status(200).json({ shared: 0, favorites: 0, private: 1 })
  }

  res.setHeader('Allow', ['GET'])
  return res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
}, {
  permissions: { read: true }
})
