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
  const { from, to } = req.body

  if (!ref || typeof ref !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference and bucket ID are required' } })
  }

  if (!from || !to) {
    return res.status(400).json({ error: { message: 'Source and destination paths are required' } })
  }

  try {
    const storageService = getStorageServiceAdapter()
    
    // Download the file from source
    const fileData = await storageService.downloadFile(ref, id, from)
    const fileMetadata = await storageService.getFile(ref, id, from)
    
    // Upload to destination
    await storageService.uploadFile(ref, id, to, fileData, {
      metadata: fileMetadata?.metadata,
    })
    
    // Delete the source file
    await storageService.deleteFile(ref, id, from)
    
    return res.status(200).json({ message: 'File moved successfully' })
  } catch (error: any) {
    console.error('Error moving file:', error)
    return res.status(400).json({ error: { message: error.message || 'Failed to move file' } })
  }
}
