/**
 * Integration tests for Docker environment variable passing and environment detection
 * Requirements 1.1, 1.3: Test environment variable availability during Docker builds
 */

import { vi, describe, it, beforeEach, afterAll, expect } from 'vitest'
import { detectEnvironment } from '../../../../packages/common/environment-detection'

describe('Docker Environment Detection Integration', () => {
  // Store original environment variables
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment variables for each test
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv
  })

  describe('Build-time Environment Variable Availability', () => {
    it('should detect production environment when ENVIRONMENT=production is set during build', () => {
      // Simulate Docker build-time environment variables
      process.env.ENVIRONMENT = 'production'
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      process.env.NEXT_PUBLIC_REQUIRE_LOGIN = 'true'
      
      // Simulate build-time context
      process.env.DOCKER_BUILDKIT = '1'
      
      const envInfo = detectEnvironment()
      
      expect(envInfo.environment).toBe('production')
      expect(envInfo.isProduction).toBe(true)
      expect(envInfo.detectionMethod).toBe('explicit-env')
      expect(envInfo.context).toContain('ENVIRONMENT variable set to "production"')
      expect(envInfo.detectionPhase.isBuildTime).toBe(true)
      expect(envInfo.detectionPhase.dockerBuild).toBe(true)
    })

    it('should detect development environment when ENVIRONMENT=development is set during build', () => {
      // Simulate Docker build-time environment variables
      process.env.ENVIRONMENT = 'development'
      process.env.NODE_ENV = 'development'
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      process.env.NEXT_PUBLIC_REQUIRE_LOGIN = 'true'
      
      // Simulate build-time context
      process.env.DOCKER_BUILD = '1'
      
      const envInfo = detectEnvironment()
      
      expect(envInfo.environment).toBe('development')
      expect(envInfo.isDevelopment).toBe(true)
      expect(envInfo.detectionMethod).toBe('explicit-env')
      expect(envInfo.context).toContain('ENVIRONMENT variable set to "development"')
      expect(envInfo.detectionPhase.isBuildTime).toBe(true)
      expect(envInfo.detectionPhase.dockerBuild).toBe(true)
    })

    it('should prioritize ENVIRONMENT over NODE_ENV during Docker builds', () => {
      // Test that ENVIRONMENT=production takes priority over NODE_ENV=development
      process.env.ENVIRONMENT = 'production'
      process.env.NODE_ENV = 'development'
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      
      // Simulate build-time context
      process.env.BUILDKIT_PROGRESS = 'plain'
      
      const envInfo = detectEnvironment()
      
      expect(envInfo.environment).toBe('production')
      expect(envInfo.isProduction).toBe(true)
      expect(envInfo.detectionMethod).toBe('explicit-env')
      expect(envInfo.context).toContain('ENVIRONMENT variable set to "production"')
      expect(envInfo.context).toContain('takes HIGHEST priority over NODE_ENV')
      
      // Check priority chain
      const environmentPriority = envInfo.priorityChain.find(p => p.source === 'ENVIRONMENT variable')
      const nodeEnvPriority = envInfo.priorityChain.find(p => p.source === 'NODE_ENV variable')
      
      expect(environmentPriority?.selected).toBe(true)
      expect(environmentPriority?.priority).toBe(1)
      expect(nodeEnvPriority?.selected).toBe(false)
      expect(nodeEnvPriority?.priority).toBe(2)
    })

    it('should detect missing environment variables during Docker builds', () => {
      // Simulate Docker build without environment variables
      process.env.DOCKER_BUILDKIT = '1'
      
      // Remove critical environment variables
      delete process.env.ENVIRONMENT
      delete process.env.NODE_ENV
      delete process.env.NEXT_PUBLIC_IS_PLATFORM
      
      const envInfo = detectEnvironment()
      
      expect(envInfo.missingVariables).toContain('ENVIRONMENT')
      expect(envInfo.missingVariables.length).toBeGreaterThan(0)
      expect(envInfo.detectionPhase.isBuildTime).toBe(true)
      expect(envInfo.detectionPhase.dockerBuild).toBe(true)
      
      // Should default to production for safety
      expect(envInfo.environment).toBe('production')
      expect(envInfo.detectionMethod).toBe('default')
    })

    it('should log comprehensive environment variable status during builds', () => {
      // Simulate Docker build with mixed environment variables
      process.env.ENVIRONMENT = 'production'
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      process.env.SUPABASE_PUBLIC_URL = 'https://api.example.com'
      process.env.DOCKER_BUILDKIT = '1'
      
      // Remove some optional variables
      delete process.env.API_EXTERNAL_URL
      delete process.env.NEXT_PUBLIC_GOTRUE_URL
      
      const envInfo = detectEnvironment()
      
      // Check that all relevant environment variables are tracked
      const trackedVars = envInfo.environmentVariables.map(v => v.name)
      expect(trackedVars).toContain('ENVIRONMENT')
      expect(trackedVars).toContain('NODE_ENV')
      expect(trackedVars).toContain('NEXT_PUBLIC_IS_PLATFORM')
      expect(trackedVars).toContain('SUPABASE_PUBLIC_URL')
      expect(trackedVars).toContain('API_EXTERNAL_URL')
      expect(trackedVars).toContain('NEXT_PUBLIC_GOTRUE_URL')
      
      // Check availability status
      const environmentVar = envInfo.environmentVariables.find(v => v.name === 'ENVIRONMENT')
      const apiUrlVar = envInfo.environmentVariables.find(v => v.name === 'API_EXTERNAL_URL')
      
      expect(environmentVar?.available).toBe(true)
      expect(environmentVar?.value).toBe('production')
      expect(apiUrlVar?.available).toBe(false)
      expect(apiUrlVar?.value).toBe(null)
    })
  })

  describe('Runtime Environment Detection with Docker Configuration', () => {
    it('should detect production environment at runtime with production URLs', () => {
      // Simulate runtime environment (no build-time indicators)
      process.env.ENVIRONMENT = 'production'
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_PUBLIC_URL = 'https://api.example.com'
      process.env.API_EXTERNAL_URL = 'https://api.example.com'
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://api.example.com/auth/v1'
      
      const envInfo = detectEnvironment()
      
      expect(envInfo.environment).toBe('production')
      expect(envInfo.isProduction).toBe(true)
      expect(envInfo.detectionMethod).toBe('explicit-env')
      expect(envInfo.detectionPhase.isBuildTime).toBe(false)
      expect(envInfo.detectionPhase.dockerBuild).toBe(false)
    })

    it('should detect development environment at runtime with localhost URLs', () => {
      // Simulate runtime environment with localhost URLs
      process.env.ENVIRONMENT = 'development'
      process.env.NODE_ENV = 'development'
      process.env.SUPABASE_PUBLIC_URL = 'http://localhost:8000'
      process.env.API_EXTERNAL_URL = 'http://localhost:8000'
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'http://localhost:8000/auth/v1'
      
      const envInfo = detectEnvironment()
      
      expect(envInfo.environment).toBe('development')
      expect(envInfo.isDevelopment).toBe(true)
      expect(envInfo.detectionMethod).toBe('explicit-env')
      expect(envInfo.detectionPhase.isBuildTime).toBe(false)
    })

    it('should handle container networking context correctly', () => {
      // Simulate container runtime environment
      process.env.ENVIRONMENT = 'production'
      process.env.HOSTNAME = 'supabase-studio-abc123'
      process.env.CONTAINER_NAME = 'supabase-studio'
      
      const envInfo = detectEnvironment()
      
      expect(envInfo.environment).toBe('production')
      expect(envInfo.networkEnvironment?.isContainer).toBe(true)
      // Note: isServerSide detection depends on 'window' object which is available in test environment
      // In real container environment, this would be true
      expect(envInfo.networkEnvironment?.networkDetectionMethod).toBe('container-env')
    })
  })

  describe('Docker Build Argument Validation', () => {
    it('should validate that required build arguments are available', () => {
      // Test the exact environment variables that should be passed as Docker build arguments
      // Note: NEXT_PUBLIC_REQUIRE_LOGIN is not tracked in environment detection, only core detection variables
      const requiredBuildArgs = [
        'ENVIRONMENT',
        'NODE_ENV',
        'NEXT_PUBLIC_IS_PLATFORM'
      ]
      
      // Set all required build arguments
      process.env.ENVIRONMENT = 'production'
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      process.env.NEXT_PUBLIC_REQUIRE_LOGIN = 'true'
      process.env.DOCKER_BUILDKIT = '1'
      
      const envInfo = detectEnvironment()
      
      // Check that all required build arguments are tracked and available
      requiredBuildArgs.forEach(argName => {
        const envVar = envInfo.environmentVariables.find(v => v.name === argName)
        expect(envVar).toBeDefined()
        expect(envVar?.available).toBe(true)
        expect(envVar?.value).not.toBe(null)
      })
      
      expect(envInfo.missingVariables).not.toContain('ENVIRONMENT')
      expect(envInfo.missingVariables).not.toContain('NODE_ENV')
    })

    it('should detect when Docker build arguments are missing', () => {
      // Simulate Docker build context without proper build arguments
      process.env.DOCKER_BUILDKIT = '1'
      
      // Remove all build arguments
      delete process.env.ENVIRONMENT
      delete process.env.NODE_ENV
      delete process.env.NEXT_PUBLIC_IS_PLATFORM
      delete process.env.NEXT_PUBLIC_REQUIRE_LOGIN
      
      const envInfo = detectEnvironment()
      
      expect(envInfo.detectionPhase.isBuildTime).toBe(true)
      expect(envInfo.detectionPhase.dockerBuild).toBe(true)
      expect(envInfo.missingVariables).toContain('ENVIRONMENT')
      
      // Should still work but use defaults
      expect(envInfo.environment).toBe('production') // Default fallback
      expect(envInfo.detectionMethod).toBe('default')
    })
  })

  describe('Priority Chain Validation', () => {
    it('should show correct priority chain when ENVIRONMENT is set', () => {
      process.env.ENVIRONMENT = 'production'
      process.env.NODE_ENV = 'development'
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'true'
      
      const envInfo = detectEnvironment()
      
      const priorityChain = envInfo.priorityChain
      
      // Check priority order
      expect(priorityChain[0].source).toBe('ENVIRONMENT variable')
      expect(priorityChain[0].priority).toBe(1)
      expect(priorityChain[0].selected).toBe(true)
      expect(priorityChain[0].available).toBe(true)
      expect(priorityChain[0].value).toBe('production')
      
      expect(priorityChain[1].source).toBe('NODE_ENV variable')
      expect(priorityChain[1].priority).toBe(2)
      expect(priorityChain[1].selected).toBe(false)
      expect(priorityChain[1].available).toBe(true)
      expect(priorityChain[1].value).toBe('development')
      
      // ENVIRONMENT should take priority over everything else
      expect(envInfo.environment).toBe('production')
      expect(envInfo.detectionMethod).toBe('explicit-env')
    })

    it('should show correct priority chain when only NODE_ENV is set', () => {
      delete process.env.ENVIRONMENT
      process.env.NODE_ENV = 'development'
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      
      const envInfo = detectEnvironment()
      
      const priorityChain = envInfo.priorityChain
      
      // ENVIRONMENT should be unavailable
      expect(priorityChain[0].source).toBe('ENVIRONMENT variable')
      expect(priorityChain[0].available).toBe(false)
      expect(priorityChain[0].selected).toBe(false)
      
      // NODE_ENV should be selected for development
      expect(priorityChain[1].source).toBe('NODE_ENV variable')
      expect(priorityChain[1].available).toBe(true)
      expect(priorityChain[1].selected).toBe(true)
      expect(priorityChain[1].value).toBe('development')
      
      expect(envInfo.environment).toBe('development')
      expect(envInfo.detectionMethod).toBe('node-env')
    })
  })
})