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
  const { path, ...params } = req.body

  if (!ref || typeof ref !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Project reference and bucket ID are required' } })
  }

  try {
    const storageService = getStorageServiceAdapter()
    const files = await storageService.listFiles(ref, id, {
      prefix: path || '',
      limit: params.options?.limit,
      offset: params.options?.offset,
    })
    return res.status(200).json(files)
  } catch (error: any) {
    console.error('Error listing files:', error)
    return res.status(500).json({ error: { message: error.message || 'Internal Server Error' } })
  }
}
