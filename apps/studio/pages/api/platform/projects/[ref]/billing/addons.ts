import { paths } from 'api-types'
import { withSecureProjectAccess } from '../../../../../../lib/api/secure-api-wrapper'

type ResponseData =
  paths['/platform/projects/{ref}/billing/addons']['get']['responses']['200']['content']['application/json']

/**
 * API endpoint for billing addons with project isolation and security
 * 
 * GET /api/platform/projects/[ref]/billing/addons - Get billing addons for project (requires read permission)
 * 
 * Requirements: 2.5
 */
export default withSecureProjectAccess(async (req, res, context) => {
  const { method } = req
  const { projectRef } = context

  if (method === 'GET') {
    const response: ResponseData = {
      ref: projectRef,
      selected_addons: [],
      available_addons: [],
    }

    return res.status(200).json(response)
  }

  res.setHeader('Allow', ['GET'])
  return res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
}, {
  permissions: { read: true }
})
