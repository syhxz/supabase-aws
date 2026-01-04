import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'
import { getStorageServiceAdapter } from 'lib/storage-service/StorageServiceAdapter'
import { ensureProjectRegistered } from 'lib/api/ensure-project-registered'

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
    // Ensure project is registered with ServiceRouter
    await ensureProjectRegistered(ref)
    
    const storageService = getStorageServiceAdapter()
    const buckets = await storageService.listBuckets(ref)
    return res.status(200).json(buckets)
  } catch (error: any) {
    console.error('Error listing buckets:', error)
    return res.status(500).json({ error: { message: error.message || 'Internal Server Error' } })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref } = req.query
  
  if (!ref || typeof ref !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference is required' } })
  }

  const {
    id,
    public: isPublicBucket,
    allowed_mime_types: allowedMimeTypes,
    file_size_limit: fileSizeLimit,
  } = req.body

  if (!id) {
    return res.status(400).json({ error: { message: 'Bucket name (id) is required' } })
  }

  try {
    // Ensure project is registered with ServiceRouter
    await ensureProjectRegistered(ref)
    
    const storageService = getStorageServiceAdapter()
    const bucket = await storageService.createBucket(ref, id, {
      public: isPublicBucket,
      allowed_mime_types: allowedMimeTypes,
      file_size_limit: fileSizeLimit,
    })
    return res.status(200).json(bucket)
  } catch (error: any) {
    console.error('Error creating bucket:', error)
    return res.status(400).json({ error: { message: error.message || 'Failed to create bucket' } })
  }
}
