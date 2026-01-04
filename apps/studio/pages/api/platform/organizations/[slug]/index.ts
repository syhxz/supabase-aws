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

  // For self-hosted mode, return default organization
  if (!IS_PLATFORM) {
    // Only support the default organization in self-hosted mode
    if (slug === 'default-org-slug') {
      const response = {
        id: 1,
        name: process.env.STUDIO_DEFAULT_ORGANIZATION || 'Default Organization',
        slug: 'default-org-slug',
        billing_email: 'admin@localhost',
        plan: {
          id: 'free',
          name: 'Free',
        },
        // Self-hosted specific fields
        managed_by: 'self-hosted',
        tier: 'free',
        subscription_id: null,
        billing_via_partner: false,
        // Add other required fields for compatibility
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      
      return res.status(200).json(response)
    } else {
      return res.status(404).json({ 
        error: { message: `Organization not found: ${slug}` } 
      })
    }
  }

  // Platform mode - not implemented for self-hosted
  return res.status(501).json({ 
    error: { message: 'Organization lookup not supported in platform mode' } 
  })
}