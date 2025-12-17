/**
 * Configuration Logging Tests
 * 
 * Tests for the comprehensive configuration logging system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  logConfigurationSource,
  logFailedRequest,
  logSuccessfulRequest,
  logConfigurationChange,
  logConfigurationError,
  logConfigurationValidation,
  getConfigurationChangeHistory,
  clearConfigurationChangeHistory,
  enableConfigDebugLogging,
  disableConfigDebugLogging,
  ConfigOperation,
  type RequestLogInfo,
} from 'common/configuration-logging'
import { ConfigError, ConfigErrorType } from 'common/runtime-config-errors'

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

describe('Configuration Logging', () => {
  beforeEach(() => {
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(mockConsole.log)
    vi.spyOn(console, 'warn').mockImplementation(mockConsole.warn)
    vi.spyOn(console, 'error').mockImplementation(mockConsole.error)
    
    // Clear change history
    clearConfigurationChangeHistory()
    
    // Reset mock calls
    mockConsole.log.mockClear()
    mockConsole.warn.mockClear()
    mockConsole.error.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('logConfigurationSource', () => {
    it('should log configuration source information', () => {
      logConfigurationSource(
        'Test Component',
        'runtime',
        {
          gotrueUrl: 'https://example.com/auth/v1',
          supabaseUrl: 'https://example.com',
          apiUrl: 'https://api.example.com',
        },
        'production',
        { hasAnonKey: true }
      )

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[Test Component] [LOAD] ✓ Configuration loaded successfully')
      )
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Source: runtime')
      )
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Environment: PRODUCTION')
      )
    })

    it('should sanitize URLs in logs', () => {
      logConfigurationSource(
        'Test Component',
        'runtime',
        {
          gotrueUrl: 'https://example.com/auth/v1?secret=token#fragment',
          supabaseUrl: 'https://example.com?key=value',
          apiUrl: 'https://api.example.com',
        },
        'production'
      )

      // URLs should be sanitized (no query params or fragments)
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('GoTrue URL: https://example.com/auth/v1')
      )
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Supabase URL: https://example.com')
      )
    })

    it('should warn about localhost URLs in production', () => {
      logConfigurationSource(
        'Test Component',
        'default',
        {
          gotrueUrl: 'http://localhost:54321/auth/v1',
          supabaseUrl: 'http://localhost:54321',
          apiUrl: 'http://localhost:8000',
        },
        'production'
      )

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL ERROR: Production environment using localhost URLs!')
      )
    })

    it('should log appropriate messages for development environment', () => {
      logConfigurationSource(
        'Test Component',
        'default',
        {
          gotrueUrl: 'http://localhost:54321/auth/v1',
          supabaseUrl: 'http://localhost:54321',
          apiUrl: 'http://localhost:8000',
        },
        'development'
      )

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('DEVELOPMENT environment detected')
      )
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Using localhost URLs (expected for development)')
      )
    })
  })

  describe('logFailedRequest', () => {
    it('should log failed request with troubleshooting steps', () => {
      const requestInfo: RequestLogInfo = {
        url: 'https://api.example.com/config',
        method: 'GET',
        status: 500,
        responseTime: 1500,
        success: false,
        error: 'Internal Server Error',
      }

      const troubleshootingSteps = [
        'Check server logs',
        'Verify server is running',
        'Check network connectivity',
      ]

      logFailedRequest('Test Component', requestInfo, troubleshootingSteps)

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[Test Component] [ERROR_HANDLING] ❌ Request failed')
      )
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('URL: https://api.example.com/config')
      )
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Status: 500')
      )
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Response time: 1500ms')
      )
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Error: Internal Server Error')
      )
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('1. Check server logs')
      )
    })

    it('should provide environment-specific guidance for localhost URLs', () => {
      const requestInfo: RequestLogInfo = {
        url: 'http://localhost:8000/api/config',
        method: 'GET',
        success: false,
        error: 'Connection refused',
      }

      logFailedRequest('Test Component', requestInfo)

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('🔧 Development Environment Troubleshooting:')
      )
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('docker-compose ps')
      )
    })

    it('should provide production-specific guidance for remote URLs', () => {
      const requestInfo: RequestLogInfo = {
        url: 'https://api.production.com/config',
        method: 'GET',
        success: false,
        error: 'Connection timeout',
      }

      logFailedRequest('Test Component', requestInfo)

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Production Environment Troubleshooting:')
      )
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Check production service status dashboards')
      )
    })
  })

  describe('logSuccessfulRequest', () => {
    it('should log successful request in debug mode', () => {
      // Enable debug logging
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const requestInfo: RequestLogInfo = {
        url: 'https://api.example.com/config',
        method: 'GET',
        status: 200,
        responseTime: 150,
        success: true,
      }

      logSuccessfulRequest('Test Component', requestInfo)

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[Test Component] ✓ Request successful')
      )
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('URL: https://api.example.com/config')
      )

      // Restore environment
      process.env.NODE_ENV = originalEnv
    })

    it('should not log in production mode by default', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const requestInfo: RequestLogInfo = {
        url: 'https://api.example.com/config',
        method: 'GET',
        status: 200,
        responseTime: 150,
        success: true,
      }

      logSuccessfulRequest('Test Component', requestInfo)

      // Should not log in production unless debug is enabled
      expect(mockConsole.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Request successful')
      )

      // Restore environment
      process.env.NODE_ENV = originalEnv
    })
  })

  describe('logConfigurationChange', () => {
    it('should log configuration changes and update history', () => {
      const previousConfig = {
        gotrueUrl: 'http://localhost:54321/auth/v1',
        supabaseUrl: 'http://localhost:54321',
        apiUrl: 'http://localhost:8000',
        source: 'default' as const,
      }

      const newConfig = {
        gotrueUrl: 'https://api.example.com/auth/v1',
        supabaseUrl: 'https://api.example.com',
        apiUrl: 'https://api.example.com',
        source: 'runtime' as const,
      }

      logConfigurationChange(
        'Test Component',
        ConfigOperation.UPDATE,
        previousConfig,
        newConfig,
        'production'
      )

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[Test Component] [UPDATE] Configuration changed')
      )
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Previous source: default')
      )
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('New source: runtime')
      )

      // Check that change was added to history
      const history = getConfigurationChangeHistory()
      expect(history).toHaveLength(1)
      expect(history[0].operation).toBe(ConfigOperation.UPDATE)
      expect(history[0].previousSource).toBe('default')
      expect(history[0].newSource).toBe('runtime')
    })

    it('should log URL changes', () => {
      const previousConfig = {
        gotrueUrl: 'http://localhost:54321/auth/v1',
        source: 'default' as const,
      }

      const newConfig = {
        gotrueUrl: 'https://api.example.com/auth/v1',
        source: 'runtime' as const,
      }

      logConfigurationChange(
        'Test Component',
        ConfigOperation.UPDATE,
        previousConfig,
        newConfig,
        'production'
      )

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('GoTrue URL changed:')
      )
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('From: http://localhost:54321/auth/v1')
      )
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('To: https://api.example.com/auth/v1')
      )
    })
  })

  describe('logConfigurationError', () => {
    it('should log configuration errors with troubleshooting', () => {
      const error = new ConfigError({
        type: ConfigErrorType.NETWORK_TIMEOUT,
        message: 'Request timeout after 3000ms',
        userMessage: 'Configuration request timed out',
        suggestions: [
          'Check your network connection',
          'Verify the server is running',
        ],
        canFallback: true,
      })

      logConfigurationError('Test Component', error, {
        url: 'https://api.example.com/config',
        timeout: 3000,
      })

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Test Component] [ERROR_HANDLING] ⚠️  Configuration warning')
      )
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Technical details: Request timeout after 3000ms')
      )
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('1. Check your network connection')
      )
    })

    it('should log critical errors differently', () => {
      const error = new ConfigError({
        type: ConfigErrorType.INVALID_URL,
        message: 'Invalid URL format',
        userMessage: 'Configuration contains invalid URL',
        suggestions: ['Check URL format'],
        canFallback: false,
      })

      logConfigurationError('Test Component', error)

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[Test Component] [ERROR_HANDLING] ❌ Configuration error')
      )
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('This is a critical error that prevents normal operation')
      )
    })
  })

  describe('logConfigurationValidation', () => {
    it('should log successful validation', () => {
      logConfigurationValidation(
        'Test Component',
        true,
        [],
        [],
        { gotrueUrl: 'https://api.example.com/auth/v1', source: 'runtime' }
      )

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[Test Component] [VALIDATE] ✓ Configuration validation passed')
      )
    })

    it('should log validation errors and warnings', () => {
      const errors = ['Invalid URL format']
      const warnings = ['Using derived URL in production']

      logConfigurationValidation(
        'Test Component',
        false,
        errors,
        warnings
      )

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[Test Component] [VALIDATE] ❌ Configuration validation failed')
      )
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('1. Invalid URL format')
      )
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('1. Using derived URL in production')
      )
    })
  })

  describe('Configuration Change History', () => {
    it('should track configuration changes', () => {
      expect(getConfigurationChangeHistory()).toHaveLength(0)

      logConfigurationChange(
        'Test Component',
        ConfigOperation.LOAD,
        null,
        { gotrueUrl: 'https://api.example.com/auth/v1', source: 'runtime' },
        'production'
      )

      const history = getConfigurationChangeHistory()
      expect(history).toHaveLength(1)
      expect(history[0].operation).toBe(ConfigOperation.LOAD)
      expect(history[0].newSource).toBe('runtime')
    })

    it('should limit history size', () => {
      // Add more than MAX_CHANGE_HISTORY entries
      for (let i = 0; i < 55; i++) {
        logConfigurationChange(
          'Test Component',
          ConfigOperation.UPDATE,
          null,
          { gotrueUrl: `https://api${i}.example.com/auth/v1`, source: 'runtime' },
          'production'
        )
      }

      const history = getConfigurationChangeHistory()
      expect(history.length).toBeLessThanOrEqual(50) // MAX_CHANGE_HISTORY
    })

    it('should clear history when requested', () => {
      logConfigurationChange(
        'Test Component',
        ConfigOperation.LOAD,
        null,
        { gotrueUrl: 'https://api.example.com/auth/v1', source: 'runtime' },
        'production'
      )

      expect(getConfigurationChangeHistory()).toHaveLength(1)

      clearConfigurationChangeHistory()

      expect(getConfigurationChangeHistory()).toHaveLength(0)
    })
  })

  describe('Debug Logging', () => {
    let localStorageMock: any

    beforeEach(() => {
      // Mock localStorage only in browser environment
      if (typeof window !== 'undefined') {
        localStorageMock = {
          getItem: vi.fn(),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        }
        Object.defineProperty(window, 'localStorage', {
          value: localStorageMock,
          writable: true,
        })
      }
    })

    it('should enable debug logging', () => {
      if (typeof window !== 'undefined') {
        enableConfigDebugLogging()

        expect(localStorageMock.setItem).toHaveBeenCalledWith('config-debug', 'true')
        expect(mockConsole.log).toHaveBeenCalledWith(
          '[Configuration Logging] Debug logging enabled'
        )
      }
    })

    it('should disable debug logging', () => {
      if (typeof window !== 'undefined') {
        disableConfigDebugLogging()

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('config-debug')
        expect(mockConsole.log).toHaveBeenCalledWith(
          '[Configuration Logging] Debug logging disabled'
        )
      }
    })
  })
})