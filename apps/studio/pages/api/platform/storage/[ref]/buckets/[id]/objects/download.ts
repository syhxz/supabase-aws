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
    const fileData = await storageService.downloadFile(ref, id, path)
    
    return res
      .status(200)
      .setHeader('Content-Type', 'application/octet-stream')
      .send(fileData)
  } catch (error: any) {
    console.error('Error downloading file:', error)
    return res.status(400).json({ error: { message: error.message || 'Failed to download file' } })
  }
}
