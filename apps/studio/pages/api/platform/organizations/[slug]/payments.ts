import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'
import { IS_PLATFORM } from 'lib/constants'

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
  const { slug } = req.query

  if (typeof slug !== 'string') {
    return res.status(400).json({ 
      error: { message: 'Organization slug is required' } 
    })
  }

  // For self-hosted mode, return empty payments list
  if (!IS_PLATFORM) {
    const response = {
      data: [],
      total: 0
    }
    
    return res.status(200).json(response)
  }

  // Platform mode - not implemented for self-hosted
  return res.status(501).json({ 
    error: { message: 'Payments not supported in platform mode' } 
  })
}