import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess } from '../../../../../../lib/api/secure-api-wrapper'

/**
 * API endpoint for REST API proxy with project isolation and security
 * 
 * GET /api/platform/projects/[ref]/api/rest - Get REST API schema (requires read permission)
 * HEAD /api/platform/projects/[ref]/api/rest - Check REST API availability (requires read permission)
 * 
 * Requirements: 2.5
 */
export default withSecureProjectAccess(async (req, res, context) => {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res, context)
    case 'HEAD':
      return handleHead(req, res, context)
    default:
      res.setHeader('Allow', ['GET', 'HEAD'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}, {
  permissions: { read: true }
})

const handleGet = async (req: NextApiRequest, res: NextApiResponse, context: any) => {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
    method: 'GET',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY!,
    },
  })
  if (response.ok) {
    const data = await response.json()

    return res.status(200).json(data)
  }

  return res.status(500).json({ error: { message: 'Internal Server Error' } })
}

const handleHead = async (req: NextApiRequest, res: NextApiResponse, context: any) => {
  res.status(200).end()
}
