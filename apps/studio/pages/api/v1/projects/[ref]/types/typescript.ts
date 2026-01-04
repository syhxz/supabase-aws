import { NextApiRequest, NextApiResponse } from 'next'

import { constructHeaders } from 'lib/api/apiHelpers'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { generateTypescriptTypes } from 'lib/api/self-hosted/generate-types'
import { ResponseError } from 'types'

export default withSecureProjectAccess(handler, {
  permissions: { read: true }
})

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse) => {
  const headers = constructHeaders(req.headers)

  const response = await generateTypescriptTypes({ headers })

  if (response instanceof ResponseError) {
    return res.status(response.code ?? 500).json({ message: response.message })
  }

  return res.status(200).json(response)
}
