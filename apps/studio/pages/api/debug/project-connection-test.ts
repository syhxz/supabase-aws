import { NextApiRequest, NextApiResponse } from 'next'
import { withProjectIsolation, ProjectIsolationContext } from 'lib/api/project-isolation-middleware'
import { getProjectDatabaseClient } from 'lib/api/project-database-client'

/**
 * Debug endpoint to test project database connection management
 */
async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  console.log('=== PROJECT CONNECTION TEST ===')
  console.log('Project Ref:', context.projectRef)
  console.log('User ID:', context.userId)
  
  const projectClient = getProjectDatabaseClient()
  
  try {
    // Test 1: Get connection info
    console.log('\n--- Test 1: Connection Info ---')
    const connectionInfo = await projectClient.getProjectConnectionInfo(context.projectRef, context.userId)
    console.log('Connection Info:', JSON.stringify(connectionInfo, null, 2))
    
    // Test 2: Test connection
    console.log('\n--- Test 2: Connection Test ---')
    const connectionTest = await projectClient.testProjectConnection(context.projectRef, context.userId)
    console.log('Connection Test Result:', connectionTest)
    
    // Test 3: Try a simple query
    console.log('\n--- Test 3: Simple Query ---')
    let queryResult = null
    try {
      queryResult = await projectClient.queryProjectDatabase(
        context.projectRef, 
        context.userId, 
        'SELECT current_database() as database_name, current_user as user_name, version() as version'
      )
      console.log('Query Result:', JSON.stringify(queryResult.rows, null, 2))
    } catch (queryError) {
      console.error('Query Error:', queryError)
      queryResult = { error: queryError instanceof Error ? queryError.message : 'Unknown error' }
    }
    
    // Test 4: Get project metadata
    console.log('\n--- Test 4: Project Metadata ---')
    const project = await projectClient.getProjectByRef(context.projectRef, context.userId)
    const projectInfo = project ? {
      ref: project.ref,
      name: project.name,
      database_name: project.database_name,
      database_user: project.database_user,
      hasConnectionString: !!project.connection_string,
      connectionStringLength: project.connection_string?.length || 0
    } : null
    console.log('Project Info:', JSON.stringify(projectInfo, null, 2))
    
    return res.status(200).json({
      success: true,
      message: 'Project connection test completed',
      results: {
        connectionInfo,
        connectionTest,
        queryResult,
        projectInfo
      },
      context: {
        projectRef: context.projectRef,
        userId: context.userId
      }
    })
    
  } catch (error) {
    console.error('Connection test failed:', error)
    return res.status(500).json({
      success: false,
      message: 'Project connection test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      context: {
        projectRef: context.projectRef,
        userId: context.userId
      }
    })
  }
}

export default withProjectIsolation(handler)