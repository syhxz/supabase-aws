/**
 * Complete Configuration Flow Integration Tests
 * 
 * This test suite validates the complete end-to-end configuration system including:
 * - Complete configuration flow from startup to API requests
 * - Environment switching between dev/staging/prod
 * - Error recovery and fallback behavior
 * - All logging and error messages
 * - Configuration manager integration
 * - Health checks and validation
 * - User interface error recovery
 * 
 * Task 11: Final integration and testing
 * Requirements: All requirements from the specification
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { NextApiRequest, NextApiResponse } from 'next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from 'ui'

// Import components and services to test
import handler from '../../pages/api/runtime-config'
import { useConfigurationManager } from '../../lib/configuration-manager'
import { ConfigurationErrorRecovery, ConfigurationWarningBanner } from '../../components/interfaces/App/ConfigurationErrorRecovery'
import { performConfigHealthCheck } from '../../lib/config-health'
import {
  fetchRuntimeConfig,
  getRuntimeConfig,
  refreshRuntimeConfig,
  resetRuntimeConfigStore,
  type RuntimeConfig,
} from 'common'
import { detectEnvironment, validateUrlsForEnvironment } from 'common/environment-detection'
import { ConfigError } from 'common/runtime-config-errors'

// Test utilities
function createMockApiResponse() {
  const req = { method: 'GET' } as NextApiRequest
  const res = {
    status: function (code: number) {
      this.statusCode = code
      return this
    },
    json: function (data: any) {
      this.data = data
      return this
    },
    setHeader: function (name: string, value: string) {
      this.headers = this.headers || {}
      this.headers[name] = value
      return this
    },
    statusCode: 200,
    data: null,
    headers: {},
  } as unknown as NextApiResponse

  return { req, res }
}

function simulateEnvironmentChange(newEnv: Record<string, string | undefined>) {
  resetRuntimeConfigStore()
  Object.keys(newEnv).forEach((key) => {
    if (newEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = newEnv[key]
    }
  })
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  )
}

// Mock configuration manager hook for testing
function TestConfigurationManager({ 
  onConfigLoad, 
  simulateError, 
  simulateFallback 
}: {
  onConfigLoad?: (config: RuntimeConfig | null) => void
  simulateError?: ConfigError
  simulateFallback?: boolean
}) {
  const configManager = useConfigurationManager({
    maxRetries: 2,
    retryDelay: 100,
    enableHealthChecks: true,
    enableCaching: true,
    autoRetry: false, // Disable auto-retry for testing
  })

  React.useEffect(() => {
    if (onConfigLoad) {
      onConfigLoad(configManager.config)
    }
  }, [configManager.config, onConfigLoad])

  if (simulateError && !configManager.config) {
    return (
      <ConfigurationErrorRecovery
        error={simulateError}
        healthResult={configManager.healthResult || undefined}
        isRetrying={configManager.isRetrying}
        onRetry={configManager.retry}
        onUseFallback={configManager.acceptFallback}
        canUseFallback={simulateError.canFallback}
        context="Test Environment"
      />
    )
  }

  if (simulateFallback && configManager.usingFallback && configManager.fallbackResult) {
    return (
      <ConfigurationWarningBanner
        message={configManager.fallbackResult.userMessage}
        details={configManager.fallbackResult.recommendations}
        dismissible={false}
      />
    )
  }

  return (
    <div data-testid="config-status">
      <div data-testid="config-loaded">{configManager.isConfigured() ? 'true' : 'false'}</div>
      <div data-testid="config-loading">{configManager.isLoading ? 'true' : 'false'}</div>
      <div data-testid="config-error">{configManager.error?.message || 'none'}</div>
      <div data-testid="config-fallback">{configManager.usingFallback ? 'true' : 'false'}</div>
      <div data-testid="config-healthy">{configManager.isHealthy() ? 'true' : 'false'}</div>
      <div data-testid="status-message">{configManager.statusMessage}</div>
    </div>
  )
}

describe('Complete Configuration Flow Integration Tests', () => {
  const originalEnv = { ...process.env }
  const originalFetch = global.fetch

  beforeAll(() => {
    // Mock console methods to reduce noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  beforeEach(() => {
    process.env = { ...originalEnv }
    resetRuntimeConfigStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    resetRuntimeConfigStore()
    global.fetch = originalFetch
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('Complete Configuration Flow End-to-End', () => {
    it('should complete full production configuration flow successfully', async () => {
      // Step 1: Set up production environment
      simulateEnvironmentChange({
        NODE_ENV: 'production',
        SUPABASE_PUBLIC_URL: 'https://prod.example.com',
        API_EXTERNAL_URL: 'https://api.prod.example.com',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'prod-anon-key-123',
      })

      // Step 2: Test runtime config API
      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data).toMatchObject({
        gotrueUrl: 'https://prod.example.com/auth/v1',
        supabaseUrl: 'https://prod.example.com',
        apiUrl: 'https://api.prod.example.com',
        anonKey: 'prod-anon-key-123',
        environment: 'production',
        source: 'derived',
      })

      // Step 3: Mock successful fetch for frontend
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => res.data,
      })
      global.fetch = mockFetch

      // Step 4: Test frontend configuration loading
      const config = await fetchRuntimeConfig()
      expect(config).toMatchObject({
        gotrueUrl: 'https://prod.example.com/auth/v1',
        environment: 'production',
      })

      // Step 5: Verify no localhost URLs
      expect(config.gotrueUrl).not.toContain('localhost')
      expect(config.gotrueUrl).not.toContain('127.0.0.1')
      expect(config.supabaseUrl).not.toContain('localhost')
      expect(config.apiUrl).not.toContain('localhost')

      // Step 6: Test environment detection
      const envInfo = detectEnvironment({
        gotrueUrl: config.gotrueUrl,
        supabaseUrl: config.supabaseUrl,
        apiUrl: config.apiUrl,
      })
      expect(envInfo.environment).toBe('production')
      expect(envInfo.isProduction).toBe(true)

      // Step 7: Test URL validation for production
      const validation = validateUrlsForEnvironment(
        {
          gotrueUrl: config.gotrueUrl,
          supabaseUrl: config.supabaseUrl,
          apiUrl: config.apiUrl,
        },
        'production'
      )
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)

      // Step 8: Test health check
      const healthResult = await performConfigHealthCheck()
      expect(healthResult).toBeDefined()
      expect(healthResult.checks).toBeDefined()
    })

    it('should handle complete development configuration flow', async () => {
      // Step 1: Set up development environment
      simulateEnvironmentChange({
        NODE_ENV: 'development',
        SUPABASE_PUBLIC_URL: undefined,
        API_EXTERNAL_URL: undefined,
      })

      // Step 2: Test runtime config API returns development defaults
      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data).toMatchObject({
        gotrueUrl: 'http://127.0.0.1:54321/auth/v1',
        supabaseUrl: 'http://127.0.0.1:54321',
        apiUrl: 'http://127.0.0.1:8000',
        environment: 'development',
        source: 'default',
      })

      // Step 3: Verify localhost URLs are used in development
      expect(res.data.gotrueUrl).toContain('127.0.0.1')
      expect(res.data.supabaseUrl).toContain('127.0.0.1')

      // Step 4: Test environment detection
      const envInfo = detectEnvironment({
        gotrueUrl: res.data.gotrueUrl,
        supabaseUrl: res.data.supabaseUrl,
        apiUrl: res.data.apiUrl,
      })
      expect(envInfo.environment).toBe('development')
      expect(envInfo.isDevelopment).toBe(true)

      // Step 5: Test URL validation for development
      const validation = validateUrlsForEnvironment(
        {
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        },
        'development'
      )
      expect(validation.isValid).toBe(true)
    })

    it('should handle staging environment configuration flow', async () => {
      // Step 1: Set up staging environment
      simulateEnvironmentChange({
        NODE_ENV: 'production',
        SUPABASE_PUBLIC_URL: 'https://staging.example.com',
        API_EXTERNAL_URL: 'https://api.staging.example.com',
      })

      // Step 2: Test runtime config API
      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data.environment).toBe('staging')
      expect(res.data.gotrueUrl).toContain('staging.example.com')

      // Step 3: Test environment detection
      const envInfo = detectEnvironment({
        gotrueUrl: res.data.gotrueUrl,
        supabaseUrl: res.data.supabaseUrl,
        apiUrl: res.data.apiUrl,
      })
      expect(envInfo.environment).toBe('staging')
      expect(envInfo.isStaging).toBe(true)
    })
  })

  describe('Environment Switching Validation', () => {
    it('should correctly switch between all environments', async () => {
      const environments = [
        {
          name: 'development',
          env: {
            NODE_ENV: 'development',
            SUPABASE_PUBLIC_URL: undefined,
            API_EXTERNAL_URL: undefined,
          },
          expectedGotrueUrl: 'http://127.0.0.1:54321/auth/v1',
          expectedEnvironment: 'development',
        },
        {
          name: 'staging',
          env: {
            NODE_ENV: 'production',
            SUPABASE_PUBLIC_URL: 'https://staging.example.com',
            API_EXTERNAL_URL: 'https://api.staging.example.com',
          },
          expectedGotrueUrl: 'https://staging.example.com/auth/v1',
          expectedEnvironment: 'staging',
        },
        {
          name: 'production',
          env: {
            NODE_ENV: 'production',
            SUPABASE_PUBLIC_URL: 'https://prod.example.com',
            API_EXTERNAL_URL: 'https://api.prod.example.com',
          },
          expectedGotrueUrl: 'https://prod.example.com/auth/v1',
          expectedEnvironment: 'production',
        },
      ]

      for (const testCase of environments) {
        // Simulate environment change
        simulateEnvironmentChange(testCase.env)

        // Test API response
        const { req, res } = createMockApiResponse()
        handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(res.data.gotrueUrl).toBe(testCase.expectedGotrueUrl)
        expect(res.data.environment).toBe(testCase.expectedEnvironment)

        // Test environment detection
        const envInfo = detectEnvironment({
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        })
        expect(envInfo.environment).toBe(testCase.expectedEnvironment)

        // Test URL validation
        const validation = validateUrlsForEnvironment(
          {
            gotrueUrl: res.data.gotrueUrl,
            supabaseUrl: res.data.supabaseUrl,
            apiUrl: res.data.apiUrl,
          },
          testCase.expectedEnvironment as any
        )
        expect(validation.isValid).toBe(true)
      }
    })

    it('should prevent localhost URLs in production environment', async () => {
      // Set production environment but with localhost URLs (misconfiguration)
      simulateEnvironmentChange({
        NODE_ENV: 'production',
        NEXT_PUBLIC_GOTRUE_URL: 'http://localhost:54321/auth/v1',
        SUPABASE_PUBLIC_URL: 'http://localhost:54321',
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      // Should detect production environment
      expect(res.data.environment).toBe('production')

      // But URL validation should fail
      const validation = validateUrlsForEnvironment(
        {
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        },
        'production'
      )
      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors[0]).toContain('localhost')
    })

    it('should handle environment variable updates without rebuild', async () => {
      // Initial configuration
      simulateEnvironmentChange({
        SUPABASE_PUBLIC_URL: 'https://old.example.com',
        API_EXTERNAL_URL: 'https://api.old.example.com',
      })

      const { req: req1, res: res1 } = createMockApiResponse()
      handler(req1, res1)
      expect(res1.data.gotrueUrl).toBe('https://old.example.com/auth/v1')

      // Update environment variables (simulate container restart)
      simulateEnvironmentChange({
        SUPABASE_PUBLIC_URL: 'https://new.example.com',
        API_EXTERNAL_URL: 'https://api.new.example.com',
      })

      const { req: req2, res: res2 } = createMockApiResponse()
      handler(req2, res2)
      expect(res2.data.gotrueUrl).toBe('https://new.example.com/auth/v1')
      expect(res2.data.apiUrl).toBe('https://api.new.example.com')
    })
  })

  describe('Error Recovery and Fallback Behavior', () => {
    it('should handle network errors with graceful fallback', async () => {
      // Mock network error
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'))
      global.fetch = mockFetch

      let configResult: RuntimeConfig | null = null
      const onConfigLoad = (config: RuntimeConfig | null) => {
        configResult = config
      }

      render(
        <TestWrapper>
          <TestConfigurationManager onConfigLoad={onConfigLoad} />
        </TestWrapper>
      )

      // Should attempt to load but fail gracefully
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Should show appropriate error state
      expect(screen.getByTestId('config-loaded')).toHaveTextContent('false')
      expect(screen.getByTestId('config-error')).not.toHaveTextContent('none')
    })

    it('should display error recovery UI with retry functionality', async () => {
      const mockError: ConfigError = {
        type: 'NETWORK_TIMEOUT',
        message: 'Request timed out after 3000ms',
        canFallback: true,
        originalError: new Error('Timeout'),
      }

      const user = userEvent.setup()
      const onRetry = vi.fn()
      const onUseFallback = vi.fn()

      render(
        <TestWrapper>
          <ConfigurationErrorRecovery
            error={mockError}
            isRetrying={false}
            onRetry={onRetry}
            onUseFallback={onUseFallback}
            canUseFallback={true}
            context="Test Environment"
          />
        </TestWrapper>
      )

      // Should display error message
      expect(screen.getByText('Configuration Request Timed Out')).toBeInTheDocument()
      expect(screen.getByText(/Request timed out after 3000ms/)).toBeInTheDocument()

      // Should have retry button
      const retryButton = screen.getByRole('button', { name: /retry/i })
      expect(retryButton).toBeInTheDocument()

      await user.click(retryButton)
      expect(onRetry).toHaveBeenCalledOnce()

      // Should have fallback button
      const fallbackButton = screen.getByRole('button', { name: /use offline mode|continue anyway/i })
      if (fallbackButton) {
        await user.click(fallbackButton)
        expect(onUseFallback).toHaveBeenCalledOnce()
      }
    })

    it('should show technical details when expanded', async () => {
      const mockError: ConfigError = {
        type: 'INVALID_RESPONSE',
        message: 'Server returned invalid JSON',
        canFallback: true,
        originalError: new Error('JSON parse error'),
        docsUrl: 'https://docs.example.com/troubleshooting',
      }

      const user = userEvent.setup()

      render(
        <TestWrapper>
          <ConfigurationErrorRecovery
            error={mockError}
            isRetrying={false}
            onRetry={() => {}}
            canUseFallback={true}
          />
        </TestWrapper>
      )

      // Technical details should be collapsed initially
      expect(screen.queryByText('INVALID_RESPONSE')).not.toBeInTheDocument()

      // Click to expand technical details
      const technicalDetailsButton = screen.getByText('Technical Details')
      await user.click(technicalDetailsButton)

      // Should show technical details
      expect(screen.getByText('INVALID_RESPONSE')).toBeInTheDocument()
      expect(screen.getByText('Server returned invalid JSON')).toBeInTheDocument()
      expect(screen.getByText('JSON parse error')).toBeInTheDocument()
    })

    it('should handle fallback configuration with warnings', async () => {
      render(
        <TestWrapper>
          <ConfigurationWarningBanner
            message="Using fallback configuration due to network issues"
            details={[
              'Runtime configuration unavailable',
              'Using cached build-time configuration',
              'Some features may be limited',
            ]}
            dismissible={true}
            onDismiss={() => {}}
          />
        </TestWrapper>
      )

      // Should display warning message
      expect(screen.getByText('Configuration Warning')).toBeInTheDocument()
      expect(screen.getByText('Using fallback configuration due to network issues')).toBeInTheDocument()

      // Should have details button
      const detailsButton = screen.getByText('Show details')
      expect(detailsButton).toBeInTheDocument()

      // Click to show details
      const user = userEvent.setup()
      await user.click(detailsButton)

      // Should show detail items
      expect(screen.getByText('Runtime configuration unavailable')).toBeInTheDocument()
      expect(screen.getByText('Using cached build-time configuration')).toBeInTheDocument()
      expect(screen.getByText('Some features may be limited')).toBeInTheDocument()
    })

    it('should recover from errors on subsequent requests', async () => {
      // First request fails
      simulateEnvironmentChange({
        NEXT_PUBLIC_GOTRUE_URL: 'invalid-url',
      })

      const { req: req1, res: res1 } = createMockApiResponse()
      handler(req1, res1)
      expect(res1.statusCode).toBe(500)

      // Fix the configuration
      simulateEnvironmentChange({
        NEXT_PUBLIC_GOTRUE_URL: 'https://valid.example.com/auth/v1',
      })

      const { req: req2, res: res2 } = createMockApiResponse()
      handler(req2, res2)
      expect(res2.statusCode).toBe(200)
      expect(res2.data.gotrueUrl).toBe('https://valid.example.com/auth/v1')
    })
  })

  describe('Logging and Error Messages Validation', () => {
    it('should log configuration source and environment information', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      simulateEnvironmentChange({
        NODE_ENV: 'production',
        SUPABASE_PUBLIC_URL: 'https://prod.example.com',
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)

      // Should log configuration details
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Runtime Config] Environment detected: production')
      )
    })

    it('should provide helpful error messages with troubleshooting steps', async () => {
      simulateEnvironmentChange({
        NEXT_PUBLIC_GOTRUE_URL: 'not-a-valid-url',
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.data).toHaveProperty('error')
      expect(res.data).toHaveProperty('suggestions')
      expect(res.data.suggestions).toBeInstanceOf(Array)
      expect(res.data.suggestions.length).toBeGreaterThan(0)
      expect(res.data.suggestions[0]).toContain('NEXT_PUBLIC_GOTRUE_URL')
    })

    it('should log successful configuration with source information', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      simulateEnvironmentChange({
        SUPABASE_PUBLIC_URL: 'https://example.com',
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data.source).toBe('derived')

      // Should log successful configuration
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Runtime configuration loaded successfully')
      )
    })

    it('should validate all error message formats include troubleshooting guidance', async () => {
      const errorScenarios = [
        {
          env: { NEXT_PUBLIC_GOTRUE_URL: 'invalid-url' },
          expectedErrorType: 'Invalid environment configuration',
        },
        {
          env: { SUPABASE_PUBLIC_URL: 'ftp://invalid-protocol.com' },
          expectedErrorType: 'Invalid environment configuration',
        },
      ]

      for (const scenario of errorScenarios) {
        simulateEnvironmentChange(scenario.env)

        const { req, res } = createMockApiResponse()
        handler(req, res)

        expect(res.statusCode).toBe(500)
        expect(res.data.error).toContain(scenario.expectedErrorType)
        expect(res.data.suggestions).toBeInstanceOf(Array)
        expect(res.data.suggestions.length).toBeGreaterThan(0)

        // Each suggestion should be actionable
        res.data.suggestions.forEach((suggestion: string) => {
          expect(suggestion).toBeTruthy()
          expect(typeof suggestion).toBe('string')
          expect(suggestion.length).toBeGreaterThan(10) // Should be meaningful
        })
      }
    })
  })

  describe('Health Checks and System Validation', () => {
    it('should perform comprehensive health checks', async () => {
      simulateEnvironmentChange({
        SUPABASE_PUBLIC_URL: 'https://example.com',
        API_EXTERNAL_URL: 'https://api.example.com',
      })

      // Mock successful health check responses
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' }),
        })

      global.fetch = mockFetch

      const healthResult = await performConfigHealthCheck()

      expect(healthResult).toBeDefined()
      expect(healthResult.checks).toBeDefined()
      expect(healthResult.checks.runtimeConfigAvailable).toBeDefined()
      expect(healthResult.checks.gotrueReachable).toBeDefined()
      expect(healthResult.checks.apiGatewayReachable).toBeDefined()
    })

    it('should handle health check failures gracefully', async () => {
      simulateEnvironmentChange({
        SUPABASE_PUBLIC_URL: 'https://unreachable.example.com',
      })

      // Mock failed health check responses
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'))
      global.fetch = mockFetch

      const healthResult = await performConfigHealthCheck()

      expect(healthResult).toBeDefined()
      expect(healthResult.healthy).toBe(false)
      expect(healthResult.errors.length).toBeGreaterThan(0)
    })

    it('should validate configuration completeness', async () => {
      // Test with missing required configuration
      simulateEnvironmentChange({
        NODE_ENV: 'production',
        // Missing SUPABASE_PUBLIC_URL and other required vars
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200) // Should still work with defaults
      expect(res.data.source).toBe('default')
      expect(res.data.environment).toBe('production')

      // But validation should show warnings
      const validation = validateUrlsForEnvironment(
        {
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        },
        'production'
      )
      expect(validation.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('Configuration Manager Integration', () => {
    it('should integrate configuration manager with UI components', async () => {
      // Mock successful configuration
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          gotrueUrl: 'https://example.com/auth/v1',
          supabaseUrl: 'https://example.com',
          apiUrl: 'https://example.com',
          anonKey: 'test-key',
          source: 'derived',
          environment: 'production',
          timestamp: Date.now(),
        }),
      })
      global.fetch = mockFetch

      render(
        <TestWrapper>
          <TestConfigurationManager />
        </TestWrapper>
      )

      // Should eventually load configuration
      await waitFor(() => {
        expect(screen.getByTestId('config-loaded')).toHaveTextContent('true')
      }, { timeout: 5000 })

      expect(screen.getByTestId('config-loading')).toHaveTextContent('false')
      expect(screen.getByTestId('config-error')).toHaveTextContent('none')
      expect(screen.getByTestId('status-message')).toHaveTextContent('Configuration loaded successfully')
    })

    it('should handle configuration manager retry functionality', async () => {
      let fetchCallCount = 0
      const mockFetch = vi.fn().mockImplementation(() => {
        fetchCallCount++
        if (fetchCallCount === 1) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            gotrueUrl: 'https://example.com/auth/v1',
            supabaseUrl: 'https://example.com',
            apiUrl: 'https://example.com',
            anonKey: 'test-key',
            source: 'derived',
            environment: 'production',
            timestamp: Date.now(),
          }),
        })
      })
      global.fetch = mockFetch

      const mockError: ConfigError = {
        type: 'NETWORK_ERROR',
        message: 'Network connection failed',
        canFallback: true,
        originalError: new Error('Network error'),
      }

      render(
        <TestWrapper>
          <TestConfigurationManager simulateError={mockError} />
        </TestWrapper>
      )

      // Should show error initially
      expect(screen.getByText('Network Connection Failed')).toBeInTheDocument()

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i })
      const user = userEvent.setup()
      await user.click(retryButton)

      // Should eventually succeed
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Complete System Integration', () => {
    it('should validate entire system works end-to-end in production', async () => {
      // Set up complete production environment
      simulateEnvironmentChange({
        NODE_ENV: 'production',
        SUPABASE_PUBLIC_URL: 'https://prod.example.com',
        API_EXTERNAL_URL: 'https://api.prod.example.com',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'prod-anon-key',
      })

      // Mock all network requests to succeed
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            gotrueUrl: 'https://prod.example.com/auth/v1',
            supabaseUrl: 'https://prod.example.com',
            apiUrl: 'https://api.prod.example.com',
            anonKey: 'prod-anon-key',
            source: 'derived',
            environment: 'production',
            timestamp: Date.now(),
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ status: 'ok' }),
        })

      global.fetch = mockFetch

      // Test 1: Runtime config API
      const { req, res } = createMockApiResponse()
      handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.data.environment).toBe('production')

      // Test 2: Frontend configuration loading
      const config = await fetchRuntimeConfig()
      expect(config.environment).toBe('production')
      expect(config.gotrueUrl).not.toContain('localhost')

      // Test 3: Environment detection
      const envInfo = detectEnvironment({
        gotrueUrl: config.gotrueUrl,
        supabaseUrl: config.supabaseUrl,
        apiUrl: config.apiUrl,
      })
      expect(envInfo.environment).toBe('production')

      // Test 4: URL validation
      const validation = validateUrlsForEnvironment(
        {
          gotrueUrl: config.gotrueUrl,
          supabaseUrl: config.supabaseUrl,
          apiUrl: config.apiUrl,
        },
        'production'
      )
      expect(validation.isValid).toBe(true)

      // Test 5: Health checks
      const healthResult = await performConfigHealthCheck()
      expect(healthResult).toBeDefined()

      // Test 6: Configuration manager integration
      let finalConfig: RuntimeConfig | null = null
      const onConfigLoad = (config: RuntimeConfig | null) => {
        finalConfig = config
      }

      render(
        <TestWrapper>
          <TestConfigurationManager onConfigLoad={onConfigLoad} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('config-loaded')).toHaveTextContent('true')
      })

      expect(finalConfig).toBeTruthy()
      expect(finalConfig?.environment).toBe('production')
      expect(finalConfig?.gotrueUrl).not.toContain('localhost')
    })

    it('should handle complete error recovery flow', async () => {
      // Start with failing configuration
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new Error('Initial network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            gotrueUrl: 'https://fallback.example.com/auth/v1',
            supabaseUrl: 'https://fallback.example.com',
            apiUrl: 'https://fallback.example.com',
            anonKey: 'fallback-key',
            source: 'derived',
            environment: 'production',
            timestamp: Date.now(),
          }),
        })

      global.fetch = mockFetch

      const mockError: ConfigError = {
        type: 'NETWORK_ERROR',
        message: 'Initial network connection failed',
        canFallback: true,
        originalError: new Error('Network error'),
      }

      render(
        <TestWrapper>
          <TestConfigurationManager simulateError={mockError} />
        </TestWrapper>
      )

      // Should show error recovery UI
      expect(screen.getByText('Network Connection Failed')).toBeInTheDocument()
      expect(screen.getByText(/Initial network connection failed/)).toBeInTheDocument()

      // Should have troubleshooting steps
      const troubleshootingButton = screen.getByText('💡 Troubleshooting Steps')
      expect(troubleshootingButton).toBeInTheDocument()

      // Click to expand troubleshooting
      const user = userEvent.setup()
      await user.click(troubleshootingButton)

      // Should show suggestions
      await waitFor(() => {
        expect(screen.getByText(/Verify your network connection/)).toBeInTheDocument()
      })

      // Test retry functionality
      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      // Should eventually recover
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })
  })
})