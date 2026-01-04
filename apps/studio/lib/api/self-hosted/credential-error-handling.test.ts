/**
 * Tests for comprehensive error handling system
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { 
  CredentialError, 
  CredentialErrorType, 
  ErrorSeverity,
  RetryManager,
  CircuitBreaker,
  CircuitBreakerState,
  GracefulDegradationManager,
  CredentialErrorHandler,
  getCredentialErrorHandler,
  resetCredentialErrorHandler
} from './credential-error-handling'

describe('CredentialError', () => {
  test('should create validation error correctly', () => {
    const error = CredentialError.validation('Invalid username', { field: 'username' })
    
    expect(error.type).toBe(CredentialErrorType.VALIDATION_ERROR)
    expect(error.severity).toBe(ErrorSeverity.MEDIUM)
    expect(error.retryable).toBe(false)
    expect(error.context.field).toBe('username')
    expect(error.message).toBe('Invalid username')
  })

  test('should create network error correctly', () => {
    const originalError = new Error('Connection refused')
    const error = CredentialError.network('Network failure', { host: 'localhost' }, originalError)
    
    expect(error.type).toBe(CredentialErrorType.NETWORK_ERROR)
    expect(error.severity).toBe(ErrorSeverity.HIGH)
    expect(error.retryable).toBe(true)
    expect(error.originalError).toBe(originalError)
  })

  test('should convert generic error correctly', () => {
    const genericError = new Error('timeout occurred')
    const credentialError = CredentialError.fromError(genericError, { operation: 'test' })
    
    expect(credentialError.type).toBe(CredentialErrorType.TIMEOUT_ERROR)
    expect(credentialError.retryable).toBe(true)
    expect(credentialError.originalError).toBe(genericError)
  })

  test('should serialize to JSON correctly', () => {
    const error = CredentialError.configuration('Missing config', { key: 'value' })
    const json = error.toJSON()
    
    expect(json.name).toBe('CredentialError')
    expect(json.type).toBe(CredentialErrorType.CONFIGURATION_ERROR)
    expect(json.context.key).toBe('value')
    expect(json.timestamp).toBeDefined()
  })
})

describe('RetryManager', () => {
  test('should succeed on first attempt', async () => {
    const retryManager = new RetryManager({ maxAttempts: 3 })
    const mockFn = vi.fn().mockResolvedValue('success')
    
    const result = await retryManager.execute(mockFn, 'test')
    
    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  test('should retry on retryable errors', async () => {
    const retryManager = new RetryManager({ 
      maxAttempts: 3, 
      baseDelay: 10,
      retryCondition: (error) => error.message.includes('retry')
    })
    
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('retry this'))
      .mockRejectedValueOnce(new Error('retry this'))
      .mockResolvedValue('success')
    
    const result = await retryManager.execute(mockFn, 'test')
    
    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalledTimes(3)
  })

  test('should not retry on non-retryable errors', async () => {
    const retryManager = new RetryManager({ 
      maxAttempts: 3,
      retryCondition: (error) => error.message.includes('retry')
    })
    
    const mockFn = vi.fn().mockRejectedValue(new Error('validation error'))
    
    await expect(retryManager.execute(mockFn, 'test')).rejects.toThrow()
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  test('should fail after max attempts', async () => {
    const retryManager = new RetryManager({ 
      maxAttempts: 2, 
      baseDelay: 10,
      retryCondition: () => true
    })
    
    const mockFn = vi.fn().mockRejectedValue(new Error('always fails'))
    
    await expect(retryManager.execute(mockFn, 'test')).rejects.toThrow()
    expect(mockFn).toHaveBeenCalledTimes(2)
  })
})

describe('CircuitBreaker', () => {
  test('should start in closed state', () => {
    const circuitBreaker = new CircuitBreaker()
    const status = circuitBreaker.getStatus()
    
    expect(status.state).toBe(CircuitBreakerState.CLOSED)
    expect(status.failureCount).toBe(0)
  })

  test('should open after failure threshold', async () => {
    const circuitBreaker = new CircuitBreaker({ failureThreshold: 2 })
    const mockFn = vi.fn().mockRejectedValue(new Error('failure'))
    
    // First failure
    await expect(circuitBreaker.execute(mockFn, 'test')).rejects.toThrow()
    expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.CLOSED)
    
    // Second failure - should open circuit
    await expect(circuitBreaker.execute(mockFn, 'test')).rejects.toThrow()
    expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.OPEN)
  })

  test('should reject calls when open', async () => {
    const circuitBreaker = new CircuitBreaker({ failureThreshold: 1 })
    const mockFn = vi.fn().mockRejectedValue(new Error('failure'))
    
    // Trigger circuit to open
    await expect(circuitBreaker.execute(mockFn, 'test')).rejects.toThrow()
    expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.OPEN)
    
    // Should reject without calling function
    const successFn = vi.fn().mockResolvedValue('success')
    await expect(circuitBreaker.execute(successFn, 'test')).rejects.toThrow('Circuit breaker is OPEN')
    expect(successFn).not.toHaveBeenCalled()
  })

  test('should transition to half-open after recovery timeout', async () => {
    const circuitBreaker = new CircuitBreaker({ 
      failureThreshold: 1, 
      recoveryTimeout: 50 
    })
    const mockFn = vi.fn().mockRejectedValue(new Error('failure'))
    
    // Open the circuit
    await expect(circuitBreaker.execute(mockFn, 'test')).rejects.toThrow()
    expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.OPEN)
    
    // Wait for recovery timeout
    await new Promise(resolve => setTimeout(resolve, 60))
    
    // Next call should transition to half-open
    const successFn = vi.fn().mockResolvedValue('success')
    const result = await circuitBreaker.execute(successFn, 'test')
    
    expect(result).toBe('success')
    expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.CLOSED)
  })

  test('should reset correctly', () => {
    const circuitBreaker = new CircuitBreaker()
    
    // Manually set some state
    circuitBreaker['state'] = CircuitBreakerState.OPEN
    circuitBreaker['failureCount'] = 5
    
    circuitBreaker.reset()
    
    const status = circuitBreaker.getStatus()
    expect(status.state).toBe(CircuitBreakerState.CLOSED)
    expect(status.failureCount).toBe(0)
  })
})

describe('GracefulDegradationManager', () => {
  test('should execute primary function successfully', async () => {
    const manager = new GracefulDegradationManager()
    const primaryFn = vi.fn().mockResolvedValue('primary result')
    
    const result = await manager.executeWithFallback('test-service', primaryFn, 'test')
    
    expect(result).toBe('primary result')
    expect(primaryFn).toHaveBeenCalledTimes(1)
    expect(manager.isServiceHealthy('test-service')).toBe(true)
  })

  test('should use fallback when primary fails', async () => {
    const manager = new GracefulDegradationManager()
    const primaryFn = vi.fn().mockRejectedValue(new Error('primary failed'))
    const fallbackFn = vi.fn().mockResolvedValue('fallback result')
    
    manager.registerFallback('test-service', fallbackFn)
    
    const result = await manager.executeWithFallback('test-service', primaryFn, 'test')
    
    expect(result).toBe('fallback result')
    expect(primaryFn).toHaveBeenCalledTimes(1)
    expect(fallbackFn).toHaveBeenCalledTimes(1)
    expect(manager.isServiceHealthy('test-service')).toBe(false)
  })

  test('should throw when both primary and fallback fail', async () => {
    const manager = new GracefulDegradationManager()
    const primaryFn = vi.fn().mockRejectedValue(new Error('primary failed'))
    const fallbackFn = vi.fn().mockRejectedValue(new Error('fallback failed'))
    
    manager.registerFallback('test-service', fallbackFn)
    
    await expect(manager.executeWithFallback('test-service', primaryFn, 'test'))
      .rejects.toThrow()
    
    expect(primaryFn).toHaveBeenCalledTimes(1)
    expect(fallbackFn).toHaveBeenCalledTimes(1)
  })

  test('should throw when no fallback is registered', async () => {
    const manager = new GracefulDegradationManager()
    const primaryFn = vi.fn().mockRejectedValue(new Error('primary failed'))
    
    await expect(manager.executeWithFallback('test-service', primaryFn, 'test'))
      .rejects.toThrow()
    
    expect(primaryFn).toHaveBeenCalledTimes(1)
  })

  test('should track service health correctly', async () => {
    const manager = new GracefulDegradationManager()
    const primaryFn = vi.fn().mockRejectedValue(new Error('failed'))
    
    // Initially unknown
    expect(manager.isServiceHealthy('test-service')).toBe(true) // Default to healthy
    
    // After failure
    try {
      await manager.executeWithFallback('test-service', primaryFn, 'test')
    } catch (error) {
      // Expected to fail
    }
    expect(manager.isServiceHealthy('test-service')).toBe(false)
    
    // After recovery
    const successFn = vi.fn().mockResolvedValue('success')
    await manager.executeWithFallback('test-service', successFn, 'test')
    expect(manager.isServiceHealthy('test-service')).toBe(true)
  })
})

describe('CredentialErrorHandler', () => {
  beforeEach(() => {
    resetCredentialErrorHandler()
  })

  test('should execute function successfully without error handling', async () => {
    const errorHandler = new CredentialErrorHandler()
    const mockFn = vi.fn().mockResolvedValue('success')
    
    const result = await errorHandler.executeWithErrorHandling(mockFn, {
      serviceName: 'test-service',
      context: 'test',
      enableRetry: false,
      enableCircuitBreaker: false,
      enableGracefulDegradation: false
    })
    
    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  test('should use retry when enabled', async () => {
    const errorHandler = new CredentialErrorHandler()
    const mockFn = vi.fn()
      .mockRejectedValueOnce(CredentialError.network('Network error'))
      .mockResolvedValue('success')
    
    const result = await errorHandler.executeWithErrorHandling(mockFn, {
      serviceName: 'test-service',
      context: 'test',
      enableRetry: true,
      enableCircuitBreaker: false,
      enableGracefulDegradation: false,
      retryOptions: { maxAttempts: 2, baseDelay: 10 }
    })
    
    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalledTimes(2)
  })

  test('should use fallback when graceful degradation is enabled', async () => {
    const errorHandler = new CredentialErrorHandler()
    const mockFn = vi.fn().mockRejectedValue(new Error('primary failed'))
    const fallbackFn = vi.fn().mockResolvedValue('fallback success')
    
    const result = await errorHandler.executeWithErrorHandling(mockFn, {
      serviceName: 'test-service',
      context: 'test',
      enableRetry: false,
      enableCircuitBreaker: false,
      enableGracefulDegradation: true,
      fallbackFn
    })
    
    expect(result).toBe('fallback success')
    expect(mockFn).toHaveBeenCalledTimes(1)
    expect(fallbackFn).toHaveBeenCalledTimes(1)
  })

  test('should combine all error handling strategies', async () => {
    const errorHandler = new CredentialErrorHandler()
    let callCount = 0
    const mockFn = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount <= 2) {
        throw CredentialError.network('Network error')
      }
      return Promise.resolve('success')
    })
    
    const result = await errorHandler.executeWithErrorHandling(mockFn, {
      serviceName: 'test-service',
      context: 'test',
      enableRetry: true,
      enableCircuitBreaker: true,
      enableGracefulDegradation: true,
      retryOptions: { maxAttempts: 3, baseDelay: 10 }
    })
    
    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalledTimes(3)
  })

  test('should get status correctly', () => {
    const errorHandler = new CredentialErrorHandler()
    const status = errorHandler.getStatus()
    
    expect(status.circuitBreakers).toBeDefined()
    expect(status.serviceHealth).toBeDefined()
  })

  test('should reset circuit breakers', () => {
    const errorHandler = new CredentialErrorHandler()
    
    // This should not throw
    errorHandler.resetCircuitBreakers()
    
    const status = errorHandler.getStatus()
    expect(status.circuitBreakers).toBeDefined()
  })
})

describe('Global Error Handler', () => {
  beforeEach(() => {
    resetCredentialErrorHandler()
  })

  test('should return singleton instance', () => {
    const handler1 = getCredentialErrorHandler()
    const handler2 = getCredentialErrorHandler()
    
    expect(handler1).toBe(handler2)
  })

  test('should reset singleton correctly', () => {
    const handler1 = getCredentialErrorHandler()
    resetCredentialErrorHandler()
    const handler2 = getCredentialErrorHandler()
    
    expect(handler1).not.toBe(handler2)
  })
})