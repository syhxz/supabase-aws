/**
 * GoTrue Error Classification System
 * 
 * Provides comprehensive error classification for GoTrue service failures
 * with detailed error context collection and status code specific handling.
 * 
 * Requirements: 2.1, 2.2
 */

import type { Environment } from 'common/environment-detection'

/**
 * Comprehensive error types for GoTrue service failures
 */
export enum GoTrueErrorType {
  // Network-related errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  DNS_RESOLUTION = 'DNS_RESOLUTION',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  
  // Authentication and authorization errors
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  API_KEY_ERROR = 'API_KEY_ERROR',
  
  // Service-related errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SERVICE_ERROR = 'SERVICE_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Configuration errors
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  URL_INVALID = 'URL_INVALID',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  
  // Response format errors
  RESPONSE_FORMAT_ERROR = 'RESPONSE_FORMAT_ERROR',
  MALFORMED_RESPONSE = 'MALFORMED_RESPONSE',
  
  // Unknown/unexpected errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Error severity levels for prioritizing error handling
 */
export enum ErrorSeverity {
  LOW = 'LOW',           // Minor issues that don't prevent operation
  MEDIUM = 'MEDIUM',     // Issues that may affect functionality
  HIGH = 'HIGH',         // Critical issues that prevent normal operation
  CRITICAL = 'CRITICAL'  // Severe issues that require immediate attention
}

/**
 * Error context information for debugging
 */
export interface ErrorContext {
  /** The original error object */
  originalError?: Error | unknown
  /** HTTP status code if available */
  statusCode?: number
  /** Response headers if available */
  responseHeaders?: Record<string, string>
  /** Request URL that failed */
  url: string
  /** HTTP method used */
  method?: string
  /** Request headers sent */
  requestHeaders?: Record<string, string>
  /** Response time in milliseconds */
  responseTime?: number
  /** Environment where error occurred */
  environment?: Environment
  /** Timestamp when error occurred */
  timestamp: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Classified error information
 */
export interface ClassifiedError {
  /** Error type classification */
  type: GoTrueErrorType
  /** Error severity level */
  severity: ErrorSeverity
  /** Human-readable error message */
  message: string
  /** Technical error details */
  technicalDetails: string
  /** Whether this error is retryable */
  retryable: boolean
  /** Suggested retry delay in milliseconds */
  retryDelay?: number
  /** Maximum recommended retries */
  maxRetries?: number
  /** Error context information */
  context: ErrorContext
  /** Troubleshooting steps */
  troubleshootingSteps: string[]
  /** Environment-specific guidance */
  environmentGuidance: string[]
}

/**
 * Status code to error type mapping
 */
const STATUS_CODE_ERROR_MAP: Record<number, GoTrueErrorType> = {
  // 4xx Client Errors
  400: GoTrueErrorType.CONFIGURATION_ERROR,
  401: GoTrueErrorType.AUTHENTICATION_ERROR,
  403: GoTrueErrorType.AUTHORIZATION_ERROR,
  404: GoTrueErrorType.ENDPOINT_NOT_FOUND,
  405: GoTrueErrorType.CONFIGURATION_ERROR,
  408: GoTrueErrorType.TIMEOUT,
  409: GoTrueErrorType.SERVICE_ERROR,
  422: GoTrueErrorType.RESPONSE_FORMAT_ERROR,
  429: GoTrueErrorType.RATE_LIMITED,
  
  // 5xx Server Errors
  500: GoTrueErrorType.SERVICE_ERROR,
  501: GoTrueErrorType.SERVICE_ERROR,
  502: GoTrueErrorType.SERVICE_UNAVAILABLE,
  503: GoTrueErrorType.SERVICE_UNAVAILABLE,
  504: GoTrueErrorType.TIMEOUT,
  505: GoTrueErrorType.SERVICE_ERROR,
}

/**
 * Error type to severity mapping
 */
const ERROR_SEVERITY_MAP: Record<GoTrueErrorType, ErrorSeverity> = {
  [GoTrueErrorType.NETWORK_ERROR]: ErrorSeverity.HIGH,
  [GoTrueErrorType.TIMEOUT]: ErrorSeverity.MEDIUM,
  [GoTrueErrorType.DNS_RESOLUTION]: ErrorSeverity.HIGH,
  [GoTrueErrorType.CONNECTION_REFUSED]: ErrorSeverity.HIGH,
  [GoTrueErrorType.AUTHENTICATION_ERROR]: ErrorSeverity.HIGH,
  [GoTrueErrorType.AUTHORIZATION_ERROR]: ErrorSeverity.HIGH,
  [GoTrueErrorType.API_KEY_ERROR]: ErrorSeverity.CRITICAL,
  [GoTrueErrorType.SERVICE_UNAVAILABLE]: ErrorSeverity.HIGH,
  [GoTrueErrorType.SERVICE_ERROR]: ErrorSeverity.MEDIUM,
  [GoTrueErrorType.RATE_LIMITED]: ErrorSeverity.LOW,
  [GoTrueErrorType.CONFIGURATION_ERROR]: ErrorSeverity.CRITICAL,
  [GoTrueErrorType.URL_INVALID]: ErrorSeverity.CRITICAL,
  [GoTrueErrorType.ENDPOINT_NOT_FOUND]: ErrorSeverity.HIGH,
  [GoTrueErrorType.RESPONSE_FORMAT_ERROR]: ErrorSeverity.MEDIUM,
  [GoTrueErrorType.MALFORMED_RESPONSE]: ErrorSeverity.MEDIUM,
  [GoTrueErrorType.UNKNOWN_ERROR]: ErrorSeverity.MEDIUM,
}

/**
 * Error type to retry configuration mapping
 */
const ERROR_RETRY_CONFIG: Record<GoTrueErrorType, { retryable: boolean; maxRetries?: number; retryDelay?: number }> = {
  [GoTrueErrorType.NETWORK_ERROR]: { retryable: true, maxRetries: 3, retryDelay: 1000 },
  [GoTrueErrorType.TIMEOUT]: { retryable: true, maxRetries: 3, retryDelay: 2000 },
  [GoTrueErrorType.DNS_RESOLUTION]: { retryable: true, maxRetries: 2, retryDelay: 5000 },
  [GoTrueErrorType.CONNECTION_REFUSED]: { retryable: true, maxRetries: 3, retryDelay: 1000 },
  [GoTrueErrorType.AUTHENTICATION_ERROR]: { retryable: false },
  [GoTrueErrorType.AUTHORIZATION_ERROR]: { retryable: false },
  [GoTrueErrorType.API_KEY_ERROR]: { retryable: false },
  [GoTrueErrorType.SERVICE_UNAVAILABLE]: { retryable: true, maxRetries: 4, retryDelay: 2000 },
  [GoTrueErrorType.SERVICE_ERROR]: { retryable: true, maxRetries: 2, retryDelay: 1000 },
  [GoTrueErrorType.RATE_LIMITED]: { retryable: true, maxRetries: 3, retryDelay: 5000 },
  [GoTrueErrorType.CONFIGURATION_ERROR]: { retryable: false },
  [GoTrueErrorType.URL_INVALID]: { retryable: false },
  [GoTrueErrorType.ENDPOINT_NOT_FOUND]: { retryable: false },
  [GoTrueErrorType.RESPONSE_FORMAT_ERROR]: { retryable: true, maxRetries: 1, retryDelay: 1000 },
  [GoTrueErrorType.MALFORMED_RESPONSE]: { retryable: true, maxRetries: 1, retryDelay: 1000 },
  [GoTrueErrorType.UNKNOWN_ERROR]: { retryable: true, maxRetries: 2, retryDelay: 1000 },
}

/**
 * Classifies a GoTrue error based on various factors
 */
export function classifyGoTrueError(
  error: Error | unknown,
  context: Partial<ErrorContext>
): ClassifiedError {
  const fullContext: ErrorContext = {
    originalError: error,
    timestamp: Date.now(),
    url: context.url || 'unknown',
    ...context,
  }

  // Determine error type
  const errorType = determineErrorType(error, fullContext)
  
  // Get severity and retry configuration
  const severity = ERROR_SEVERITY_MAP[errorType] || ErrorSeverity.MEDIUM
  const retryConfig = ERROR_RETRY_CONFIG[errorType] || { retryable: false }
  
  // Generate messages and guidance
  const { message, technicalDetails } = generateErrorMessages(errorType, fullContext)
  const troubleshootingSteps = generateTroubleshootingSteps(errorType, fullContext)
  const environmentGuidance = generateEnvironmentGuidance(errorType, fullContext)

  return {
    type: errorType,
    severity,
    message,
    technicalDetails,
    retryable: retryConfig.retryable,
    retryDelay: retryConfig.retryDelay,
    maxRetries: retryConfig.maxRetries,
    context: fullContext,
    troubleshootingSteps,
    environmentGuidance,
  }
}

/**
 * Determines the error type based on error details and context
 */
function determineErrorType(error: Error | unknown, context: ErrorContext): GoTrueErrorType {
  // Check status code first if available
  if (context.statusCode) {
    const statusCodeType = STATUS_CODE_ERROR_MAP[context.statusCode]
    if (statusCodeType) {
      return statusCodeType
    }
  }

  // Check error message patterns
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  
  // Network-related errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch failed')) {
    return GoTrueErrorType.NETWORK_ERROR
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
    return GoTrueErrorType.TIMEOUT
  }
  
