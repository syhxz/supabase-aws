/**
 * Configuration Logging Module
 * 
 * Provides comprehensive logging for configuration-related operations with:
 * - Standardized log formatting
 * - Configuration source tracking
 * - Failed request URL logging
 * - Troubleshooting guidance
 * - Environment-aware logging levels
 * 
 * This module centralizes all configuration logging to ensure consistency
 * and provide actionable debugging information.
 */

import type { RuntimeConfig } from './runtime-config'
import type { ConfigError } from './runtime-config-errors'
import type { Environment, EnvironmentInfo } from './environment-detection'

/**
 * Log levels for configuration operations
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Configuration source types for logging
 */
export type ConfigSource = 
  | 'runtime' 
  | 'explicit' 
  | 'derived-public' 
  | 'derived' 
  | 'default' 
  | 'fallback'

/**
 * Configuration operation types for logging
 */
export enum ConfigOperation {
  FETCH = 'FETCH',
  LOAD = 'LOAD',
  UPDATE = 'UPDATE',
  VALIDATE = 'VALIDATE',
  HEALTH_CHECK = 'HEALTH_CHECK',
  URL_RESOLUTION = 'URL_RESOLUTION',
  ERROR_HANDLING = 'ERROR_HANDLING',
}

/**
 * Request logging information
 */
