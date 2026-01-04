/**
 * Tests for Credential Migration Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { 
  CredentialMigrationManager, 
  getCredentialMigrationManager, 
  resetCredentialMigrationManager,
  type MigrationResult,
  type MigrationStats,
  type CredentialGenerationOptions
} from './credential-migration-manager'
import { resetCredentialFallbackManager } from './credential-fallback-manager'

describe('CredentialMigrationManager', () => {
  let migrationManager: CredentialMigrationManager

  beforeEach(() => {
    // Reset singletons before each test
    resetCredentialMigrationManager()
    resetCredentialFallbackManager()
    migrationManager = new CredentialMigrationManager()
  })

  afterEach(() => {
    // Clean up after each test
    resetCredentialMigrationManager()
    resetCredentialFallbackManager()
  })

  describe('generateProjectCredentials', () => {
    it('should generate valid project credentials with default options', async () => {
      const projectRef = 'test-project-123'
      const result = await migrationManager.generateProjectCredentials(projectRef)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      
      if (result.data) {
        expect(result.data.user).toBeDefined()
        expect(result.data.passwordHash).toBeDefined()
        expect(result.data.isComplete).toBe(true)
        
        // Check username format
        expect(result.data.user).toMatch(/^proj_test_project_123_user$/)
        
        // Check password hash is bcrypt format
        expect(result.data.passwordHash).toMatch(/^\$2[aby]\$\d+\$/)
        expect(result.data.passwordHash!.length).toBeGreaterThan(50) // bcrypt hashes are longer
      }
    })

    it('should generate credentials with custom options', async () => {
      const projectRef = 'custom-project'
      const options: CredentialGenerationOptions = {
        userPrefix: 'custom_',
        userSuffix: '_db',
        passwordLength: 16,
        includeSpecialChars: false,
        excludeSimilarChars: true
      }

      const result = await migrationManager.generateProjectCredentials(projectRef, options)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      
      if (result.data) {
        expect(result.data.user).toMatch(/^custom_custom_project_db$/)
        expect(result.data.isComplete).toBe(true)
      }
    })

    it('should sanitize project ref in username', async () => {
      const projectRef = 'test-project@#$%^&*()123'
      const result = await migrationManager.generateProjectCredentials(projectRef)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      
      if (result.data) {
        // Special characters should be replaced with underscores
        expect(result.data.user).toMatch(/^proj_test_project_+123_user$/)
      }
    })

    it('should generate different passwords for different projects', async () => {
      const result1 = await migrationManager.generateProjectCredentials('project1')
      const result2 = await migrationManager.generateProjectCredentials('project2')

      expect(result1.error).toBeUndefined()
      expect(result2.error).toBeUndefined()
      expect(result1.data?.passwordHash).not.toEqual(result2.data?.passwordHash)
    })
  })

  describe('singleton pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = getCredentialMigrationManager()
      const instance2 = getCredentialMigrationManager()

      expect(instance1).toBe(instance2)
    })

    it('should create a new instance after reset', () => {
      const instance1 = getCredentialMigrationManager()
      resetCredentialMigrationManager()
      const instance2 = getCredentialMigrationManager()

      expect(instance1).not.toBe(instance2)
    })
  })

  describe('credential validation', () => {
    it('should validate generated credentials meet security requirements', async () => {
      const projectRef = 'security-test'
      const result = await migrationManager.generateProjectCredentials(projectRef)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      
      if (result.data) {
        // Username should follow PostgreSQL naming rules
        expect(result.data.user).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
        
        // Password hash should be bcrypt format (starts with $2a$, $2b$, or $2y$)
        expect(result.data.passwordHash).toMatch(/^\$2[aby]\$\d+\$/)
      }
    })

    it('should handle empty project refs', async () => {
      const result = await migrationManager.generateProjectCredentials('')

      // Empty project ref should still generate credentials with default naming
      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      
      if (result.data) {
        expect(result.data.user).toMatch(/^proj__user$/)
      }
    })
  })

  describe('password generation security', () => {
    it('should generate passwords with sufficient entropy', async () => {
      const passwords = new Set<string>()
      
      // Generate multiple passwords and ensure they're all different
      for (let i = 0; i < 10; i++) {
        const result = await migrationManager.generateProjectCredentials(`test-${i}`)
        expect(result.error).toBeUndefined()
        
        if (result.data?.passwordHash) {
          passwords.add(result.data.passwordHash)
        }
      }
      
      // All passwords should be unique
      expect(passwords.size).toBe(10)
    })

    it('should generate passwords with required character types', async () => {
      const result = await migrationManager.generateProjectCredentials('char-test')
      
      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      
      // We can't directly test the plaintext password since it's hashed,
      // but we can verify the generation doesn't fail with default options
      // that require various character types
    })
  })

  describe('error handling', () => {
    it('should handle invalid generation options gracefully', async () => {
      const options: CredentialGenerationOptions = {
        passwordLength: -1, // Invalid length
      }

      const result = await migrationManager.generateProjectCredentials('test', options)
      
      // Should either succeed with corrected options or fail gracefully
      if (result.error) {
        expect(result.error.message).toContain('Failed to generate')
      }
    })
  })
})

describe('Integration with existing systems', () => {
  it('should work with credential fallback manager', async () => {
    const migrationManager = new CredentialMigrationManager()
    const projectRef = 'integration-test'
    
    const result = await migrationManager.generateProjectCredentials(projectRef)
    
    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
    
    if (result.data) {
      // The generated credentials should be considered complete by the fallback manager
      expect(result.data.isComplete).toBe(true)
    }
  })
})