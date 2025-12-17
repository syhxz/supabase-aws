import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'
import { getStorageServiceAdapter } from 'lib/storage-service/StorageServiceAdapter'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'DELETE':
      return handleDelete(req, res)
    default:
      res.setHeader('Allow', ['DELETE'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref, id } = req.query
  const { paths } = req.body

  if (!ref || typeof ref !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference and bucket ID are required' } })
  }

  if (!paths || !Array.isArray(paths)) {
    return res.status(400).json({ error: { message: 'Paths array is required' } })
  }

  try {
    const storageService = getStorageServiceAdapter()
    const results = []
    
    for (const path of paths) {
      try {
        await storageService.deleteFile(ref, id, path)
        results.push({ name: path, success: true })
      } catch (error: any) {
        results.push({ name: path, success: false, error: error.message })
      }
    }
    
    return res.status(200).json(results)
  } catch (error: any) {
    console.error('Error deleting files:', error)
    return res.status(400).json({ error: { message: error.message || 'Failed to delete files' } })
  }
}