export interface RequestLogInfo {
  /** The URL that was requested */
  url: string
  /** HTTP method used */
  method?: string
  /** Response status code (if available) */
  status?: number
  /** Response time in milliseconds */
  responseTime?: number
  /** Whether the request succeeded */
  success: boolean
  /** Error message if request failed */
  error?: string
  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Configuration change log entry
 */
export interface ConfigChangeLog {
  /** Timestamp of the change */
  timestamp: number
  /** Operation that caused the change */
  operation: ConfigOperation
  /** Previous configuration source */
  previousSource?: ConfigSource
  /** New configuration source */
  newSource: ConfigSource
  /** Previous URLs (sanitized) */
  previousUrls?: {
    gotrueUrl?: string
    supabaseUrl?: string
    apiUrl?: string
  }
  /** New URLs (sanitized) */
  newUrls: {
    gotrueUrl?: string
    supabaseUrl?: string
    apiUrl?: string
  }
  /** Environment context */
  environment: Environment
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Global configuration change history (for debugging)
 */
const configChangeHistory: ConfigChangeLog[] = []

/**
 * Maximum number of change log entries to keep
 */
const MAX_CHANGE_HISTORY = 50

/**
 * Determines if debug logging should be enabled
 */
function shouldLogDebug(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.CONFIG_DEBUG === 'true' ||
    (typeof window !== 'undefined' && window.localStorage?.getItem('config-debug') === 'true')
  )
}

/**
 * Gets a standardized log prefix for configuration operations
 */
function getLogPrefix(component: string, operation?: ConfigOperation): string {
  const prefix = `[${component}]`
  return operation ? `${prefix} [${operation}]` : prefix
}

/**
 * Sanitizes URLs for logging (removes sensitive information)
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove query parameters that might contain sensitive data
    parsed.search = ''
    // Remove hash that might contain sensitive data
    parsed.hash = ''
    return parsed.toString()
  } catch {
    // If URL parsing fails, just return the original (it might not be a URL)
    return url
  }
}

/**
 * Sanitizes configuration for logging (removes sensitive data)
 */
function sanitizeConfig(config: Partial<RuntimeConfig>): Record<string, unknown> {
  return {
    gotrueUrl: config.gotrueUrl ? sanitizeUrl(config.gotrueUrl) : undefined,
    supabaseUrl: config.supabaseUrl ? sanitizeUrl(config.supabaseUrl) : undefined,
    apiUrl: config.apiUrl ? sanitizeUrl(config.apiUrl) : undefined,
    hasAnonKey: !!config.anonKey,
    source: config.source,
    environment: config.environment,
    timestamp: config.timestamp,
    // Note: We never log the actual anonKey to prevent exposure
  }
}

/**
 * Logs configuration source information with context
 */
export function logConfigurationSource(
  component: string,
  source: ConfigSource,
  urls: {
    gotrueUrl?: string
    supabaseUrl?: string
    apiUrl?: string
  },
  environment: Environment,
  metadata?: Record<string, unknown>
): void {
  const prefix = getLogPrefix(component, ConfigOperation.LOAD)
  
  console.log(`${prefix} ✓ Configuration loaded successfully`)
  console.log(`${prefix} Source: ${source}`)
  console.log(`${prefix} Environment: ${environment.toUpperCase()}`)
  
  // Log URLs (sanitized)
  if (urls.gotrueUrl) {
    console.log(`${prefix} GoTrue URL: ${sanitizeUrl(urls.gotrueUrl)}`)
  }
  if (urls.supabaseUrl) {
    console.log(`${prefix} Supabase URL: ${sanitizeUrl(urls.supabaseUrl)}`)
  }
  if (urls.apiUrl) {
    console.log(`${prefix} API URL: ${sanitizeUrl(urls.apiUrl)}`)
  }
  
  // Log metadata if provided
  if (metadata) {
    console.log(`${prefix} Metadata:`, metadata)
  }
  
  // Environment-specific logging
  logEnvironmentSpecificInfo(component, source, environment, urls)
  
  // Log source-specific information
  logSourceSpecificInfo(component, source, environment)
}

/**
 * Logs environment-specific configuration information
 */
function logEnvironmentSpecificInfo(
  component: string,
  source: ConfigSource,
  environment: Environment,
  urls: {
    gotrueUrl?: string
    supabaseUrl?: string
    apiUrl?: string
  }
): void {
  const prefix = getLogPrefix(component)
  
  if (environment === 'production') {
    console.log(`${prefix} 🚀 PRODUCTION environment detected`)
    
    // Validate production URLs don't contain localhost
    const allUrls = [urls.gotrueUrl, urls.supabaseUrl, urls.apiUrl].filter(Boolean)
    const hasLocalhost = allUrls.some(url => 
      url!.includes('localhost') || url!.includes('127.0.0.1')
    )
    
    if (hasLocalhost) {
      console.error(`${prefix} ❌ CRITICAL ERROR: Production environment using localhost URLs!`)
      console.error(`${prefix} All API requests will fail!`)
      console.error(`${prefix} Check your environment variables:`)
      console.error(`${prefix}   - SUPABASE_PUBLIC_URL`)
      console.error(`${prefix}   - API_EXTERNAL_URL`)
      console.error(`${prefix}   - NEXT_PUBLIC_GOTRUE_URL`)
    } else {
      console.log(`${prefix} ✓ Production URLs validated (no localhost detected)`)
    }
    
    // Warn about insecure HTTP in production
    const hasInsecureHttp = allUrls.some(url => 
      url!.startsWith('http://') && !url!.includes('localhost') && !url!.includes('127.0.0.1')
    )
    
    if (hasInsecureHttp) {
      console.warn(`${prefix} ⚠️  Production environment using insecure HTTP protocol`)
      console.warn(`${prefix} Consider using HTTPS for production deployments`)
    }
    
  } else if (environment === 'development') {
    console.log(`${prefix} 🔧 DEVELOPMENT environment detected`)
    
    // Check if using localhost as expected
    const allUrls = [urls.gotrueUrl, urls.supabaseUrl, urls.apiUrl].filter(Boolean)
    const hasLocalhost = allUrls.some(url => 
      url!.includes('localhost') || url!.includes('127.0.0.1')
    )
    
    if (!hasLocalhost) {
      console.warn(`${prefix} ⚠️  Development environment not using localhost URLs`)
      console.warn(`${prefix} This may be intentional if connecting to remote services`)
    } else {
      console.log(`${prefix} ✓ Using localhost URLs (expected for development)`)
    }
    
  } else if (environment === 'staging') {
    console.log(`${prefix} 🧪 STAGING environment detected`)
    console.log(`${prefix} Using staging environment services`)
  }
}

/**
 * Logs source-specific configuration information
 */
function logSourceSpecificInfo(
  component: string,
  source: ConfigSource,
  environment: Environment
): void {
  const prefix = getLogPrefix(component)
  
  switch (source) {
    case 'runtime':
      console.log(`${prefix} ✓ Using runtime configuration (optimal)`)
      if (environment === 'production') {
        console.log(`${prefix} ✓ Production environment with runtime configuration (recommended)`)
      }
      break
      
    case 'explicit':
      console.log(`${prefix} ✓ Using explicit build-time configuration`)
      if (environment === 'production') {
        console.log(`${prefix} ✓ Production environment with explicit configuration (good)`)
      }
      break
      
    case 'derived-public':
    case 'derived':
      console.log(`${prefix} ⚠️  Using derived build-time configuration`)
      if (environment === 'production') {
        console.warn(`${prefix} ⚠️  Production environment using derived URLs`)
        console.warn(`${prefix} Consider setting explicit NEXT_PUBLIC_GOTRUE_URL for production`)
      } else {
        console.log(`${prefix} This is acceptable for ${environment} environment`)
      }
      break
      
    case 'default':
      console.warn(`${prefix} ⚠️  Using development defaults`)
      if (environment === 'production') {
        console.error(`${prefix} ❌ CRITICAL: Using defaults in production environment!`)
        console.error(`${prefix} This will cause all API requests to fail!`)
        console.error(`${prefix} Set SUPABASE_PUBLIC_URL or NEXT_PUBLIC_GOTRUE_URL environment variables`)
      } else if (environment === 'development') {
        console.log(`${prefix} ✓ Development environment with defaults (expected)`)
      }
      break
      
    case 'fallback':
      console.warn(`${prefix} ⚠️  Using fallback configuration due to runtime config failure`)
      console.warn(`${prefix} Application may not work correctly if fallback URLs are wrong`)
      break
  }
}

/**
 * Logs a failed request with detailed information for debugging
 */
export function logFailedRequest(
  component: string,
  requestInfo: RequestLogInfo,
  troubleshootingSteps?: string[]
): void {
  const prefix = getLogPrefix(component, ConfigOperation.ERROR_HANDLING)
  
  console.error(`${prefix} ❌ Request failed`)
  console.error(`${prefix} URL: ${sanitizeUrl(requestInfo.url)}`)
  
  if (requestInfo.method) {
    console.error(`${prefix} Method: ${requestInfo.method}`)
  }
  
  if (requestInfo.status) {
    console.error(`${prefix} Status: ${requestInfo.status}`)
  }
  
  if (requestInfo.responseTime) {
    console.error(`${prefix} Response time: ${requestInfo.responseTime}ms`)
  }
  
  if (requestInfo.error) {
    console.error(`${prefix} Error: ${requestInfo.error}`)
  }
  
  if (requestInfo.context) {
    console.error(`${prefix} Context:`, requestInfo.context)
  }
  
  // Log troubleshooting steps
  if (troubleshootingSteps && troubleshootingSteps.length > 0) {
    console.error(`${prefix} Troubleshooting steps:`)
    troubleshootingSteps.forEach((step, index) => {
      console.error(`${prefix}   ${index + 1}. ${step}`)
    })
  }
  
  // Log environment-specific guidance
  logRequestFailureGuidance(component, requestInfo)
}

/**
 * Logs environment-specific guidance for request failures
 * Enhanced for requirement 3.5: Provide useful troubleshooting suggestions
 */
function logRequestFailureGuidance(component: string, requestInfo: RequestLogInfo): void {
  const prefix = getLogPrefix(component)
  const url = requestInfo.url.toLowerCase()
  
  // Detect likely environment based on URL
  let environment: Environment = 'production'
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    environment = 'development'
  } else if (url.includes('staging') || url.includes('stg')) {
    environment = 'staging'
  }
  
