import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'
import { getAuthServiceAdapter } from 'lib/auth-service/AuthServiceAdapter'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'DELETE':
      return handleDelete(req, res)
    default:
      res.setHeader('Allow', ['GET', 'DELETE'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref, id } = req.query

  if (!ref || typeof ref !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference and user ID are required' } })
  }

  // Note: MFA factors functionality not yet implemented in AuthServiceAdapter
  // This would need to be added to support MFA
  return res.status(501).json({ error: { message: 'MFA factors not yet implemented' } })
}

const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref, id } = req.query

  if (!ref || typeof ref !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference and user ID are required' } })
  }

  // Note: MFA factors functionality not yet implemented in AuthServiceAdapter
  // This would need to be added to support MFA factor deletion
  return res.status(501).json({ error: { message: 'MFA factor deletion not yet implemented' } })
}
