/**
 * Configuration Error Recovery Tests
 * 
 * Tests the comprehensive error recovery and user feedback system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConfigError, ConfigErrorType } from 'common/runtime-config-errors'
import {
  validateFallbackConfiguration,
  explainConfigurationLimitations,
} from '../../lib/configuration-fallback'

// Mock localStorage for Node.js environment
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}

// Mock global window and localStorage
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: mockLocalStorage,
  },
  writable: true,
})

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

describe('Configuration Error Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateFallbackConfiguration', () => {
    it('should validate correct configuration', () => {
      const config = {
        gotrueUrl: 'https://example.com/auth/v1',
        supabaseUrl: 'https://example.com',
        apiUrl: 'https://example.com',
        anonKey: 'test-key',
        source: 'build-time' as const,
        environment: 'production' as const,
        limitations: [],
        timestamp: Date.now(),
      }
      
      const result = validateFallbackConfiguration(config)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect invalid URLs', () => {
      const config = {
        gotrueUrl: 'invalid-url',
        supabaseUrl: 'https://example.com',
        apiUrl: 'https://example.com',
        anonKey: 'test-key',
        source: 'build-time' as const,
        environment: 'production' as const,
        limitations: [],
        timestamp: Date.now(),
      }
      
      const result = validateFallbackConfiguration(config)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid GoTrue URL in fallback configuration')
    })

    it('should detect localhost in production', () => {
      const config = {
        gotrueUrl: 'http://localhost:54321/auth/v1',
        supabaseUrl: 'http://localhost:54321',
        apiUrl: 'http://localhost:8000',
        anonKey: 'test-key',
        source: 'build-time' as const,
        environment: 'production' as const,
        limitations: [],
        timestamp: Date.now(),
      }
      
      const result = validateFallbackConfiguration(config)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('GoTrue URL uses localhost in production environment')
      expect(result.errors).toContain('API URL uses localhost in production environment')
    })

    it('should warn about missing API key', () => {
      const config = {
        gotrueUrl: 'https://example.com/auth/v1',
        supabaseUrl: 'https://example.com',
        apiUrl: 'https://example.com',
        anonKey: '',
        source: 'build-time' as const,
        environment: 'production' as const,
        limitations: [],
        timestamp: Date.now(),
      }
      
      const result = validateFallbackConfiguration(config)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('No API key configured - authentication may not work')
    })
  })

  describe('explainConfigurationLimitations', () => {
    it('should explain cached configuration limitations', () => {
      const config = {
        gotrueUrl: 'https://example.com/auth/v1',
        supabaseUrl: 'https://example.com',
        apiUrl: 'https://example.com',
        anonKey: 'test-key',
        source: 'cached' as const,
        environment: 'production' as const,
        limitations: ['Using cached configuration'],
        timestamp: Date.now(),
      }
      
      const explanation = explainConfigurationLimitations(config)
      
      expect(explanation.title).toBe('Using Cached Configuration')
      expect(explanation.description).toContain('saved from a previous session')
      expect(explanation.impacts).toContain('Configuration may be outdated')
      expect(explanation.actions).toContain('Refresh the page to try fetching latest configuration')
    })

    it('should explain build-time configuration limitations', () => {
      const config = {
        gotrueUrl: 'https://example.com/auth/v1',
        supabaseUrl: 'https://example.com',
        apiUrl: 'https://example.com',
        anonKey: 'test-key',
        source: 'build-time' as const,
        environment: 'production' as const,
        limitations: ['Using build-time configuration'],
        timestamp: Date.now(),
      }
      
      const explanation = explainConfigurationLimitations(config)
      
      expect(explanation.title).toBe('Using Build-Time Configuration')
      expect(explanation.description).toContain('compiled when it was built')
      expect(explanation.impacts).toContain('Cannot adapt to environment changes without rebuild')
      expect(explanation.actions).toContain('Check network connectivity to configuration server')
    })

    it('should explain emergency defaults limitations', () => {
      const config = {
        gotrueUrl: 'http://127.0.0.1:54321/auth/v1',
        supabaseUrl: 'http://127.0.0.1:54321',
        apiUrl: 'http://127.0.0.1:8000',
        anonKey: '',
        source: 'emergency-defaults' as const,
        environment: 'development' as const,
        limitations: ['Using emergency defaults'],
        timestamp: Date.now(),
      }
      
      const explanation = explainConfigurationLimitations(config)
      
      expect(explanation.title).toBe('Using Emergency Defaults')
      expect(explanation.description).toContain('hardcoded default values as a last resort')
      expect(explanation.impacts).toContain('Only works for local development')
      expect(explanation.actions).toContain('Ensure local Supabase services are running')
    })
  })


})

describe('Error Recovery User Messages', () => {
  it('should provide appropriate error messages for different error types', () => {
    const networkError = new ConfigError({
      type: ConfigErrorType.NETWORK_ERROR,
      message: 'Network failed',
      userMessage: 'Failed to connect to configuration server',
      suggestions: ['Check network connection'],
    })
    
    expect(networkError.userMessage).toBe('Failed to connect to configuration server')
    expect(networkError.suggestions).toContain('Check network connection')
    expect(networkError.canFallback).toBe(true)
  })

  it('should handle different error types appropriately', () => {
    const timeoutError = new ConfigError({
      type: ConfigErrorType.NETWORK_TIMEOUT,
      message: 'Request timeout after 3000ms',
      userMessage: 'Configuration request timed out',
      suggestions: ['Check network connection', 'Try refreshing the page'],
    })
    
    expect(timeoutError.type).toBe(ConfigErrorType.NETWORK_TIMEOUT)
    expect(timeoutError.userMessage).toBe('Configuration request timed out')
    expect(timeoutError.suggestions).toHaveLength(2)
  })
})