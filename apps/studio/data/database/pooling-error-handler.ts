import { toast } from 'sonner'

/**
 * Enhanced error handling for pooling configuration queries
 */

export interface PoolingErrorContext {
  operation: string
  projectRef?: string
  environment?: 'platform' | 'self-hosted'
  poolingService?: 'pgbouncer' | 'supavisor'
}

export class PoolingErrorHandler {
  /**
   * Handle query errors with appropriate user feedback
   */
  static handleQueryError(
    error: Error | unknown,
    context: PoolingErrorContext
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const { operation, environment, poolingService } = context
    
    console.error(`Pooling ${operation} error:`, error)
    
    // Determine if this is a recoverable error
    const isRecoverable = this.isRecoverableError(errorMessage)
    
    // Show appropriate toast message
    if (isRecoverable) {
      toast.error(
        `Temporary issue with ${poolingService || 'pooling service'}. Please try again.`,
        {
          description: this.getRecoveryGuidance(errorMessage, environment),
          duration: 5000
        }
      )
    } else {
      toast.error(
        `${poolingService || 'Pooling service'} configuration issue`,
        {
          description: this.getConfigurationGuidance(errorMessage, environment),
          duration: 8000
        }
      )
    }
  }

  /**
   * Handle mutation errors with detailed feedback
   */
  static handleMutationError(
    error: Error | unknown,
    context: PoolingErrorContext & { updates?: Record<string, any> }
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const { operation, environment, poolingService, updates } = context
    
    console.error(`Pooling ${operation} mutation error:`, error, { updates })
    
    // Parse API error response if available
    const apiError = this.parseApiError(error)
    
    if (apiError) {
      toast.error(apiError.message, {
        description: apiError.suggestions?.join(' ') || 'Please check your configuration and try again.',
        duration: 10000
      })
    } else {
      toast.error(
        `Failed to update ${poolingService || 'pooling'} configuration`,
        {
          description: this.getMutationGuidance(errorMessage, environment),
          duration: 8000
        }
      )
    }
  }

  /**
   * Determine if an error is recoverable (temporary)
   */
  private static isRecoverableError(errorMessage: string): boolean {
    const recoverablePatterns = [
      'network',
      'timeout',
      'temporarily unavailable',
      'service unavailable',
      'connection refused',
      'fetch',
      '502',
      '503',
      '504'
    ]
    
    return recoverablePatterns.some(pattern => 
      errorMessage.toLowerCase().includes(pattern)
    )
  }

  /**
   * Get recovery guidance for temporary errors
   */
  private static getRecoveryGuidance(
    errorMessage: string, 
    environment?: string
  ): string {
    if (environment === 'self-hosted') {
      if (errorMessage.includes('service unavailable') || errorMessage.includes('container')) {
        return 'Check if the Supavisor Docker container is running and healthy.'
      }
      if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        return 'Verify network connectivity and that ports are not blocked.'
      }
    }
    
    return 'This is usually a temporary issue. Wait a moment and try again.'
  }

  /**
   * Get configuration guidance for persistent errors
   */
  private static getConfigurationGuidance(
    errorMessage: string,
    environment?: string
  ): string {
    if (environment === 'self-hosted') {
      if (errorMessage.includes('environment variable') || errorMessage.includes('POOLER_')) {
        return 'Check your environment variables in the .env file and restart Docker containers.'
      }
      if (errorMessage.includes('invalid') || errorMessage.includes('validation')) {
        return 'Review your configuration values and ensure they meet the requirements.'
      }
    }
    
    return 'Please check the documentation or contact support if the issue persists.'
  }

  /**
   * Get mutation-specific guidance
   */
  private static getMutationGuidance(
    errorMessage: string,
    environment?: string
  ): string {
    if (environment === 'self-hosted') {
      return 'Ensure the Supavisor service is running and you have the necessary permissions to update configuration.'
    }
    
    return 'Verify your settings are valid and you have permission to make changes.'
  }

  /**
   * Parse structured API error response
   */
  private static parseApiError(error: unknown): {
    message: string
    type?: string
    suggestions?: string[]
  } | null {
    try {
      // Handle fetch response errors
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as any).response
        if (response?.data?.error) {
          return {
            message: response.data.error.message,
            type: response.data.error.type,
            suggestions: response.data.error.suggestions
          }
        }
      }
      
      // Handle direct error objects
      if (error && typeof error === 'object' && 'message' in error) {
        const errorObj = error as any
        if (errorObj.type && errorObj.suggestions) {
          return {
            message: errorObj.message,
            type: errorObj.type,
            suggestions: errorObj.suggestions
          }
        }
      }
      
      return null
    } catch (parseError) {
      console.warn('Failed to parse API error:', parseError)
      return null
    }
  }

  /**
   * Create retry function with exponential backoff
   */
  static createRetryFunction(
    originalFunction: () => Promise<any>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): () => Promise<any> {
    return async () => {
      let lastError: Error | unknown
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await originalFunction()
        } catch (error) {
          lastError = error
          
          // Don't retry on the last attempt
          if (attempt === maxRetries - 1) {
            throw error
          }
          
          // Don't retry non-recoverable errors
          const errorMessage = error instanceof Error ? error.message : String(error)
          if (!this.isRecoverableError(errorMessage)) {
            throw error
          }
          
          // Wait before retrying with exponential backoff
          const delay = baseDelay * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      
      throw lastError
    }
  }

  /**
   * Show success feedback for configuration updates
   */
  static showUpdateSuccess(
    serviceName: string,
    updatedValues?: Record<string, any>
  ): void {
    const description = updatedValues 
      ? `Updated: ${Object.entries(updatedValues)
          .map(([key, value]) => `${this.formatSettingName(key)}: ${value}`)
          .join(', ')}`
      : 'Your changes have been applied successfully.'
    
    toast.success(`${serviceName} configuration updated`, {
      description,
      duration: 5000
    })
  }

  /**
   * Format setting names for display
   */
  private static formatSettingName(key: string): string {
    switch (key) {
      case 'poolSize':
        return 'Pool Size'
      case 'maxClientConnections':
        return 'Max Client Connections'
      case 'poolMode':
        return 'Pool Mode'
      default:
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    }
  }
}