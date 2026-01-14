import { NextApiRequest, NextApiResponse } from 'next'

/**
 * Debug endpoint to test database connection and project store functions
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('=== DATABASE TEST DEBUG ===')
    
    // Test 1: Import project store functions
    console.log('Testing project store import...')
    const { findByRef } = await import('../../../lib/api/self-hosted/project-store-pg')
    console.log('✅ Project store imported successfully')
    
    // Test 2: Query project by ref
    console.log('Testing project query...')
    const projectRef = '0irikjmk5ijanl'
    const result = await findByRef(projectRef)
    
    console.log('Project query result:', {
      error: result.error ? result.error.message : null,
      data: result.data ? {
        id: result.data.id,
        ref: result.data.ref,
        name: result.data.name,
        owner_user_id: result.data.owner_user_id
      } : null
    })
    
    if (result.error) {
      return res.status(500).json({
        success: false,
        message: 'Database query failed',
        error: result.error.message,
        details: result.error
      })
    }
    
    if (!result.data) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
        projectRef
      })
    }
    
    return res.status(200).json({
      success: true,
      message: 'Database connection and project query working!',
      project: {
        id: result.data.id,
        ref: result.data.ref,
        name: result.data.name,
        owner_user_id: result.data.owner_user_id,
        status: result.data.status
      }
    })
    
  } catch (error) {
    console.error('Database test error:', error)
    return res.status(500).json({
      success: false,
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}