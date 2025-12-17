/**
 * Environment Detection Module
 * 
 * Provides centralized environment detection and environment-specific behavior.
 * Ensures correct URL usage in each environment with appropriate logging.
 */

import { analyzeEnvironmentForErrors, logConfigurationError } from './error-handling-guidance'

/**
 * Supported environment types
 */
export type Environment = 'development' | 'production' | 'staging'

/**
 * Network environment information for container and server-side detection
 */
export interface NetworkEnvironment {
  /** Whether running in a container environment */
  isContainer: boolean
  /** Whether running on server-side (vs client-side) */
  isServerSide: boolean
  /** Preferred protocol for the environment */
  preferredProtocol: 'http' | 'https'
  /** Internal domain for container networking (e.g., 'kong:8000') */
  internalDomain: string
  /** External domain for browser access (e.g., 'localhost:8000') */
  externalDomain: string
  /** Detection method used for network environment */
  networkDetectionMethod: 'container-env' | 'hostname-check' | 'process-check' | 'default'
  /** Additional context about network detection */
  networkContext: string
}

/**
 * Environment variable status for logging
 */
export interface EnvironmentVariableStatus {
  /** The environment variable name */
  name: string
  /** The value (masked for sensitive vars) */
  value: string | null
  /** Whether the variable was available */
  available: boolean
  /** Source of the variable (process.env, Docker ARG, etc.) */
  source: string
}

/**
 * Build-time vs runtime detection information
 */
export interface DetectionPhaseInfo {
  /** Whether this detection occurred during build-time */
  isBuildTime: boolean
  /** Build-specific context information */
  buildContext?: string
  /** Container context during detection */
  containerContext?: string
  /** Docker build indicators */
  dockerBuild?: boolean
}

/**
 * Priority chain information for logging
 */
export interface PriorityChainInfo {
  /** Priority level (1 = highest) */
  priority: number
  /** Source name */
  source: string
  /** Whether this source was available */
  available: boolean
  /** Value from this source (if available) */
  value?: string
  /** Whether this source was selected */
  selected: boolean
  /** Reason for selection or rejection */
  reason: string
}

/**
 * Enhanced environment detection result with detailed logging information
 */
export interface EnvironmentInfo {
  /** The detected environment */
  environment: Environment
  /** Whether the environment is production */
  isProduction: boolean
  /** Whether the environment is development */
  isDevelopment: boolean
  /** Whether the environment is staging */
  isStaging: boolean
  /** Detection method used */
  detectionMethod: 'node-env' | 'url-pattern' | 'explicit-env' | 'default' | 'platform-flag'
  /** Additional context about the detection */
  context: string
  /** Network environment information */
  networkEnvironment?: NetworkEnvironment
  /** Build-time vs runtime detection information */
  detectionPhase: DetectionPhaseInfo
  /** All environment variables checked during detection */
  environmentVariables: EnvironmentVariableStatus[]
  /** Priority chain showing which sources were considered */
  priorityChain: PriorityChainInfo[]
  /** Missing variables that could affect detection */
  missingVariables: string[]
  /** Detection timestamp */
  timestamp: string
}

/**
 * Detects if we're running in a build-time context
 * Enhanced for Requirements 1.1, 1.3: Improved build-time environment variable access and validation
 */
function detectBuildTimeContext(): DetectionPhaseInfo {
  const isBuildTime = !!(
    process.env.DOCKER_BUILDKIT ||
    process.env.BUILDKIT_PROGRESS ||
    process.env.DOCKER_BUILD ||
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL ||
    process.env.BUILD_ID ||
    process.env.BUILD_NUMBER
  )

  let buildContext = 'Runtime execution'
  let containerContext: string | undefined
  let dockerBuild = false

  if (isBuildTime) {
    const buildIndicators = []
    
    if (process.env.DOCKER_BUILDKIT) buildIndicators.push('Docker BuildKit')
    if (process.env.BUILDKIT_PROGRESS) buildIndicators.push('BuildKit Progress')
    if (process.env.DOCKER_BUILD) buildIndicators.push('Docker Build')
    if (process.env.CI) buildIndicators.push('CI Environment')
    if (process.env.GITHUB_ACTIONS) buildIndicators.push('GitHub Actions')
    if (process.env.GITLAB_CI) buildIndicators.push('GitLab CI')
    if (process.env.JENKINS_URL) buildIndicators.push('Jenkins')
    if (process.env.BUILD_ID || process.env.BUILD_NUMBER) buildIndicators.push('Build System')

    buildContext = `Build-time execution detected: ${buildIndicators.join(', ')}`
    dockerBuild = !!(process.env.DOCKER_BUILDKIT || process.env.BUILDKIT_PROGRESS || process.env.DOCKER_BUILD)
    
    if (dockerBuild) {
      containerContext = 'Docker image build process'
      
      // Enhanced validation for Docker build environment variable availability
      const criticalEnvVars = ['ENVIRONMENT', 'NODE_ENV']
      const missingCriticalVars = criticalEnvVars.filter(varName => !process.env[varName])
      
      if (missingCriticalVars.length > 0) {
        console.warn(`[Environment Detection] ⚠️  Docker build missing critical environment variables: ${missingCriticalVars.join(', ')}`)
        console.warn(`[Environment Detection] 💡 Add ARG declarations in Dockerfile: ${missingCriticalVars.map(v => `ARG ${v}`).join(', ')}`)
        console.warn(`[Environment Detection] 💡 Pass variables during build: docker build ${missingCriticalVars.map(v => `--build-arg ${v}=$${v}`).join(' ')}`)
      }
      
      // Validate that ENVIRONMENT variable is accessible during build if set
      const buildEnv = process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.ENVIRONMENT
      if (buildEnv) {
        console.log(`[Environment Detection] ✅ ENVIRONMENT variable available during Docker build: ${buildEnv}`)
      } else {
        console.warn(`[Environment Detection] ⚠️  ENVIRONMENT variable not available during Docker build`)
        console.warn(`[Environment Detection] 💡 To fix: Add 'ARG ENVIRONMENT' and 'ENV ENVIRONMENT=\${ENVIRONMENT}' to Dockerfile`)
      }
    }
  }

  return {
    isBuildTime,
    buildContext,
    containerContext,
    dockerBuild,
  }
}

/**
 * Gathers environment variable status for logging
 */
