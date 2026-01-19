import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'
import { getStorageServiceAdapter } from 'lib/storage-service/StorageServiceAdapter'
import formidable from 'formidable'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

export const config = {
  api: {
    bodyParser: false,
  },
}

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
    // Parse multipart form data
    const form = formidable({ multiples: false })
    const [fields, files] = await form.parse(req)
    
    const file = Array.isArray(files.file) ? files.file[0] : files.file
    const filePath = Array.isArray(fields.path) ? fields.path[0] : fields.path
    
    if (!file || !filePath) {
      return res.status(400).json({ error: { message: 'File and path are required' } })
    }

    // Read file data
    const fs = require('fs')
    const fileData = fs.readFileSync(file.filepath)
    
    const storageService = await getStorageServiceAdapter(ref)
    
    // Extract user token from Authorization header
    const authHeader = req.headers.authorization
    const userToken = authHeader?.replace('Bearer ', '')
    
    const result = await storageService.uploadFile(
      ref,
      id,
      filePath,
      fileData,
      {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: true
      },
      userToken
    )
    
    return res.status(200).json(result)
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ 
      error: { message: error.message || 'Upload failed' } 
    })
  }
}