  console.error(`${prefix} === TROUBLESHOOTING GUIDANCE ===`)
  console.error(`${prefix} Environment-specific guidance for ${environment.toUpperCase()}:`)
  
  if (environment === 'development') {
    console.error(`${prefix} 🔧 Development Environment Troubleshooting:`)
    console.error(`${prefix}   1. Service Status Checks:`)
    console.error(`${prefix}      • docker-compose ps (check all services are running)`)
    console.error(`${prefix}      • docker-compose logs kong (check Kong gateway logs)`)
    console.error(`${prefix}      • docker-compose logs gotrue (check GoTrue service logs)`)
    console.error(`${prefix}   2. Network Connectivity:`)
    console.error(`${prefix}      • curl http://localhost:8000/health (test Kong gateway)`)
    console.error(`${prefix}      • curl http://localhost:54321/health (test GoTrue directly)`)
    console.error(`${prefix}      • netstat -tlnp | grep :8000 (verify port binding)`)
    console.error(`${prefix}   3. Container Networking:`)
    console.error(`${prefix}      • docker network ls (check networks exist)`)
    console.error(`${prefix}      • docker exec studio-container ping kong (test internal connectivity)`)
    console.error(`${prefix}      • docker exec studio-container nslookup kong (test DNS resolution)`)
    console.error(`${prefix}   4. Configuration Checks:`)
    console.error(`${prefix}      • Verify .env file has correct localhost URLs`)
    console.error(`${prefix}      • Check SUPABASE_ANON_KEY is set and valid`)
    console.error(`${prefix}      • Ensure no conflicting environment variables`)
  } else if (environment === 'production') {
    console.error(`${prefix} 🚀 Production Environment Troubleshooting:`)
    console.error(`${prefix}   1. Service Health Verification:`)
    console.error(`${prefix}      • Check production service status dashboards`)
    console.error(`${prefix}      • Verify all microservices are running`)
    console.error(`${prefix}      • Check load balancer health checks`)
    console.error(`${prefix}   2. Network Connectivity:`)
    console.error(`${prefix}      • Test external connectivity: curl -I <production-url>`)
    console.error(`${prefix}      • Verify DNS resolution: nslookup <domain>`)
    console.error(`${prefix}      • Check CDN/proxy configuration`)
    console.error(`${prefix}   3. Security & Access:`)
    console.error(`${prefix}      • Verify SSL/TLS certificates are valid`)
    console.error(`${prefix}      • Check firewall rules and security groups`)
    console.error(`${prefix}      • Validate API keys and authentication tokens`)
    console.error(`${prefix}   4. Infrastructure Checks:`)
    console.error(`${prefix}      • Monitor server resources (CPU, memory, disk)`)
    console.error(`${prefix}      • Check database connectivity and performance`)
    console.error(`${prefix}      • Verify container orchestration (Kubernetes/Docker Swarm)`)
  } else if (environment === 'staging') {
    console.error(`${prefix} 🧪 Staging Environment Troubleshooting:`)
    console.error(`${prefix}   1. Staging Service Verification:`)
    console.error(`${prefix}      • Verify staging services are deployed and running`)
    console.error(`${prefix}      • Check staging-specific configuration`)
    console.error(`${prefix}      • Validate staging database connectivity`)
    console.error(`${prefix}   2. Environment Isolation:`)
    console.error(`${prefix}      • Ensure staging is isolated from production`)
    console.error(`${prefix}      • Verify staging-specific API keys and credentials`)
    console.error(`${prefix}      • Check staging data and test fixtures`)
    console.error(`${prefix}   3. Configuration Validation:`)
    console.error(`${prefix}      • Verify staging URLs contain staging indicators`)
    console.error(`${prefix}      • Check environment variable overrides`)
    console.error(`${prefix}      • Validate staging-specific feature flags`)
  }
  