function gatherEnvironmentVariables(): EnvironmentVariableStatus[] {
  const envVars = [
    'ENVIRONMENT',
    'NODE_ENV',
    'NEXT_PUBLIC_IS_PLATFORM',
    'SUPABASE_PUBLIC_URL',
    'SUPABASE_URL',
    'API_EXTERNAL_URL',
    'NEXT_PUBLIC_GOTRUE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'HOSTNAME',
    'DOCKER_CONTAINER',
    'DOCKER_CONTAINER_ID',
    'KUBERNETES_SERVICE_HOST',
    'KUBERNETES_PORT',
    'CONTAINER_NAME',
    'CI',
    'GITHUB_ACTIONS',
    'GITLAB_CI',
    'JENKINS_URL',
    'BUILD_ID',
    'BUILD_NUMBER',
    'DOCKER_BUILDKIT',
    'BUILDKIT_PROGRESS',
    'DOCKER_BUILD',
  ]

  return envVars.map(name => {
    const value = process.env[name]
    const available = value !== undefined
    
    // Mask sensitive values
    let maskedValue = value
    if (available && (name.includes('KEY') || name.includes('SECRET') || name.includes('TOKEN'))) {
      maskedValue = value.length > 8 ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` : '***'
    }

    return {
      name,
      value: maskedValue || null,
      available,
      source: 'process.env',
    }
  })
}

/**
 * Creates priority chain information for environment detection
 * Enhanced for Requirements 1.2: Ensure ENVIRONMENT variable takes highest priority over NODE_ENV
 */
function createPriorityChain(): PriorityChainInfo[] {
  const chain: PriorityChainInfo[] = []

  // Priority 1: Explicit ENVIRONMENT variable (ALWAYS highest priority)
  // Use NEXT_PUBLIC_ENVIRONMENT for client-side, fallback to ENVIRONMENT for server-side
  const explicitEnv = (process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.ENVIRONMENT)?.toLowerCase()
  const isValidExplicitEnv = explicitEnv && ['production', 'development', 'staging'].includes(explicitEnv)
  
  chain.push({
    priority: 1,
    source: 'ENVIRONMENT variable',
    available: !!explicitEnv,
    value: explicitEnv,
    selected: !!isValidExplicitEnv,
    reason: isValidExplicitEnv
      ? `Explicit ENVIRONMENT="${explicitEnv}" takes HIGHEST priority over all other sources`
      : explicitEnv
      ? `Invalid ENVIRONMENT value "${explicitEnv}", must be production|development|staging`
      : 'ENVIRONMENT variable not set - this is the highest priority source for environment detection'
  })

  // Priority 2: NODE_ENV variable (with special handling)
  const nodeEnv = process.env.NODE_ENV?.toLowerCase()
  const nodeEnvSelected = !chain[0].selected && nodeEnv === 'development'
  chain.push({
    priority: 2,
    source: 'NODE_ENV variable',
    available: !!nodeEnv,
    value: nodeEnv,
    selected: nodeEnvSelected,
    reason: nodeEnvSelected
      ? 'NODE_ENV=development always respected'
      : nodeEnv === 'production'
      ? 'NODE_ENV=production requires URL validation (processed later)'
      : nodeEnv
      ? `NODE_ENV="${nodeEnv}" not used for environment detection`
      : 'NODE_ENV variable not set'
  })

  // Priority 2.5: IS_PLATFORM flag
  const isPlatform = process.env.NEXT_PUBLIC_IS_PLATFORM === 'true'
  const platformSelected = !chain[0].selected && !nodeEnvSelected && isPlatform
  chain.push({
    priority: 2.5,
    source: 'NEXT_PUBLIC_IS_PLATFORM flag',
    available: !!process.env.NEXT_PUBLIC_IS_PLATFORM,
    value: process.env.NEXT_PUBLIC_IS_PLATFORM,
    selected: platformSelected,
    reason: platformSelected
      ? 'Platform flag indicates production environment'
      : isPlatform
      ? 'Platform flag available but higher priority source selected'
      : 'Platform flag not set or not "true"'
  })

  // Priority 3: URL pattern analysis
  const urls = [
    process.env.SUPABASE_PUBLIC_URL,
    process.env.SUPABASE_URL,
    process.env.API_EXTERNAL_URL,
    process.env.NEXT_PUBLIC_GOTRUE_URL,
  ].filter(Boolean)

  const hasLocalhostUrls = urls.some(url => 
    url && (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url) || url.includes(':54321') || url.includes(':8000'))
  )

  const stagingPatterns = ['staging', 'stg', 'test', 'dev-', 'preview']
  const hasStaging = urls.some(url => 
    url && stagingPatterns.some(pattern => url.includes(pattern))
  )

  const hasProductionUrls = urls.some(url => {
    if (!url) return false
    try {
      const parsed = new URL(url)
      return (
        (parsed.protocol === 'https:' && !['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) ||
        /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/.test(parsed.hostname) ||
        /\.(com|org|net|io|co|app)/.test(parsed.hostname)
      )
    } catch {
      return false
    }
  })

  const urlPatternSelected = !chain[0].selected && !nodeEnvSelected && !platformSelected && (hasLocalhostUrls || hasStaging || hasProductionUrls)
  let urlPatternReason = 'No URLs configured for pattern analysis'
  
  if (urls.length > 0) {
    if (hasLocalhostUrls) {
      urlPatternReason = 'Localhost URLs detected, indicates development'
    } else if (hasStaging) {
      urlPatternReason = 'Staging patterns detected in URLs'
    } else if (hasProductionUrls) {
      urlPatternReason = 'Production URLs detected (HTTPS, domains, IPs)'
    } else {
      urlPatternReason = 'URLs configured but no clear environment pattern'
    }
  }

  chain.push({
    priority: 3,
    source: 'URL pattern analysis',
    available: urls.length > 0,
    value: urls.length > 0 ? `${urls.length} URLs analyzed` : undefined,
    selected: urlPatternSelected,
    reason: urlPatternSelected ? urlPatternReason : `URL patterns available but ${urlPatternReason.toLowerCase()}`
  })

  // Priority 4: Default to production
  const defaultSelected = !chain.some(item => item.selected)
  chain.push({
    priority: 4,
    source: 'Default fallback',
    available: true,
    value: 'production',
    selected: defaultSelected,
    reason: defaultSelected
      ? 'No clear environment indicators found, defaulting to production for safety'
      : 'Default not needed, environment determined by higher priority source'
  })

  return chain
}

/**
 * Identifies missing environment variables that could improve detection
 */
function identifyMissingVariables(): string[] {
  const missing: string[] = []
  const recommendations: string[] = []

  // Check for explicit environment configuration
  const envVar = process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.ENVIRONMENT
  if (!envVar) {
    missing.push('ENVIRONMENT')
    recommendations.push('Set ENVIRONMENT=production|development|staging for explicit control')
  }

  // Check for URL configuration
  if (!process.env.SUPABASE_PUBLIC_URL && !process.env.SUPABASE_URL) {
    missing.push('SUPABASE_PUBLIC_URL')
    recommendations.push('Set SUPABASE_PUBLIC_URL for Supabase client configuration')
  }

  if (!process.env.API_EXTERNAL_URL) {
    missing.push('API_EXTERNAL_URL')
    recommendations.push('Set API_EXTERNAL_URL for API gateway configuration')
  }

  if (!process.env.NEXT_PUBLIC_GOTRUE_URL) {
    missing.push('NEXT_PUBLIC_GOTRUE_URL')
    recommendations.push('Set NEXT_PUBLIC_GOTRUE_URL for explicit GoTrue configuration')
  }

  // Check for platform configuration
  if (!process.env.NEXT_PUBLIC_IS_PLATFORM) {
    missing.push('NEXT_PUBLIC_IS_PLATFORM')
    recommendations.push('Set NEXT_PUBLIC_IS_PLATFORM=true for platform deployments')
  }

  return missing
}

/**
 * Detects container and network environment
 * 
 * Detection methods:
 * 1. Check for container-specific environment variables
 * 2. Check hostname patterns (container hostnames vs localhost)
 * 3. Check process environment indicators
 * 4. Determine server-side vs client-side context
 * 
 * @returns NetworkEnvironment object with container and network details
 */
export function detectNetworkEnvironment(): NetworkEnvironment {
  // Check if we're running server-side
  const isServerSide = typeof window === 'undefined'
  
  // Container detection methods
  let isContainer = false
  let networkDetectionMethod: NetworkEnvironment['networkDetectionMethod'] = 'default'
  let networkContext = 'Default network environment detection'
  
  // Method 1: Check container-specific environment variables
  const containerEnvVars = [
    'HOSTNAME', // Docker containers often have specific hostnames
    'CONTAINER_NAME',
    'DOCKER_CONTAINER_ID',
    'KUBERNETES_SERVICE_HOST',
    'KUBERNETES_PORT',
  ]
  
  const hasContainerEnvVars = containerEnvVars.some(envVar => {
    const value = process.env[envVar]
    return value && value !== 'localhost' && value !== '127.0.0.1'
  })
  
  if (hasContainerEnvVars) {
    isContainer = true
    networkDetectionMethod = 'container-env'
    networkContext = 'Detected container environment variables'
  }
  
  // Method 2: Check hostname patterns
  if (!isContainer && isServerSide) {
    try {
      const os = require('os')
      const hostname = os.hostname()
      
      // Container hostnames are often random strings or service names
      const containerHostnamePatterns = [
        /^[a-f0-9]{12}$/, // Docker container ID pattern
        /^[a-f0-9]{64}$/, // Full Docker container ID
        /^studio-/, // Service name patterns
        /^supabase-/, 
        /^kong-/,
        /^gotrue-/,
        /^postgres-/,
      ]
      
      const isContainerHostname = containerHostnamePatterns.some(pattern => 
        pattern.test(hostname)
      ) || (
        // Generic container hostname indicators
        hostname.length > 10 && 
        hostname !== 'localhost' && 
        !hostname.includes('.local') &&
        !hostname.includes('.')
      )
      
      if (isContainerHostname) {
        isContainer = true
        networkDetectionMethod = 'hostname-check'
        networkContext = `Detected container hostname pattern: ${hostname}`
      }
    } catch (error) {
      // os module not available or other error, continue with other methods
    }
  }
  
  // Method 3: Check process environment indicators
  if (!isContainer && isServerSide) {
    // Check for Docker-specific process indicators
    try {
      const fs = require('fs')
      
      // Check if running in Docker by looking for .dockerenv file
      if (fs.existsSync('/.dockerenv')) {
        isContainer = true
        networkDetectionMethod = 'process-check'
        networkContext = 'Detected .dockerenv file (Docker container)'
      }
      
      // Check cgroup for container indicators (Docker, Kubernetes)
      if (!isContainer) {
        try {
          const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8')
          if (cgroup.includes('docker') || cgroup.includes('kubepods') || cgroup.includes('containerd')) {
            isContainer = true
            networkDetectionMethod = 'process-check'
            networkContext = 'Detected container in /proc/1/cgroup'
          }
        } catch {
          // /proc/1/cgroup not available (not Linux or no access)
        }
      }
    } catch (error) {
      // fs module not available or other error, continue
    }
  }
  
  // Determine network domains based on container detection and custom configuration
  let internalDomain = 'localhost:8000'
  let externalDomain = 'localhost:8000'
  let preferredProtocol: 'http' | 'https' = 'http'
  
  // Check for custom configuration first (takes precedence over container defaults)
  const kongUrl = process.env.KONG_URL || process.env.NEXT_PUBLIC_KONG_URL
  const customInternalDomain = process.env.INTERNAL_KONG_URL || process.env.KONG_INTERNAL_URL
  const customExternalDomain = process.env.EXTERNAL_KONG_URL || process.env.KONG_EXTERNAL_URL
  
  if (kongUrl) {
    // General KONG_URL configuration - use for both internal and external
    try {
      const parsed = new URL(kongUrl)
      const domain = `${parsed.hostname}:${parsed.port || '8000'}`
      internalDomain = domain
      externalDomain = domain
      preferredProtocol = parsed.protocol === 'https:' ? 'https' : 'http'
    } catch {
      // Invalid URL, fall back to defaults
    }
  } else if (isContainer) {
    // Container environment defaults
    internalDomain = 'kong:8000'
    externalDomain = 'localhost:8000'
  }
  
  // Override with specific internal/external configurations if provided
  if (customInternalDomain) {
    try {
      const parsed = new URL(customInternalDomain)
      internalDomain = `${parsed.hostname}:${parsed.port || '8000'}`
      preferredProtocol = parsed.protocol === 'https:' ? 'https' : 'http'
    } catch {
      // Invalid URL, keep current value
    }
  }
  
  if (customExternalDomain) {
    try {
      const parsed = new URL(customExternalDomain)
      externalDomain = `${parsed.hostname}:${parsed.port || '8000'}`
    } catch {
      // Invalid URL, keep current value
    }
  }
  
  return {
    isContainer,
    isServerSide,
    preferredProtocol,
    internalDomain,
    externalDomain,
    networkDetectionMethod,
    networkContext,
  }
}

/**
 * Validates internal network addresses for container environments
 * 
 * @param url - URL to validate
 * @param networkEnv - Network environment information
 * @returns Validation result with specific container networking feedback
 */
export function validateInternalNetworkAddress(
  url: string,
  networkEnv: NetworkEnvironment
): {
  isValid: boolean
  isInternalAddress: boolean
  errors: string[]
  warnings: string[]
  recommendations: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const recommendations: string[] = []
  let isInternalAddress = false
  
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80')
    
    // Check if this is an internal container address
    const internalPatterns = [
      'kong', 'gotrue', 'postgres', 'postgrest', 'realtime', 'storage',
      'supabase-kong', 'supabase-gotrue', 'supabase-db',
      // Docker Compose service names
      'studio', 'auth', 'rest', 'db', 'edge-functions'
    ]
    
    isInternalAddress = internalPatterns.some(pattern => 
      hostname.includes(pattern) || hostname === pattern
    )
    
    if (networkEnv.isContainer && networkEnv.isServerSide) {
      // Server-side in container should use internal addresses
      if (!isInternalAddress && (hostname === 'localhost' || hostname === '127.0.0.1')) {
        errors.push(
          `Server-side container code using localhost address: ${url}. ` +
          `This will fail in container networking. Use service name instead (e.g., kong:8000).`
        )
        recommendations.push(
          `Replace ${hostname}:${port} with ${networkEnv.internalDomain} for server-side API calls`
        )
      }
      
      if (isInternalAddress) {
        // Validate internal address format
        if (parsed.protocol === 'https:' && port !== '443') {
          warnings.push(
            `Internal container address using HTTPS with non-standard port: ${url}. ` +
            `Container networking typically uses HTTP for internal communication.`
          )
          recommendations.push(
            `Consider using HTTP for internal container communication: http://${hostname}:${port}`
          )
        }
        
        // Check if port matches expected container ports
        const expectedPorts = ['8000', '54321', '3000', '5432', '8080']
        if (!expectedPorts.includes(port)) {
          warnings.push(
            `Internal address using uncommon port ${port}: ${url}. ` +
            `Verify this matches your container service configuration.`
          )
        }
      }
    } else if (!networkEnv.isContainer || !networkEnv.isServerSide) {
      // Client-side or non-container should use external addresses
      if (isInternalAddress) {
        errors.push(
          `Client-side code using internal container address: ${url}. ` +
          `Browsers cannot access container service names. Use external address instead.`
        )
        recommendations.push(
          `Replace ${hostname}:${port} with ${networkEnv.externalDomain} for client-side access`
        )
      }
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // This is expected for client-side in development
        if (networkEnv.preferredProtocol === 'https' && parsed.protocol === 'http:') {
          warnings.push(
            `Using HTTP with localhost in environment that prefers HTTPS: ${url}. ` +
            `This may cause mixed content issues.`
          )
        }
      }
    }
    
    // General validation
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      errors.push(`Invalid protocol in URL: ${url}. Only HTTP and HTTPS are supported.`)
    }
    
    // Port validation
    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      errors.push(`Invalid port number in URL: ${url}. Port must be between 1 and 65535.`)
    }
    
  } catch (urlError) {
    errors.push(`Invalid URL format: ${url}`)
  }
  
  return {
    isValid: errors.length === 0,
    isInternalAddress,
    errors,
    warnings,
    recommendations,
  }
}

