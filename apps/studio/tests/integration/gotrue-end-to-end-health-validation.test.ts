/**
 * GoTrue End-to-End Health Check Validation Tests
 * 
 * Comprehensive validation of the complete health check flow from frontend to GoTrue service
 * including error scenarios, recovery paths, and configuration changes.
 * 
 * Task 8.1: Create end-to-end health check validation
 * Requirements: All requirements from the specification
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

// Import GoTrue health check functions
import {
  checkGoTrueHealth,
  checkGoTrueHealthWithRetry,
  checkGoTrueHealthEnhanced,
  checkGoTrueHealthWithMonitoring,
  checkGoTrueHealthComprehensive,
  getHealthMetrics,
  getHealthPerformanceAnalysis,
  getHealthState,
  getHealthRecoveryHistory,
  type GoTrueHealthResult,
} from '../../lib/gotrue-health'

// Import retry and error handling
import {
  retryWithBackoff,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  getAllCircuitBreakerStatuses,
  CircuitBreakerStateEnum,
  type RetryConfig,
  type CircuitBreakerConfig,
} from '../../lib/gotrue-retry-logic'

import {
  classifyGoTrueError,
  isRetryableError,
  getRetryConfig,
  GoTrueErrorType,
  ErrorSeverity,
  type ClassifiedError,
} from '../../lib/gotrue-error-classification'

// Import troubleshooting and monitoring
import {
  getTroubleshootingGuidance,
  getActionableErrorMessage,
} from '../../lib/gotrue-troubleshooting'

import {
  checkGoTrueHealthWithRateLimit,
  getHealthMonitor,
} from '../../lib/gotrue-health-monitoring'

import {
  processHealthCheckForRecovery,
  getCurrentHealthState,
  getRecoveryHistory,
  triggerManualRecoveryCheck,
} from '../../lib/gotrue-recovery-detection'

// Import configuration
import { getGoTrueUrl } from 'common/gotrue-config'

// Test utilities
function createMockResponse(status: number, data?: any, headers?: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : status === 500 ? 'Internal Server Error' : 'Error',
    headers: new Map(Object.entries(headers || {})),
    json: async () => data || { status: status === 200 ? 'ok' : 'error' },
  } as Response
}

function simulateNetworkError(message: string = 'Network error') {
  return Promise.reject(new Error(message))
}

function simulateTimeout() {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error('Request timeout')
      error.name = 'AbortError'
      reject(error)
    }, 100)
  })
}

describe('GoTrue End-to-End Health Check Validation', () => {
  const originalFetch = global.fetch
  const originalEnv = { ...process.env }

  beforeAll(() => {
    // Mock console methods to reduce noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.clearAllMocks()
    
    // Reset circuit breakers
    const statuses = getAllCircuitBreakerStatuses()
    Object.keys(statuses).forEach(url => resetCircuitBreaker(url))
  })

  afterEach(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('Complete Health Check Flow - Success Scenarios', () => {
    it('should complete successful health check flow from frontend to GoTrue', async () => {
      // Set up environment
      process.env.SUPABASE_PUBLIC_URL = 'https://test.example.com'
      
      // Mock successful GoTrue health response with small delay for timing
      const mockFetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10)) // Small delay for timing
        return createMockResponse(200, {
          status: 'ok',
          version: '2.0.0',
          name: 'GoTrue',
          description: 'Supabase Auth API',
        })
      })
      global.fetch = mockFetch

      // Step 1: Basic health check
      const basicResult = await checkGoTrueHealth()
      
      expect(basicResult.available).toBe(true)
      expect(basicResult.url).toBe('https://test.example.com')
      expect(basicResult.source).toBe('derived-public')
      expect(basicResult.version).toBe('2.0.0')
      expect(basicResult.name).toBe('GoTrue')
      expect(basicResult.responseTime).toBeGreaterThan(0)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.example.com/auth/v1/health',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
      )

      // Step 2: Enhanced health check with retry logic
      const enhancedResult = await checkGoTrueHealthEnhanced()
      
      expect(enhancedResult.available).toBe(true)
      expect(enhancedResult.retryAttempts).toBe(0) // No retries needed
      expect(enhancedResult.circuitBreakerTripped).toBe(false)

      // Step 3: Health check with monitoring
      const monitoredResult = await checkGoTrueHealthWithMonitoring()
      
      expect(monitoredResult.available).toBe(true)

      // Step 4: Comprehensive health check with test-friendly rate limiting
      const comprehensiveResult = await checkGoTrueHealthComprehensive(
        undefined, // url
        undefined, // retryConfig
        undefined, // circuitBreakerConfig
        { minHealthCheckInterval: 0 }, // rateLimitConfig - allow rapid calls for testing
        undefined, // performanceThresholds
        undefined  // recoveryConfig
      )
      
      expect(comprehensiveResult.available).toBe(true)

      // Step 5: Verify metrics are collected
      const metrics = getHealthMetrics()
      expect(metrics).toBeDefined()
      expect(metrics.totalRequests).toBeGreaterThan(0)
      expect(metrics.successfulRequests).toBeGreaterThan(0)

      // Step 6: Verify performance analysis
      const performance = getHealthPerformanceAnalysis()
      expect(performance).toBeDefined()
      expect(performance.averageResponseTime).toBeGreaterThan(0)

      // Step 7: Verify health state tracking
      const healthState = getHealthState()
      expect(healthState).toBeDefined()
      expect(healthState.isHealthy).toBe(true)
    })

    it('should handle explicit URL override in health check flow', async () => {
      const explicitUrl = 'https://explicit.example.com/auth/v1'
      
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, { status: 'ok' })
      )
      global.fetch = mockFetch

      const result = await checkGoTrueHealth(explicitUrl)
      
      expect(result.available).toBe(true)
      expect(result.url).toBe('https://explicit.example.com')
      expect(result.source).toBe('explicit')
      expect(mockFetch).toHaveBeenCalledWith(
        `${explicitUrl}/health`,
        expect.any(Object)
      )
    })

    it('should validate health check with different configuration sources', async () => {
      const testCases = [
        {
          name: 'Explicit configuration',
          env: { NEXT_PUBLIC_GOTRUE_URL: 'https://runtime.example.com/auth/v1' },
          expectedUrl: 'https://runtime.example.com',
          expectedSource: 'explicit',
        },
        {
          name: 'Derived from public URL',
          env: { SUPABASE_PUBLIC_URL: 'https://derived.example.com' },
          expectedUrl: 'https://derived.example.com',
          expectedSource: 'derived-public',
        },
        {
          name: 'Development defaults',
          env: { NODE_ENV: 'development' },
          expectedUrl: 'http://127.0.0.1:54321',
          expectedSource: 'default',
        },
      ]

      for (const testCase of testCases) {
        // Reset environment
        Object.keys(process.env).forEach(key => {
          if (key.startsWith('SUPABASE_') || key.startsWith('NEXT_PUBLIC_')) {
            delete process.env[key]
          }
        })
        Object.assign(process.env, testCase.env)

        const mockFetch = vi.fn().mockResolvedValue(
          createMockResponse(200, { status: 'ok' })
        )
        global.fetch = mockFetch

        const result = await checkGoTrueHealth()
        
        expect(result.available).toBe(true)
        expect(result.url).toBe(testCase.expectedUrl)
        expect(result.source).toBe(testCase.expectedSource)
      }
    })
  })

  describe('Error Scenarios and Recovery Paths', () => {
    it('should handle network errors with proper classification and retry', async () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://unreachable.example.com'
      
      // Mock network error
      const mockFetch = vi.fn().mockRejectedValue(new Error('fetch failed'))
      global.fetch = mockFetch

      // Test basic health check failure
      const basicResult = await checkGoTrueHealth()
      
      expect(basicResult.available).toBe(false)
      expect(basicResult.error).toContain('Failed to connect to GoTrue service')
      expect(basicResult.url).toBe('https://unreachable.example.com')

      // Test enhanced health check with retry
      const enhancedResult = await checkGoTrueHealthEnhanced()
      
      expect(enhancedResult.available).toBe(false)
      expect(enhancedResult.classifiedError).toBeDefined()
      expect(enhancedResult.classifiedError?.type).toBe(GoTrueErrorType.NETWORK_ERROR)
      expect(enhancedResult.classifiedError?.severity).toBe(ErrorSeverity.HIGH)
      expect(enhancedResult.classifiedError?.retryable).toBe(true)
      expect(enhancedResult.retryAttempts).toBeGreaterThan(0)

      // Verify error classification
      const classifiedError = classifyGoTrueError(new Error('fetch failed'), {
        url: 'https://unreachable.example.com/auth/v1/health',
        environment: 'production',
      })
      
      expect(classifiedError.type).toBe(GoTrueErrorType.NETWORK_ERROR)
      expect(classifiedError.troubleshootingSteps).toContain('Check your internet connection')
      expect(classifiedError.environmentGuidance).toContain('Production Environment:')
    })

    it('should handle timeout errors with exponential backoff', async () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://slow.example.com'
      
      // Mock timeout error
      const mockFetch = vi.fn().mockImplementation(() => simulateTimeout())
      global.fetch = mockFetch

      const result = await checkGoTrueHealthEnhanced(undefined, {
        maxRetries: 2,
        initialDelay: 100,
        maxDelay: 1000,
      })
      
      expect(result.available).toBe(false)
      expect(result.classifiedError?.type).toBe(GoTrueErrorType.TIMEOUT)
      expect(result.retryAttempts).toBe(2)
      expect(result.responseTime).toBeGreaterThan(200) // Should include retry delays
    })

    it('should handle HTTP error responses with proper classification', async () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://error.example.com'
      
      const errorCases = [
        { status: 401, expectedType: GoTrueErrorType.AUTHENTICATION_ERROR },
        { status: 403, expectedType: GoTrueErrorType.AUTHORIZATION_ERROR },
        { status: 404, expectedType: GoTrueErrorType.ENDPOINT_NOT_FOUND },
        { status: 429, expectedType: GoTrueErrorType.RATE_LIMITED },
        { status: 500, expectedType: GoTrueErrorType.SERVICE_ERROR },
        { status: 502, expectedType: GoTrueErrorType.SERVICE_UNAVAILABLE },
        { status: 503, expectedType: GoTrueErrorType.SERVICE_UNAVAILABLE },
        { status: 504, expectedType: GoTrueErrorType.TIMEOUT },
      ]

      for (const errorCase of errorCases) {
        const mockFetch = vi.fn().mockResolvedValue(
          createMockResponse(errorCase.status)
        )
        global.fetch = mockFetch

        const result = await checkGoTrueHealthEnhanced()
        
        expect(result.available).toBe(false)
        expect(result.classifiedError?.type).toBe(errorCase.expectedType)
        
        // Verify troubleshooting guidance is provided
        expect(result.classifiedError?.troubleshootingSteps).toBeDefined()
        expect(result.classifiedError?.troubleshootingSteps.length).toBeGreaterThan(0)
      }
    })

    it('should implement circuit breaker pattern for persistent failures', async () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://failing.example.com'
      const url = 'https://failing.example.com/auth/v1/health'
      
      // Mock persistent failures
      const mockFetch = vi.fn().mockRejectedValue(new Error('Service unavailable'))
      global.fetch = mockFetch

      const circuitBreakerConfig: Partial<CircuitBreakerConfig> = {
        failureThreshold: 3,
        recoveryTimeout: 1000,
        successThreshold: 2,
      }

      // Make multiple failing requests to trip circuit breaker
      for (let i = 0; i < 4; i++) {
        await checkGoTrueHealthEnhanced(undefined, undefined, circuitBreakerConfig)
      }

      // Check circuit breaker status
      const status = getCircuitBreakerStatus(url)
      expect(status.state).toBe(CircuitBreakerStateEnum.OPEN)
      expect(status.failureCount).toBeGreaterThanOrEqual(3)

      // Next request should fail fast due to circuit breaker
      const fastFailResult = await checkGoTrueHealthEnhanced(undefined, undefined, circuitBreakerConfig)
      expect(fastFailResult.circuitBreakerTripped).toBe(true)
      expect(fastFailResult.totalAttempts).toBe(0)
    })

    it('should handle recovery after circuit breaker opens', async () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://recovering.example.com'
      const url = 'https://recovering.example.com/auth/v1/health'
      
      const circuitBreakerConfig: Partial<CircuitBreakerConfig> = {
        failureThreshold: 2,
        recoveryTimeout: 100, // Short timeout for testing
        successThreshold: 1,
      }

      // Trip circuit breaker with failures
      const mockFailingFetch = vi.fn().mockRejectedValue(new Error('Service down'))
      global.fetch = mockFailingFetch

      await checkGoTrueHealthEnhanced(undefined, undefined, circuitBreakerConfig)
      await checkGoTrueHealthEnhanced(undefined, undefined, circuitBreakerConfig)

      expect(getCircuitBreakerStatus(url).state).toBe(CircuitBreakerStateEnum.OPEN)

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 150))

      // Mock successful response for recovery
      const mockSuccessfulFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, { status: 'ok' })
      )
      global.fetch = mockSuccessfulFetch

      // Should transition to half-open and then closed on success
      const recoveryResult = await checkGoTrueHealthEnhanced(undefined, undefined, circuitBreakerConfig)
      
      expect(recoveryResult.available).toBe(true)
      expect(getCircuitBreakerStatus(url).state).toBe(CircuitBreakerStateEnum.CLOSED)
    })
  })

  describe('Configuration Changes and Reloading', () => {
    it('should handle runtime configuration changes without restart', async () => {
      // Initial configuration
      process.env.SUPABASE_PUBLIC_URL = 'https://initial.example.com'
      
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, { status: 'ok' })
      )
      global.fetch = mockFetch

      // First health check
      const initialResult = await checkGoTrueHealth()
      expect(initialResult.url).toBe('https://initial.example.com')

      // Change configuration (simulate runtime update)
      process.env.SUPABASE_PUBLIC_URL = 'https://updated.example.com'

      // Second health check should use new configuration
      const updatedResult = await checkGoTrueHealth()
      expect(updatedResult.url).toBe('https://updated.example.com')
      expect(updatedResult.available).toBe(true)
    })

    it('should validate configuration priority: explicit > derived > default', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, { status: 'ok' })
      )
      global.fetch = mockFetch

      // Test explicit URL (highest priority)
      const explicitResult = await checkGoTrueHealth('https://explicit.example.com/auth/v1')
      expect(explicitResult.url).toBe('https://explicit.example.com')
      expect(explicitResult.source).toBe('explicit')

      // Test explicit configuration
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://runtime.example.com/auth/v1'
      const runtimeResult = await checkGoTrueHealth()
      expect(runtimeResult.url).toBe('https://runtime.example.com')
      expect(runtimeResult.source).toBe('explicit')

      // Test derived configuration
      delete process.env.NEXT_PUBLIC_GOTRUE_URL
      process.env.SUPABASE_PUBLIC_URL = 'https://derived.example.com'
      const derivedResult = await checkGoTrueHealth()
      expect(derivedResult.url).toBe('https://derived.example.com')
      expect(derivedResult.source).toBe('derived-public')

      // Test default configuration
      delete process.env.SUPABASE_PUBLIC_URL
      process.env.NODE_ENV = 'development'
      const defaultResult = await checkGoTrueHealth()
      expect(defaultResult.url).toBe('http://127.0.0.1:54321')
      expect(defaultResult.source).toBe('default')
    })

    it('should handle invalid configuration gracefully', async () => {
      // Test with invalid URL
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'not-a-valid-url'
      
      const mockFetch = vi.fn().mockRejectedValue(new Error('Invalid URL'))
      global.fetch = mockFetch

      const result = await checkGoTrueHealthEnhanced()
      
      expect(result.available).toBe(false)
      expect(result.classifiedError?.type).toBe(GoTrueErrorType.CONFIGURATION_ERROR)
      expect(result.classifiedError?.troubleshootingSteps).toContain('Verify environment variables are set correctly')
    })

    it('should handle missing configuration with appropriate defaults', async () => {
      // Clear all GoTrue-related environment variables
      Object.keys(process.env).forEach(key => {
        if (key.includes('GOTRUE') || key.includes('SUPABASE')) {
          delete process.env[key]
        }
      })

      const result = await checkGoTrueHealth()
      
      // Should fall back to development defaults
      expect(result.url).toBe('http://127.0.0.1:54321')
      expect(result.source).toBe('default')
    })
  })

  describe('Monitoring and Performance Analysis', () => {
    it('should collect comprehensive health check metrics', async () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://metrics.example.com'
      
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(createMockResponse(200, { status: 'ok' })) // Success
        .mockRejectedValueOnce(new Error('Network error'))                // Failure
        .mockResolvedValueOnce(createMockResponse(200, { status: 'ok' })) // Success

      global.fetch = mockFetch

      // Perform multiple health checks
      await checkGoTrueHealthWithMonitoring()
      await checkGoTrueHealthWithMonitoring()
      await checkGoTrueHealthWithMonitoring()

      const metrics = getHealthMetrics()
      
      expect(metrics.totalRequests).toBe(3)
      expect(metrics.successfulRequests).toBe(2)
      expect(metrics.failedRequests).toBe(1)
      expect(metrics.successRate).toBeCloseTo(0.67, 1)
      expect(metrics.averageResponseTime).toBeGreaterThan(0)
    })

    it('should provide performance analysis and recommendations', async () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://performance.example.com'
      
      // Mock slow responses
      const mockFetch = vi.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve(createMockResponse(200, { status: 'ok' })), 200)
        )
      )
      global.fetch = mockFetch

      // Perform health checks to collect performance data
      await checkGoTrueHealthWithMonitoring()
      await checkGoTrueHealthWithMonitoring()

      const performance = getHealthPerformanceAnalysis()
      
      expect(performance.averageResponseTime).toBeGreaterThan(150)
      expect(performance.recommendations).toBeDefined()
      expect(performance.recommendations.length).toBeGreaterThan(0)
    })

    it('should track recovery events and history', async () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://recovery.example.com'
      
      // Mock failure followed by success
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new Error('Service down'))
        .mockResolvedValueOnce(createMockResponse(200, { status: 'ok' }))

      global.fetch = mockFetch

      // First request fails
      const failureResult = await checkGoTrueHealthComprehensive(
        undefined, undefined, undefined, { minHealthCheckInterval: 0 }
      )
      expect(failureResult.available).toBe(false)

      // Second request succeeds (recovery)
      const recoveryResult = await checkGoTrueHealthComprehensive(
        undefined, undefined, undefined, { minHealthCheckInterval: 0 }
      )
      expect(recoveryResult.available).toBe(true)

      // Check recovery history
      const recoveryHistory = getHealthRecoveryHistory()
      expect(recoveryHistory.length).toBeGreaterThan(0)
      
      const latestRecovery = recoveryHistory[recoveryHistory.length - 1]
      expect(latestRecovery.type).toBe('recovery')
      expect(latestRecovery.timestamp).toBeDefined()
    })
  })

  describe('Rate Limiting and Protection', () => {
    it('should implement rate limiting for health checks', async () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://ratelimited.example.com'
      
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, { status: 'ok' })
      )
      global.fetch = mockFetch

      const rateLimitConfig = {
        maxRequests: 2,
        windowMs: 60000, // 1 minute
        healthCheckImmunity: false, // Disable immunity for this test
        minHealthCheckInterval: 0, // Allow rapid calls
      }

      // First request should succeed
      const result1 = await checkGoTrueHealthWithMonitoring(
        undefined, undefined, undefined, rateLimitConfig
      )
      expect(result1.available).toBe(true)

      // Rapid subsequent requests should be rate limited
      const result2 = await checkGoTrueHealthWithMonitoring(
        undefined, undefined, undefined, rateLimitConfig
      )
      const result3 = await checkGoTrueHealthWithMonitoring(
        undefined, undefined, undefined, rateLimitConfig
      )

      // At least one should be rate limited
      expect([result2.available, result3.available]).toContain(false)
    })

    it('should provide immunity for critical health checks', async () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://critical.example.com'
      
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, { status: 'ok' })
      )
      global.fetch = mockFetch

      // Perform multiple critical health checks with immunity enabled
      const rateLimitConfig = {
        maxRequests: 1,
        windowMs: 60000,
        healthCheckImmunity: true, // Enable immunity for critical checks
        minHealthCheckInterval: 0,
      }
      
      const results = await Promise.all([
        checkGoTrueHealthWithRateLimit(
          () => checkGoTrueHealth(),
          rateLimitConfig
        ),
        checkGoTrueHealthWithRateLimit(
          () => checkGoTrueHealth(),
          rateLimitConfig
        ),
      ])

      // Both critical requests should succeed despite rate limiting
      expect(results[0].available).toBe(true)
      expect(results[1].available).toBe(true)
    })
  })

  describe('Integration with Troubleshooting System', () => {
    it('should provide actionable error messages for all error types', async () => {
      const errorScenarios = [
        {
          mockError: new Error('fetch failed'),
          expectedType: GoTrueErrorType.NETWORK_ERROR,
          expectedGuidance: 'Check your internet connection',
        },
        {
          mockError: new Error('Request timeout'),
          expectedType: GoTrueErrorType.TIMEOUT,
          expectedGuidance: 'Wait a moment and try again',
        },
        {
          mockResponse: createMockResponse(401),
          expectedType: GoTrueErrorType.AUTHENTICATION_ERROR,
          expectedGuidance: 'Verify your credentials are correct',
        },
        {
          mockResponse: createMockResponse(503),
          expectedType: GoTrueErrorType.SERVICE_UNAVAILABLE,
          expectedGuidance: 'Wait a few minutes and try again',
        },
      ]

      for (const scenario of errorScenarios) {
        process.env.SUPABASE_PUBLIC_URL = 'https://test.example.com'
        
        if (scenario.mockError) {
          const mockFetch = vi.fn().mockRejectedValue(scenario.mockError)
          global.fetch = mockFetch
        } else if (scenario.mockResponse) {
          const mockFetch = vi.fn().mockResolvedValue(scenario.mockResponse)
          global.fetch = mockFetch
        }

        const result = await checkGoTrueHealthEnhanced()
        
        expect(result.available).toBe(false)
        expect(result.classifiedError?.type).toBe(scenario.expectedType)
        expect(result.classifiedError?.troubleshootingSteps).toContain(scenario.expectedGuidance)
        
        // Verify actionable error message
        const actionableMessage = getActionableErrorMessage(result.classifiedError!, {
          url: 'https://test.example.com/auth/v1/health',
          isHealthCheck: true,
        })
        expect(actionableMessage).toBeTruthy()
        expect(actionableMessage.length).toBeGreaterThan(10)
      }
    })

    it('should provide environment-specific troubleshooting guidance', async () => {
      const environments = [
        {
          url: 'http://localhost:54321/auth/v1',
          environment: 'development',
          expectedGuidance: 'ensure docker-compose services are running',
        },
        {
          url: 'https://staging.example.com/auth/v1',
          environment: 'staging',
          expectedGuidance: 'Verify staging services are deployed',
        },
        {
          url: 'https://prod.example.com/auth/v1',
          environment: 'production',
          expectedGuidance: 'Verify GoTrue service is deployed and running',
        },
      ]

      for (const env of environments) {
        const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'))
        global.fetch = mockFetch

        const result = await checkGoTrueHealthEnhanced(env.url)
        
        expect(result.available).toBe(false)
        expect(result.classifiedError?.environmentGuidance.join(' ')).toContain(env.expectedGuidance)
      }
    })
  })

  describe('Manual Recovery and Testing', () => {
    it('should support manual recovery checks', async () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://manual.example.com'
      
      // Mock initial failure
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new Error('Service down'))
        .mockResolvedValueOnce(createMockResponse(200, { status: 'ok' }))

      global.fetch = mockFetch

      // Initial failure
      await checkGoTrueHealthComprehensive(
        undefined, undefined, undefined, { minHealthCheckInterval: 0 }
      )
      
      const initialState = getHealthState()
      expect(initialState.isHealthy).toBe(false)

      // Trigger manual recovery check
      const recoveryResult = await triggerManualRecoveryCheck()
      expect(recoveryResult).toBeDefined()

      const finalState = getHealthState()
      expect(finalState.isHealthy).toBe(true)
    })

    it('should validate complete system integration', async () => {
      // Set up complete production-like environment
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_PUBLIC_URL = 'https://integration.example.com'
      
      const mockFetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10)) // Small delay for timing
        return createMockResponse(200, {
          status: 'ok',
          version: '2.0.0',
          name: 'GoTrue',
          description: 'Supabase Auth API',
        })
      })
      global.fetch = mockFetch

      // Perform comprehensive health check
      const result = await checkGoTrueHealthComprehensive(
        undefined,
        { maxRetries: 3, initialDelay: 100 },
        { failureThreshold: 5, recoveryTimeout: 1000 },
        { maxRequestsPerMinute: 60, burstLimit: 10 },
        { slowResponseThreshold: 1000, errorRateThreshold: 0.1 },
        { enableRecoveryDetection: true, recoveryThreshold: 3 }
      )

      // Validate all aspects of the health check
      expect(result.available).toBe(true)
      expect(result.url).toBe('https://integration.example.com')
      expect(result.source).toBe('derived-public')
      expect(result.version).toBe('2.0.0')
      expect(result.responseTime).toBeGreaterThan(0)
      expect(result.retryAttempts).toBe(0)
      expect(result.circuitBreakerTripped).toBe(false)

      // Validate metrics collection
      const metrics = getHealthMetrics()
      expect(metrics.totalRequests).toBeGreaterThan(0)
      expect(metrics.successfulRequests).toBeGreaterThan(0)

      // Validate health state
      const healthState = getHealthState()
      expect(healthState.isHealthy).toBe(true)
      expect(healthState.lastSuccessfulCheck).toBeDefined()
    })
  })
})