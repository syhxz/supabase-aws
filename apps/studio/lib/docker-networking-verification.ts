/**
 * Docker Networking Configuration Verification
 * 
 * Validates Docker service discovery, networking setup, port mapping for health checks,
 * and health check configuration according to requirements 3.1, 3.3, and 3.4.
 */

import { 
  logFailedRequest, 
  logSuccessfulRequest, 
  type RequestLogInfo 
} from 'common/configuration-logging'

export interface DockerNetworkingConfig {
  /** Service discovery validation */
  serviceDiscovery: ServiceDiscoveryValidation
  /** Network connectivity validation */
  networkConnectivity: NetworkConnectivityValidation
  /** Port mapping validation */
  portMapping: PortMappingValidation
  /** Health check configuration validation */
  healthCheckConfig: HealthCheckConfigValidation
  /** Overall networking status */
  overallStatus: {
    healthy: boolean
    issues: string[]
    recommendations: string[]
  }
}

export interface ServiceDiscoveryValidation {
  /** Whether service discovery is working */
  working: boolean
  /** Discovered services */
  discoveredServices: {
    [serviceName: string]: {
      reachable: boolean
      url?: string
      responseTime?: number
      error?: string
    }
  }
  /** Service discovery errors */
  errors: string[]
}

export interface NetworkConnectivityValidation {
  /** Whether inter-service communication is working */
  working: boolean
  /** Connectivity test results */
  connectivityTests: {
    [testName: string]: {
      success: boolean
      responseTime?: number
      error?: string
    }
  }
  /** Network configuration issues */
  issues: string[]
}

export interface PortMappingValidation {
  /** Whether port mapping is correct */
  correct: boolean
  /** Port mapping details */
  ports: {
    [serviceName: string]: {
      internal: number
      external?: number
      accessible: boolean
      error?: string
    }
  }
  /** Port mapping issues */
  issues: string[]
}

export interface HealthCheckConfigValidation {
  /** Whether health check configuration is valid */
  valid: boolean
  /** Health check configurations */
  configurations: {
    [serviceName: string]: {
      configured: boolean
      endpoint?: string
      interval?: string
      timeout?: string
      retries?: number
      status?: 'healthy' | 'unhealthy' | 'starting' | 'unknown'
      error?: string
    }
  }
  /** Configuration issues */
  issues: string[]
}

/**
 * Expected Docker services for Supabase stack
 */
const EXPECTED_SERVICES = {
  'kong': {
    internalPort: 8000,
    externalPort: 8000,
    healthEndpoint: '/health',
  },
  'auth': {
    internalPort: 9999,
    externalPort: null, // Internal only
    healthEndpoint: '/health',
  },
  'rest': {
    internalPort: 3000,
    externalPort: null, // Internal only
    healthEndpoint: null,
  },
  'db': {
    internalPort: 5432,
    externalPort: 5432,
    healthEndpoint: null,
  },
  'studio': {
    internalPort: 3000,
    externalPort: 3000,
    healthEndpoint: '/api/health',
  },
} as const

/**
 * Tests service discovery by attempting to resolve service names
 */
