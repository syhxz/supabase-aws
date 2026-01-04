import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import { getAuthServiceAdapter } from 'lib/auth-service/AuthServiceAdapter'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'PATCH':
      return handlePatch(req, res)
    case 'DELETE':
      return handleDelete(req, res)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref, id } = req.query

  if (!ref || typeof ref !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference and user ID are required' } })
  }

  try {
    const authService = getAuthServiceAdapter()
    const user = await authService.getUser(ref, id)
    
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } })
    }
    
    return res.status(200).json(user)
  } catch (error: any) {
    console.error('Error getting user:', error)
    return res.status(500).json({ error: { message: error.message || 'Failed to get user' } })
  }
}

const handlePatch = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref, id } = req.query

  if (!ref || typeof ref !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference and user ID are required' } })
  }

  // Note: User update functionality not yet fully implemented in AuthServiceAdapter
  // This would need to be added to support user updates (ban_duration, etc.)
  return res.status(501).json({ error: { message: 'User update not yet implemented' } })
}

const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref, id } = req.query

  if (!ref || typeof ref !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference and user ID are required' } })
  }

  try {
    const authService = getAuthServiceAdapter()
    await authService.deleteUser(ref, id)
    return res.status(200).json({ message: 'User deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting user:', error)
    return res.status(400).json({ error: { message: error.message || 'Failed to delete user' } })
  }
}
