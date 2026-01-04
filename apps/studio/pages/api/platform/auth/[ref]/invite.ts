import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import { getAuthServiceAdapter } from 'lib/auth-service/AuthServiceAdapter'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref } = req.query
  const { email } = req.body

  if (!ref || typeof ref !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference is required' } })
  }

  if (!email) {
    return res.status(400).json({ error: { message: 'Email is required' } })
  }

  try {
    const authService = getAuthServiceAdapter()
    
    // Create user with a temporary password (they'll need to reset it)
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
    const session = await authService.signUp(ref, {
      email,
      password: tempPassword,
      user_metadata: { invited: true },
    })
    
    // In a real implementation, you'd send an invitation email here
    // For now, just return the user
    return res.status(200).json({ user: session.user })
  } catch (error: any) {
    console.error('Error inviting user:', error)
    return res.status(400).json({ error: { message: error.message || 'Failed to invite user' } })
  }
}