  if (errorMessage.includes('dns') || errorMessage.includes('name resolution')) {
    return GoTrueErrorType.DNS_RESOLUTION
  }
  
  if (errorMessage.includes('connection refused') || errorMessage.includes('econnrefused')) {
    return GoTrueErrorType.CONNECTION_REFUSED
  }
  
  // Configuration errors
  if (errorMessage.includes('not configured') || errorMessage.includes('invalid url')) {
    return GoTrueErrorType.CONFIGURATION_ERROR
  }
  
  if (errorMessage.includes('malformed') || errorMessage.includes('invalid json')) {
    return GoTrueErrorType.MALFORMED_RESPONSE
  }
  
  // Authentication errors
  if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
    return GoTrueErrorType.AUTHENTICATION_ERROR
  }
  
  if (errorMessage.includes('forbidden') || errorMessage.includes('access denied')) {
    return GoTrueErrorType.AUTHORIZATION_ERROR
  }
  
  // Check error name/type
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return GoTrueErrorType.TIMEOUT
    }
    
    if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
      return GoTrueErrorType.NETWORK_ERROR
    }
  }
  
  // Default to unknown error
  return GoTrueErrorType.UNKNOWN_ERROR
}

/**
 * Generates human-readable and technical error messages
 */
function generateErrorMessages(
  errorType: GoTrueErrorType,
  context: ErrorContext
): { message: string; technicalDetails: string } {
  const baseMessages: Record<GoTrueErrorType, { message: string; technicalDetails: string }> = {
    [GoTrueErrorType.NETWORK_ERROR]: {
      message: 'Cannot connect to authentication service. Please check your network connection.',
      technicalDetails: `Network error connecting to ${context.url}`,
    },
    [GoTrueErrorType.TIMEOUT]: {
      message: 'Authentication service is taking too long to respond. Please try again.',
      technicalDetails: `Request timeout after ${context.responseTime || 'unknown'}ms to ${context.url}`,
    },
    [GoTrueErrorType.DNS_RESOLUTION]: {
      message: 'Cannot resolve authentication service address. Please check your network settings.',
      technicalDetails: `DNS resolution failed for ${context.url}`,
    },
    [GoTrueErrorType.CONNECTION_REFUSED]: {
      message: 'Authentication service is not accepting connections. Please try again later.',
      technicalDetails: `Connection refused to ${context.url}`,
    },
    [GoTrueErrorType.AUTHENTICATION_ERROR]: {
      message: 'Authentication failed. Please check your credentials or contact your administrator.',
      technicalDetails: `Authentication error (HTTP ${context.statusCode || 'unknown'}) at ${context.url}`,
    },
    [GoTrueErrorType.AUTHORIZATION_ERROR]: {
      message: 'Access denied to authentication service. Please contact your administrator.',
      technicalDetails: `Authorization error (HTTP ${context.statusCode || 'unknown'}) at ${context.url}`,
    },
    [GoTrueErrorType.API_KEY_ERROR]: {
      message: 'Invalid API key configuration. Please contact your administrator.',
      technicalDetails: `API key error at ${context.url}`,
    },
    [GoTrueErrorType.SERVICE_UNAVAILABLE]: {
      message: 'Authentication service is temporarily unavailable. Please try again later.',
      technicalDetails: `Service unavailable (HTTP ${context.statusCode || 'unknown'}) at ${context.url}`,
    },
    [GoTrueErrorType.SERVICE_ERROR]: {
      message: 'Authentication service encountered an error. Please try again or contact your administrator.',
      technicalDetails: `Service error (HTTP ${context.statusCode || 'unknown'}) at ${context.url}`,
    },
    [GoTrueErrorType.RATE_LIMITED]: {
      message: 'Too many requests to authentication service. Please wait a moment and try again.',
      technicalDetails: `Rate limited (HTTP ${context.statusCode || 'unknown'}) at ${context.url}`,
    },
    [GoTrueErrorType.CONFIGURATION_ERROR]: {
      message: 'Authentication service is not properly configured. Please contact your administrator.',
      technicalDetails: `Configuration error at ${context.url}`,
    },
    [GoTrueErrorType.URL_INVALID]: {
      message: 'Invalid authentication service URL. Please contact your administrator.',
      technicalDetails: `Invalid URL: ${context.url}`,
    },
    [GoTrueErrorType.ENDPOINT_NOT_FOUND]: {
      message: 'Authentication service endpoint not found. Please contact your administrator.',
      technicalDetails: `Endpoint not found (HTTP 404) at ${context.url}`,
    },
    [GoTrueErrorType.RESPONSE_FORMAT_ERROR]: {
      message: 'Authentication service returned an unexpected response format.',
      technicalDetails: `Response format error (HTTP ${context.statusCode || 'unknown'}) at ${context.url}`,
    },
    [GoTrueErrorType.MALFORMED_RESPONSE]: {
      message: 'Authentication service returned malformed data.',
      technicalDetails: `Malformed response from ${context.url}`,
    },
    [GoTrueErrorType.UNKNOWN_ERROR]: {
      message: 'An unexpected error occurred with the authentication service. Please try again.',
      technicalDetails: `Unknown error at ${context.url}: ${context.originalError}`,
    },
  }

  return baseMessages[errorType] || baseMessages[GoTrueErrorType.UNKNOWN_ERROR]
}

