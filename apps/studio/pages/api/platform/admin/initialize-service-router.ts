/**
 * Admin API: Initialize ServiceRouter
 * 
 * POST /api/platform/admin/initialize-service-router
 * 
 * Manually triggers ServiceRouter initialization to load all existing projects.
 * This is useful when projects were created before the isolation fix was applied.
 */

import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['POST'])
      res.status(405).json({
        error: {
          message: `Method ${method} Not Allowed`,
        },
      })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('=== Manual ServiceRouter Initialization ===')

  try {
    // Import and run initialization
    const { initializeServiceRouter } = await import('lib/service-router/init')

    await initializeServiceRouter()

    return res.status(200).json({
      success: true,
      message: 'ServiceRouter initialized successfully',
    })
  } catch (error) {
    console.error('Failed to initialize ServiceRouter:', error)

    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to initialize ServiceRouter',
        code: 'INITIALIZATION_FAILED',
      },
    })
  }
}
