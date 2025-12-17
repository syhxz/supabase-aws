import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import { getAuthServiceAdapter } from 'lib/auth-service/AuthServiceAdapter'

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
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref } = req.query

  if (!ref || typeof ref !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference is required' } })
  }

  try {
    const authService = getAuthServiceAdapter()
    const users = await authService.listUsers(ref)
    return res.status(200).json(users)
  } catch (error: any) {
    console.error('Error listing users:', error)
    return res.status(500).json({ error: { message: error.message || 'Failed to list users' } })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref } = req.query
  const { email, password, user_metadata, app_metadata } = req.body

  if (!ref || typeof ref !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference is required' } })
  }

  if (!email || !password) {
    return res.status(400).json({ error: { message: 'Email and password are required' } })
  }

  try {
    const authService = getAuthServiceAdapter()
    const session = await authService.signUp(ref, {
      email,
      password,
      user_metadata,
      app_metadata,
    })
    
    return res.status(200).json(session.user)
  } catch (error: any) {
    console.error('Error creating user:', error)
    return res.status(400).json({ error: { message: error.message || 'Failed to create user' } })
  }
}
