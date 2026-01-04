import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess } from '../../../../../lib/api/secure-api-wrapper'

/**
 * API endpoint for infrastructure monitoring with project isolation and security
 * 
 * GET /api/platform/projects/[ref]/infra-monitoring - Get infrastructure monitoring data (requires read permission)
 * 
 * Requirements: 2.5
 */
export default withSecureProjectAccess(async (req, res, context) => {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res, context)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}, {
  permissions: { read: true }
})

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse, context: any) => {
  // Platform specific endpoint
  const response = {
    data: [],
    yAxisLimit: 0,
    format: '%',
    total: 0,
  }
  return res.status(200).json(response)
}
