/**
 * Basic Configuration Logging Tests
 * 
 * Simple tests for the configuration logging system without complex mocking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  logConfigurationSource,
  logFailedRequest,
  logConfigurationValidation,
  type RequestLogInfo,
} from 'common/configuration-logging'

// Mock localStorage to avoid MSW issues
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
})

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

describe('Configuration Logging - Basic Tests', () => {
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

  describe('logConfigurationSource', () => {
    it('should log basic configuration information', () => {
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
  })

  describe('logFailedRequest', () => {
    it('should log failed request information', () => {
      const requestInfo: RequestLogInfo = {
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
  })

  describe('logConfigurationValidation', () => {
    it('should log successful validation', () => {
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

    it('should log validation errors', () => {
      const errors = ['Invalid URL format']
      const warnings = ['Using derived URL in production']

      logConfigurationValidation(
        'Test Component',
        false,
        errors,
        warnings
      )

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Configuration validation failed')
      )
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('1. Invalid URL format')
      )
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('1. Using derived URL in production')
      )
    })
  })
})