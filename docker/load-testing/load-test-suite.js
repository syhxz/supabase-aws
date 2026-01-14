#!/usr/bin/env node
/**
 * Enhanced REST API Load Testing Suite
 * Comprehensive load testing for performance validation
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

const axios = require('axios')
const { performance } = require('perf_hooks')
const fs = require('fs').promises
const path = require('path')
const cluster = require('cluster')
const os = require('os')

// Load test configuration
const LOAD_CONFIG = {
  baseURL: process.env.SUPABASE_URL || 'http://localhost:8000',
  apiKey: process.env.SUPABASE_ANON_KEY || '',
  serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  
  // Test scenarios
  scenarios: {
    light: {
      duration: 60000, // 1 minute
      concurrency: 10,
      rampUp: 5000, // 5 seconds
      requestsPerSecond: 50
    },
    moderate: {
      duration: 300000, // 5 minutes
      concurrency: 50,
      rampUp: 30000, // 30 seconds
      requestsPerSecond: 200
    },
    heavy: {
      duration: 600000, // 10 minutes
      concurrency: 100,
      rampUp: 60000, // 1 minute
      requestsPerSecond: 500
    },
    stress: {
      duration: 300000, // 5 minutes
      concurrency: 200,
      rampUp: 30000, // 30 seconds
      requestsPerSecond: 1000
    }
  },
  
  // Test endpoints and operations
  endpoints: [
    { path: '/rest/v1/test_users', method: 'GET', weight: 40 },
    { path: '/rest/v1/test_users?limit=10', method: 'GET', weight: 30 },
    { path: '/rest/v1/test_user_summary', method: 'GET', weight: 15 },
    { path: '/rest/v1/rpc/test_get_user_count', method: 'POST', weight: 10 },
    { path: '/rest/v1/test_users', method: 'POST', weight: 5, data: { name: 'Load Test User', email: 'load@test.com' } }
  ]
}

// Results tracking
const loadTestResults = {
  scenario: '',
  startTime: 0,
  endTime: 0,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errorCounts: {},
  throughput: 0,
  workers: 0,
  memoryUsage: [],
  cpuUsage: []
}

// Utility functions
const log = (message, level = 'INFO') => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [${level}] ${message}`)
}

const createApiClient = () => {
  return axios.create({
    baseURL: LOAD_CONFIG.baseURL,
    timeout: 30000,
    headers: {
      'Authorization': `Bearer ${LOAD_CONFIG.apiKey}`,
      'Content-Type': 'application/json',
      'apikey': LOAD_CONFIG.apiKey
    }
  })
}

const selectRandomEndpoint = () => {
  const totalWeight = LOAD_CONFIG.endpoints.reduce((sum, ep) => sum + ep.weight, 0)
  let random = Math.random() * totalWeight
  
  for (const endpoint of LOAD_CONFIG.endpoints) {
    random -= endpoint.weight
    if (random <= 0) {
      return endpoint
    }
  }
  
  return LOAD_CONFIG.endpoints[0] // Fallback
}

const generateTestData = (endpoint) => {
  if (endpoint.data) {
    return {
      ...endpoint.data,
      email: `load-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
      timestamp: new Date().toISOString()
    }
  }
  return null
}

// Worker process for load generation
const runWorkerProcess = async (workerId, scenario, duration) => {
  const client = createApiClient()
  const workerResults = {
    workerId,
    requests: 0,
    successful: 0,
    failed: 0,
    responseTimes: [],
    errors: {}
  }
  
  const startTime = Date.now()
  const endTime = startTime + duration
  
  log(`Worker ${workerId} starting load generation for ${duration}ms`)
  
  while (Date.now() < endTime) {
    const endpoint = selectRandomEndpoint()
    const requestStart = performance.now()
    
    try {
      const requestData = generateTestData(endpoint)
      let response
      
      if (endpoint.method === 'GET') {
        response = await client.get(endpoint.path)
      } else if (endpoint.method === 'POST') {
        response = await client.post(endpoint.path, requestData)
      } else if (endpoint.method === 'PUT') {
        response = await client.put(endpoint.path, requestData)
      } else if (endpoint.method === 'DELETE') {
        response = await client.delete(endpoint.path)
      }
      
      const responseTime = performance.now() - requestStart
      
      workerResults.requests++
      workerResults.successful++
      workerResults.responseTimes.push(responseTime)
      
      // Throttle requests to match target RPS
      const targetInterval = 1000 / (scenario.requestsPerSecond / scenario.concurrency)
      const actualInterval = performance.now() - requestStart
      if (actualInterval < targetInterval) {
        await new Promise(resolve => setTimeout(resolve, targetInterval - actualInterval))
      }
      
    } catch (error) {
      const responseTime = performance.now() - requestStart
      
      workerResults.requests++
      workerResults.failed++
      workerResults.responseTimes.push(responseTime)
      
      const errorKey = error.response?.status || 'network_error'
      workerResults.errors[errorKey] = (workerResults.errors[errorKey] || 0) + 1
    }
  }
  
  log(`Worker ${workerId} completed: ${workerResults.successful}/${workerResults.requests} successful`)
  return workerResults
}

// System monitoring
const monitorSystemResources = async (duration) => {
  const monitoring = {
    memory: [],
    cpu: [],
    interval: 5000 // 5 seconds
  }
  
  const startTime = Date.now()
  
  while (Date.now() - startTime < duration) {
    // Memory usage
    const memUsage = process.memoryUsage()
    monitoring.memory.push({
      timestamp: Date.now(),
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    })
    
    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage()
    monitoring.cpu.push({
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system
    })
    
    await new Promise(resolve => setTimeout(resolve, monitoring.interval))
  }
  
  return monitoring
}

// Main load test execution
const runLoadTest = async (scenarioName) => {
  const scenario = LOAD_CONFIG.scenarios[scenarioName]
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioName}`)
  }
  
  log(`Starting load test scenario: ${scenarioName}`)
  log(`Duration: ${scenario.duration}ms, Concurrency: ${scenario.concurrency}, Target RPS: ${scenario.requestsPerSecond}`)
  
  loadTestResults.scenario = scenarioName
  loadTestResults.startTime = Date.now()
  loadTestResults.workers = scenario.concurrency
  
  // Start system monitoring
  const monitoringPromise = monitorSystemResources(scenario.duration + 10000) // Extra 10s buffer
  
  // Ramp up workers gradually
  const workers = []
  const rampUpInterval = scenario.rampUp / scenario.concurrency
  
  for (let i = 0; i < scenario.concurrency; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, rampUpInterval))
    }
    
    const workerPromise = runWorkerProcess(i, scenario, scenario.duration)
    workers.push(workerPromise)
    
    log(`Started worker ${i + 1}/${scenario.concurrency}`)
  }
  
  // Wait for all workers to complete
  log('Waiting for all workers to complete...')
  const workerResults = await Promise.all(workers)
  
  // Stop monitoring
  const systemMetrics = await monitoringPromise
  
  loadTestResults.endTime = Date.now()
  
  // Aggregate results
  loadTestResults.totalRequests = workerResults.reduce((sum, w) => sum + w.requests, 0)
  loadTestResults.successfulRequests = workerResults.reduce((sum, w) => sum + w.successful, 0)
  loadTestResults.failedRequests = workerResults.reduce((sum, w) => sum + w.failed, 0)
  
  // Combine all response times
  loadTestResults.responseTimes = workerResults.reduce((all, w) => all.concat(w.responseTimes), [])
  
  // Aggregate error counts
  workerResults.forEach(worker => {
    Object.entries(worker.errors).forEach(([error, count]) => {
      loadTestResults.errorCounts[error] = (loadTestResults.errorCounts[error] || 0) + count
    })
  })
  
  // Calculate throughput
  const durationSeconds = (loadTestResults.endTime - loadTestResults.startTime) / 1000
  loadTestResults.throughput = loadTestResults.successfulRequests / durationSeconds
  
  // Store system metrics
  loadTestResults.memoryUsage = systemMetrics.memory
  loadTestResults.cpuUsage = systemMetrics.cpu
  
  log(`Load test completed: ${loadTestResults.successfulRequests}/${loadTestResults.totalRequests} successful`)
  log(`Throughput: ${loadTestResults.throughput.toFixed(2)} RPS`)
  
  return loadTestResults
}

// Results analysis
const analyzeResults = (results) => {
  const responseTimes = results.responseTimes.sort((a, b) => a - b)
  const total = responseTimes.length
  
  const analysis = {
    summary: {
      scenario: results.scenario,
      duration: results.endTime - results.startTime,
      totalRequests: results.totalRequests,
      successfulRequests: results.successfulRequests,
      failedRequests: results.failedRequests,
      successRate: ((results.successfulRequests / results.totalRequests) * 100).toFixed(2) + '%',
      throughput: results.throughput.toFixed(2) + ' RPS',
      workers: results.workers
    },
    
    responseTime: {
      min: responseTimes[0]?.toFixed(2) || 0,
      max: responseTimes[total - 1]?.toFixed(2) || 0,
      mean: (responseTimes.reduce((sum, rt) => sum + rt, 0) / total).toFixed(2),
      median: responseTimes[Math.floor(total / 2)]?.toFixed(2) || 0,
      p95: responseTimes[Math.floor(total * 0.95)]?.toFixed(2) || 0,
      p99: responseTimes[Math.floor(total * 0.99)]?.toFixed(2) || 0
    },
    
    errors: results.errorCounts,
    
    systemResources: {
      peakMemoryMB: Math.max(...results.memoryUsage.map(m => m.rss / 1024 / 1024)).toFixed(2),
      avgMemoryMB: (results.memoryUsage.reduce((sum, m) => sum + m.rss, 0) / results.memoryUsage.length / 1024 / 1024).toFixed(2)
    }
  }
  
  return analysis
}

// Report generation
const generateLoadTestReport = async (analysis) => {
  const reportPath = path.join(__dirname, `load-test-report-${analysis.summary.scenario}-${Date.now()}.json`)
  
  const report = {
    ...analysis,
    timestamp: new Date().toISOString(),
    environment: {
      baseURL: LOAD_CONFIG.baseURL,
      nodeVersion: process.version,
      platform: os.platform(),
      cpus: os.cpus().length,
      totalMemory: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + 'GB'
    }
  }
  
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
  
  // Console report
  log('='.repeat(80))
  log(`LOAD TEST REPORT - ${analysis.summary.scenario.toUpperCase()}`)
  log('='.repeat(80))
  log(`Duration: ${analysis.summary.duration}ms`)
  log(`Workers: ${analysis.summary.workers}`)
  log(`Total Requests: ${analysis.summary.totalRequests}`)
  log(`Successful: ${analysis.summary.successfulRequests}`)
  log(`Failed: ${analysis.summary.failedRequests}`)
  log(`Success Rate: ${analysis.summary.successRate}`)
  log(`Throughput: ${analysis.summary.throughput}`)
  log('')
  log('RESPONSE TIMES (ms):')
  log(`  Min: ${analysis.responseTime.min}`)
  log(`  Max: ${analysis.responseTime.max}`)
  log(`  Mean: ${analysis.responseTime.mean}`)
  log(`  Median: ${analysis.responseTime.median}`)
  log(`  95th percentile: ${analysis.responseTime.p95}`)
  log(`  99th percentile: ${analysis.responseTime.p99}`)
  log('')
  log('SYSTEM RESOURCES:')
  log(`  Peak Memory: ${analysis.systemResources.peakMemoryMB}MB`)
  log(`  Avg Memory: ${analysis.systemResources.avgMemoryMB}MB`)
  log('')
  
  if (Object.keys(analysis.errors).length > 0) {
    log('ERRORS:')
    Object.entries(analysis.errors).forEach(([error, count]) => {
      log(`  ${error}: ${count}`)
    })
    log('')
  }
  
  log(`Full report saved to: ${reportPath}`)
  
  return reportPath
}

// Test setup
const setupLoadTestEnvironment = async () => {
  log('Setting up load test environment...')
  
  const client = axios.create({
    baseURL: LOAD_CONFIG.baseURL,
    headers: {
      'Authorization': `Bearer ${LOAD_CONFIG.serviceKey}`,
      'Content-Type': 'application/json',
      'apikey': LOAD_CONFIG.serviceKey
    }
  })
  
  try {
    // Create test data for load testing
    const setupQueries = [
      `CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        metadata JSONB DEFAULT '{}',
        tags TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE OR REPLACE VIEW test_user_summary AS 
       SELECT id, name, email, 
              jsonb_extract_path_text(metadata, 'role') as role,
              array_length(tags, 1) as tag_count,
              created_at
       FROM test_users`,
      
      `CREATE OR REPLACE FUNCTION test_get_user_count()
       RETURNS INTEGER AS $$
       BEGIN
         RETURN (SELECT COUNT(*) FROM test_users);
       END;
       $$ LANGUAGE plpgsql`,
      
      // Insert seed data for consistent load testing
      `INSERT INTO test_users (name, email, metadata, tags) 
       SELECT 
         'Load Test User ' || i,
         'loadtest' || i || '@example.com',
         '{"role": "user", "test": true}',
         '{"user", "test"}'
       FROM generate_series(1, 1000) i
       ON CONFLICT (email) DO NOTHING`
    ]
    
    for (const query of setupQueries) {
      await client.post('/rest/v1/rpc/exec_sql', { query })
    }
    
    log('Load test environment setup completed')
  } catch (error) {
    log(`Load test environment setup failed: ${error.message}`, 'ERROR')
    throw error
  }
}

// Main execution
const main = async () => {
  const scenarioName = process.argv[2] || 'light'
  
  if (!LOAD_CONFIG.scenarios[scenarioName]) {
    log(`Invalid scenario: ${scenarioName}`, 'ERROR')
    log(`Available scenarios: ${Object.keys(LOAD_CONFIG.scenarios).join(', ')}`)
    process.exit(1)
  }
  
  try {
    await setupLoadTestEnvironment()
    const results = await runLoadTest(scenarioName)
    const analysis = analyzeResults(results)
    await generateLoadTestReport(analysis)
    
    // Exit with appropriate code based on success rate
    const successRate = parseFloat(analysis.summary.successRate)
    if (successRate < 95) {
      log(`Low success rate: ${successRate}%`, 'WARN')
      process.exit(1)
    }
    
    process.exit(0)
  } catch (error) {
    log(`Load test failed: ${error.message}`, 'ERROR')
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = {
  runLoadTest,
  analyzeResults,
  generateLoadTestReport,
  LOAD_CONFIG
}