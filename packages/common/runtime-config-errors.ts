/**
 * Runtime Configuration Error Handling
 * 
 * Provides comprehensive error handling for runtime configuration with:
 * - User-friendly error messages
 * - Troubleshooting suggestions
 * - Error categorization
 * - Fallback strategies
 */

/**
 * Configuration error types
 */
export enum ConfigErrorType {
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  MISSING_ENV_VARS = 'MISSING_ENV_VARS',
  INVALID_URL = 'INVALID_URL',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Configuration error with user-friendly messaging
 */
export class ConfigError extends Error {
  public readonly type: ConfigErrorType
  public readonly userMessage: string
  public readonly suggestions: string[]
  public readonly docsUrl?: string
  public readonly canFallback: boolean
  public readonly originalError?: Error

  constructor(options: {
    type: ConfigErrorType
    message: string
    userMessage: string
    suggestions: string[]
    docsUrl?: string
    canFallback?: boolean
    originalError?: Error
  }) {
    super(options.message)
    this.name = 'ConfigError'
    this.type = options.type
    this.userMessage = options.userMessage
    this.suggestions = options.suggestions
    this.docsUrl = options.docsUrl
    this.canFallback = options.canFallback ?? true
    this.originalError = options.originalError
  }

  /**
   * Get a formatted error message for display
   */
  getDisplayMessage(): string {
    let message = this.userMessage

    if (this.suggestions.length > 0) {
      message += '\n\nSuggestions:\n'
      message += this.suggestions.map((s) => `  • ${s}`).join('\n')
    }

    if (this.docsUrl) {
      message += `\n\nFor more information, see: ${this.docsUrl}`
    }

    return message
  }

  /**
   * Get a JSON representation of the error
   */
  toJSON() {
    return {
      type: this.type,
      message: this.message,
      userMessage: this.userMessage,
      suggestions: this.suggestions,
      docsUrl: this.docsUrl,
      canFallback: this.canFallback,
      originalError: this.originalError?.message,
    }
  }
}

/**
 * Creates a network timeout error
 */
export function createNetworkTimeoutError(timeoutMs: number, url?: string): ConfigError {
  const suggestions = [
    'Check your network connection',
    'Verify the server is running and accessible',
    'Try refreshing the page',
  ]
  
  // Add URL-specific troubleshooting if URL is provided
  if (url) {
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      suggestions.push('Ensure local development services are running (docker-compose up)')
      suggestions.push('Check if ports 8000 (Kong) and 54321 (GoTrue) are accessible')
      suggestions.push('Verify no other services are using these ports')
    } else {
      suggestions.push('Verify the server URL is correct and accessible from your network')
      suggestions.push('Check if a firewall or proxy is blocking the connection')
      suggestions.push('Verify DNS resolution for the domain')
    }
  }
  
  suggestions.push('If the problem persists, the application will use build-time defaults')
  
  return new ConfigError({
    type: ConfigErrorType.NETWORK_TIMEOUT,
    message: `Request timeout after ${timeoutMs}ms${url ? ` to ${url}` : ''}`,
    userMessage: 'Configuration request timed out',
    suggestions,
    canFallback: true,
  })
}

/**
 * Creates a network error
 */
export function createNetworkError(originalError: Error, url?: string): ConfigError {
  const suggestions = [
    'Check your network connection',
    'Verify the server is running',
  ]
  
  // Add URL-specific troubleshooting if URL is provided
  if (url) {
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      suggestions.push('Ensure local Supabase services are running')
      suggestions.push('Run: docker-compose ps to check service status')
      suggestions.push('Run: docker-compose up -d to start services')
      suggestions.push('Check local firewall settings')
    } else {
      suggestions.push('Verify the server URL is correct and reachable')
      suggestions.push('Check network connectivity to the server')
      suggestions.push('Verify DNS resolution works for the domain')
      suggestions.push('Check if a corporate firewall or proxy is blocking access')
      
      // HTTPS-specific suggestions
      if (url.startsWith('https://')) {
        suggestions.push('Verify SSL/TLS certificates are valid')
        suggestions.push('Check if certificate validation is failing')
      }
    }
  } else {
    suggestions.push('Check if a firewall is blocking the connection')
  }
  
  suggestions.push('The application will use build-time configuration as fallback')
  
  return new ConfigError({
    type: ConfigErrorType.NETWORK_ERROR,
    message: originalError.message,
    userMessage: 'Failed to connect to configuration server',
    suggestions,
    canFallback: true,
    originalError,
  })
}

/**
 * Creates an invalid response error
 */
export function createInvalidResponseError(details: string): ConfigError {
  return new ConfigError({
    type: ConfigErrorType.INVALID_RESPONSE,
    message: `Invalid configuration response: ${details}`,
    userMessage: 'Received invalid configuration from server',
    suggestions: [
      'Verify server environment variables are properly set',
      'Check server logs for configuration errors',
      'Ensure all required fields are present in the response',
      'The application will use build-time configuration as fallback',
    ],
    canFallback: true,
  })
}

/**
 * Creates a missing environment variables error
 */
export function createMissingEnvVarsError(missingVars: string[]): ConfigError {
  return new ConfigError({
    type: ConfigErrorType.MISSING_ENV_VARS,
    message: `Missing required environment variables: ${missingVars.join(', ')}`,
    userMessage: 'Server configuration is incomplete',
    suggestions: [
      'Set the following environment variables on the server:',
      ...missingVars.map((v) => `  - ${v}`),
      'Restart the server after setting environment variables',
      'For development, localhost defaults will be used',
      'For production, ensure SUPABASE_PUBLIC_URL or API_EXTERNAL_URL is set',
    ],
    docsUrl: '/docs/configuration',
    canFallback: true,
  })
}

