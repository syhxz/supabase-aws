import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ref, ...pathParts } = req.query
  const authPath = Array.isArray(pathParts.path) ? pathParts.path.join('/') : pathParts.path || ''
  
  if (!ref || typeof ref !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference is required' } })
  }

  try {
    const authUrl = process.env.AUTH_API_URL || 'http://supabase-auth:9999'
    const url = `${authUrl}/${authPath}${req.url?.includes('?') ? '?' + req.url.split('?')[1] : ''}`
    
    const headers: Record<string, string> = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    }
    
    if (req.headers['apikey']) {
      headers['apikey'] = req.headers['apikey'] as string
    }
    
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'] as string
    }
    
    const response = await fetch(url, {
      method: req.method,
      headers,
      ...(req.method !== 'GET' && req.method !== 'HEAD' && { body: JSON.stringify(req.body) })
    })

    const data = await response.json()
    
    // Auto-inject project_ref into user metadata on signup/login
    if ((authPath === 'signup' || authPath === 'token') && data.user && req.method === 'POST') {
      const serviceKey = process.env.SUPABASE_SERVICE_KEY
      await fetch(`${authUrl}/admin/users/${data.user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey as string
        },
        body: JSON.stringify({
          user_metadata: {
            ...data.user.user_metadata,
            project_ref: ref
          }
        })
      })
      
      data.user.user_metadata = {
        ...data.user.user_metadata,
        project_ref: ref
      }
    }
    
    return res.status(response.status).json(data)
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message } })
  }
}