  // Enhanced status-specific guidance
  if (requestInfo.status) {
    console.error(`${prefix} 🔍 HTTP Status Code Analysis (${requestInfo.status}):`)
    
    if (requestInfo.status >= 500) {
      console.error(`${prefix}   Server Error (5xx) - Service Internal Issues:`)
      console.error(`${prefix}   • Check server logs for detailed error information`)
      console.error(`${prefix}   • Verify server has sufficient resources (CPU, memory)`)
      console.error(`${prefix}   • Check for server-side configuration issues`)
      console.error(`${prefix}   • Validate database connectivity and health`)
      console.error(`${prefix}   • Check for service dependencies that may be down`)
      console.error(`${prefix}   • Review recent deployments for potential issues`)
    } else if (requestInfo.status === 404) {
      console.error(`${prefix}   Not Found (404) - Routing or Endpoint Issues:`)
      console.error(`${prefix}   • Verify the API endpoint URL is correct`)
      console.error(`${prefix}   • Check API gateway routing configuration`)
      console.error(`${prefix}   • Ensure the service is registered with the gateway`)
      console.error(`${prefix}   • Validate URL path and query parameters`)
      console.error(`${prefix}   • Check for typos in the endpoint URL`)
    } else if (requestInfo.status === 403) {
      console.error(`${prefix}   Forbidden (403) - Authentication/Authorization Issues:`)
      console.error(`${prefix}   • Verify API key is correct and has proper permissions`)
      console.error(`${prefix}   • Check JWT token validity and expiration`)
      console.error(`${prefix}   • Validate user permissions for the requested resource`)
      console.error(`${prefix}   • Check for IP-based access restrictions`)
      console.error(`${prefix}   • Verify service-to-service authentication`)
    } else if (requestInfo.status === 401) {
      console.error(`${prefix}   Unauthorized (401) - Authentication Required:`)
      console.error(`${prefix}   • Verify authentication credentials are provided`)
      console.error(`${prefix}   • Check API key format and validity`)
      console.error(`${prefix}   • Validate authentication headers`)
      console.error(`${prefix}   • Ensure authentication service is accessible`)
    } else if (requestInfo.status === 429) {
      console.error(`${prefix}   Too Many Requests (429) - Rate Limiting:`)
      console.error(`${prefix}   • Implement exponential backoff retry logic`)
      console.error(`${prefix}   • Check rate limiting configuration`)
      console.error(`${prefix}   • Verify request frequency is within limits`)
      console.error(`${prefix}   • Consider request batching or caching`)
    } else if (requestInfo.status >= 400) {
      console.error(`${prefix}   Client Error (4xx) - Request Issues:`)
      console.error(`${prefix}   • Validate request format and content-type`)
      console.error(`${prefix}   • Check request headers and parameters`)
      console.error(`${prefix}   • Verify request body structure and data types`)
      console.error(`${prefix}   • Validate required fields are present`)
      console.error(`${prefix}   • Check for data validation errors`)
    }
  }
  
