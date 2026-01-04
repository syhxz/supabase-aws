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

  if (!ref || typeof ref !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference and bucket ID are required' } })
  }

  try {
    const storageService = getStorageServiceAdapter()
    
    // Get all files in the bucket
    const files = await storageService.listFiles(ref, id)
    
    // Delete all files
    for (const file of files) {
      await storageService.deleteFile(ref, id, file.name)
    }
    
    return res.status(200).json({ message: 'Bucket emptied successfully' })
  } catch (error: any) {
    console.error('Error emptying bucket:', error)
    return res.status(400).json({ error: { message: error.message || 'Failed to empty bucket' } })
  }
}
