/**
 * Error Handling and User Guidance Tests
 * 
 * Tests for the comprehensive error handling and user guidance system
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateFallbackRecommendations,
  generateProductionLocalhostError,
  generateDevelopmentProductionMismatch,
  generateConfigurationValidationError,
  generateUrlValidationError,
  generateDockerBuildVariableError,
  analyzeEnvironmentForErrors,
  generateTroubleshootingGuide,
  UserGuidanceContext,
} from 'common/error-handling-guidance'
import { EnvironmentInfo } from 'common/environment-detection'

// Mock environment variables
const mockEnv = (envVars: Record<string, string | undefined>) => {
  Object.keys(envVars).forEach(key => {
    if (envVars[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = envVars[key]
    }
  })
}

describe('Error Handling and User Guidance', () => {
  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.ENVIRONMENT
    delete process.env.NODE_ENV
    delete process.env.SUPABASE_PUBLIC_URL
    delete process.env.API_EXTERNAL_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
  })

  describe('generateFallbackRecommendations', () => {
    const mockContext: UserGuidanceContext = {
      environment: 'production',
      isDocker: false,
      isBuildTime: false,
      availableVariables: ['NODE_ENV'],
      missingVariables: ['ENVIRONMENT', 'SUPABASE_PUBLIC_URL'],
      currentUrls: {
        supabaseUrl: 'http://localhost:54321',
      },
    }

    it('should generate build-time fallback recommendations', () => {
      const error = generateFallbackRecommendations('build-time', mockContext)

      expect(error.type).toBe('fallback-configuration-used')
      expect(error.severity).toBe('warning')
      expect(error.message).toContain('build-time configuration fallback')
      expect(error.recommendations).toContain('Check network connectivity to configuration endpoints')
      expect(error.examples.environmentVariables).toBeDefined()
      expect(error.examples.dockerCommands).toBeDefined()
    })

    it('should generate cached fallback recommendations', () => {
      const error = generateFallbackRecommendations('cached', mockContext)

      expect(error.type).toBe('fallback-configuration-used')
      expect(error.message).toContain('cached configuration')
      expect(error.recommendations).toContain('Refresh the page to attempt loading fresh configuration')
    })

    it('should generate emergency defaults recommendations with critical severity', () => {
      const error = generateFallbackRecommendations('emergency-defaults', mockContext)

      expect(error.severity).toBe('critical')
      expect(error.message).toContain('emergency default configuration')
      expect(error.recommendations).toContain('IMMEDIATE ACTION REQUIRED: Set proper environment variables')
    })
  })

  describe('generateProductionLocalhostError', () => {
    it('should generate critical error for localhost URLs in production', () => {
      const context: UserGuidanceContext = {
        environment: 'production',
        isDocker: false,
        isBuildTime: false,
        availableVariables: [],
        missingVariables: ['SUPABASE_PUBLIC_URL'],
        currentUrls: {
          supabaseUrl: 'http://localhost:54321',
          gotrueUrl: 'http://localhost:54321/auth/v1',
        },
      }

      const error = generateProductionLocalhostError(
        ['http://localhost:54321', 'http://localhost:54321/auth/v1'],
        context
      )

      expect(error.type).toBe('production-localhost-mismatch')
      expect(error.severity).toBe('critical')
      expect(error.message).toContain('CRITICAL: Production environment detected with localhost URLs')
      expect(error.description).toContain('complete application failure in production')
      expect(error.recommendations).toContain('🚨 IMMEDIATE ACTION REQUIRED - Production deployment will fail')
      expect(error.examples.environmentVariables).toHaveProperty('SUPABASE_PUBLIC_URL')
      expect(error.examples.dockerCommands).toBeDefined()
      expect(error.examples.configurationFiles).toBeDefined()
    })
  })

  describe('generateDevelopmentProductionMismatch', () => {
    it('should generate warning for environment mismatch', () => {
      const context: UserGuidanceContext = {
        environment: 'development',
        isDocker: false,
        isBuildTime: false,
        availableVariables: [],
        missingVariables: [],
        currentUrls: {},
      }

      const error = generateDevelopmentProductionMismatch('development', 'production', context)

      expect(error.type).toBe('development-production-mismatch')
      expect(error.severity).toBe('warning')
      expect(error.message).toContain('Environment mismatch: detected development but expected production')
      expect(error.recommendations).toContain('Set ENVIRONMENT=production for explicit control')
    })
  })

  describe('generateConfigurationValidationError', () => {
    it('should generate critical error for production with missing variables', () => {
      const context: UserGuidanceContext = {
        environment: 'production',
        isDocker: false,
        isBuildTime: false,
        availableVariables: [],
        missingVariables: ['SUPABASE_PUBLIC_URL', 'API_EXTERNAL_URL'],
        currentUrls: {},
      }

      const error = generateConfigurationValidationError(
        ['SUPABASE_PUBLIC_URL', 'API_EXTERNAL_URL'],
        ['invalid-url'],
        context
      )

      expect(error.type).toBe('missing-environment-variables')
      expect(error.severity).toBe('critical')
      expect(error.message).toContain('Missing or invalid configuration variables')
      expect(error.examples.environmentVariables).toHaveProperty('ENVIRONMENT', 'production')
      expect(error.examples.environmentVariables).toHaveProperty('SUPABASE_PUBLIC_URL')
      expect(error.examples.dockerCommands).toBeDefined()
      expect(error.examples.configurationFiles).toBeDefined()
    })

    it('should generate warning for development with missing variables', () => {
      const context: UserGuidanceContext = {
        environment: 'development',
        isDocker: false,
        isBuildTime: false,
        availableVariables: [],
        missingVariables: ['NEXT_PUBLIC_SUPABASE_URL'],
        currentUrls: {},
      }

      const error = generateConfigurationValidationError(['NEXT_PUBLIC_SUPABASE_URL'], [], context)

      expect(error.severity).toBe('warning')
      expect(error.examples.environmentVariables).toHaveProperty('ENVIRONMENT', 'development')
      expect(error.examples.environmentVariables).toHaveProperty('SUPABASE_PUBLIC_URL', 'http://127.0.0.1:54321')
    })
  })

  describe('generateUrlValidationError', () => {
    it('should generate error for invalid URL formats', () => {
      const context: UserGuidanceContext = {
        environment: 'production',
        isDocker: false,
        isBuildTime: false,
        availableVariables: [],
        missingVariables: [],
        currentUrls: {},
      }

      const invalidUrls = [
        { url: 'invalid-url', error: 'Invalid URL format' },
        { url: 'ftp://example.com', error: 'Unsupported protocol' },
      ]

      const error = generateUrlValidationError(invalidUrls, context)

      expect(error.type).toBe('invalid-url-format')
      expect(error.severity).toBe('error')
      expect(error.message).toContain('Invalid URL format detected in 2 URLs')
      expect(error.recommendations).toContain('Ensure all URLs use valid HTTP or HTTPS protocols')
      expect(error.examples.environmentVariables).toBeDefined()
    })
  })

  describe('generateDockerBuildVariableError', () => {
    it('should generate error for missing Docker build variables', () => {
      const context: UserGuidanceContext = {
        environment: 'production',
        isDocker: true,
        isBuildTime: true,
        availableVariables: [],
        missingVariables: ['ENVIRONMENT', 'SUPABASE_PUBLIC_URL'],
        currentUrls: {},
      }

      const error = generateDockerBuildVariableError(['ENVIRONMENT', 'SUPABASE_PUBLIC_URL'], context)

      expect(error.type).toBe('docker-build-variable-missing')
      expect(error.severity).toBe('error')
      expect(error.message).toContain('Environment variables not available during Docker build')
      expect(error.recommendations).toContain('Add ARG declarations in your Dockerfile for build-time variables')
      expect(error.examples.configurationFiles).toHaveProperty('Dockerfile')
      expect(error.examples.configurationFiles).toHaveProperty('docker-compose.yml')
      expect(error.examples.dockerCommands).toBeDefined()
    })
  })

  describe('generateTroubleshootingGuide', () => {
    it('should generate production troubleshooting guide', () => {
      const guide = generateTroubleshootingGuide('production')

      expect(guide.title).toBe('Production Environment Troubleshooting')
      expect(guide.commonIssues).toContain('Localhost URLs in production configuration')
      expect(guide.diagnosticCommands).toContain('curl -f $SUPABASE_PUBLIC_URL/rest/v1/')
      expect(guide.quickFixes).toContain('Set ENVIRONMENT=production explicitly')
      expect(guide.preventionTips).toContain('Use environment-specific configuration files')
    })

    it('should generate development troubleshooting guide', () => {
      const guide = generateTroubleshootingGuide('development')

      expect(guide.title).toBe('Development Environment Troubleshooting')
      expect(guide.commonIssues).toContain('Local Supabase services not running')
      expect(guide.diagnosticCommands).toContain('docker-compose ps')
      expect(guide.quickFixes).toContain('Run docker-compose up -d to start services')
    })

    it('should generate staging troubleshooting guide', () => {
      const guide = generateTroubleshootingGuide('staging')

      expect(guide.title).toBe('Staging Environment Troubleshooting')
      expect(guide.commonIssues).toContain('Staging URLs not configured correctly')
      expect(guide.quickFixes).toContain('Set ENVIRONMENT=staging explicitly')
    })
  })

  describe('analyzeEnvironmentForErrors', () => {
    it('should detect production-localhost mismatch', () => {
      const mockEnvInfo: Partial<EnvironmentInfo> = {
        environment: 'production',
        detectionPhase: {
          isBuildTime: false,
          dockerBuild: false,
        },
        environmentVariables: [],
        missingVariables: [],
      }

      const urls = {
        supabaseUrl: 'http://localhost:54321',
        gotrueUrl: 'http://localhost:54321/auth/v1',
      }

      const errors = analyzeEnvironmentForErrors(mockEnvInfo as EnvironmentInfo, urls)

      expect(errors).toHaveLength(1)
      expect(errors[0].type).toBe('production-localhost-mismatch')
      expect(errors[0].severity).toBe('critical')
    })

    it('should detect missing variables', () => {
      const mockEnvInfo: Partial<EnvironmentInfo> = {
        environment: 'production',
        detectionPhase: {
          isBuildTime: false,
          dockerBuild: false,
        },
        environmentVariables: [],
        missingVariables: ['SUPABASE_PUBLIC_URL', 'API_EXTERNAL_URL'],
      }

      const errors = analyzeEnvironmentForErrors(mockEnvInfo as EnvironmentInfo, {})

      expect(errors).toHaveLength(1)
      expect(errors[0].type).toBe('missing-environment-variables')
    })

    it('should detect Docker build variable issues', () => {
      const mockEnvInfo: Partial<EnvironmentInfo> = {
        environment: 'production',
        detectionPhase: {
          isBuildTime: true,
          dockerBuild: true,
        },
        environmentVariables: [],
        missingVariables: ['ENVIRONMENT', 'NODE_ENV'],
      }

      const errors = analyzeEnvironmentForErrors(mockEnvInfo as EnvironmentInfo, {})

      expect(errors).toHaveLength(2) // Missing variables + Docker build variables
      expect(errors.some(e => e.type === 'docker-build-variable-missing')).toBe(true)
    })

    it('should detect fallback usage', () => {
      const mockEnvInfo: Partial<EnvironmentInfo> = {
        environment: 'production',
        detectionMethod: 'default',
        detectionPhase: {
          isBuildTime: false,
          dockerBuild: false,
        },
        environmentVariables: [],
        missingVariables: [],
      }

      const errors = analyzeEnvironmentForErrors(mockEnvInfo as EnvironmentInfo, {})

      expect(errors).toHaveLength(1)
      expect(errors[0].type).toBe('fallback-configuration-used')
    })
  })
})