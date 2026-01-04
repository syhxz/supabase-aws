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
  // Mock available regions endpoint for local development
  const regions = {
    all: {
      smartGroup: [
        {
          key: 'local',
          name: 'Local Development',
          region: 'local',
          country: 'Local',
          coordinates: [0, 0],
        },
      ],
    },
    recommendations: {
      smartGroup: {
        code: 'local',
      },
      specific: [],
    },
  }
  
  return res.status(200).json(regions)
}
