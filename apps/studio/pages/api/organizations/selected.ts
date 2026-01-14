import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'

/**
 * Selected Organization API
 * Returns the default organization for self-hosted installations
 */

const DEFAULT_ORGANIZATION = {
  id: 1,
  slug: 'default',
  name: 'Default Organization',
  plan: {
    id: 'pro',
    name: 'Pro'
  },
  usage_billing_enabled: false,
  billing_email: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${method} Not Allowed` })
  }

  // Return default organization for self-hosted
  return res.status(200).json(DEFAULT_ORGANIZATION)
}

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)
