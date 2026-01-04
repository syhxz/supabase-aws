import { NextApiRequest, NextApiResponse } from 'next'

import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'

export default withSecureProjectAccess(handler, {
  permissions: { read: true }
})

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  // Mock upgrade status endpoint for local development
  // Return no upgrade in progress
  const status = {
    initiated_at: null,
    target_version: null,
    status: null,
  }
  
  return res.status(200).json(status)
}
