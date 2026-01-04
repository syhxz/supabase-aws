import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess } from '../../../../../../lib/api/secure-api-wrapper'

/**
 * API endpoint for GraphQL API proxy with project isolation and security
 * 
 * POST /api/platform/projects/[ref]/api/graphql - Execute GraphQL query (requires read permission)
 * 
 * Requirements: 2.5
 */
export default withSecureProjectAccess(async (req, res, context) => {
  const { method } = req

  switch (method) {
    case 'POST':
      return handleGet(req, res, context)

    default:
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}, {
  permissions: { read: true }
})

const handleGet = async (req: NextApiRequest, res: NextApiResponse, context: any) => {
  const authorizationHeader = req.headers['x-graphql-authorization']

  const response = await fetch(`${process.env.SUPABASE_URL}/graphql/v1`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY!,
      Authorization:
        (Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader) ??
        `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req.body),
  })
  if (response.ok) {
    const data = await response.json()

    return res.status(200).json(data)
  }

  return res.status(500).json({ error: { message: 'Internal Server Error' } })
}