/**
 * Generates troubleshooting steps for the error type
 */
function generateTroubleshootingSteps(
  errorType: GoTrueErrorType,
  context: ErrorContext
): string[] {
  const baseSteps: Record<GoTrueErrorType, string[]> = {
    [GoTrueErrorType.NETWORK_ERROR]: [
      'Check your internet connection',
      'Verify the authentication service URL is correct',
      'Check for firewall or proxy blocking the connection',
      'Try refreshing the page',
    ],
    [GoTrueErrorType.TIMEOUT]: [
      'Wait a moment and try again',
      'Check your internet connection speed',
      'Verify the authentication service is running',
      'Contact your administrator if the problem persists',
    ],
    [GoTrueErrorType.DNS_RESOLUTION]: [
      'Check your DNS settings',
      'Try using a different DNS server (e.g., 8.8.8.8)',
      'Verify the domain name is correct',
      'Contact your network administrator',
    ],
    [GoTrueErrorType.CONNECTION_REFUSED]: [
      'Verify the authentication service is running',
      'Check if the service port is accessible',
      'Verify firewall settings allow the connection',
      'Contact your administrator',
    ],
    [GoTrueErrorType.AUTHENTICATION_ERROR]: [
      'Verify your credentials are correct',
      'Check if your account is active',
      'Clear browser cookies and try again',
      'Contact your administrator if credentials are correct',
    ],
    [GoTrueErrorType.AUTHORIZATION_ERROR]: [
      'Verify you have permission to access this service',
      'Check if your account has the required roles',
      'Contact your administrator for access',
    ],
    [GoTrueErrorType.API_KEY_ERROR]: [
      'Verify the API key is configured correctly',
      'Check if the API key has expired',
      'Ensure the API key has the required permissions',
      'Contact your administrator to verify API key configuration',
    ],
    [GoTrueErrorType.SERVICE_UNAVAILABLE]: [
      'Wait a few minutes and try again',
      'Check the service status page if available',
      'Verify the service is not under maintenance',
      'Contact your administrator if the problem persists',
    ],
    [GoTrueErrorType.SERVICE_ERROR]: [
      'Try refreshing the page',
      'Wait a moment and try again',
      'Check the service logs if you have access',
      'Contact your administrator with error details',
    ],
    [GoTrueErrorType.RATE_LIMITED]: [
      'Wait a few minutes before trying again',
      'Reduce the frequency of requests',
      'Contact your administrator if rate limits are too restrictive',
    ],
    [GoTrueErrorType.CONFIGURATION_ERROR]: [
      'Verify environment variables are set correctly',
      'Check the service configuration files',
      'Ensure all required settings are present',
      'Contact your administrator for configuration help',
    ],
    [GoTrueErrorType.URL_INVALID]: [
      'Verify the URL format is correct',
      'Check for typos in the URL',
      'Ensure the protocol (http/https) is correct',
      'Contact your administrator to verify the correct URL',
    ],
    [GoTrueErrorType.ENDPOINT_NOT_FOUND]: [
      'Verify the endpoint URL is correct',
      'Check if the service version supports this endpoint',
      'Ensure the service is properly deployed',
      'Contact your administrator for endpoint verification',
    ],
    [GoTrueErrorType.RESPONSE_FORMAT_ERROR]: [
      'Try refreshing the page',
      'Check if the service version is compatible',
      'Verify the request format is correct',
      'Contact your administrator if the problem persists',
    ],
    [GoTrueErrorType.MALFORMED_RESPONSE]: [
      'Try the request again',
      'Check if the service is functioning properly',
      'Verify network stability',
      'Contact your administrator with error details',
    ],
    [GoTrueErrorType.UNKNOWN_ERROR]: [
      'Try refreshing the page',
      'Check browser console for additional details',
      'Try again in a few minutes',
      'Contact your administrator with full error details',
    ],
  }

  return baseSteps[errorType] || baseSteps[GoTrueErrorType.UNKNOWN_ERROR]
}