/**
 * Gets the appropriate network address based on environment
 * 
 * @param baseUrl - Base URL to transform
 * @param networkEnv - Network environment information
 * @param forServerSide - Whether this URL is for server-side use
 * @returns Appropriate URL for the network environment
 */
export function getNetworkAppropriateUrl(
  baseUrl: string,
  networkEnv: NetworkEnvironment,
  forServerSide?: boolean
): string {
  // Use provided forServerSide parameter, or fall back to detected server-side
  const isServerSide = forServerSide !== undefined ? forServerSide : networkEnv.isServerSide
  
  try {
    const parsed = new URL(baseUrl)
    
    // If we're in a container and this is for server-side use
    if (networkEnv.isContainer && isServerSide) {
      // Transform localhost URLs to internal container addresses
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        const internalUrl = `${networkEnv.preferredProtocol}://${networkEnv.internalDomain}${parsed.pathname}${parsed.search}${parsed.hash}`
        return internalUrl
      }
    } else if (!isServerSide) {
      // For client-side, ensure we use external addresses
      const internalPatterns = ['kong', 'gotrue', 'postgres', 'postgrest', 'realtime', 'storage']
      const isInternalAddress = internalPatterns.some(pattern => 
        parsed.hostname.includes(pattern) || parsed.hostname === pattern
      )
      
      if (isInternalAddress) {
        const externalUrl = `${networkEnv.preferredProtocol}://${networkEnv.externalDomain}${parsed.pathname}${parsed.search}${parsed.hash}`
        return externalUrl
      }
    }
    
    // Return original URL if no transformation needed
    return baseUrl
  } catch {
    // Invalid URL, return as-is
    return baseUrl
  }
}

