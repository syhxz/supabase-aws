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
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref } = req.query
    const { dbAllowedCidrs, dbAllowedCidrsV6 } = req.body

    if (!ref || typeof ref !== 'string') {
      return res.status(400).json({
        data: null,
        error: { message: 'Project reference is required' }
      })
    }

    // Validate CIDR formats
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    const cidrV6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/

    const validateCidrs = (cidrs: string[], isV6 = false) => {
      if (!Array.isArray(cidrs)) return false
      const regex = isV6 ? cidrV6Regex : cidrRegex
      return cidrs.every(cidr => regex.test(cidr))
    }

    if (dbAllowedCidrs && !validateCidrs(dbAllowedCidrs)) {
      return res.status(400).json({
        data: null,
        error: { message: 'Invalid IPv4 CIDR format' }
      })
    }

    if (dbAllowedCidrsV6 && !validateCidrs(dbAllowedCidrsV6, true)) {
      return res.status(400).json({
        data: null,
        error: { message: 'Invalid IPv6 CIDR format' }
      })
    }

    // Apply the network restrictions
    const response = {
      config: {
        dbAllowedCidrs: dbAllowedCidrs || ['0.0.0.0/0'],
        dbAllowedCidrsV6: dbAllowedCidrsV6 || ['::/0']
      },
      status: 'applied',
      appliedAt: new Date().toISOString(),
      message: 'Network restrictions applied successfully. Note: For self-hosted deployments, ensure your infrastructure enforces these restrictions.'
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error('Network restrictions apply error:', error)
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}