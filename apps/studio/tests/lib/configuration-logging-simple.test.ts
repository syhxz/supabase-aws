/**
 * Simple Configuration Logging Tests
 * 
 * Tests for the configuration logging system without MSW dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

describe('Configuration Logging - Simple Tests', () => {
  beforeEach(() => {
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(mockConsole.log)
    vi.spyOn(console, 'warn').mockImplementation(mockConsole.warn)
    vi.spyOn(console, 'error').mockImplementation(mockConsole.error)
    
    // Reset mock calls
    mockConsole.log.mockClear()
    mockConsole.warn.mockClear()
    mockConsole.error.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should import configuration logging functions', async () => {
    const {
      logConfigurationSource,
      logFailedRequest,
      logConfigurationValidation,
    } = await import('common/configuration-logging')

    expect(logConfigurationSource).toBeDefined()
    expect(logFailedRequest).toBeDefined()
    expect(logConfigurationValidation).toBeDefined()
  })

  it('should log configuration source information', async () => {
    const { logConfigurationSource } = await import('common/configuration-logging')
    
    logConfigurationSource(
      'Test Component',
      'runtime',
      {
        gotrueUrl: 'https://example.com/auth/v1',
        supabaseUrl: 'https://example.com',
        apiUrl: 'https://api.example.com',
      },
      'production'
    )

    expect(mockConsole.log).toHaveBeenCalledWith(
      expect.stringContaining('Configuration loaded successfully')
    )
    expect(mockConsole.log).toHaveBeenCalledWith(
      expect.stringContaining('Source: runtime')
    )
    expect(mockConsole.log).toHaveBeenCalledWith(
      expect.stringContaining('Environment: PRODUCTION')
    )
  })

  it('should log failed request information', async () => {
    const { logFailedRequest } = await import('common/configuration-logging')
    
    const requestInfo = {
      url: 'https://api.example.com/config',
      method: 'GET',
      status: 500,
      responseTime: 1500,
      success: false,
      error: 'Internal Server Error',
    }

    logFailedRequest('Test Component', requestInfo)

    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining('Request failed')
    )
    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining('URL: https://api.example.com/config')
    )
    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining('Status: 500')
    )
  })

  it('should log validation results', async () => {
    const { logConfigurationValidation } = await import('common/configuration-logging')
    
    logConfigurationValidation(
      'Test Component',
      true,
      [],
      []
    )

    expect(mockConsole.log).toHaveBeenCalledWith(
      expect.stringContaining('Configuration validation passed')
    )
  })
})