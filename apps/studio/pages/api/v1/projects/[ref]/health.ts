import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
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
  // Mock health endpoint for local development
  // Return all services as healthy
  const health = {
    auth: { healthy: true },
    realtime: { healthy: true },
    rest: { healthy: true },
    storage: { healthy: true },
    db: { healthy: true },
  }
  
  return res.status(200).json(health)
}