  // Network-specific troubleshooting
  if (requestInfo.error) {
    console.error(`${prefix} 🌐 Network Error Analysis:`)
    const errorLower = requestInfo.error.toLowerCase()
    
    if (errorLower.includes('econnrefused')) {
      console.error(`${prefix}   Connection Refused - Service Not Accessible:`)
      console.error(`${prefix}   • Service may not be running on the target port`)
      console.error(`${prefix}   • Check if the service is bound to the correct interface`)
      console.error(`${prefix}   • Verify firewall rules allow the connection`)
      console.error(`${prefix}   • In containers: ensure service names resolve correctly`)
    } else if (errorLower.includes('etimedout') || errorLower.includes('timeout')) {
      console.error(`${prefix}   Connection Timeout - Network or Performance Issues:`)
      console.error(`${prefix}   • Service may be overloaded or responding slowly`)
      console.error(`${prefix}   • Check network latency and connectivity`)
      console.error(`${prefix}   • Verify service health and resource usage`)
      console.error(`${prefix}   • Consider increasing timeout values`)
    } else if (errorLower.includes('enotfound')) {
      console.error(`${prefix}   Host Not Found - DNS or Configuration Issues:`)
      console.error(`${prefix}   • Verify hostname/domain is correct`)
      console.error(`${prefix}   • Check DNS resolution: nslookup <hostname>`)
      console.error(`${prefix}   • In containers: verify service names in docker-compose`)
      console.error(`${prefix}   • Check network configuration and routing`)
    } else if (errorLower.includes('econnreset')) {
      console.error(`${prefix}   Connection Reset - Network or Service Issues:`)
      console.error(`${prefix}   • Service may have crashed or restarted`)
      console.error(`${prefix}   • Check for network instability`)
      console.error(`${prefix}   • Verify service can handle the request load`)
      console.error(`${prefix}   • Check for proxy or load balancer issues`)
    }
  }
  
  console.error(`${prefix} =======================================`)
}

/**
 * Logs a successful request with performance information
 */
