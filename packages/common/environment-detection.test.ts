/**
 * Tests for Environment Detection Module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  detectEnvironment,
  detectNetworkEnvironment,
  validateUrlsForEnvironment,
  validateInternalNetworkAddress,
  getNetworkAppropriateUrl,
  logEnvironmentInfo,
  logUrlValidation,
  logNetworkValidation,
  getEnvironmentRecommendations,
  performEnvironmentCheck,
  type Environment,
  type EnvironmentInfo,
  type NetworkEnvironment,
} from './environment-detection'

describe('Environment Detection', () => {
  // Store original environment variables
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.ENVIRONMENT
    delete process.env.NODE_ENV
    delete process.env.SUPABASE_PUBLIC_URL
    delete process.env.SUPABASE_URL
    delete process.env.API_EXTERNAL_URL
  })

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv }
  })

  describe('detectNetworkEnvironment', () => {
    it('should detect server-side environment', () => {
      const result = detectNetworkEnvironment()
      
      expect(result.isServerSide).toBe(true) // Running in Node.js test environment
      expect(result).toHaveProperty('isContainer')
      expect(result).toHaveProperty('preferredProtocol')
      expect(result).toHaveProperty('internalDomain')
      expect(result).toHaveProperty('externalDomain')
      expect(result).toHaveProperty('networkDetectionMethod')
      expect(result).toHaveProperty('networkContext')
    })

    it('should provide appropriate domains based on container detection', () => {
      const result = detectNetworkEnvironment()
      
      // Test environment may be detected as container, so check both cases
      if (result.isContainer) {
        expect(result.internalDomain).toContain('kong')
        expect(result.externalDomain).toContain('localhost')
      } else {
        expect(result.internalDomain).toContain('localhost')
        expect(result.externalDomain).toContain('localhost')
      }
      expect(result.preferredProtocol).toBe('http')
    })

    it('should use custom domain configuration when available', () => {
      process.env.KONG_URL = 'https://custom.example.com:9000'
      
      const result = detectNetworkEnvironment()
      
      // Custom configuration should override defaults regardless of container detection
      if (result.isContainer) {
        expect(result.internalDomain).toBe('custom.example.com:9000')
        expect(result.externalDomain).toBe('custom.example.com:9000')
      } else {
        expect(result.internalDomain).toBe('custom.example.com:9000')
        expect(result.externalDomain).toBe('custom.example.com:9000')
      }
      expect(result.preferredProtocol).toBe('https')
      
      delete process.env.KONG_URL
    })
  })

  describe('validateInternalNetworkAddress', () => {
    it('should validate internal container addresses', () => {
      const networkEnv: NetworkEnvironment = {
        isContainer: true,
        isServerSide: true,
        preferredProtocol: 'http',
        internalDomain: 'kong:8000',
        externalDomain: 'localhost:8000',
        networkDetectionMethod: 'container-env',
        networkContext: 'Test container environment'
      }
      
      const result = validateInternalNetworkAddress('http://kong:8000/auth/v1', networkEnv)
      
      expect(result.isInternalAddress).toBe(true)
      expect(result.isValid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should reject localhost in server-side container environment', () => {
      const networkEnv: NetworkEnvironment = {
        isContainer: true,
        isServerSide: true,
        preferredProtocol: 'http',
        internalDomain: 'kong:8000',
        externalDomain: 'localhost:8000',
        networkDetectionMethod: 'container-env',
        networkContext: 'Test container environment'
      }
      
      const result = validateInternalNetworkAddress('http://localhost:8000/auth/v1', networkEnv)
      
      expect(result.isInternalAddress).toBe(false)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.includes('localhost'))).toBe(true)
    })

    it('should reject internal addresses for client-side', () => {
      const networkEnv: NetworkEnvironment = {
        isContainer: true,
        isServerSide: false,
        preferredProtocol: 'http',
        internalDomain: 'kong:8000',
        externalDomain: 'localhost:8000',
        networkDetectionMethod: 'container-env',
        networkContext: 'Test container environment'
      }
      
      const result = validateInternalNetworkAddress('http://kong:8000/auth/v1', networkEnv)
      
      expect(result.isInternalAddress).toBe(true)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('Client-side'))).toBe(true)
    })
  })

  describe('getNetworkAppropriateUrl', () => {
    it('should transform localhost to internal address for server-side container', () => {
      const networkEnv: NetworkEnvironment = {
        isContainer: true,
        isServerSide: true,
        preferredProtocol: 'http',
        internalDomain: 'kong:8000',
        externalDomain: 'localhost:8000',
        networkDetectionMethod: 'container-env',
        networkContext: 'Test container environment'
      }
      
      const result = getNetworkAppropriateUrl('http://localhost:8000/auth/v1', networkEnv, true)
      
      expect(result).toBe('http://kong:8000/auth/v1')
    })

    it('should transform internal address to external for client-side', () => {
      const networkEnv: NetworkEnvironment = {
        isContainer: true,
        isServerSide: false,
        preferredProtocol: 'http',
        internalDomain: 'kong:8000',
        externalDomain: 'localhost:8000',
        networkDetectionMethod: 'container-env',
        networkContext: 'Test container environment'
      }
      
      const result = getNetworkAppropriateUrl('http://kong:8000/auth/v1', networkEnv, false)
      
      expect(result).toBe('http://localhost:8000/auth/v1')
    })

    it('should preserve URLs that do not need transformation', () => {
      const networkEnv: NetworkEnvironment = {
        isContainer: false,
        isServerSide: true,
        preferredProtocol: 'https',
        internalDomain: 'localhost:8000',
        externalDomain: 'localhost:8000',
        networkDetectionMethod: 'default',
        networkContext: 'Non-container environment'
      }
      
      const originalUrl = 'https://api.example.com/auth/v1'
      const result = getNetworkAppropriateUrl(originalUrl, networkEnv)
      
      expect(result).toBe(originalUrl)
    })
  })

  describe('detectEnvironment', () => {
    it('should detect production from explicit ENVIRONMENT variable', () => {
      process.env.ENVIRONMENT = 'production'
      
      const result = detectEnvironment()
      
      expect(result.environment).toBe('production')
      expect(result.isProduction).toBe(true)
      expect(result.isDevelopment).toBe(false)
      expect(result.isStaging).toBe(false)
      expect(result.detectionMethod).toBe('explicit-env')
      expect(result.networkEnvironment).toBeDefined()
      expect(result.detectionPhase).toBeDefined()
      expect(result.environmentVariables).toBeDefined()
      expect(result.priorityChain).toBeDefined()
      expect(result.missingVariables).toBeDefined()
      expect(result.timestamp).toBeDefined()
    })

    it('should detect development from explicit ENVIRONMENT variable', () => {
      process.env.ENVIRONMENT = 'development'
      
      const result = detectEnvironment()
      
      expect(result.environment).toBe('development')
      expect(result.isProduction).toBe(false)
      expect(result.isDevelopment).toBe(true)
      expect(result.isStaging).toBe(false)
      expect(result.detectionMethod).toBe('explicit-env')
      expect(result.networkEnvironment).toBeDefined()
      expect(result.detectionPhase.isBuildTime).toBe(false) // Should be runtime in tests
      expect(result.environmentVariables.length).toBeGreaterThan(0)
      expect(result.priorityChain.length).toBeGreaterThan(0)
    })

    it('should detect staging from explicit ENVIRONMENT variable', () => {
      process.env.ENVIRONMENT = 'staging'
      
      const result = detectEnvironment()
      
      expect(result.environment).toBe('staging')
      expect(result.isProduction).toBe(false)
      expect(result.isDevelopment).toBe(false)
      expect(result.isStaging).toBe(true)
      expect(result.detectionMethod).toBe('explicit-env')
      expect(result.networkEnvironment).toBeDefined()
    })

    it('should detect development from NODE_ENV', () => {
      process.env.NODE_ENV = 'development'
      
      const result = detectEnvironment()
      
      expect(result.environment).toBe('development')
      expect(result.isDevelopment).toBe(true)
      expect(result.detectionMethod).toBe('node-env')
      expect(result.networkEnvironment).toBeDefined()
    })

    it('should detect development from localhost URL', () => {
      process.env.SUPABASE_PUBLIC_URL = 'http://localhost:54321'
      
      const result = detectEnvironment()
      
      expect(result.environment).toBe('development')
      expect(result.isDevelopment).toBe(true)
      expect(result.detectionMethod).toBe('url-pattern')
      expect(result.context).toContain('localhost')
    })

    it('should detect development from 127.0.0.1 URL', () => {
      process.env.SUPABASE_PUBLIC_URL = 'http://127.0.0.1:54321'
      
      const result = detectEnvironment()
      
      expect(result.environment).toBe('development')
      expect(result.isDevelopment).toBe(true)
      expect(result.detectionMethod).toBe('url-pattern')
    })

    it('should detect staging from URL pattern', () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://staging.example.com'
      
      const result = detectEnvironment()
      
      expect(result.environment).toBe('staging')
      expect(result.isStaging).toBe(true)
      expect(result.detectionMethod).toBe('url-pattern')
    })

    it('should default to production when no indicators present', () => {
      const result = detectEnvironment()
      
      expect(result.environment).toBe('production')
      expect(result.isProduction).toBe(true)
      expect(result.detectionMethod).toBe('default')
      expect(result.networkEnvironment).toBeDefined()
    })

    it('should detect production from NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production'
      
      const result = detectEnvironment()
      
      expect(result.environment).toBe('production')
      expect(result.isProduction).toBe(true)
      expect(result.detectionMethod).toBe('node-env')
    })
  })

  describe('validateUrlsForEnvironment', () => {
    it('should reject localhost URLs in production', () => {
      const urls = {
        gotrueUrl: 'http://localhost:54321/auth/v1',
        supabaseUrl: 'http://localhost:54321',
        apiUrl: 'http://localhost:8000',
      }
      
      const result = validateUrlsForEnvironment(urls, 'production')
      
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.includes('localhost'))).toBe(true)
    })

    it('should reject 127.0.0.1 URLs in production', () => {
      const urls = {
        gotrueUrl: 'http://127.0.0.1:54321/auth/v1',
      }
      
      const result = validateUrlsForEnvironment(urls, 'production')
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('127.0.0.1'))).toBe(true)
    })

    it('should accept production URLs in production', () => {
      const urls = {
        gotrueUrl: 'https://example.com/auth/v1',
        supabaseUrl: 'https://example.com',
        apiUrl: 'https://api.example.com',
      }
      
      const result = validateUrlsForEnvironment(urls, 'production')
      
      expect(result.isValid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should warn about HTTP in production', () => {
      const urls = {
        gotrueUrl: 'http://example.com/auth/v1',
      }
      
      const result = validateUrlsForEnvironment(urls, 'production')
      
      expect(result.isValid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some(w => w.includes('insecure HTTP'))).toBe(true)
    })

    it('should accept localhost URLs in development', () => {
      const urls = {
        gotrueUrl: 'http://localhost:54321/auth/v1',
        supabaseUrl: 'http://localhost:54321',
      }
      
      const result = validateUrlsForEnvironment(urls, 'development')
      
      expect(result.isValid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should warn about non-localhost URLs in development', () => {
      const urls = {
        gotrueUrl: 'https://example.com/auth/v1',
      }
      
      const result = validateUrlsForEnvironment(urls, 'development')
      
      expect(result.isValid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('getEnvironmentRecommendations', () => {
    it('should provide production recommendations', () => {
      const recommendations = getEnvironmentRecommendations('production')
      
      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations.some(r => r.includes('HTTPS'))).toBe(true)
      expect(recommendations.some(r => r.includes('localhost'))).toBe(true)
    })

    it('should provide development recommendations', () => {
      const recommendations = getEnvironmentRecommendations('development')
      
      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations.some(r => r.includes('localhost'))).toBe(true)
    })

    it('should provide staging recommendations', () => {
      const recommendations = getEnvironmentRecommendations('staging')
      
      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations.some(r => r.includes('staging'))).toBe(true)
    })
  })

  describe('performEnvironmentCheck', () => {
    it('should perform comprehensive check and return environment info', () => {
      process.env.NODE_ENV = 'production'
      const urls = {
        gotrueUrl: 'https://example.com/auth/v1',
        supabaseUrl: 'https://example.com',
      }
      
      const result = performEnvironmentCheck(urls)
      
      expect(result.environment).toBe('production')
      expect(result.isProduction).toBe(true)
    })

    it('should detect issues with production localhost URLs', () => {
      process.env.NODE_ENV = 'production'
      const urls = {
        gotrueUrl: 'http://localhost:54321/auth/v1',
      }
      
      // The new logic correctly overrides NODE_ENV=production with development for safety
      // when localhost URLs are detected
      const result = performEnvironmentCheck(urls)
      
      expect(result.environment).toBe('development')
      expect(result.isDevelopment).toBe(true)
      expect(result.context).toContain('localhost')
    })
  })

  describe('Environment-specific behavior', () => {
    it('should correctly identify production environment from multiple signals', () => {
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_PUBLIC_URL = 'https://prod.example.com'
      
      const result = detectEnvironment()
      
      expect(result.environment).toBe('production')
      expect(result.isProduction).toBe(true)
    })

    it('should prioritize explicit ENVIRONMENT over NODE_ENV', () => {
      process.env.ENVIRONMENT = 'staging'
      process.env.NODE_ENV = 'production'
      
      const result = detectEnvironment()
      
      expect(result.environment).toBe('staging')
      expect(result.isStaging).toBe(true)
    })

    it('should prioritize explicit ENVIRONMENT over URL patterns', () => {
      process.env.ENVIRONMENT = 'production'
      process.env.SUPABASE_PUBLIC_URL = 'http://localhost:54321'
      
      const result = detectEnvironment()
      
      expect(result.environment).toBe('production')
      expect(result.isProduction).toBe(true)
    })

    it('should detect production environment when ENVIRONMENT=production in Docker build context', () => {
      // Simulate Docker build environment
      process.env.ENVIRONMENT = 'production'
      process.env.DOCKER_BUILD = 'true'
      process.env.NODE_ENV = 'development' // This should be overridden
      
      const result = detectEnvironment()
      
      expect(result.environment).toBe('production')
      expect(result.isProduction).toBe(true)
      expect(result.detectionMethod).toBe('explicit-env')
      expect(result.detectionPhase.isBuildTime).toBe(true)
      expect(result.detectionPhase.dockerBuild).toBe(true)
      expect(result.context).toContain('ENVIRONMENT variable set to "production"')
      expect(result.context).toContain('HIGHEST priority')
      
      // Clean up
      delete process.env.DOCKER_BUILD
    })

    it('should log missing ENVIRONMENT variable during Docker build', () => {
      // Simulate Docker build without ENVIRONMENT variable
      process.env.DOCKER_BUILD = 'true'
      process.env.NODE_ENV = 'production'
      delete process.env.ENVIRONMENT
      
      const result = detectEnvironment()
      
      expect(result.detectionPhase.isBuildTime).toBe(true)
      expect(result.detectionPhase.dockerBuild).toBe(true)
      expect(result.missingVariables).toContain('ENVIRONMENT')
      
      // Clean up
      delete process.env.DOCKER_BUILD
    })
  })
})
