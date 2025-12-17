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

    if (!ref || typeof ref !== 'string') {
      return res.status(400).json({
        data: null,
        error: { message: 'Project reference is required' }
      })
    }

    // For self-hosted deployments, banned IPs are typically managed
    // at the infrastructure level (firewall, fail2ban, etc.)
    // Return configuration from environment variables or empty list
    const bannedIps = {
      banned_ipv4_addresses: process.env.BANNED_IPS ? 
        process.env.BANNED_IPS.split(',').map(ip => ip.trim()) : 
        [],
      banned_ipv6_addresses: process.env.BANNED_IPS_V6 ? 
        process.env.BANNED_IPS_V6.split(',').map(ip => ip.trim()) : 
        [],
      total_count: (process.env.BANNED_IPS ? process.env.BANNED_IPS.split(',').length : 0) +
                   (process.env.BANNED_IPS_V6 ? process.env.BANNED_IPS_V6.split(',').length : 0),
      status: 'active'
    }

    return res.status(200).json(bannedIps)
  } catch (error) {
    console.error('Network bans retrieve error:', error)
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}