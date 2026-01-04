import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  const { slug } = req.query
  const { provider, region } = req.body

  console.log('[Available Versions API] Request:', { slug, provider, region })

  // For self-hosted mode, return a default PostgreSQL version
  // This is a simplified implementation for self-hosted environments
  const availableVersions = {
    postgresql: [
      {
        version: '15.8.1',
        default: true,
        supported: true,
        description: 'PostgreSQL 15.8.1 (Self-hosted)',
      }
    ]
  }

  console.log('[Available Versions API] Returning versions:', availableVersions)

  return res.status(200).json(availableVersions)
}