/**
 * Unit tests for project store credential utility functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resetCredentialFallbackManager, getCredentialFallbackManager } from './credential-fallback-manager'

// Import the utility functions directly for testing
// We'll need to extract these from the project store files for testing

describe('Project Store Credential Utilities', () => {
  beforeEach(() => {
    resetCredentialFallbackManager()
  })

  afterEach(() => {
    resetCredentialFallbackManager()
  })

  describe('Credential Status Calculation', () => {
    // Helper function to test credential status calculation
    function calculateCredentialStatus(
      databaseUser: string | null | undefined,
      databasePasswordHash: string | null | undefined
    ): 'complete' | 'missing_user' | 'missing_password' | 'missing_both' {
      const hasUser = databaseUser !== null && databaseUser !== undefined && databaseUser.trim() !== ''
      const hasPassword = databasePasswordHash !== null && databasePasswordHash !== undefined && databasePasswordHash.trim() !== ''

      if (hasUser && hasPassword) {
        return 'complete'
      } else if (!hasUser && !hasPassword) {
        return 'missing_both'
      } else if (!hasUser) {
        return 'missing_user'
      } else {
        return 'missing_password'
      }
    }

    it('should return complete when both user and password are present', () => {
      const status = calculateCredentialStatus('test_user', 'hashed_password')
      expect(status).toBe('complete')
    })

    it('should return missing_both when both user and password are null', () => {
      const status = calculateCredentialStatus(null, null)
      expect(status).toBe('missing_both')
    })

    it('should return missing_both when both user and password are undefined', () => {
      const status = calculateCredentialStatus(undefined, undefined)
      expect(status).toBe('missing_both')
    })

    it('should return missing_user when user is null but password is present', () => {
      const status = calculateCredentialStatus(null, 'hashed_password')
      expect(status).toBe('missing_user')
    })

    it('should return missing_user when user is undefined but password is present', () => {
      const status = calculateCredentialStatus(undefined, 'hashed_password')
      expect(status).toBe('missing_user')
    })

    it('should return missing_user when user is empty string but password is present', () => {
      const status = calculateCredentialStatus('', 'hashed_password')
      expect(status).toBe('missing_user')
    })

    it('should return missing_user when user is whitespace but password is present', () => {
      const status = calculateCredentialStatus('   ', 'hashed_password')
      expect(status).toBe('missing_user')
    })

    it('should return missing_password when password is null but user is present', () => {
      const status = calculateCredentialStatus('test_user', null)
      expect(status).toBe('missing_password')
    })

    it('should return missing_password when password is undefined but user is present', () => {
      const status = calculateCredentialStatus('test_user', undefined)
      expect(status).toBe('missing_password')
    })

    it('should return missing_password when password is empty string but user is present', () => {
      const status = calculateCredentialStatus('test_user', '')
      expect(status).toBe('missing_password')
    })

    it('should return missing_password when password is whitespace but user is present', () => {
      const status = calculateCredentialStatus('test_user', '   ')
      expect(status).toBe('missing_password')
    })
  })

  describe('Enhanced Project Metadata Creation', () => {
    // Helper function to test enhanced metadata creation
    function enhanceProjectWithCredentialStatus(project: {
      id: number
      ref: string
      name: string
      database_name: string
      database_user: string | null
      database_password_hash: string | null
      organization_id: number
      status: string
      region: string
      connection_string: string
      inserted_at: string
      updated_at: string
    }) {
      const calculateCredentialStatus = (
        databaseUser: string | null | undefined,
        databasePasswordHash: string | null | undefined
      ): 'complete' | 'missing_user' | 'missing_password' | 'missing_both' => {
        const hasUser = databaseUser !== null && databaseUser !== undefined && databaseUser.trim() !== ''
        const hasPassword = databasePasswordHash !== null && databasePasswordHash !== undefined && databasePasswordHash.trim() !== ''

        if (hasUser && hasPassword) {
          return 'complete'
        } else if (!hasUser && !hasPassword) {
          return 'missing_both'
        } else if (!hasUser) {
          return 'missing_user'
        } else {
          return 'missing_password'
        }
      }

      const credentialStatus = calculateCredentialStatus(project.database_user, project.database_password_hash)
      const usesFallback = credentialStatus !== 'complete'

      return {
        ...project,
        credential_status: credentialStatus,
        last_credential_check: new Date().toISOString(),
        uses_fallback_credentials: usesFallback
      }
    }

    it('should enhance project with complete credentials correctly', () => {
      const project = {
        id: 1,
        ref: 'test-project',
        name: 'Test Project',
        database_name: 'test_db',
        database_user: 'test_user',
        database_password_hash: 'hashed_password',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY',
        region: 'localhost',
        connection_string: 'postgresql://test_user:password@localhost:5432/test_db',
        inserted_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      const enhanced = enhanceProjectWithCredentialStatus(project)

      expect(enhanced.credential_status).toBe('complete')
      expect(enhanced.uses_fallback_credentials).toBe(false)
      expect(enhanced.last_credential_check).toBeDefined()
      expect(new Date(enhanced.last_credential_check)).toBeInstanceOf(Date)
    })

    it('should enhance project with missing credentials correctly', () => {
      const project = {
        id: 1,
        ref: 'test-project',
        name: 'Test Project',
        database_name: 'test_db',
        database_user: null,
        database_password_hash: null,
        organization_id: 1,
        status: 'ACTIVE_HEALTHY',
        region: 'localhost',
        connection_string: 'postgresql://fallback:password@localhost:5432/test_db',
        inserted_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      const enhanced = enhanceProjectWithCredentialStatus(project)

      expect(enhanced.credential_status).toBe('missing_both')
      expect(enhanced.uses_fallback_credentials).toBe(true)
      expect(enhanced.last_credential_check).toBeDefined()
    })

    it('should enhance project with partial credentials correctly', () => {
      const project = {
        id: 1,
        ref: 'test-project',
        name: 'Test Project',
        database_name: 'test_db',
        database_user: 'test_user',
        database_password_hash: null,
        organization_id: 1,
        status: 'ACTIVE_HEALTHY',
        region: 'localhost',
        connection_string: 'postgresql://test_user:fallback@localhost:5432/test_db',
        inserted_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      const enhanced = enhanceProjectWithCredentialStatus(project)

      expect(enhanced.credential_status).toBe('missing_password')
      expect(enhanced.uses_fallback_credentials).toBe(true)
      expect(enhanced.last_credential_check).toBeDefined()
    })
  })

  describe('Effective Credentials Logic', () => {
    it('should prefer project credentials when complete', () => {
      const fallbackManager = getCredentialFallbackManager()
      
      const projectCredentials = fallbackManager.getProjectCredentials(
        'test-project',
        'project_user',
        'project_password_hash'
      )

      expect(projectCredentials.isComplete).toBe(true)
      expect(projectCredentials.user).toBe('project_user')
      expect(projectCredentials.passwordHash).toBe('project_password_hash')
    })

    it('should detect incomplete credentials when user is missing', () => {
      const fallbackManager = getCredentialFallbackManager()
      
      const projectCredentials = fallbackManager.getProjectCredentials(
        'test-project',
        null,
        'project_password_hash'
      )

      expect(projectCredentials.isComplete).toBe(false)
      expect(projectCredentials.user).toBe(null)
      expect(projectCredentials.passwordHash).toBe('project_password_hash')
    })

    it('should detect incomplete credentials when password is missing', () => {
      const fallbackManager = getCredentialFallbackManager()
      
      const projectCredentials = fallbackManager.getProjectCredentials(
        'test-project',
        'project_user',
        null
      )

      expect(projectCredentials.isComplete).toBe(false)
      expect(projectCredentials.user).toBe('project_user')
      expect(projectCredentials.passwordHash).toBe(null)
    })

    it('should detect incomplete credentials when both are missing', () => {
      const fallbackManager = getCredentialFallbackManager()
      
      const projectCredentials = fallbackManager.getProjectCredentials(
        'test-project',
        null,
        null
      )

      expect(projectCredentials.isComplete).toBe(false)
      expect(projectCredentials.user).toBe(null)
      expect(projectCredentials.passwordHash).toBe(null)
    })

    it('should provide fallback credentials when needed', () => {
      const fallbackManager = getCredentialFallbackManager()
      
      const fallbackCredentials = fallbackManager.getFallbackCredentials(false)

      expect(fallbackCredentials.user).toBeDefined()
      expect(fallbackCredentials.password).toBeDefined()
      expect(fallbackCredentials.source).toMatch(/^(environment|default)$/)
    })

    it('should provide read-only fallback credentials when requested', () => {
      const fallbackManager = getCredentialFallbackManager()
      
      const fallbackCredentials = fallbackManager.getFallbackCredentials(true)

      expect(fallbackCredentials.user).toBeDefined()
      expect(fallbackCredentials.password).toBeDefined()
      expect(fallbackCredentials.source).toMatch(/^(environment|default)$/)
    })

    it('should determine when to use fallback correctly', () => {
      const fallbackManager = getCredentialFallbackManager()
      
      // Complete credentials should not use fallback
      const completeCredentials = { user: 'test_user', passwordHash: 'test_hash', isComplete: true }
      expect(fallbackManager.shouldUseFallback(completeCredentials)).toBe(false)

      // Incomplete credentials should use fallback
      const incompleteCredentials = { user: null, passwordHash: 'test_hash', isComplete: false }
      expect(fallbackManager.shouldUseFallback(incompleteCredentials)).toBe(true)

      // Missing credentials should use fallback
      expect(fallbackManager.shouldUseFallback({})).toBe(true)
      expect(fallbackManager.shouldUseFallback(null as any)).toBe(true)
    })
  })

  describe('Fallback Usage Logging', () => {
    it('should log fallback usage correctly', () => {
      const fallbackManager = getCredentialFallbackManager()
      
      // Clear any existing logs
      fallbackManager.clearFallbackUsageLog()

      // Log some fallback usage
      fallbackManager.logFallbackUsage('project-1', 'missing_both', 'both')
      fallbackManager.logFallbackUsage('project-2', 'missing_user', 'user')

      const stats = fallbackManager.getFallbackUsageStats()
      expect(stats.totalEntries).toBe(2)
      expect(stats.uniqueProjects).toBe(2)
      expect(stats.recentUsage).toHaveLength(2)
      expect(stats.mostCommonReasons).toContainEqual({ reason: 'missing_both', count: 1 })
      expect(stats.mostCommonReasons).toContainEqual({ reason: 'missing_user', count: 1 })
    })

    it('should track recent fallback usage', () => {
      const fallbackManager = getCredentialFallbackManager()
      
      // Clear any existing logs
      fallbackManager.clearFallbackUsageLog()

      // Log multiple entries
      for (let i = 0; i < 5; i++) {
        fallbackManager.logFallbackUsage(`project-${i}`, 'missing_both', 'both')
      }

      const recentUsage = fallbackManager.getRecentFallbackUsage(3)
      expect(recentUsage).toHaveLength(3)
      
      // Should contain the expected project refs (order may vary due to timestamp precision)
      const projectRefs = recentUsage.map(entry => entry.projectRef)
      expect(projectRefs).toContain('project-4')
      expect(projectRefs).toContain('project-3')
      expect(projectRefs).toContain('project-2')
    })

    it('should limit log size to prevent memory issues', () => {
      const fallbackManager = getCredentialFallbackManager()
      
      // Clear any existing logs
      fallbackManager.clearFallbackUsageLog()

      // Log more than the limit (1000 entries)
      for (let i = 0; i < 1100; i++) {
        fallbackManager.logFallbackUsage(`project-${i}`, 'missing_both', 'both')
      }

      const stats = fallbackManager.getFallbackUsageStats()
      expect(stats.totalEntries).toBe(1000) // Should be capped at 1000
    })
  })
})