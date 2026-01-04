import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  // Mock permissions endpoint for local development
  // Return full admin permissions for local development
  const permissions = [
    {
      id: 1,
      organization_slug: 'default-org-slug',
      actions: ['%'],
      resources: ['%'],
      condition: null,
      restrictive: false,
      project_refs: null,
    },
  ]
  return res.status(200).json(permissions)
}
