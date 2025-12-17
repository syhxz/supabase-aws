import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'
import { getStorageServiceAdapter } from 'lib/storage-service/StorageServiceAdapter'
import * as crypto from 'crypto'

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
  const { ref, id } = req.query
  const { path, expiresIn = 60 * 60 * 24 } = req.body

  if (!ref || typeof ref !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference and bucket ID are required' } })
  }

  if (!path) {
    return res.status(400).json({ error: { message: 'File path is required' } })
  }

  try {
    const storageService = getStorageServiceAdapter()
    
    // Verify file exists
    const file = await storageService.getFile(ref, id, path)
    if (!file) {
      return res.status(404).json({ error: { message: 'File not found' } })
    }
    
    // Generate signed URL with expiration
    // Note: This is a simplified implementation. In production, you'd want to use JWT or similar
    const expiresAt = Date.now() + (expiresIn * 1000)
    const token = crypto.randomBytes(32).toString('hex')
    
    const baseUrl = process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL || 'http://localhost:8082'
    const signedUrl = `${baseUrl}/api/platform/storage/${ref}/buckets/${id}/objects/download?path=${encodeURIComponent(path)}&token=${token}&expires=${expiresAt}`
    
    return res.status(200).json({ 
      signedUrl,
      path,
      expiresIn,
      expiresAt: new Date(expiresAt).toISOString()
    })
  } catch (error: any) {
    console.error('Error creating signed URL:', error)
    return res.status(400).json({ error: { message: error.message || 'Failed to create signed URL' } })
  }
}