/**
 * Detects the current environment based on multiple signals with enhanced logging
 * 
 * Detection priority:
 * 1. Explicit ENVIRONMENT variable
 * 2. NODE_ENV variable (with improved production detection)
 * 3. URL patterns (localhost/127.0.0.1 = development, staging subdomain = staging)
 * 4. IS_PLATFORM flag (platform = production, self-hosted = development by default)
 * 5. Production indicators (external IPs, domain names)
 * 6. Default to production for safety
 * 
 * @param runtimeUrls - Optional runtime URLs to check for environment indicators
 * @returns EnvironmentInfo object with detailed detection information
 */
export function detectEnvironment(runtimeUrls?: {
  gotrueUrl?: string
  supabaseUrl?: string
  apiUrl?: string
}): EnvironmentInfo {
  const timestamp = new Date().toISOString()
  
  // Gather detailed information for logging
  const detectionPhase = detectBuildTimeContext()
  const environmentVariables = gatherEnvironmentVariables()
  const priorityChain = createPriorityChain()
  const missingVariables = identifyMissingVariables()
  
  // Detect network environment
  const networkEnvironment = detectNetworkEnvironment()
  
  // Log detection start
  console.log(`[Environment Detection] 🔍 Starting environment detection at ${timestamp}`)
  console.log(`[Environment Detection] Phase: ${detectionPhase.isBuildTime ? 'BUILD-TIME' : 'RUNTIME'}`)
  if (detectionPhase.buildContext) {
    console.log(`[Environment Detection] Build context: ${detectionPhase.buildContext}`)
  }
  
  // Log all environment variables checked
  console.log(`[Environment Detection] 📋 Environment Variables Analyzed:`)
  environmentVariables.forEach(envVar => {
    const status = envVar.available ? '✓' : '✗'
    const value = envVar.available ? envVar.value : 'NOT SET'
    console.log(`[Environment Detection]   ${status} ${envVar.name}: ${value}`)
  })
  
  // Log missing variables
  if (missingVariables.length > 0) {
    console.log(`[Environment Detection] ⚠️  Missing Variables (${missingVariables.length}):`)
    missingVariables.forEach(varName => {
      console.log(`[Environment Detection]   • ${varName}`)
    })
  }
  
  // Log priority chain
  console.log(`[Environment Detection] 🔗 Priority Chain Analysis:`)
  priorityChain.forEach(item => {
    const status = item.selected ? '🎯 SELECTED' : item.available ? '⏭️  AVAILABLE' : '❌ UNAVAILABLE'
    console.log(`[Environment Detection]   ${item.priority}. ${item.source}: ${status}`)
    console.log(`[Environment Detection]      Reason: ${item.reason}`)
    if (item.value) {
      console.log(`[Environment Detection]      Value: ${item.value}`)
    }
  })
  
  // Determine environment based on priority chain
  let environment: Environment = 'production'
  let detectionMethod: EnvironmentInfo['detectionMethod'] = 'default'
  let context = 'No clear environment indicators found, defaulting to production for safety'
  
  // Priority 1: Check explicit ENVIRONMENT variable (ALWAYS takes highest priority)
  // Requirements 1.1, 1.2, 1.4: Fix production environment detection when ENVIRONMENT="production"
  // Use NEXT_PUBLIC_ENVIRONMENT for client-side, fallback to ENVIRONMENT for server-side
  const explicitEnv = (process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.ENVIRONMENT)?.toLowerCase()
  if (explicitEnv === 'production' || explicitEnv === 'development' || explicitEnv === 'staging') {
    environment = explicitEnv as Environment
    detectionMethod = 'explicit-env'
    context = `ENVIRONMENT variable set to "${explicitEnv}" - takes HIGHEST priority over NODE_ENV and all other sources`
    
    // Enhanced logging for production environment detection (Requirement 1.4)
    if (environment === 'production') {
      console.log(`[Environment Detection] ✅ PRODUCTION environment detected via ENVIRONMENT variable`)
      console.log(`[Environment Detection] 🎯 ENVIRONMENT=production takes priority over NODE_ENV and URL patterns`)
    } else if (environment === 'development') {
      console.log(`[Environment Detection] ✅ DEVELOPMENT environment detected via ENVIRONMENT variable`)
    } else if (environment === 'staging') {
      console.log(`[Environment Detection] ✅ STAGING environment detected via ENVIRONMENT variable`)
    }
    
    console.log(`[Environment Detection] ✅ Environment determined by ENVIRONMENT variable: ${environment.toUpperCase()}`)
  }
  // Priority 2: Check NODE_ENV with improved logic (only if ENVIRONMENT not set)
  else {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase()
    
    console.log(`[Environment Detection] 📋 ENVIRONMENT variable not set, checking NODE_ENV: ${nodeEnv || 'NOT SET'}`)
    
    // If NODE_ENV is explicitly set to development, always respect it
    if (nodeEnv === 'development') {
      environment = 'development'
      detectionMethod = 'node-env'
      context = 'NODE_ENV=development (ENVIRONMENT variable not set)'
      console.log(`[Environment Detection] ✅ Environment determined by NODE_ENV: ${environment.toUpperCase()}`)
    }
    // Priority 2.5: Check IS_PLATFORM flag (before NODE_ENV=production processing)
    else {
      const isPlatform = process.env.NEXT_PUBLIC_IS_PLATFORM === 'true'
      
      console.log(`[Environment Detection] 📋 NODE_ENV not development, checking IS_PLATFORM: ${process.env.NEXT_PUBLIC_IS_PLATFORM || 'NOT SET'}`)
      
      // Platform instances are production by default
      if (isPlatform) {
        environment = 'production'
        detectionMethod = 'platform-flag'
        context = 'NEXT_PUBLIC_IS_PLATFORM=true indicates production platform environment (ENVIRONMENT and NODE_ENV not set)'
        console.log(`[Environment Detection] ✅ PRODUCTION environment detected via platform flag`)
        console.log(`[Environment Detection] ✅ Environment determined by platform flag: ${environment.toUpperCase()}`)
      }
      // Priority 3: Check URL patterns first when NODE_ENV=production
      else if (nodeEnv === 'production') {
        console.log(`[Environment Detection] 📋 NODE_ENV=production detected, validating with URL patterns (ENVIRONMENT and IS_PLATFORM not set)`)
        
        // Get URLs for pattern checking
        const supabaseUrl = runtimeUrls?.supabaseUrl || process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL || ''
        const apiUrl = runtimeUrls?.apiUrl || process.env.API_EXTERNAL_URL || ''
        const gotrueUrl = runtimeUrls?.gotrueUrl || process.env.NEXT_PUBLIC_GOTRUE_URL || ''
        
        // Check for localhost patterns first - this overrides NODE_ENV=production
        const urls = [
          process.env.SUPABASE_PUBLIC_URL,
          process.env.SUPABASE_URL,
          process.env.API_EXTERNAL_URL,
          process.env.NEXT_PUBLIC_GOTRUE_URL,
          runtimeUrls?.gotrueUrl,
          runtimeUrls?.supabaseUrl,
          runtimeUrls?.apiUrl
        ].filter(Boolean)
        
        console.log(`[Environment Detection] 🔍 Analyzing ${urls.length} URLs for localhost patterns`)
        
        const hasLocalhostUrls = urls.some(url => 
          url && (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url) || url.includes(':54321') || url.includes(':8000'))
        )
        
        // CRITICAL FIX: If NODE_ENV=production but URLs contain localhost, force development
        if (hasLocalhostUrls) {
          environment = 'development'
          detectionMethod = 'url-pattern'
          context = 'Forced to development due to localhost URL (NODE_ENV=production overridden for safety - ENVIRONMENT variable would prevent this override)'
          console.log(`[Environment Detection] ⚠️  NODE_ENV=production overridden by localhost URLs: ${environment.toUpperCase()}`)
          console.log(`[Environment Detection] 💡 To force production: Set ENVIRONMENT=production (takes priority over URL patterns)`)
        }
        // Check for staging indicators
        else {
          const stagingPatterns = ['staging', 'stg', 'test', 'dev-', 'preview']
          const hasStaging = stagingPatterns.some(pattern =>
            supabaseUrl.includes(pattern) || 
            apiUrl.includes(pattern) ||
            gotrueUrl.includes(pattern)
          )
          
          if (hasStaging) {
            environment = 'staging'
            detectionMethod = 'url-pattern'
            context = runtimeUrls
              ? `Detected staging pattern (${stagingPatterns.join('|')}) in runtime URLs`
              : `Detected staging pattern (${stagingPatterns.join('|')}) in environment variables`
            console.log(`[Environment Detection] ✅ Environment determined by URL staging patterns: ${environment.toUpperCase()}`)
          } else {
            // Check if URLs indicate production patterns (HTTPS, domains, etc.)
            const hasProductionUrls = urls.some(url => {
              if (!url) return false
              try {
                const parsed = new URL(url)
                return (
                  parsed.protocol === 'https:' ||
                  /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/.test(parsed.hostname) || // IP addresses
                  /\.(com|org|net|io|co|app)/.test(parsed.hostname) // Common TLDs
                )
              } catch {
                return false
              }
            })
            
            environment = 'production'
            detectionMethod = hasProductionUrls ? 'url-pattern' : 'node-env'
            context = hasProductionUrls
              ? 'Detected production URLs (external IPs, domains, or HTTPS) in environment variables (NODE_ENV=production confirmed by URL patterns)'
              : 'NODE_ENV=production with default configuration (ENVIRONMENT variable would provide more explicit control)'
            
            // Enhanced logging for production environment detection (Requirement 1.4)
            console.log(`[Environment Detection] ✅ PRODUCTION environment detected via NODE_ENV=production`)
            if (hasProductionUrls) {
              console.log(`[Environment Detection] ✅ Production URLs confirmed NODE_ENV=production`)
            } else {
              console.log(`[Environment Detection] ⚠️  NODE_ENV=production with no explicit production URLs`)
              console.log(`[Environment Detection] 💡 Consider setting ENVIRONMENT=production for explicit control`)
            }
            console.log(`[Environment Detection] ✅ Environment determined by NODE_ENV=production: ${environment.toUpperCase()}`)
          }
        }
      }
      // Priority 4: Check URL patterns (runtime URLs take precedence over build-time)
      else {
        // Enhanced localhost detection for development environments
        const localhostPatterns = [
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          '::1', // IPv6 localhost
        ]
        
        // Get URLs for pattern checking - prioritize runtime URLs when provided
        let supabaseUrl = ''
        let apiUrl = ''
        let gotrueUrl = ''
        
        if (runtimeUrls) {
          // When runtime URLs are provided, use only those for detection
          supabaseUrl = runtimeUrls.supabaseUrl || ''
          apiUrl = runtimeUrls.apiUrl || ''
          gotrueUrl = runtimeUrls.gotrueUrl || ''
        } else {
          // When no runtime URLs, use environment variables
          supabaseUrl = process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL || ''
          apiUrl = process.env.API_EXTERNAL_URL || ''
          gotrueUrl = process.env.NEXT_PUBLIC_GOTRUE_URL || ''
        }
        
        // Check for localhost patterns in URLs
        const isLocalhost = 
          localhostPatterns.some(pattern => 
            supabaseUrl.includes(pattern) || 
            apiUrl.includes(pattern) ||
            gotrueUrl.includes(pattern)
          ) ||
          // Only check window.location when no runtime URLs are provided
          (!runtimeUrls && typeof window !== 'undefined' && (
            localhostPatterns.includes(window.location?.hostname || '')
          ))
        
        // If runtime URLs are provided and contain localhost, detect development
        // If no runtime URLs but environment variables contain localhost, also detect development
        const hasAnyExplicitConfig = !!(
          process.env.SUPABASE_PUBLIC_URL || 
          process.env.SUPABASE_URL || 
          process.env.API_EXTERNAL_URL ||
          process.env.NEXT_PUBLIC_GOTRUE_URL ||
          nodeEnv
        )
        
        // Detect development if localhost URLs are present
        // - Always detect if runtime URLs contain localhost (frontend client validation case)
        // - Detect if environment variables contain localhost and we have explicit config
        if (isLocalhost && (runtimeUrls || hasAnyExplicitConfig)) {
          environment = 'development'
          detectionMethod = 'url-pattern'
          context = runtimeUrls 
            ? 'Detected localhost/127.0.0.1/0.0.0.0 in runtime URLs'
            : 'Detected localhost/127.0.0.1/0.0.0.0 in URLs or browser location'
          console.log(`[Environment Detection] ✅ Environment determined by localhost URLs: ${environment.toUpperCase()}`)
        }
        // Check for staging indicators
        else {
          const stagingPatterns = ['staging', 'stg', 'test', 'dev-', 'preview']
          const hasStaging = stagingPatterns.some(pattern =>
            supabaseUrl.includes(pattern) || 
            apiUrl.includes(pattern) ||
            gotrueUrl.includes(pattern)
          )
          
          if (hasStaging) {
            environment = 'staging'
            detectionMethod = 'url-pattern'
            context = runtimeUrls
              ? `Detected staging pattern (${stagingPatterns.join('|')}) in runtime URLs`
              : `Detected staging pattern (${stagingPatterns.join('|')}) in URLs`
            console.log(`[Environment Detection] ✅ Environment determined by staging URL patterns: ${environment.toUpperCase()}`)
          }
          // Check for production indicators in URLs
          else {
            const hasProductionUrls = [supabaseUrl, apiUrl, gotrueUrl].some(url => {
              if (!url) return false
              
              try {
                const parsed = new URL(url)
                
                // HTTPS suggests production (unless localhost)
                if (parsed.protocol === 'https:' && !localhostPatterns.includes(parsed.hostname)) {
                  return true
                }
                
                // External IP addresses suggest production
                const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
                if (ipv4Regex.test(parsed.hostname) && !localhostPatterns.includes(parsed.hostname)) {
                  return true
                }
                
                // Domain names (not localhost) suggest production
                if (parsed.hostname.includes('.') && !localhostPatterns.includes(parsed.hostname)) {
                  return true
                }
                
                return false
              } catch {
                return false
              }
            })

            if (hasProductionUrls) {
              environment = 'production'
              detectionMethod = 'url-pattern'
              context = runtimeUrls
                ? 'Detected production URLs (external IPs, domains, or HTTPS) in runtime URLs'
                : 'Detected production URLs (external IPs, domains, or HTTPS) in environment variables'
              console.log(`[Environment Detection] ✅ Environment determined by production URL patterns: ${environment.toUpperCase()}`)
            }
            // Final fallback to NODE_ENV if set
            else if (nodeEnv === 'production') {
              environment = 'production'
              detectionMethod = 'node-env'
              context = 'NODE_ENV=production fallback (no URL patterns detected, ENVIRONMENT variable would provide explicit control)'
              console.log(`[Environment Detection] ✅ PRODUCTION environment detected via NODE_ENV fallback`)
              console.log(`[Environment Detection] 💡 For explicit control, set ENVIRONMENT=production`)
              console.log(`[Environment Detection] ✅ Environment determined by NODE_ENV fallback: ${environment.toUpperCase()}`)
            }
            // Default to production for safety
            else {
              environment = 'production'
              detectionMethod = 'default'
              context = 'No clear environment indicators found, defaulting to production for safety (set ENVIRONMENT variable for explicit control)'
              console.log(`[Environment Detection] ⚠️  Environment defaulted to production for safety: ${environment.toUpperCase()}`)
              console.log(`[Environment Detection] 💡 Recommendation: Set ENVIRONMENT=production|development|staging for explicit control`)
            }
          }
        }
      }
    }
  }
  
  // Log final result
  console.log(`[Environment Detection] 🎯 FINAL RESULT: ${environment.toUpperCase()} environment detected`)
  console.log(`[Environment Detection] Detection method: ${detectionMethod}`)
  console.log(`[Environment Detection] Context: ${context}`)
  console.log(`[Environment Detection] Detection completed at ${new Date().toISOString()}`)
  
  return {
    environment,
    isProduction: environment === 'production',
    isDevelopment: environment === 'development',
    isStaging: environment === 'staging',
    detectionMethod,
    context,
    networkEnvironment,
    detectionPhase,
    environmentVariables,
    priorityChain,
    missingVariables,
    timestamp,
  }
}

