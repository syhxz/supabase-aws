import { NextApiRequest, NextApiResponse } from 'next'
import { runStartupHooks } from 'lib/startup/startup-hooks'

/**
 * Internal Startup Initialization API
 * 
 * This endpoint is called internally during application startup
 * to ensure all required databases and schemas are initialized.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('[Startup API] Running startup initialization...')
    await runStartupHooks()
    
    return res.status(200).json({ 
      success: true, 
      message: 'Startup initialization completed successfully' 
    })
  } catch (error) {
    console.error('[Startup API] Startup initialization failed:', error)
    
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Startup initialization failed'
    })
  }
}