/**
 * Creates an invalid URL error
 */
export function createInvalidUrlError(url: string, field: string): ConfigError {
  return new ConfigError({
    type: ConfigErrorType.INVALID_URL,
    message: `Invalid URL in ${field}: ${url}`,
    userMessage: `Configuration contains invalid URL: ${field}`,
    suggestions: [
      `Verify ${field} is a valid http or https URL`,
      'Check for typos in the URL',
      'Ensure the URL includes the protocol (http:// or https://)',
      'Example: https://your-project.supabase.co',
    ],
    canFallback: true,
  })
}

/**
 * Creates a server error
 */
export function createServerError(statusCode: number, message: string, url?: string): ConfigError {
  const suggestions = []
  
  // Status-specific troubleshooting
  if (statusCode >= 500) {
    suggestions.push('Server error detected - check server logs for detailed information')
    suggestions.push('Verify the server is running and has sufficient resources')
    suggestions.push('Check server environment variables are properly set')
    suggestions.push('Ensure database connections are working (if applicable)')
    suggestions.push('Verify server has access to required external services')
  } else if (statusCode === 404) {
    suggestions.push('Configuration API endpoint not found')
    suggestions.push('Verify the /api/runtime-config endpoint exists')
    suggestions.push('Check if the correct API version is being used')
    suggestions.push('Ensure the server routing is configured correctly')
  } else if (statusCode === 403) {
    suggestions.push('Access forbidden - check authentication and authorization')
    suggestions.push('Verify API keys and tokens are correctly configured')
    suggestions.push('Check server access control settings')
  } else if (statusCode === 401) {
    suggestions.push('Authentication required or failed')
    suggestions.push('Verify API keys are correctly set')
    suggestions.push('Check authentication headers and tokens')
  } else if (statusCode >= 400) {
    suggestions.push('Client error detected - check request format')
    suggestions.push('Verify request headers and parameters')
    suggestions.push('Check API documentation for correct request format')
  }
  
  // Environment-specific suggestions
  if (url) {
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      suggestions.push('For local development: check docker-compose logs for errors')
      suggestions.push('Ensure all required environment variables are set in .env files')
    } else {
      suggestions.push('For production: check server deployment and configuration')
      suggestions.push('Verify production environment variables are properly set')
    }
  }
  
  suggestions.push('The application will use build-time configuration as fallback')
  
  return new ConfigError({
    type: ConfigErrorType.SERVER_ERROR,
    message: `Server error (${statusCode}): ${message}`,
    userMessage: 'Configuration server returned an error',
    suggestions,
    canFallback: true,
  })
}

/**
 * Creates an unknown error
 */
export function createUnknownError(originalError: Error): ConfigError {
  return new ConfigError({
    type: ConfigErrorType.UNKNOWN,
    message: originalError.message,
    userMessage: 'An unexpected error occurred while loading configuration',
    suggestions: [
      'Try refreshing the page',
      'Check browser console for detailed error information',
      'If the problem persists, contact support',
      'The application will use build-time configuration as fallback',
    ],
    canFallback: true,
    originalError,
  })
}

/**
 * Analyzes an error and converts it to a ConfigError
 */
export function analyzeConfigError(error: any): ConfigError {
  // Already a ConfigError
  if (error instanceof ConfigError) {
    return error
  }

  // Convert Error to ConfigError
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Network timeout
    if (message.includes('timeout')) {
      const match = message.match(/(\d+)ms/)
      const timeoutMs = match ? parseInt(match[1], 10) : 3000
      return createNetworkTimeoutError(timeoutMs)
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch failed') ||
      message.includes('failed to fetch') ||
      error.name === 'NetworkError' ||
      error.name === 'TypeError'
    ) {
      return createNetworkError(error)
    }

    // Invalid response
    if (message.includes('invalid') || message.includes('missing required fields')) {
      return createInvalidResponseError(error.message)
    }

    // Server errors
    if (message.includes('http')) {
      const match = message.match(/http (\d+)/)
      const statusCode = match ? parseInt(match[1], 10) : 500
      return createServerError(statusCode, error.message)
    }

    // Unknown error
    return createUnknownError(error)
  }

  // Non-Error object
  return createUnknownError(new Error(String(error)))
}

/**
 * Logs a configuration error with appropriate level
 */
export function logConfigError(error: ConfigError, context?: string): void {
  const prefix = context ? `[${context}]` : '[Config Error]'

  // Log based on severity
  if (error.canFallback) {
    console.warn(`${prefix} ${error.userMessage}`)
    console.warn(`${prefix} Technical details:`, error.message)
    if (error.suggestions.length > 0) {
      console.warn(`${prefix} Suggestions:`)
      error.suggestions.forEach((s) => console.warn(`  - ${s}`))
    }
  } else {
    console.error(`${prefix} ${error.userMessage}`)
    console.error(`${prefix} Technical details:`, error.message)
    if (error.suggestions.length > 0) {
      console.error(`${prefix} Suggestions:`)
      error.suggestions.forEach((s) => console.error(`  - ${s}`))
    }
  }

  // Log original error if available
  if (error.originalError) {
    console.error(`${prefix} Original error:`, error.originalError)
  }
}

/**
 * Formats error for user display
 */
export function formatErrorForUser(error: ConfigError): {
  title: string
  message: string
  suggestions: string[]
  severity: 'error' | 'warning'
} {
  return {
    title: error.canFallback ? 'Configuration Warning' : 'Configuration Error',
    message: error.userMessage,
    suggestions: error.suggestions,
    severity: error.canFallback ? 'warning' : 'error',
  }
}