export function logSuccessfulRequest(
  component: string,
  requestInfo: RequestLogInfo
): void {
  const prefix = getLogPrefix(component)
  
  if (shouldLogDebug()) {
    console.log(`${prefix} ✓ Request successful`)
    console.log(`${prefix} URL: ${sanitizeUrl(requestInfo.url)}`)
    
    if (requestInfo.method) {
      console.log(`${prefix} Method: ${requestInfo.method}`)
    }
    
    if (requestInfo.status) {
      console.log(`${prefix} Status: ${requestInfo.status}`)
    }
    
    if (requestInfo.responseTime) {
      console.log(`${prefix} Response time: ${requestInfo.responseTime}ms`)
    }
    
    if (requestInfo.context) {
      console.log(`${prefix} Context:`, requestInfo.context)
    }
  }
}

/**
 * Logs configuration changes for audit trail
 */
export function logConfigurationChange(
  component: string,
  operation: ConfigOperation,
  previousConfig: Partial<RuntimeConfig> | null,
  newConfig: Partial<RuntimeConfig>,
  environment: Environment,
  metadata?: Record<string, unknown>
): void {
  const prefix = getLogPrefix(component, operation)
  
  console.log(`${prefix} Configuration changed`)
  console.log(`${prefix} Operation: ${operation}`)
  console.log(`${prefix} Environment: ${environment}`)
  
  if (previousConfig) {
    console.log(`${prefix} Previous source: ${previousConfig.source}`)
  }
  console.log(`${prefix} New source: ${newConfig.source}`)
  
  // Log URL changes (sanitized)
  if (previousConfig?.gotrueUrl !== newConfig.gotrueUrl) {
    console.log(`${prefix} GoTrue URL changed:`)
    console.log(`${prefix}   From: ${previousConfig?.gotrueUrl ? sanitizeUrl(previousConfig.gotrueUrl) : 'none'}`)
    console.log(`${prefix}   To: ${newConfig.gotrueUrl ? sanitizeUrl(newConfig.gotrueUrl) : 'none'}`)
  }
  
  if (previousConfig?.supabaseUrl !== newConfig.supabaseUrl) {
    console.log(`${prefix} Supabase URL changed:`)
    console.log(`${prefix}   From: ${previousConfig?.supabaseUrl ? sanitizeUrl(previousConfig.supabaseUrl) : 'none'}`)
    console.log(`${prefix}   To: ${newConfig.supabaseUrl ? sanitizeUrl(newConfig.supabaseUrl) : 'none'}`)
  }
  
  if (previousConfig?.apiUrl !== newConfig.apiUrl) {
    console.log(`${prefix} API URL changed:`)
    console.log(`${prefix}   From: ${previousConfig?.apiUrl ? sanitizeUrl(previousConfig.apiUrl) : 'none'}`)
    console.log(`${prefix}   To: ${newConfig.apiUrl ? sanitizeUrl(newConfig.apiUrl) : 'none'}`)
  }
  
  if (metadata) {
    console.log(`${prefix} Metadata:`, metadata)
  }
  
  // Add to change history
  const changeLog: ConfigChangeLog = {
    timestamp: Date.now(),
    operation,
    previousSource: previousConfig?.source as ConfigSource,
    newSource: newConfig.source as ConfigSource,
    previousUrls: previousConfig ? {
      gotrueUrl: previousConfig.gotrueUrl,
      supabaseUrl: previousConfig.supabaseUrl,
      apiUrl: previousConfig.apiUrl,
    } : undefined,
    newUrls: {
      gotrueUrl: newConfig.gotrueUrl,
      supabaseUrl: newConfig.supabaseUrl,
      apiUrl: newConfig.apiUrl,
    },
    environment,
    metadata,
  }
  
  configChangeHistory.push(changeLog)
  
  // Keep history size manageable
  if (configChangeHistory.length > MAX_CHANGE_HISTORY) {
    configChangeHistory.shift()
  }
}

/**
 * Logs configuration error with detailed troubleshooting information
 */
