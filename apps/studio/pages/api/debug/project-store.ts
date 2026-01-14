import { NextApiRequest, NextApiResponse } from 'next'

/**
 * Debug endpoint to test project store functions
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('=== Project Store Debug ===')
    
    const projectRef = '0irikjmk5ijanl'
    
    // Test 1: Import project store functions
    console.log('Importing project store functions...')
    const { findByRef } = await import('lib/api/self-hosted/project-store-pg')
    console.log('Project store functions imported successfully')
    
    // Test 2: Find project by ref
    console.log('Finding project by ref:', projectRef)
    const result = await findByRef(projectRef)
    console.log('Project store result:', result)
    
    if (result.error) {
      return res.status(500).json({
        error: 'Project store error',
        details: result.error,
        step: 'findByRef'
      })
    }
    
    if (!result.data) {
      return res.status(404).json({
        error: 'Project not found',
        projectRef,
        step: 'findByRef'
      })
    }
    
    return res.status(200).json({
      success: true,
      projectRef,
      project: result.data,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Project store debug error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}