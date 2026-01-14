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
  // Mock feature flags endpoint for self-hosted development
  // Return some default feature flags that are commonly used
  return res.status(200).json({
    // Universal filter bar flag used in LogsPreviewer
    universalFilterBar: false,
    // Other common flags that might be referenced
    storageAnalyticsVector: false,
    edgeFunctionsInvocations: true,
    // Add more flags as needed based on usage
  })
}
