import { NextApiRequest, NextApiResponse } from 'next'
import { getCurrentUserId, validateUserProjectAccessByRef } from 'lib/api/auth-helpers'
import { findByRef } from 'lib/api/self-hosted/project-store-pg'

/**
 * Debug endpoint to test each step of project isolation middleware
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const projectRef = '0irikjmk5ijanl'
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    projectRef,
    steps: {}
  }

  try {
    // Step 1: Extract JWT token
    const authHeader = req.headers.authorization
    debugInfo.steps.step1_token_extraction = {
      hasAuthHeader: !!authHeader,
      authHeaderFormat: authHeader ? authHeader.substring(0, 20) + '...' : null,
      tokenLength: authHeader ? authHeader.length : 0
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      debugInfo.steps.step1_token_extraction.error = 'No Bearer token found'
      return res.status(200).json(debugInfo)
    }

    // Step 2: Get current user ID
    console.log('Step 2: Getting current user ID...')
    const userId = await getCurrentUserId(req, projectRef)
    debugInfo.steps.step2_get_user_id = {
      userId: userId,
      success: !!userId
    }

    if (!userId) {
      debugInfo.steps.step2_get_user_id.error = 'Failed to get user ID from JWT token'
      return res.status(200).json(debugInfo)
    }

    // Step 3: Find project by ref
    console.log('Step 3: Finding project by ref...')
    const projectResult = await findByRef(projectRef)
    debugInfo.steps.step3_find_project = {
      success: !projectResult.error && !!projectResult.data,
      error: projectResult.error?.message,
      projectFound: !!projectResult.data,
      projectData: projectResult.data ? {
        id: projectResult.data.id,
        ref: projectResult.data.ref,
        name: projectResult.data.name,
        owner_user_id: projectResult.data.owner_user_id,
        organization_id: projectResult.data.organization_id,
        status: projectResult.data.status
      } : null
    }

    if (projectResult.error || !projectResult.data) {
      debugInfo.steps.step3_find_project.error = projectResult.error?.message || 'Project not found'
      return res.status(200).json(debugInfo)
    }

    // Step 4: Validate user project access
    console.log('Step 4: Validating user project access...')
    const accessResult = await validateUserProjectAccessByRef(userId, projectRef)
    debugInfo.steps.step4_validate_access = {
      hasAccess: accessResult.hasAccess,
      accessType: accessResult.accessType,
      reason: accessResult.reason,
      organizationId: accessResult.organizationId,
      userIdMatches: projectResult.data.owner_user_id === userId
    }

    // Step 5: Check database connection (simulate what project store does)
    console.log('Step 5: Testing database connection...')
    try {
      // Test a simple query to verify database connectivity
      const testResult = await findByRef(projectRef) // This tests the database connection
      debugInfo.steps.step5_database_test = {
        success: !testResult.error,
        error: testResult.error?.message
      }
    } catch (dbError) {
      debugInfo.steps.step5_database_test = {
        success: false,
        error: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }
    }

    // Summary
    debugInfo.summary = {
      allStepsSuccessful: debugInfo.steps.step2_get_user_id.success &&
                         debugInfo.steps.step3_find_project.success &&
                         debugInfo.steps.step4_validate_access.hasAccess &&
                         debugInfo.steps.step5_database_test.success,
      finalAccessGranted: accessResult.hasAccess,
      userId,
      projectRef,
      projectId: projectResult.data?.id
    }

    return res.status(200).json(debugInfo)

  } catch (error) {
    debugInfo.error = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }
    
    console.error('Debug endpoint error:', error)
    return res.status(200).json(debugInfo)
  }
}