export function logConfigurationError(
  component: string,
  error: ConfigError,
  context?: Record<string, unknown>
): void {
  const prefix = getLogPrefix(component, ConfigOperation.ERROR_HANDLING)
  
  // Log based on severity
  if (error.canFallback) {
    console.warn(`${prefix} ⚠️  Configuration warning: ${error.userMessage}`)
    console.warn(`${prefix} Technical details: ${error.message}`)
  } else {
    console.error(`${prefix} ❌ Configuration error: ${error.userMessage}`)
    console.error(`${prefix} Technical details: ${error.message}`)
  }
  
  // Log context if provided
  if (context) {
    console.warn(`${prefix} Context:`, context)
  }
  
  // Log troubleshooting suggestions
  if (error.suggestions.length > 0) {
    console.warn(`${prefix} Troubleshooting suggestions:`)
    error.suggestions.forEach((suggestion, index) => {
      console.warn(`${prefix}   ${index + 1}. ${suggestion}`)
    })
  }
  
  // Log documentation link if available
  if (error.docsUrl) {
    console.warn(`${prefix} Documentation: ${error.docsUrl}`)
  }
  
  // Log original error if available
  if (error.originalError) {
    console.error(`${prefix} Original error:`, error.originalError)
  }
  
  // Log fallback information
  if (error.canFallback) {
    console.warn(`${prefix} Application will continue using fallback configuration`)
    console.warn(`${prefix} Some features may not work correctly until this is resolved`)
  } else {
    console.error(`${prefix} This is a critical error that prevents normal operation`)
  }
}

/**
 * Logs configuration validation results
 */
export function logConfigurationValidation(
  component: string,
  isValid: boolean,
  errors: string[],
  warnings: string[],
  config?: Partial<RuntimeConfig>
): void {
  const prefix = getLogPrefix(component, ConfigOperation.VALIDATE)
  
  if (isValid && warnings.length === 0) {
    console.log(`${prefix} ✓ Configuration validation passed`)
  } else if (isValid) {
    console.warn(`${prefix} ⚠️  Configuration validation passed with warnings`)
  } else {
    console.error(`${prefix} ❌ Configuration validation failed`)
  }
  
  // Log configuration being validated (sanitized)
  if (config && shouldLogDebug()) {
    console.log(`${prefix} Validated configuration:`, sanitizeConfig(config))
  }
  
  // Log errors
  if (errors.length > 0) {
    console.error(`${prefix} Validation errors:`)
    errors.forEach((error, index) => {
      console.error(`${prefix}   ${index + 1}. ${error}`)
    })
  }
  
  // Log warnings
  if (warnings.length > 0) {
    console.warn(`${prefix} Validation warnings:`)
    warnings.forEach((warning, index) => {
      console.warn(`${prefix}   ${index + 1}. ${warning}`)
    })
  }
}

/**
 * Gets the configuration change history for debugging
 */
export function getConfigurationChangeHistory(): ConfigChangeLog[] {
  return [...configChangeHistory]
}

/**
 * Clears the configuration change history (for testing)
 */
export function clearConfigurationChangeHistory(): void {
  configChangeHistory.length = 0
}

/**
 * Logs a summary of the current configuration state
 */
export function logConfigurationSummary(
  component: string,
  config: RuntimeConfig,
  environment: Environment,
  additionalInfo?: Record<string, unknown>
): void {
  const prefix = getLogPrefix(component)
  
  console.log(`${prefix} === Configuration Summary ===`)
  console.log(`${prefix} Environment: ${environment.toUpperCase()}`)
  console.log(`${prefix} Source: ${config.source}`)
  console.log(`${prefix} Timestamp: ${new Date(config.timestamp).toISOString()}`)
  console.log(`${prefix} GoTrue URL: ${sanitizeUrl(config.gotrueUrl)}`)
  console.log(`${prefix} Supabase URL: ${sanitizeUrl(config.supabaseUrl)}`)
  console.log(`${prefix} API URL: ${sanitizeUrl(config.apiUrl)}`)
  console.log(`${prefix} Has Anon Key: ${!!config.anonKey}`)
  
  if (additionalInfo) {
    console.log(`${prefix} Additional Info:`, additionalInfo)
  }
  
  console.log(`${prefix} ================================`)
}

/**
 * Enables debug logging for configuration operations
 */
export function enableConfigDebugLogging(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('config-debug', 'true')
    console.log('[Configuration Logging] Debug logging enabled')
  }
}

/**
 * Disables debug logging for configuration operations
 */
export function disableConfigDebugLogging(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('config-debug')
    console.log('[Configuration Logging] Debug logging disabled')
  }
}