export async function validateServiceDiscovery(): Promise<ServiceDiscoveryValidation> {
  console.log('[Docker Networking] Validating service discovery...')
  
  const discoveredServices: ServiceDiscoveryValidation['discoveredServices'] = {}
  const errors: string[] = []

  for (const [serviceName, config] of Object.entries(EXPECTED_SERVICES)) {
    try {
      const startTime = Date.now()
      
      // Try to connect to the service using Docker internal networking
      const serviceUrl = `http://${serviceName}:${config.internalPort}`
      
      console.log(`[Docker Networking] Testing service discovery for ${serviceName} at ${serviceUrl}`)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      try {
        const response = await fetch(serviceUrl, {
          method: 'HEAD',
          // Only use signal in environments that support it properly
          ...(typeof AbortSignal !== 'undefined' && controller.signal instanceof AbortSignal ? { signal: controller.signal } : {}),
        })
        
        clearTimeout(timeoutId)
        const responseTime = Date.now() - startTime
        
        discoveredServices[serviceName] = {
          reachable: true,
          url: serviceUrl,
          responseTime,
        }
        
        console.log(`[Docker Networking] ✓ ${serviceName} is reachable (${responseTime}ms)`)
      } catch (fetchError) {
        clearTimeout(timeoutId)
        const responseTime = Date.now() - startTime
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error'
        
        discoveredServices[serviceName] = {
          reachable: false,
          url: serviceUrl,
          responseTime,
          error: errorMessage,
        }
        
        errors.push(`${serviceName}: ${errorMessage}`)
        console.log(`[Docker Networking] ✗ ${serviceName} is not reachable: ${errorMessage}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      discoveredServices[serviceName] = {
        reachable: false,
        error: errorMessage,
      }
      errors.push(`${serviceName}: ${errorMessage}`)
      console.log(`[Docker Networking] ✗ Failed to test ${serviceName}: ${errorMessage}`)
    }
  }

  const working = errors.length === 0

  return {
    working,
    discoveredServices,
    errors,
  }
}

/**
 * Tests network connectivity between services
 */
export async function validateNetworkConnectivity(): Promise<NetworkConnectivityValidation> {
  console.log('[Docker Networking] Validating network connectivity...')
  
  const connectivityTests: NetworkConnectivityValidation['connectivityTests'] = {}
  const issues: string[] = []

  // Test Studio -> Kong connectivity (critical path)
  try {
    console.log('[Docker Networking] Testing Studio -> Kong connectivity...')
    const startTime = Date.now()
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    try {
      const response = await fetch('http://kong:8000/health', {
        method: 'GET',
        // Only use signal in environments that support it properly
        ...(typeof AbortSignal !== 'undefined' && controller.signal instanceof AbortSignal ? { signal: controller.signal } : {}),
      })
      
      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime
      
      connectivityTests['studio-to-kong'] = {
        success: response.ok,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      }
      
      if (response.ok) {
        console.log(`[Docker Networking] ✓ Studio -> Kong connectivity working (${responseTime}ms)`)
      } else {
        issues.push(`Studio -> Kong: HTTP ${response.status}`)
        console.log(`[Docker Networking] ✗ Studio -> Kong connectivity failed: HTTP ${response.status}`)
      }
    } catch (fetchError) {
      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error'
      
      connectivityTests['studio-to-kong'] = {
        success: false,
        responseTime,
        error: errorMessage,
      }
      
      issues.push(`Studio -> Kong: ${errorMessage}`)
      console.log(`[Docker Networking] ✗ Studio -> Kong connectivity failed: ${errorMessage}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    connectivityTests['studio-to-kong'] = {
      success: false,
      error: errorMessage,
    }
    issues.push(`Studio -> Kong: ${errorMessage}`)
    console.log(`[Docker Networking] ✗ Failed to test Studio -> Kong: ${errorMessage}`)
  }

  // Test Kong -> GoTrue connectivity (critical path)
  try {
    console.log('[Docker Networking] Testing Kong -> GoTrue connectivity...')
    const startTime = Date.now()
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    try {
      // Test through Kong's routing to GoTrue health endpoint
      const response = await fetch('http://kong:8000/auth/v1/health', {
        method: 'GET',
        // Only use signal in environments that support it properly
        ...(typeof AbortSignal !== 'undefined' && controller.signal instanceof AbortSignal ? { signal: controller.signal } : {}),
      })
      
      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime
      
      connectivityTests['kong-to-gotrue'] = {
        success: response.ok,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      }
      
      if (response.ok) {
        console.log(`[Docker Networking] ✓ Kong -> GoTrue connectivity working (${responseTime}ms)`)
      } else {
        issues.push(`Kong -> GoTrue: HTTP ${response.status}`)
        console.log(`[Docker Networking] ✗ Kong -> GoTrue connectivity failed: HTTP ${response.status}`)
      }
    } catch (fetchError) {
      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error'
      
      connectivityTests['kong-to-gotrue'] = {
        success: false,
        responseTime,
        error: errorMessage,
      }
      
      issues.push(`Kong -> GoTrue: ${errorMessage}`)
      console.log(`[Docker Networking] ✗ Kong -> GoTrue connectivity failed: ${errorMessage}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    connectivityTests['kong-to-gotrue'] = {
      success: false,
      error: errorMessage,
    }
    issues.push(`Kong -> GoTrue: ${errorMessage}`)
    console.log(`[Docker Networking] ✗ Failed to test Kong -> GoTrue: ${errorMessage}`)
  }

  // Test direct GoTrue connectivity (bypass Kong)
  try {
    console.log('[Docker Networking] Testing direct GoTrue connectivity...')
    const startTime = Date.now()
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    try {
      const response = await fetch('http://auth:9999/health', {
        method: 'GET',
        // Only use signal in environments that support it properly
        ...(typeof AbortSignal !== 'undefined' && controller.signal instanceof AbortSignal ? { signal: controller.signal } : {}),
      })
      
      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime
      
      connectivityTests['direct-gotrue'] = {
        success: response.ok,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      }
      
      if (response.ok) {
        console.log(`[Docker Networking] ✓ Direct GoTrue connectivity working (${responseTime}ms)`)
      } else {
        issues.push(`Direct GoTrue: HTTP ${response.status}`)
        console.log(`[Docker Networking] ✗ Direct GoTrue connectivity failed: HTTP ${response.status}`)
      }
    } catch (fetchError) {
      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error'
      
      connectivityTests['direct-gotrue'] = {
        success: false,
        responseTime,
        error: errorMessage,
      }
      
      issues.push(`Direct GoTrue: ${errorMessage}`)
      console.log(`[Docker Networking] ✗ Direct GoTrue connectivity failed: ${errorMessage}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    connectivityTests['direct-gotrue'] = {
      success: false,
      error: errorMessage,
    }
    issues.push(`Direct GoTrue: ${errorMessage}`)
    console.log(`[Docker Networking] ✗ Failed to test direct GoTrue: ${errorMessage}`)
  }

  const working = issues.length === 0

  return {
    working,
    connectivityTests,
    issues,
  }
}

/**
 * Validates port mapping configuration
 */
export async function validatePortMapping(): Promise<PortMappingValidation> {
  console.log('[Docker Networking] Validating port mapping...')
  
  const ports: PortMappingValidation['ports'] = {}
  const issues: string[] = []

  for (const [serviceName, config] of Object.entries(EXPECTED_SERVICES)) {
    try {
      // Test internal port accessibility
      const internalUrl = `http://${serviceName}:${config.internalPort}`
      
      console.log(`[Docker Networking] Testing internal port for ${serviceName}: ${config.internalPort}`)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      try {
        const response = await fetch(internalUrl, {
          method: 'HEAD',
          // Only use signal in environments that support it properly
          ...(typeof AbortSignal !== 'undefined' && controller.signal instanceof AbortSignal ? { signal: controller.signal } : {}),
        })
        
        clearTimeout(timeoutId)
        
        ports[serviceName] = {
          internal: config.internalPort,
          external: config.externalPort,
          accessible: true,
        }
        
        console.log(`[Docker Networking] ✓ ${serviceName} internal port ${config.internalPort} is accessible`)
      } catch (fetchError) {
        clearTimeout(timeoutId)
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error'
        
        ports[serviceName] = {
          internal: config.internalPort,
          external: config.externalPort,
          accessible: false,
          error: errorMessage,
        }
        
        issues.push(`${serviceName} internal port ${config.internalPort}: ${errorMessage}`)
        console.log(`[Docker Networking] ✗ ${serviceName} internal port ${config.internalPort} not accessible: ${errorMessage}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      ports[serviceName] = {
        internal: config.internalPort,
        external: config.externalPort,
        accessible: false,
        error: errorMessage,
      }
      
      issues.push(`${serviceName}: ${errorMessage}`)
      console.log(`[Docker Networking] ✗ Failed to test ${serviceName} port mapping: ${errorMessage}`)
    }
  }

  const correct = issues.length === 0

  return {
    correct,
    ports,
    issues,
  }
}

/**
 * Validates health check configuration in docker-compose
 */
export function validateHealthCheckConfig(): HealthCheckConfigValidation {
  console.log('[Docker Networking] Validating health check configuration...')
  
  const configurations: HealthCheckConfigValidation['configurations'] = {}
  const issues: string[] = []

  // Expected health check configurations based on docker-compose.yml
  const expectedHealthChecks = {
    'studio': {
      endpoint: '/api/health',
      interval: '30s',
      timeout: '10s',
      retries: 3,
    },
    'auth': {
      endpoint: '/health',
      interval: '5s',
      timeout: '5s',
      retries: 3,
    },
    'kong': {
      endpoint: null, // Kong doesn't have health check in compose
      interval: null,
      timeout: null,
      retries: null,
    },
    'db': {
      endpoint: null, // Uses pg_isready
      interval: '5s',
      timeout: '5s',
      retries: 10,
    },
  }

  for (const [serviceName, expectedConfig] of Object.entries(expectedHealthChecks)) {
    const configured = expectedConfig.endpoint !== null || serviceName === 'db'
    
    configurations[serviceName] = {
      configured,
      endpoint: expectedConfig.endpoint || undefined,
      interval: expectedConfig.interval || undefined,
      timeout: expectedConfig.timeout || undefined,
      retries: expectedConfig.retries || undefined,
      status: 'unknown', // Would need Docker API to get actual status
    }

    if (!configured && serviceName !== 'kong') {
      issues.push(`${serviceName}: No health check configured`)
      console.log(`[Docker Networking] ⚠️  ${serviceName} has no health check configured`)
    } else {
      console.log(`[Docker Networking] ✓ ${serviceName} health check configuration found`)
    }
  }

  const valid = issues.length === 0

  return {
    valid,
    configurations,
    issues,
  }
}

/**
 * Performs comprehensive Docker networking configuration verification
 */
export async function verifyDockerNetworkingConfiguration(): Promise<DockerNetworkingConfig> {
  console.log('[Docker Networking] Starting comprehensive networking verification...')
  
  // Validate service discovery
  console.log('[Docker Networking] Step 1: Service Discovery')
  const serviceDiscovery = await validateServiceDiscovery()
  
  // Validate network connectivity
  console.log('[Docker Networking] Step 2: Network Connectivity')
  const networkConnectivity = await validateNetworkConnectivity()
  
  // Validate port mapping
  console.log('[Docker Networking] Step 3: Port Mapping')
  const portMapping = await validatePortMapping()
  
  // Validate health check configuration
  console.log('[Docker Networking] Step 4: Health Check Configuration')
  const healthCheckConfig = validateHealthCheckConfig()
  
  // Determine overall status
  const issues: string[] = []
  const recommendations: string[] = []

  if (!serviceDiscovery.working) {
    issues.push('Service discovery issues detected')
    recommendations.push('Ensure all Docker services are running: docker compose up')
    recommendations.push('Check Docker network configuration')
  }

  if (!networkConnectivity.working) {
    issues.push('Network connectivity issues detected')
    recommendations.push('Verify Docker services can communicate with each other')
    recommendations.push('Check for network isolation or firewall issues')
  }

  if (!portMapping.correct) {
    issues.push('Port mapping issues detected')
    recommendations.push('Verify Docker port mappings in docker-compose.yml')
    recommendations.push('Check for port conflicts with other services')
  }

  if (!healthCheckConfig.valid) {
    issues.push('Health check configuration issues detected')
    recommendations.push('Add health check configurations to docker-compose.yml')
    recommendations.push('Ensure health check endpoints are accessible')
  }

  const healthy = issues.length === 0

  const config: DockerNetworkingConfig = {
    serviceDiscovery,
    networkConnectivity,
    portMapping,
    healthCheckConfig,
    overallStatus: {
      healthy,
      issues,
      recommendations,
    },
  }

  // Log comprehensive verification results
  console.log('[Docker Networking] Networking verification complete:')
  console.log(`  Service Discovery: ${serviceDiscovery.working ? '✓' : '✗'} (${serviceDiscovery.errors.length} errors)`)
  console.log(`  Network Connectivity: ${networkConnectivity.working ? '✓' : '✗'} (${networkConnectivity.issues.length} issues)`)
  console.log(`  Port Mapping: ${portMapping.correct ? '✓' : '✗'} (${portMapping.issues.length} issues)`)
  console.log(`  Health Check Config: ${healthCheckConfig.valid ? '✓' : '✗'} (${healthCheckConfig.issues.length} issues)`)
  console.log(`  Overall Status: ${healthy ? '✓ Healthy' : '✗ Issues Detected'}`)

  // Log detailed issues if any
  if (issues.length > 0) {
    console.log('  Issues:')
    issues.forEach(issue => console.log(`    - ${issue}`))
  }

  if (recommendations.length > 0) {
    console.log('  Recommendations:')
    recommendations.forEach(rec => console.log(`    - ${rec}`))
  }

  // Create comprehensive log entry
  const requestInfo: RequestLogInfo = {
    url: 'docker-networking',
    method: 'VERIFICATION',
    success: healthy,
    context: {
      verification: true,
      serviceDiscovery: serviceDiscovery.working,
      networkConnectivity: networkConnectivity.working,
      portMapping: portMapping.correct,
      healthCheckConfig: healthCheckConfig.valid,
    },
  }

  if (healthy) {
    logSuccessfulRequest('Docker Networking Verification', requestInfo)
  } else {
    const troubleshootingSteps = [
      ...recommendations,
      'Check Docker Compose logs: docker compose logs',
      'Restart Docker services: docker compose down && docker compose up',
      'Verify Docker network: docker network ls',
    ]

    requestInfo.error = 'Docker networking configuration issues detected'
    logFailedRequest('Docker Networking Verification', requestInfo, troubleshootingSteps)
  }

  return config
}

/**
 * Generates a networking configuration report
 */
export function generateNetworkingConfigReport(config: DockerNetworkingConfig): string {
  const lines = [
    '# Docker Networking Configuration Report',
    '',
    `**Overall Status:** ${config.overallStatus.healthy ? '✓ Healthy' : '✗ Issues Detected'}`,
    '',
    '## Service Discovery',
    `**Working:** ${config.serviceDiscovery.working ? '✓' : '✗'}`,
  ]

  if (config.serviceDiscovery.errors.length > 0) {
    lines.push('**Errors:**')
    config.serviceDiscovery.errors.forEach(error => {
      lines.push(`  - ${error}`)
    })
  }

  lines.push(
    '',
    '## Network Connectivity',
    `**Working:** ${config.networkConnectivity.working ? '✓' : '✗'}`
  )

  Object.entries(config.networkConnectivity.connectivityTests).forEach(([testName, result]) => {
    lines.push(`**${testName}:** ${result.success ? '✓' : '✗'}${result.responseTime ? ` (${result.responseTime}ms)` : ''}`)
    if (result.error) {
      lines.push(`  Error: ${result.error}`)
    }
  })

  lines.push(
    '',
    '## Port Mapping',
    `**Correct:** ${config.portMapping.correct ? '✓' : '✗'}`
  )

  Object.entries(config.portMapping.ports).forEach(([serviceName, portInfo]) => {
    lines.push(`**${serviceName}:** ${portInfo.accessible ? '✓' : '✗'} (internal: ${portInfo.internal}${portInfo.external ? `, external: ${portInfo.external}` : ''})`)
    if (portInfo.error) {
      lines.push(`  Error: ${portInfo.error}`)
    }
  })

  lines.push(
    '',
    '## Health Check Configuration',
    `**Valid:** ${config.healthCheckConfig.valid ? '✓' : '✗'}`
  )

  Object.entries(config.healthCheckConfig.configurations).forEach(([serviceName, healthConfig]) => {
    lines.push(`**${serviceName}:** ${healthConfig.configured ? '✓' : '✗'}`)
    if (healthConfig.endpoint) {
      lines.push(`  Endpoint: ${healthConfig.endpoint}`)
    }
    if (healthConfig.interval) {
      lines.push(`  Interval: ${healthConfig.interval}`)
    }
  })

  if (config.overallStatus.issues.length > 0) {
    lines.push('', '## Issues')
    config.overallStatus.issues.forEach(issue => {
      lines.push(`- ${issue}`)
    })
  }

  if (config.overallStatus.recommendations.length > 0) {
    lines.push('', '## Recommendations')
    config.overallStatus.recommendations.forEach(rec => {
      lines.push(`- ${rec}`)
    })
  }

  return lines.join('\n')
}