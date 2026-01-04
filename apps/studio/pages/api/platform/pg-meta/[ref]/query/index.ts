import { constructHeaders } from 'lib/api/apiHelpers'
import apiWrapper from 'lib/api/apiWrapper'
import { executeQuery } from 'lib/api/self-hosted/query'
import { PgMetaDatabaseError } from 'lib/api/self-hosted/types'
import { getProjectRefFromRequest } from 'lib/api/self-hosted/project-database'
import { NextApiRequest, NextApiResponse } from 'next'

export default (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: true })

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ error: { message: `Method ${method} Not Allowed` } })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  const { query } = req.body
  const headers = constructHeaders(req.headers)
  
  // Get project reference to determine which database to use
  const projectRef = getProjectRefFromRequest(req)
  
  console.log(`[API] Executing query for project: ${projectRef}`)
  console.log(`[API] Query: ${query.substring(0, 200)}...`)
  
  const { data, error } = await executeQuery({ query, headers, projectRef })

  if (error) {
    if (error instanceof PgMetaDatabaseError) {
      const { statusCode, message, formattedError } = error
      return res.status(statusCode).json({ message, formattedError })
    }
    const { message } = error
    return res.status(500).json({ message, formattedError: message })
  } else {
    return res.status(200).json(data)
  }
}
