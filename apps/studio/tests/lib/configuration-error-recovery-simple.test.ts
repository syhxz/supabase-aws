/**
 * Simple Configuration Error Recovery Tests
 * 
 * Tests the core error recovery functionality without complex mocking.
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { ConfigError, ConfigErrorType, formatErrorForUser } from 'common/runtime-config-errors'
import { validateFallbackConfiguration, explainConfigurationLimitations } from '../../lib/configuration-fallback'

describe('Configuration Error Recovery - Core Functionality', () => {
  describe('ConfigError', () => {
    it('should create error with user-friendly message', () => {
      const error = new ConfigError({
        type: ConfigErrorType.NETWORK_TIMEOUT,
        message: 'Request timeout after 3000ms',
        userMessage: 'Configuration request timed out',
        suggestions: ['Check network connection', 'Try refreshing the page'],
        canFallback: true,
      })
      
      expect(error.type).toBe(ConfigErrorType.NETWORK_TIMEOUT)
      expect(error.userMessage).toBe('Configuration request timed out')
      expect(error.suggestions).toHaveLength(2)
      expect(error.canFallback).toBe(true)
    })

    it('should format error for user display', () => {
      const error = new ConfigError({
        type: ConfigErrorType.SERVER_ERROR,
        message: 'Server returned 500',
        userMessage: 'Server configuration error',
        suggestions: ['Check server logs', 'Contact administrator'],
        canFallback: true,
      })
      
      const formatted = formatErrorForUser(error)
      
      expect(formatted.title).toBe('Configuration Warning')
      expect(formatted.message).toBe('Server configuration error')
      expect(formatted.suggestions).toEqual(['Check server logs', 'Contact administrator'])
      expect(formatted.severity).toBe('warning')
    })

    it('should handle critical errors differently', () => {
      const error = new ConfigError({
        type: ConfigErrorType.INVALID_URL,
        message: 'Invalid URL format',
        userMessage: 'Configuration contains invalid URL',
        suggestions: ['Check URL format'],
        canFallback: false,
      })
      
      const formatted = formatErrorForUser(error)
      
      expect(formatted.title).toBe('Configuration Error')
      expect(formatted.severity).toBe('error')
    })
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

    it('should allow localhost in development', () => {
      const config = {
        gotrueUrl: 'http://localhost:54321/auth/v1',
        supabaseUrl: 'http://localhost:54321',
        apiUrl: 'http://localhost:8000',
        anonKey: 'test-key',
        source: 'build-time' as const,
        environment: 'development' as const,
        limitations: [],
        timestamp: Date.now(),
      }
      
      const result = validateFallbackConfiguration(config)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
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

    it('should handle unknown configuration source', () => {
      const config = {
        gotrueUrl: 'https://example.com/auth/v1',
        supabaseUrl: 'https://example.com',
        apiUrl: 'https://example.com',
        anonKey: 'test-key',
        source: 'unknown' as any,
        environment: 'production' as const,
        limitations: [],
        timestamp: Date.now(),
      }
      
      const explanation = explainConfigurationLimitations(config)
      
      expect(explanation.title).toBe('Unknown Configuration Source')
      expect(explanation.description).toContain('not recognized')
      expect(explanation.impacts).toContain('Unpredictable behavior')
      expect(explanation.actions).toContain('Contact support for assistance')
    })
  })

  describe('Error Types and Messages', () => {
    it('should provide appropriate messages for network timeout', () => {
      const error = new ConfigError({
        type: ConfigErrorType.NETWORK_TIMEOUT,
        message: 'Request timeout after 3000ms',
        userMessage: 'Configuration request timed out',
        suggestions: [
          'Check your network connection',
          'Verify the server is running and accessible',
          'Try refreshing the page',
        ],
      })
      
      expect(error.type).toBe(ConfigErrorType.NETWORK_TIMEOUT)
      expect(error.suggestions).toContain('Check your network connection')
      expect(error.canFallback).toBe(true) // Default value
    })

    it('should provide appropriate messages for network error', () => {
      const error = new ConfigError({
        type: ConfigErrorType.NETWORK_ERROR,
        message: 'Failed to fetch',
        userMessage: 'Failed to connect to configuration server',
        suggestions: [
          'Check your network connection',
          'Verify the server is running',
        ],
      })
      
      expect(error.type).toBe(ConfigErrorType.NETWORK_ERROR)
      expect(error.suggestions).toContain('Verify the server is running')
    })

    it('should provide appropriate messages for server error', () => {
      const error = new ConfigError({
        type: ConfigErrorType.SERVER_ERROR,
        message: 'Server error (500): Internal Server Error',
        userMessage: 'Configuration server returned an error',
        suggestions: [
          'Server error detected - check server logs for detailed information',
          'Verify the server is running and has sufficient resources',
        ],
      })
      
      expect(error.type).toBe(ConfigErrorType.SERVER_ERROR)
      expect(error.suggestions).toContain('Server error detected - check server logs for detailed information')
    })

    it('should provide appropriate messages for missing environment variables', () => {
      const error = new ConfigError({
        type: ConfigErrorType.MISSING_ENV_VARS,
        message: 'Missing required environment variables: SUPABASE_PUBLIC_URL',
        userMessage: 'Server configuration is incomplete',
        suggestions: [
          'Set the following environment variables on the server:',
          '  - SUPABASE_PUBLIC_URL',
          'Restart the server after setting environment variables',
        ],
      })
      
      expect(error.type).toBe(ConfigErrorType.MISSING_ENV_VARS)
      expect(error.suggestions).toContain('Set the following environment variables on the server:')
    })
  })
})