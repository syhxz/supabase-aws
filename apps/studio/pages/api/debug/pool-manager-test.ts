import { NextApiRequest, NextApiResponse } from 'next'
import { getDatabasePoolManager } from 'lib/api/database-pool-manager'

/**
 * Debug endpoint to test database pool manager functionality
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('=== POOL MANAGER TEST ===')
  
  const poolManager = getDatabasePoolManager()
  
  try {
    // Test 1: Get all pool stats
    console.log('\n--- Test 1: All Pool Stats ---')
    const allStats = poolManager.getAllPoolStats()
    console.log('All Pool Stats:', Object.fromEntries(allStats))
    
    // Test 2: Health check
    console.log('\n--- Test 2: Health Check ---')
    const healthStatus = await poolManager.healthCheck()
    console.log('Health Status:', Object.fromEntries(healthStatus))
    
    // Test 3: Get detailed pool info for each pool
    console.log('\n--- Test 3: Detailed Pool Info ---')
    const poolInfos: any = {}
    for (const [poolKey] of allStats) {
      const poolInfo = poolManager.getPoolInfo(poolKey)
      if (poolInfo) {
        poolInfos[poolKey] = poolInfo
      }
    }
    console.log('Pool Infos:', JSON.stringify(poolInfos, null, 2))
    
    // Test 4: Create a test pool
    console.log('\n--- Test 4: Create Test Pool ---')
    const testPoolKey = 'test-pool-' + Date.now()
    const testConfig = {
      host: process.env.POSTGRES_HOST || 'db',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'postgres',
      user: process.env.POSTGRES_USER_READ_WRITE || 'supabase_admin',
      password: process.env.POSTGRES_PASSWORD,
      max: 5,
      application_name: 'pool-manager-test'
    }
    
    const testPool = poolManager.getPool(testPoolKey, testConfig)
    console.log('Test pool created:', testPoolKey)
    
    // Test the pool with a simple query
    try {
      const testResult = await poolManager.query(testPoolKey, testConfig, 'SELECT 1 as test')
      console.log('Test query result:', testResult.rows)
    } catch (queryError) {
      console.error('Test query failed:', queryError)
    }
    
    // Get info about the test pool
    const testPoolInfo = poolManager.getPoolInfo(testPoolKey)
    console.log('Test Pool Info:', JSON.stringify(testPoolInfo, null, 2))
    
    // Clean up test pool
    await poolManager.closePool(testPoolKey)
    console.log('Test pool closed')
    
    return res.status(200).json({
      success: true,
      message: 'Pool manager test completed',
      results: {
        allStats: Object.fromEntries(allStats),
        healthStatus: Object.fromEntries(healthStatus),
        poolInfos,
        testPoolCreated: true,
        testPoolClosed: true
      }
    })
    
  } catch (error) {
    console.error('Pool manager test failed:', error)
    return res.status(500).json({
      success: false,
      message: 'Pool manager test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}