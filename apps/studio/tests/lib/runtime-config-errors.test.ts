/**
 * Tests for runtime configuration error handling
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import {
  ConfigError,
  ConfigErrorType,
  analyzeConfigError,
  createNetworkTimeoutError,
  createNetworkError,
  createInvalidResponseError,
  createMissingEnvVarsError,
  createInvalidUrlError,
  createServerError,
  createUnknownError,
  formatErrorForUser,
} from 'common'

describe('ConfigError', () => {
  it('should create a ConfigError with all properties', () => {
    const error = new ConfigError({
      type: ConfigErrorType.NETWORK_TIMEOUT,
      message: 'Request timeout',
      userMessage: 'Configuration request timed out',
      suggestions: ['Check your network connection'],
      docsUrl: '/docs/config',
      canFallback: true,
    })

    expect(error.type).toBe(ConfigErrorType.NETWORK_TIMEOUT)
    expect(error.message).toBe('Request timeout')
    expect(error.userMessage).toBe('Configuration request timed out')
    expect(error.suggestions).toEqual(['Check your network connection'])
    expect(error.docsUrl).toBe('/docs/config')
    expect(error.canFallback).toBe(true)
  })

  it('should generate display message with suggestions', () => {
    const error = new ConfigError({
      type: ConfigErrorType.NETWORK_ERROR,
      message: 'Network failed',
      userMessage: 'Failed to connect',
      suggestions: ['Check network', 'Verify server'],
      docsUrl: '/docs/troubleshooting',
      canFallback: true,
    })

    const displayMessage = error.getDisplayMessage()
    expect(displayMessage).toContain('Failed to connect')
    expect(displayMessage).toContain('Check network')
    expect(displayMessage).toContain('Verify server')
    expect(displayMessage).toContain('/docs/troubleshooting')
  })

  it('should convert to JSON', () => {
    const error = new ConfigError({
      type: ConfigErrorType.INVALID_RESPONSE,
      message: 'Invalid response',
      userMessage: 'Server returned invalid data',
      suggestions: ['Check server logs'],
      canFallback: true,
    })

    const json = error.toJSON()
    expect(json.type).toBe(ConfigErrorType.INVALID_RESPONSE)
    expect(json.message).toBe('Invalid response')
    expect(json.userMessage).toBe('Server returned invalid data')
    expect(json.suggestions).toEqual(['Check server logs'])
    expect(json.canFallback).toBe(true)
  })
})

describe('Error Factory Functions', () => {
  it('should create network timeout error', () => {
    const error = createNetworkTimeoutError(3000)
    expect(error.type).toBe(ConfigErrorType.NETWORK_TIMEOUT)
    expect(error.message).toContain('3000ms')
    expect(error.canFallback).toBe(true)
    expect(error.suggestions.length).toBeGreaterThan(0)
  })

  it('should create network error', () => {
    const originalError = new Error('Network failed')
    const error = createNetworkError(originalError)
    expect(error.type).toBe(ConfigErrorType.NETWORK_ERROR)
    expect(error.originalError).toBe(originalError)
    expect(error.canFallback).toBe(true)
  })

  it('should create invalid response error', () => {
    const error = createInvalidResponseError('missing required fields')
    expect(error.type).toBe(ConfigErrorType.INVALID_RESPONSE)
    expect(error.message).toContain('missing required fields')
    expect(error.canFallback).toBe(true)
  })

  it('should create missing env vars error', () => {
    const error = createMissingEnvVarsError(['SUPABASE_URL', 'API_KEY'])
    expect(error.type).toBe(ConfigErrorType.MISSING_ENV_VARS)
    expect(error.message).toContain('SUPABASE_URL')
    expect(error.message).toContain('API_KEY')
    expect(error.canFallback).toBe(true)
  })

  it('should create invalid URL error', () => {
    const error = createInvalidUrlError('not-a-url', 'gotrueUrl')
    expect(error.type).toBe(ConfigErrorType.INVALID_URL)
    expect(error.message).toContain('not-a-url')
    expect(error.message).toContain('gotrueUrl')
    expect(error.canFallback).toBe(true)
  })

  it('should create server error', () => {
    const error = createServerError(500, 'Internal server error')
    expect(error.type).toBe(ConfigErrorType.SERVER_ERROR)
    expect(error.message).toContain('500')
    expect(error.message).toContain('Internal server error')
    expect(error.canFallback).toBe(true)
  })

  it('should create unknown error', () => {
    const originalError = new Error('Something went wrong')
    const error = createUnknownError(originalError)
    expect(error.type).toBe(ConfigErrorType.UNKNOWN)
    expect(error.originalError).toBe(originalError)
    expect(error.canFallback).toBe(true)
  })
})

describe('analyzeConfigError', () => {
  it('should return ConfigError as-is', () => {
    const configError = createNetworkTimeoutError(3000)
    const analyzed = analyzeConfigError(configError)
    expect(analyzed).toBe(configError)
  })

  it('should detect network timeout errors', () => {
    const error = new Error('Request timeout after 3000ms')
    const analyzed = analyzeConfigError(error)
    expect(analyzed.type).toBe(ConfigErrorType.NETWORK_TIMEOUT)
  })

  it('should detect network errors', () => {
    const error = new Error('Network request failed')
    const analyzed = analyzeConfigError(error)
    expect(analyzed.type).toBe(ConfigErrorType.NETWORK_ERROR)
  })

  it('should detect fetch failed errors', () => {
    const error = new Error('Failed to fetch')
    const analyzed = analyzeConfigError(error)
    expect(analyzed.type).toBe(ConfigErrorType.NETWORK_ERROR)
  })

  it('should detect invalid response errors', () => {
    const error = new Error('Invalid configuration response: missing required fields')
    const analyzed = analyzeConfigError(error)
    expect(analyzed.type).toBe(ConfigErrorType.INVALID_RESPONSE)
  })

  it('should detect server errors', () => {
    const error = new Error('HTTP 500: Internal Server Error')
    const analyzed = analyzeConfigError(error)
    expect(analyzed.type).toBe(ConfigErrorType.SERVER_ERROR)
  })

  it('should handle non-Error objects', () => {
    const analyzed = analyzeConfigError('Something went wrong')
    expect(analyzed.type).toBe(ConfigErrorType.UNKNOWN)
    expect(analyzed.message).toContain('Something went wrong')
  })

  it('should handle null/undefined', () => {
    const analyzed = analyzeConfigError(null)
    expect(analyzed.type).toBe(ConfigErrorType.UNKNOWN)
  })
})

describe('formatErrorForUser', () => {
  it('should format error with warning severity for fallback errors', () => {
    const error = createNetworkTimeoutError(3000)
    const formatted = formatErrorForUser(error)
    
    expect(formatted.title).toBe('Configuration Warning')
    expect(formatted.severity).toBe('warning')
    expect(formatted.message).toBe(error.userMessage)
    expect(formatted.suggestions).toEqual(error.suggestions)
  })

  it('should format error with error severity for non-fallback errors', () => {
    const error = new ConfigError({
      type: ConfigErrorType.UNKNOWN,
      message: 'Critical error',
      userMessage: 'Critical configuration error',
      suggestions: ['Contact support'],
      canFallback: false,
    })
    
    const formatted = formatErrorForUser(error)
    
    expect(formatted.title).toBe('Configuration Error')
    expect(formatted.severity).toBe('error')
  })
})

describe('Error Handling Integration', () => {
  it('should provide helpful suggestions for all error types', () => {
    const errorTypes = [
      createNetworkTimeoutError(3000),
      createNetworkError(new Error('Network failed')),
      createInvalidResponseError('missing fields'),
      createMissingEnvVarsError(['VAR1']),
      createInvalidUrlError('bad-url', 'field'),
      createServerError(500, 'error'),
      createUnknownError(new Error('unknown')),
    ]

    errorTypes.forEach((error) => {
      expect(error.suggestions.length).toBeGreaterThan(0)
      expect(error.userMessage).toBeTruthy()
      expect(error.canFallback).toBe(true)
    })
  })

  it('should include fallback information in suggestions', () => {
    const error = createNetworkTimeoutError(3000)
    const hasFallbackSuggestion = error.suggestions.some((s) =>
      s.toLowerCase().includes('fallback') || s.toLowerCase().includes('default')
    )
    expect(hasFallbackSuggestion).toBe(true)
  })
})
