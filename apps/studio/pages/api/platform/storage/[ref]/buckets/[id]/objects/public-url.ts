import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'
import { getStorageServiceAdapter } from 'lib/storage-service/StorageServiceAdapter'

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
  const { path } = req.body

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
    
    // Generate public URL
    const baseUrl = process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL || 'http://localhost:8082'
    const publicUrl = `${baseUrl}/api/platform/storage/${ref}/buckets/${id}/objects/download?path=${encodeURIComponent(path)}`
    
    return res.status(200).json({ publicUrl })
  } catch (error: any) {
    console.error('Error generating public URL:', error)
    return res.status(400).json({ error: { message: error.message || 'Failed to generate public URL' } })
  }
}
