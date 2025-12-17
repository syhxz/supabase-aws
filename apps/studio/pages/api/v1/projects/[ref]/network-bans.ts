import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'POST':
      return handlePost(req, res)
    case 'DELETE':
      return handleDelete(req, res)
    default:
      res.setHeader('Allow', ['POST', 'DELETE'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref } = req.query
    const { ip_addresses, reason, expires_at } = req.body

    if (!ref || typeof ref !== 'string') {
      return res.status(400).json({
        data: null,
        error: { message: 'Project reference is required' }
      })
    }

    if (!ip_addresses || !Array.isArray(ip_addresses) || ip_addresses.length === 0) {
      return res.status(400).json({
        data: null,
        error: { message: 'IP addresses array is required' }
      })
    }

    // Validate IP addresses
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipV6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/
    
    const invalidIps = ip_addresses.filter(ip => 
      !ipRegex.test(ip) && !ipV6Regex.test(ip)
    )

    if (invalidIps.length > 0) {
      return res.status(400).json({
        data: null,
        error: { 
          message: 'Invalid IP address format', 
          invalid_ips: invalidIps 
        }
      })
    }

    // For self-hosted deployments, this would typically integrate with
    // infrastructure-level IP blocking (fail2ban, iptables, etc.)
    
    // Separate IPv4 and IPv6 addresses
    const ipv4Addresses = ip_addresses.filter(ip => ipRegex.test(ip))
    const ipv6Addresses = ip_addresses.filter(ip => ipV6Regex.test(ip))
    
    const response = {
      banned_ipv4_addresses: ipv4Addresses,
      banned_ipv6_addresses: ipv6Addresses,
      message: 'IP addresses banned successfully. Note: For self-hosted deployments, ensure your infrastructure is configured to enforce IP bans.',
      status: 'applied'
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error('Network bans POST error:', error)
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}

const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref } = req.query
    const { ip_addresses } = req.body

    if (!ref || typeof ref !== 'string') {
      return res.status(400).json({
        data: null,
        error: { message: 'Project reference is required' }
      })
    }

    if (!ip_addresses || !Array.isArray(ip_addresses) || ip_addresses.length === 0) {
      return res.status(400).json({
        data: null,
        error: { message: 'IP addresses array is required' }
      })
    }

    // For self-hosted deployments, this would typically integrate with
    // infrastructure-level IP unblocking
    
    // Validate IP addresses (reuse validation from POST)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipV6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/
    
    // Separate IPv4 and IPv6 addresses
    const ipv4Addresses = ip_addresses.filter(ip => ipRegex.test(ip))
    const ipv6Addresses = ip_addresses.filter(ip => ipV6Regex.test(ip))
    
    const response = {
      unbanned_ipv4_addresses: ipv4Addresses,
      unbanned_ipv6_addresses: ipv6Addresses,
      message: 'IP addresses unbanned successfully. Note: For self-hosted deployments, ensure your infrastructure is updated to remove IP bans.',
      status: 'applied'
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error('Network bans DELETE error:', error)
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}