/**
 * Validates that URLs are appropriate for the current environment
 * 
 * @param urls - Object containing URLs to validate
 * @param environment - The current environment
 * @returns Validation result with any errors or warnings
 */
export function validateUrlsForEnvironment(
  urls: {
    gotrueUrl?: string
    supabaseUrl?: string
    apiUrl?: string
  },
  environment: Environment
): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  const allUrls = [urls.gotrueUrl, urls.supabaseUrl, urls.apiUrl].filter(Boolean) as string[]

  // Enhanced localhost patterns for validation
  const localhostPatterns = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1', // IPv6 localhost
  ]

  if (environment === 'production') {
    // In production, URLs should NOT contain any localhost patterns
    for (const url of allUrls) {
      const containsLocalhost = localhostPatterns.some(pattern => url.includes(pattern))
      if (containsLocalhost) {
        errors.push(
          `Production environment detected but URL contains localhost pattern: ${url}. ` +
          `This will cause API requests to fail in production. ` +
          `Set proper production URLs in environment variables.`
        )
      }
    }

    // Validate that production URLs are properly formatted
    for (const url of allUrls) {
      try {
        const parsed = new URL(url)
        
        // Check for suspicious ports that suggest development
        const developmentPorts = ['3000', '3001', '5000', '5173', '8080', '54321']
        if (developmentPorts.includes(parsed.port)) {
          warnings.push(
            `Production URL uses development-like port ${parsed.port}: ${url}. ` +
            `Verify this is correct for your production setup.`
          )
        }
        
        // Warn if using http in production (should use https for security)
        if (parsed.protocol === 'http:' && !localhostPatterns.includes(parsed.hostname)) {
          warnings.push(
            `Production environment using insecure HTTP protocol: ${url}. ` +
            `Consider using HTTPS for better security.`
          )
        }
        
        // Check for IP addresses in production (domains are preferred)
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
        if (ipv4Regex.test(parsed.hostname)) {
          warnings.push(
            `Production URL uses IP address instead of domain: ${url}. ` +
            `Consider using a proper domain name for better reliability.`
          )
        }
      } catch (urlError) {
        errors.push(`Invalid URL format in production environment: ${url}`)
      }
    }

    // Check that all required URLs are present for production
    if (!urls.gotrueUrl) {
      warnings.push(
        'Production environment missing GoTrue URL. ' +
        'Set NEXT_PUBLIC_GOTRUE_URL or SUPABASE_PUBLIC_URL environment variable.'
      )
    }
    
    if (!urls.supabaseUrl) {
      warnings.push(
        'Production environment missing Supabase URL. ' +
        'Set SUPABASE_PUBLIC_URL environment variable.'
      )
    }
    
    if (!urls.apiUrl) {
      warnings.push(
        'Production environment missing API URL. ' +
        'Set API_EXTERNAL_URL environment variable.'
      )
    }

  } else if (environment === 'development') {
    // In development, validate localhost URLs are properly configured
    for (const url of allUrls) {
      const containsLocalhost = localhostPatterns.some(pattern => url.includes(pattern))
      
      if (!containsLocalhost) {
        warnings.push(
          `Development environment detected but URL is not localhost: ${url}. ` +
          `This may be intentional if connecting to remote development services.`
        )
      } else {
        // Validate localhost URL format
        try {
          const parsed = new URL(url)
          
          // Check for common development ports
          const commonDevPorts = ['3000', '3001', '5000', '5173', '8000', '8080', '54321']
          if (parsed.port && !commonDevPorts.includes(parsed.port)) {
            warnings.push(
              `Development URL uses uncommon port ${parsed.port}: ${url}. ` +
              `Verify this matches your local development setup.`
            )
          }
          
          // Ensure HTTP is used for localhost (HTTPS can cause issues in dev)
          if (parsed.protocol === 'https:' && localhostPatterns.includes(parsed.hostname)) {
            warnings.push(
              `Development URL uses HTTPS with localhost: ${url}. ` +
              `This may cause certificate issues. Consider using HTTP for local development.`
            )
          }
        } catch (urlError) {
          errors.push(`Invalid localhost URL format in development environment: ${url}`)
        }
      }
    }

    // Provide helpful development setup guidance
    if (allUrls.length === 0) {
      warnings.push(
        'Development environment with no URLs configured. ' +
        'Ensure your local Supabase services are running (e.g., docker-compose up).'
      )
    }

  } else if (environment === 'staging') {
    // In staging, URLs should not be localhost but may use HTTP
    for (const url of allUrls) {
      const containsLocalhost = localhostPatterns.some(pattern => url.includes(pattern))
      if (containsLocalhost) {
        warnings.push(
          `Staging environment detected but URL contains localhost: ${url}. ` +
          `Consider using dedicated staging URLs.`
        )
      }
    }

    // Validate staging URL patterns
    for (const url of allUrls) {
      try {
        const parsed = new URL(url)
        
        // Check if URL actually looks like staging
        const stagingPatterns = ['staging', 'stg', 'test', 'dev-', 'preview']
        const looksLikeStaging = stagingPatterns.some(pattern => 
          parsed.hostname.includes(pattern) || parsed.pathname.includes(pattern)
        )
        
        if (!looksLikeStaging) {
          warnings.push(
            `Staging environment detected but URL doesn't contain staging indicators: ${url}. ` +
            `Verify this is the correct staging URL.`
          )
        }
      } catch (urlError) {
        errors.push(`Invalid URL format in staging environment: ${url}`)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Logs environment detection information with enhanced build-time vs runtime details
 * Enhanced for requirements 1.3, 1.5, 2.1, 2.2, 2.4: Comprehensive logging with priority chain
 * 
 * @param envInfo - Environment information to log
 * @param prefix - Optional prefix for log messages
 */
export function logEnvironmentInfo(envInfo: EnvironmentInfo, prefix: string = 'Environment'): void {
  // Note: Error handling guidance is available via analyzeEnvironmentForErrors function
  console.log(`[${prefix}] 🌍 Environment detected: ${envInfo.environment.toUpperCase()}`)
  console.log(`[${prefix}] Detection method: ${envInfo.detectionMethod}`)
  console.log(`[${prefix}] Context: ${envInfo.context}`)
  
  // Enhanced logging for build-time vs runtime detection (Requirements 2.1, 2.2)
  console.log(`[${prefix}] === ENVIRONMENT DETECTION DETAILS ===`)
  console.log(`[${prefix}] Detection timestamp: ${envInfo.timestamp}`)
  console.log(`[${prefix}] Detection phase: ${envInfo.detectionPhase.isBuildTime ? 'BUILD-TIME' : 'RUNTIME'}`)
  
  if (envInfo.detectionPhase.isBuildTime) {
    console.log(`[${prefix}] 🏗️  BUILD-TIME DETECTION:`)
    console.log(`[${prefix}]   Build context: ${envInfo.detectionPhase.buildContext}`)
    if (envInfo.detectionPhase.containerContext) {
      console.log(`[${prefix}]   Container context: ${envInfo.detectionPhase.containerContext}`)
    }
    if (envInfo.detectionPhase.dockerBuild) {
      console.log(`[${prefix}]   Docker build: ✓ YES`)
      console.log(`[${prefix}]   ⚠️  Note: Environment variables may be limited during Docker build`)
    }
  } else {
    console.log(`[${prefix}] 🚀 RUNTIME DETECTION:`)
    console.log(`[${prefix}]   Full environment variable access available`)
    console.log(`[${prefix}]   Runtime configuration can be dynamically loaded`)
  }
  
  console.log(`[${prefix}] Environment flags:`)
  console.log(`[${prefix}]   isProduction: ${envInfo.isProduction}`)
  console.log(`[${prefix}]   isDevelopment: ${envInfo.isDevelopment}`)
  console.log(`[${prefix}]   isStaging: ${envInfo.isStaging}`)
  
  // Log all environment variables checked during detection (Requirements 1.5)
  console.log(`[${prefix}] 📋 Environment Variables Analyzed (${envInfo.environmentVariables.length} total):`)
  envInfo.environmentVariables.forEach(envVar => {
    const status = envVar.available ? '✓' : '✗'
    const value = envVar.available ? envVar.value : 'NOT SET'
    console.log(`[${prefix}]   ${status} ${envVar.name}: ${value} (${envVar.source})`)
  })
  
  // Log missing variables that could improve detection (Requirements 1.3)
  if (envInfo.missingVariables.length > 0) {
    console.log(`[${prefix}] ⚠️  Missing Variables (${envInfo.missingVariables.length}):`)
    envInfo.missingVariables.forEach(varName => {
      console.log(`[${prefix}]   • ${varName} - Could improve environment detection accuracy`)
    })
    console.log(`[${prefix}] 💡 Consider setting these variables for more explicit control`)
  } else {
    console.log(`[${prefix}] ✓ All recommended environment variables are available`)
  }
  
  // Log priority chain showing which source was selected (Requirements 2.4)
  console.log(`[${prefix}] 🔗 Priority Chain Analysis:`)
  envInfo.priorityChain.forEach(item => {
    const status = item.selected ? '🎯 SELECTED' : item.available ? '⏭️  AVAILABLE' : '❌ UNAVAILABLE'
    console.log(`[${prefix}]   ${item.priority}. ${item.source}: ${status}`)
    console.log(`[${prefix}]      Reason: ${item.reason}`)
    if (item.value) {
      console.log(`[${prefix}]      Value: ${item.value}`)
    }
  })
  
  // Log network environment information with enhanced details
  if (envInfo.networkEnvironment) {
    const netEnv = envInfo.networkEnvironment
    console.log(`[${prefix}] 🔗 Network Environment Configuration:`)
    console.log(`[${prefix}]   Container detected: ${netEnv.isContainer ? '✓ YES' : '✗ NO'}`)
    console.log(`[${prefix}]   Server-side execution: ${netEnv.isServerSide ? '✓ YES' : '✗ NO'}`)
    console.log(`[${prefix}]   Preferred protocol: ${netEnv.preferredProtocol}`)
    console.log(`[${prefix}]   Internal domain: ${netEnv.internalDomain}`)
    console.log(`[${prefix}]   External domain: ${netEnv.externalDomain}`)
    console.log(`[${prefix}]   Network detection method: ${netEnv.networkDetectionMethod}`)
    console.log(`[${prefix}]   Network detection context: ${netEnv.networkContext}`)
    
    // Enhanced container networking analysis
    if (netEnv.isContainer) {
      console.log(`[${prefix}] 🐳 Container Networking Analysis:`)
      console.log(`[${prefix}]   Container type: Docker/Kubernetes detected`)
      console.log(`[${prefix}]   Internal service communication: ENABLED`)
      console.log(`[${prefix}]   Service discovery: Using container names (kong, gotrue, etc.)`)
      console.log(`[${prefix}]   Port mapping: Internal ports accessible via service names`)
      
      if (netEnv.isServerSide) {
        console.log(`[${prefix}]   → Server-side APIs should use: ${netEnv.internalDomain}`)
        console.log(`[${prefix}]   → Example: http://kong:8000/auth/v1 for GoTrue`)
      } else {
        console.log(`[${prefix}]   → Client-side requests should use: ${netEnv.externalDomain}`)
        console.log(`[${prefix}]   → Example: http://localhost:8000/auth/v1 for GoTrue`)
      }
    } else {
      console.log(`[${prefix}] 💻 Non-Container Environment:`)
      console.log(`[${prefix}]   Direct networking: Using localhost/IP addresses`)
      console.log(`[${prefix}]   Service discovery: Manual configuration required`)
      console.log(`[${prefix}]   Port access: Direct port binding`)
    }
    
    // Log networking recommendations
    console.log(`[${prefix}] 💡 Networking Recommendations:`)
    if (netEnv.isContainer && netEnv.isServerSide) {
      console.log(`[${prefix}]   ✓ Use internal service names for server-to-server communication`)
      console.log(`[${prefix}]   ✓ Avoid localhost URLs in server-side container code`)
      console.log(`[${prefix}]   ✓ Use HTTP for internal container communication (unless TLS required)`)
    } else if (netEnv.isContainer && !netEnv.isServerSide) {
      console.log(`[${prefix}]   ✓ Use external addresses for browser requests`)
      console.log(`[${prefix}]   ✓ Ensure port mapping is configured for external access`)
    } else {
      console.log(`[${prefix}]   ✓ Use localhost or direct IP addresses`)
      console.log(`[${prefix}]   ✓ Ensure services are running on expected ports`)
    }
  }
  
  // Environment-specific guidance with build-time considerations
  if (envInfo.isProduction) {
    console.log(`[${prefix}] ⚠️  PRODUCTION MODE DETECTED`)
    console.log(`[${prefix}] 🔒 Production Requirements:`)
    console.log(`[${prefix}]   • All URLs must point to production services`)
    console.log(`[${prefix}]   • No localhost or development URLs allowed`)
    console.log(`[${prefix}]   • HTTPS recommended for external communication`)
    console.log(`[${prefix}]   • Proper SSL/TLS certificates required`)
    console.log(`[${prefix}]   • Environment variables must be production-ready`)
    
    if (envInfo.detectionPhase.isBuildTime) {
      console.log(`[${prefix}] 🏗️  Build-time Production Considerations:`)
      console.log(`[${prefix}]   • Ensure ENVIRONMENT=production is set during Docker build`)
      console.log(`[${prefix}]   • Use ARG declarations in Dockerfile for build-time variables`)
      console.log(`[${prefix}]   • Verify production URLs are accessible during build`)
    }
  } else if (envInfo.isDevelopment) {
    console.log(`[${prefix}] 🔧 DEVELOPMENT MODE DETECTED`)
    console.log(`[${prefix}] 🛠️  Development Setup:`)
    console.log(`[${prefix}]   • Using local development services`)
    console.log(`[${prefix}]   • Localhost URLs are expected and normal`)
    console.log(`[${prefix}]   • HTTP is acceptable for local development`)
    console.log(`[${prefix}]   • Ensure docker-compose services are running`)
    
    if (envInfo.detectionPhase.isBuildTime) {
      console.log(`[${prefix}] 🏗️  Build-time Development Considerations:`)
      console.log(`[${prefix}]   • Development builds can use localhost URLs`)
      console.log(`[${prefix}]   • Build-time environment detection is working correctly`)
    }
  } else if (envInfo.isStaging) {
    console.log(`[${prefix}] 🧪 STAGING MODE DETECTED`)
    console.log(`[${prefix}] 🎯 Staging Configuration:`)
    console.log(`[${prefix}]   • Using staging environment services`)
    console.log(`[${prefix}]   • Should mirror production setup`)
    console.log(`[${prefix}]   • Staging-specific URLs and credentials`)
    
    if (envInfo.detectionPhase.isBuildTime) {
      console.log(`[${prefix}] 🏗️  Build-time Staging Considerations:`)
      console.log(`[${prefix}]   • Ensure ENVIRONMENT=staging is set during build`)
      console.log(`[${prefix}]   • Staging URLs should be accessible during build`)
    }
  }
  
  console.log(`[${prefix}] =======================================`)
  
  // Analyze environment for potential errors and provide guidance
  try {
    const errors = analyzeEnvironmentForErrors(envInfo, {
      supabaseUrl: process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL,
      gotrueUrl: process.env.NEXT_PUBLIC_GOTRUE_URL,
      apiUrl: process.env.API_EXTERNAL_URL,
    })
    
    if (errors.length > 0) {
      console.log(`[${prefix}] 🔍 Configuration Analysis: ${errors.length} issues detected`)
      errors.forEach((error, index) => {
        console.log(`[${prefix}] Issue ${index + 1}/${errors.length}:`)
        logConfigurationError(error, {
          environment: envInfo.environment,
          isDocker: envInfo.detectionPhase.dockerBuild || false,
          isBuildTime: envInfo.detectionPhase.isBuildTime,
          availableVariables: envInfo.environmentVariables.filter(v => v.available).map(v => v.name),
          missingVariables: envInfo.missingVariables,
          currentUrls: {
            supabaseUrl: process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL,
            gotrueUrl: process.env.NEXT_PUBLIC_GOTRUE_URL,
            apiUrl: process.env.API_EXTERNAL_URL,
          },
        }, prefix)
      })
    } else {
      console.log(`[${prefix}] ✅ Configuration analysis: No critical issues detected`)
    }
  } catch (analysisError) {
    console.warn(`[${prefix}] ⚠️ Could not perform configuration analysis:`, analysisError)
  }
}

/**
 * Logs URL validation results for the environment
 * 
 * @param validation - Validation result
 * @param prefix - Optional prefix for log messages
 */
export function logUrlValidation(
  validation: ReturnType<typeof validateUrlsForEnvironment>,
  prefix: string = 'Environment'
): void {
  if (validation.errors.length > 0) {
    console.error(`[${prefix}] ❌ URL validation errors:`)
    validation.errors.forEach((error, index) => {
      console.error(`  ${index + 1}. ${error}`)
    })
  }

  if (validation.warnings.length > 0) {
    console.warn(`[${prefix}] ⚠️  URL validation warnings:`)
    validation.warnings.forEach((warning, index) => {
      console.warn(`  ${index + 1}. ${warning}`)
    })
  }

  if (validation.isValid && validation.warnings.length === 0) {
    console.log(`[${prefix}] ✓ All URLs are valid for the current environment`)
  }
}

/**
 * Logs network address validation results
 * 
 * @param validation - Network validation result
 * @param url - The URL that was validated
 * @param prefix - Optional prefix for log messages
 */
export function logNetworkValidation(
  validation: ReturnType<typeof validateInternalNetworkAddress>,
  url: string,
  prefix: string = 'Network'
): void {
  console.log(`[${prefix}] 🔍 Validating network address: ${url}`)
  console.log(`[${prefix}]   Internal address: ${validation.isInternalAddress ? '✓' : '✗'}`)
  console.log(`[${prefix}]   Valid: ${validation.isValid ? '✓' : '✗'}`)
  
  if (validation.errors.length > 0) {
    console.error(`[${prefix}] ❌ Network validation errors:`)
    validation.errors.forEach((error, index) => {
      console.error(`  ${index + 1}. ${error}`)
    })
  }

  if (validation.warnings.length > 0) {
    console.warn(`[${prefix}] ⚠️  Network validation warnings:`)
    validation.warnings.forEach((warning, index) => {
      console.warn(`  ${index + 1}. ${warning}`)
    })
  }

  if (validation.recommendations.length > 0) {
    console.log(`[${prefix}] 💡 Network recommendations:`)
    validation.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`)
    })
  }
}

/**
 * Gets environment-specific configuration recommendations
 * 
 * @param environment - The current environment
 * @returns Array of recommendation strings
 */
export function getEnvironmentRecommendations(environment: Environment): string[] {
  const recommendations: string[] = []

  if (environment === 'production') {
    recommendations.push(
      '🔧 Production Environment Setup:',
      '  • Set SUPABASE_PUBLIC_URL to your production Supabase URL (e.g., https://your-project.supabase.co)',
      '  • Set API_EXTERNAL_URL to your production API gateway URL (e.g., https://api.yourcompany.com)',
      '  • Set NEXT_PUBLIC_SUPABASE_ANON_KEY to your production anonymous key',
      '  • Use HTTPS URLs for all services for security',
      '  • Never use localhost, 127.0.0.1, or 0.0.0.0 URLs in production',
      '  • Consider using domain names instead of IP addresses for reliability',
      '  • Verify all URLs are accessible from your production network',
      '🔍 Validation Commands:',
      '  • curl -f "$SUPABASE_PUBLIC_URL/rest/v1/" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"',
      '  • curl -f "$API_EXTERNAL_URL/health" (if health endpoint exists)',
      '📋 Environment Variables Checklist:',
      '  • SUPABASE_PUBLIC_URL ✓',
      '  • API_EXTERNAL_URL ✓', 
      '  • NEXT_PUBLIC_SUPABASE_ANON_KEY ✓',
      '  • NODE_ENV=production (recommended)',
      '  • ENVIRONMENT=production (optional, explicit)'
    )
  } else if (environment === 'development') {
    recommendations.push(
      '🔧 Development Environment Setup:',
      '  • Use localhost URLs for local development',
      '  • Ensure local Supabase services are running (docker-compose up)',
      '  • Default ports: Kong (8000), GoTrue (54321), PostgREST (3000)',
      '  • Use HTTP (not HTTPS) for localhost to avoid certificate issues',
      '🚀 Quick Start Commands:',
      '  • docker-compose up -d (start local services)',
      '  • curl http://localhost:8000/health (verify Kong is running)',
      '  • curl http://localhost:54321/health (verify GoTrue is running)',
      '📋 Development URLs:',
      '  • GoTrue: http://localhost:54321/auth/v1',
      '  • Kong Gateway: http://localhost:8000',
      '  • PostgREST: http://localhost:3000',
      '🔧 Override Options:',
      '  • Set NEXT_PUBLIC_GOTRUE_URL if using custom ports',
      '  • Set NODE_ENV=development for explicit development mode',
      '  • Set SUPABASE_PUBLIC_URL if connecting to remote development instance'
    )
  } else if (environment === 'staging') {
    recommendations.push(
      '🔧 Staging Environment Setup:',
      '  • Use staging-specific URLs with staging indicators (staging., stg., test.)',
      '  • Set SUPABASE_PUBLIC_URL to your staging Supabase URL',
      '  • Set API_EXTERNAL_URL to your staging API gateway URL',
      '  • Use staging-specific API keys and credentials',
      '  • Consider using HTTPS even in staging for production-like testing',
      '📋 Staging Environment Variables:',
      '  • SUPABASE_PUBLIC_URL (staging URL)',
      '  • API_EXTERNAL_URL (staging API gateway)',
      '  • NEXT_PUBLIC_SUPABASE_ANON_KEY (staging anon key)',
      '  • ENVIRONMENT=staging (recommended for clarity)',
      '🔍 Staging Validation:',
      '  • Verify staging URLs are accessible',
      '  • Test with staging data and credentials',
      '  • Ensure staging environment is isolated from production',
      '💡 Best Practices:',
      '  • Use staging for integration testing before production',
      '  • Keep staging configuration similar to production',
      '  • Use staging-specific database and storage'
    )
  }

  return recommendations
}

/**
 * Performs comprehensive environment check and logs results
 * 
 * This is a convenience function that:
 * 1. Detects the environment using runtime URLs if available
 * 2. Validates URLs for the environment
 * 3. Logs all information and recommendations
 * 
 * @param urls - URLs to validate
 * @param useRuntimeUrls - Whether to use these URLs for environment detection
 * @returns Environment information
 */
export function performEnvironmentCheck(
  urls: {
    gotrueUrl?: string
    supabaseUrl?: string
    apiUrl?: string
  },
  useRuntimeUrls: boolean = true
): EnvironmentInfo {
  // Detect environment, optionally using runtime URLs
  const envInfo = detectEnvironment(useRuntimeUrls ? urls : undefined)
  
  // Log environment info
  logEnvironmentInfo(envInfo, 'Environment Check')
  
  // Validate URLs
  const validation = validateUrlsForEnvironment(urls, envInfo.environment)
  logUrlValidation(validation, 'Environment Check')
  
  // Log recommendations if there are issues
  if (!validation.isValid || validation.warnings.length > 0) {
    const recommendations = getEnvironmentRecommendations(envInfo.environment)
    console.log('[Environment Check] 💡 Recommendations:')
    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`)
    })
  }
  
  return envInfo
}