/**
 * Logs configuration fallback operations
 */
export function logConfigurationFallback(
  component: string,
  strategy: 'cached' | 'build-time' | 'emergency-defaults',
  originalError: ConfigError,
  urls: {
    gotrueUrl?: string
    supabaseUrl?: string
    apiUrl?: string
  },
  limitations: string[]
): void {
  const prefix = getLogPrefix(component, ConfigOperation.ERROR_HANDLING)
  
  console.warn(`${prefix} ⚠️  Configuration fallback activated`)
  console.warn(`${prefix} Strategy: ${strategy}`)
  console.warn(`${prefix} Original error: ${originalError.type} - ${originalError.message}`)
  
  // Log fallback URLs (sanitized)
  if (urls.gotrueUrl) {
    console.warn(`${prefix} Fallback GoTrue URL: ${sanitizeUrl(urls.gotrueUrl)}`)
  }
  if (urls.supabaseUrl) {
    console.warn(`${prefix} Fallback Supabase URL: ${sanitizeUrl(urls.supabaseUrl)}`)
  }
  if (urls.apiUrl) {
    console.warn(`${prefix} Fallback API URL: ${sanitizeUrl(urls.apiUrl)}`)
  }
  
  // Log limitations
  if (limitations.length > 0) {
    console.warn(`${prefix} Fallback limitations:`)
    limitations.forEach((limitation, index) => {
      console.warn(`${prefix}   ${index + 1}. ${limitation}`)
    })
  }
  
  // Log strategy-specific information
  switch (strategy) {
    case 'cached':
      console.warn(`${prefix} Using cached configuration from previous session`)
      console.warn(`${prefix} Configuration may be outdated`)
      break
    case 'build-time':
      console.warn(`${prefix} Using build-time configuration as fallback`)
      console.warn(`${prefix} Configuration cannot adapt to environment changes`)
      break
    case 'emergency-defaults':
      console.warn(`${prefix} Using emergency defaults as last resort`)
      console.warn(`${prefix} This will only work for local development`)
      break
  }
}

/**
 * Logs configuration recovery operations
 */
export function logConfigurationRecovery(
  component: string,
  recoveryMethod: 'cached' | 'build-time' | 'emergency-defaults' | 'retry' | 'refresh',
  originalError: ConfigError,
  urls: {
    gotrueUrl?: string
    supabaseUrl?: string
    apiUrl?: string
  },
  limitations?: string[]
): void {
  const prefix = getLogPrefix(component, ConfigOperation.ERROR_HANDLING)
  
  console.log(`${prefix} ✓ Configuration recovery successful`)
  console.log(`${prefix} Recovery method: ${recoveryMethod}`)
  console.log(`${prefix} Recovered from error: ${originalError.type} - ${originalError.message}`)
  
  // Log recovered URLs (sanitized)
  if (urls.gotrueUrl) {
    console.log(`${prefix} Recovered GoTrue URL: ${sanitizeUrl(urls.gotrueUrl)}`)
  }
  if (urls.supabaseUrl) {
    console.log(`${prefix} Recovered Supabase URL: ${sanitizeUrl(urls.supabaseUrl)}`)
  }
  if (urls.apiUrl) {
    console.log(`${prefix} Recovered API URL: ${sanitizeUrl(urls.apiUrl)}`)
  }
  
  // Log limitations if any
  if (limitations && limitations.length > 0) {
    console.warn(`${prefix} Recovery limitations:`)
    limitations.forEach((limitation, index) => {
      console.warn(`${prefix}   ${index + 1}. ${limitation}`)
    })
  }
  
  // Log recovery method specific information
  switch (recoveryMethod) {
    case 'cached':
      console.log(`${prefix} Successfully recovered using cached configuration`)
      break
    case 'build-time':
      console.log(`${prefix} Successfully recovered using build-time configuration`)
      break
    case 'emergency-defaults':
      console.log(`${prefix} Successfully recovered using emergency defaults`)
      break
    case 'retry':
      console.log(`${prefix} Successfully recovered after retry`)
      break
    case 'refresh':
      console.log(`${prefix} Successfully recovered after forced refresh`)
      break
  }
}