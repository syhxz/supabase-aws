import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'
import { getStorageServiceAdapter } from 'lib/storage-service/StorageServiceAdapter'

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
    return res.status(400).json({ error: { message: 'Project reference and bucket ID are required' } })
  }

  try {
    const storageService = getStorageServiceAdapter()
    const bucket = await storageService.getBucket(ref, id)
    
    if (!bucket) {
      return res.status(404).json({ error: { message: 'Bucket not found' } })
    }
    
    return res.status(200).json(bucket)
  } catch (error: any) {
    console.error('Error getting bucket:', error)
    return res.status(500).json({ error: { message: error.message || 'Internal Server Error' } })
  }
}

const handlePatch = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref, id } = req.query

  if (!ref || typeof ref !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference and bucket ID are required' } })
  }

  // Note: Update bucket functionality not yet implemented in StorageServiceAdapter
  // This would need to be added to support bucket updates
  return res.status(501).json({ error: { message: 'Bucket update not yet implemented' } })
}

const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref, id } = req.query

  if (!ref || typeof ref !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference and bucket ID are required' } })
  }

  try {
    const storageService = getStorageServiceAdapter()
    await storageService.deleteBucket(ref, id, { force: true })
    return res.status(200).json({ message: 'Bucket deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting bucket:', error)
    return res.status(400).json({ error: { message: error.message || 'Failed to delete bucket' } })
  }
}
