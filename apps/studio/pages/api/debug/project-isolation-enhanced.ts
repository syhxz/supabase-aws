import { NextApiRequest, NextApiResponse } from 'next'
import { withProjectIsolation, ProjectIsolationContext } from 'lib/api/project-isolation-middleware'
import { getProjectDatabaseClient } from 'lib/api/project-database-client'
import { getDatabasePoolManager } from 'lib/api/database-pool-manager'

/**
 * Enhanced debug endpoint to test complete project isolation
 */
async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  console.log('=== ENHANCED PROJECT ISOLATION TEST ===')
  console.log('Project Ref:', context.projectRef)
  console.log('User ID:', context.userId)
  
  const projectClient = getProjectDatabaseClient()
  const poolManager = getDatabasePoolManager()
  
  try {
    // Test 1: Project metadata and connection info
    console.log('\n--- Test 1: Project Metadata ---')
    const project = await projectClient.getProjectByRef(context.projectRef, context.userId)
    const connectionInfo = await projectClient.getProjectConnectionInfo(context.projectRef, context.userId)
    
    console.log('Project found:', !!project)
    console.log('Connection Info:', JSON.stringify(connectionInfo, null, 2))
    
    // Test 2: Pool isolation verification
    console.log('\n--- Test 2: Pool Isolation ---')
    const expectedPoolKey = `project-${context.projectRef}`
    const poolInfo = poolManager.getPoolInfo(expectedPoolKey)
    
    console.log('Expected Pool Key:', expectedPoolKey)
    console.log('Pool exists before query:', !!poolInfo)
    
    // Test 3: Execute query to create pool
    console.log('\n--- Test 3: Execute Query (Creates Pool) ---')
    let queryResult = null
    try {
      queryResult = await projectClient.queryProjectDatabase(
        context.projectRef,
        context.userId,
        `SELECT 
          current_database() as current_db,
          current_user as current_user,
          inet_server_addr() as server_addr,
          inet_server_port() as server_port,
          version() as pg_version`
      )
      console.log('Query executed successfully')
      console.log('Database info:', JSON.stringify(queryResult.rows[0], null, 2))
    } catch (queryError) {
      console.error('Query failed:', queryError)
      queryResult = { error: queryError instanceof Error ? queryError.message : 'Unknown error' }
    }
    
    // Test 4: Verify pool was created with correct configuration
    console.log('\n--- Test 4: Pool Verification ---')
    const poolInfoAfter = poolManager.getPoolInfo(expectedPoolKey)
    console.log('Pool exists after query:', !!poolInfoAfter)
    if (poolInfoAfter) {
      console.log('Pool configuration:', JSON.stringify(poolInfoAfter.config, null, 2))
      console.log('Pool stats:', JSON.stringify(poolInfoAfter.stats, null, 2))
    }
    
    // Test 5: Connection test
    console.log('\n--- Test 5: Connection Test ---')
    const connectionTest = await projectClient.testProjectConnection(context.projectRef, context.userId)
    console.log('Connection test passed:', connectionTest)
    
    // Test 6: Multiple queries to test pool reuse
    console.log('\n--- Test 6: Pool Reuse Test ---')
    const queries = [
      'SELECT 1 as test1',
      'SELECT 2 as test2', 
      'SELECT 3 as test3'
    ]
    
    const multiQueryResults = []
    for (let i = 0; i < queries.length; i++) {
      try {
        const result = await projectClient.queryProjectDatabase(
          context.projectRef,
          context.userId,
          queries[i]
        )
        multiQueryResults.push({ 
          query: queries[i], 
          success: true, 
          result: result.rows[0] 
        })
      } catch (error) {
        multiQueryResults.push({ 
          query: queries[i], 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }
    console.log('Multi-query results:', JSON.stringify(multiQueryResults, null, 2))
    
    // Test 7: Pool stats after multiple queries
    console.log('\n--- Test 7: Final Pool Stats ---')
    const finalPoolInfo = poolManager.getPoolInfo(expectedPoolKey)
    console.log('Final pool stats:', JSON.stringify(finalPoolInfo?.stats, null, 2))
    
    // Test 8: All pools overview
    console.log('\n--- Test 8: All Pools Overview ---')
    const allPoolStats = poolManager.getAllPoolStats()
    const poolOverview = Object.fromEntries(
      Array.from(allPoolStats.entries()).map(([key, stats]) => [
        key, 
        { 
          ...stats, 
          isProjectPool: key.startsWith('project-'),
          projectRef: key.startsWith('project-') ? key.replace('project-', '') : null
        }
      ])
    )
    console.log('All pools:', JSON.stringify(poolOverview, null, 2))
    
    return res.status(200).json({
      success: true,
      message: 'Enhanced project isolation test completed',
      results: {
        project: project ? {
          ref: project.ref,
          name: project.name,
          database_name: project.database_name,
          hasConnectionString: !!project.connection_string
        } : null,
        connectionInfo,
        poolKey: expectedPoolKey,
        poolCreated: !!poolInfoAfter,
        poolConfig: poolInfoAfter?.config,
        connectionTest,
        queryResult: queryResult?.rows?.[0] || queryResult,
        multiQueryResults,
        finalPoolStats: finalPoolInfo?.stats,
        allPools: poolOverview
      },
      context: {
        projectRef: context.projectRef,
        userId: context.userId
      }
    })
    
  } catch (error) {
    console.error('Enhanced isolation test failed:', error)
    return res.status(500).json({
      success: false,
      message: 'Enhanced project isolation test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      context: {
        projectRef: context.projectRef,
        userId: context.userId
      }
    })
  }
}

export default withProjectIsolation(handler)