/**
 * Generates environment-specific guidance for the error
 */
function generateEnvironmentGuidance(
  errorType: GoTrueErrorType,
  context: ErrorContext
): string[] {
  const environment = context.environment || detectEnvironmentFromUrl(context.url)
  const guidance: string[] = []

  if (environment === 'development') {
    guidance.push('Development Environment:')
    
    switch (errorType) {
      case GoTrueErrorType.NETWORK_ERROR:
      case GoTrueErrorType.CONNECTION_REFUSED:
        guidance.push('- Ensure docker-compose services are running: docker-compose ps')
        guidance.push('- Check if GoTrue port (54321) is accessible')
        guidance.push('- Verify Kong Gateway is running on port 8000')
        guidance.push('- Run: docker-compose logs gotrue')
        break
      case GoTrueErrorType.CONFIGURATION_ERROR:
        guidance.push('- Check .env file for correct GOTRUE_* variables')
        guidance.push('- Verify docker-compose.yml configuration')
        guidance.push('- Ensure all required environment variables are set')
        break
      case GoTrueErrorType.AUTHENTICATION_ERROR:
        guidance.push('- Check if Kong Gateway is properly configured')
        guidance.push('- Verify API key configuration in .env')
        guidance.push('- Check Kong routing rules for /auth endpoints')
        break
    }
  } else if (environment === 'production') {
    guidance.push('Production Environment:')
    
    switch (errorType) {
      case GoTrueErrorType.NETWORK_ERROR:
      case GoTrueErrorType.CONNECTION_REFUSED:
        guidance.push('- Verify GoTrue service is deployed and running')
        guidance.push('- Check load balancer and firewall settings')
        guidance.push('- Verify DNS resolution for the domain')
        guidance.push('- Check SSL/TLS certificate validity')
        break
      case GoTrueErrorType.CONFIGURATION_ERROR:
        guidance.push('- Verify production environment variables')
        guidance.push('- Check Kubernetes/Docker configuration')
        guidance.push('- Ensure secrets are properly mounted')
        break
      case GoTrueErrorType.AUTHENTICATION_ERROR:
        guidance.push('- Verify API gateway configuration')
        guidance.push('- Check authentication service deployment')
        guidance.push('- Verify SSL termination settings')
        break
    }
  } else if (environment === 'staging') {
    guidance.push('Staging Environment:')
    guidance.push('- Verify staging services are deployed')
    guidance.push('- Check staging environment configuration')
    guidance.push('- Ensure staging database connectivity')
  }

  return guidance
}

/**
 * Detects environment from URL patterns
 */
function detectEnvironmentFromUrl(url: string): Environment {
  const lowerUrl = url.toLowerCase()
  
  if (lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1')) {
    return 'development'
  }
  
  if (lowerUrl.includes('staging') || lowerUrl.includes('stg') || lowerUrl.includes('dev.')) {
    return 'staging'
  }
  
  return 'production'
}

/**
 * Checks if an error type is retryable
 */
export function isRetryableError(errorType: GoTrueErrorType): boolean {
  return ERROR_RETRY_CONFIG[errorType]?.retryable || false
}

/**
 * Gets retry configuration for an error type
 */
export function getRetryConfig(errorType: GoTrueErrorType): { maxRetries: number; retryDelay: number } {
  const config = ERROR_RETRY_CONFIG[errorType]
  return {
    maxRetries: config?.maxRetries || 0,
    retryDelay: config?.retryDelay || 1000,
  }
}

/**
 * Gets error severity level
 */
export function getErrorSeverity(errorType: GoTrueErrorType): ErrorSeverity {
  return ERROR_SEVERITY_MAP[errorType] || ErrorSeverity.MEDIUM
}