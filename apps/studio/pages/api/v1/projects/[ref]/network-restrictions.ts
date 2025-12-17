import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref } = req.query

    if (!ref || typeof ref !== 'string') {
      return res.status(400).json({
        data: null,
        error: { message: 'Project reference is required' }
      })
    }

    // For self-hosted deployments, network restrictions are typically managed
    // at the infrastructure level (firewall, load balancer, etc.)
    // Return default configuration that indicates open access unless configured otherwise
    const networkConfig = {
      config: {
        dbAllowedCidrs: process.env.DB_ALLOWED_CIDRS ? 
          process.env.DB_ALLOWED_CIDRS.split(',').map(cidr => cidr.trim()) : 
          ['0.0.0.0/0'], // Default to allow all if not configured
        dbAllowedCidrsV6: process.env.DB_ALLOWED_CIDRS_V6 ? 
          process.env.DB_ALLOWED_CIDRS_V6.split(',').map(cidr => cidr.trim()) : 
          ['::/0'], // Default to allow all IPv6 if not configured
        dbDeniedCidrs: process.env.DB_DENIED_CIDRS ? 
          process.env.DB_DENIED_CIDRS.split(',').map(cidr => cidr.trim()) : 
          [],
        dbDeniedCidrsV6: process.env.DB_DENIED_CIDRS_V6 ? 
          process.env.DB_DENIED_CIDRS_V6.split(',').map(cidr => cidr.trim()) : 
          []
      },
      status: 'applied',
      isUpdating: false
    }

    return res.status(200).json(networkConfig)
  } catch (error) {
    console.error('Network restrictions GET error:', error)
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref } = req.query
    const { dbAllowedCidrs, dbAllowedCidrsV6, dbDeniedCidrs, dbDeniedCidrsV6 } = req.body

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
        error: { message: 'Invalid IPv4 CIDR format in allowed list' }
      })
    }

    if (dbAllowedCidrsV6 && !validateCidrs(dbAllowedCidrsV6, true)) {
      return res.status(400).json({
        data: null,
        error: { message: 'Invalid IPv6 CIDR format in allowed list' }
      })
    }

    if (dbDeniedCidrs && !validateCidrs(dbDeniedCidrs)) {
      return res.status(400).json({
        data: null,
        error: { message: 'Invalid IPv4 CIDR format in denied list' }
      })
    }

    if (dbDeniedCidrsV6 && !validateCidrs(dbDeniedCidrsV6, true)) {
      return res.status(400).json({
        data: null,
        error: { message: 'Invalid IPv6 CIDR format in denied list' }
      })
    }

    // For self-hosted deployments, network restrictions would typically
    // be applied at the infrastructure level
    const response = {
      config: {
        dbAllowedCidrs: dbAllowedCidrs || ['0.0.0.0/0'],
        dbAllowedCidrsV6: dbAllowedCidrsV6 || ['::/0'],
        dbDeniedCidrs: dbDeniedCidrs || [],
        dbDeniedCidrsV6: dbDeniedCidrsV6 || []
      },
      status: 'applied',
      isUpdating: false,
      message: 'Network restrictions updated. Note: For self-hosted deployments, ensure your infrastructure (firewall, load balancer) is configured to enforce these restrictions.'
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error('Network restrictions POST error:', error)
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}