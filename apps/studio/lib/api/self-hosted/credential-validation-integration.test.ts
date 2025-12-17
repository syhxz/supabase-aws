/**
 * Integration tests for credential validation system with existing components
 */

import { validateProjectCredentials, validateCredentialFormat } from './credential-validation'
import { getCredentialFallbackManager } from './credential-fallback-manager'

describe('Credential Validation Integration', () => {
  describe('Integration with CredentialFallbackManager', () => {
    it('should validate credentials from fallback manager', async () => {
      const fallbackManager = getCredentialFallbackManager()
      
      // Get project credentials (simulating missing credentials)
      const projectCredentials = fallbackManager.getProjectCredentials('test-project', null, null)
      
      // Validate the credentials
      const validationResult = await validateProjectCredentials(projectCredentials, { requireComplete: false })
      
      // Should not be valid since both are null
      expect(validationResult.isValid).toBe(false)
      expect(validationResult.userValidation.isValid).toBe(false)
      expect(validationResult.passwordValidation.isValid).toBe(false)
    })

    it('should validate fallback credentials format', async () => {
      const fallbackManager = getCredentialFallbackManager()
      
      // Get fallback credentials
      const fallbackCredentials = await fallbackManager.getFallbackCredentials(false)
      
      // Validate the format
      const formatValidation = validateCredentialFormat(
        fallbackCredentials.user,
        fallbackCredentials.password
      )
      
      // Default fallback credentials may be weak (like "postgres" password)
      // but should not have format issues like SQL injection or control characters
      expect(formatValidation.errors.some(error => 
        error.includes('SQL patterns') || error.includes('control characters')
      )).toBe(false)
      
      // The username should be valid format
      expect(fallbackCredentials.user).toBeTruthy()
      expect(typeof fallbackCredentials.user).toBe('string')
    })

    it('should validate complete project credentials', async () => {
      const fallbackManager = getCredentialFallbackManager()
      
      // Simulate complete project credentials
      const projectCredentials = fallbackManager.getProjectCredentials(
        'test-project',
        'project_user_123',
        'Str0ng!P@ssw0rd#2024'
      )
      
      // Validate the credentials
      const validationResult = await validateProjectCredentials(projectCredentials, { requireComplete: true })
      
      // Should be valid
      expect(validationResult.isValid).toBe(true)
      expect(validationResult.userValidation.isValid).toBe(true)
      expect(validationResult.passwordValidation.isValid).toBe(true)
      expect(validationResult.overallErrors).toHaveLength(0)
    })

    it('should handle mixed valid/invalid credentials', async () => {
      const fallbackManager = getCredentialFallbackManager()
      
      // Simulate mixed credentials (valid user, invalid password)
      const projectCredentials = fallbackManager.getProjectCredentials(
        'test-project',
        'valid_user_123',
        'weak' // Too short password
      )
      
      // Validate the credentials
      const validationResult = await validateProjectCredentials(projectCredentials, { requireComplete: true })
      
      // Should not be valid due to weak password
      expect(validationResult.isValid).toBe(false)
      expect(validationResult.userValidation.isValid).toBe(true) // User is valid
      expect(validationResult.passwordValidation.isValid).toBe(false) // Password is invalid
    })
  })

  describe('Real-world scenarios', () => {
    it('should validate credentials for project creation', async () => {
      // Simulate project creation with user-provided credentials
      const userProvidedCredentials = {
        user: 'my_project_user',
        passwordHash: 'MySecur3!Pr0ject#P@ssw0rd',
        isComplete: true
      }

      const validationResult = await validateProjectCredentials(userProvidedCredentials)
      
      expect(validationResult.isValid).toBe(true)
      expect(validationResult.userValidation.isValid).toBe(true)
      expect(validationResult.passwordValidation.isValid).toBe(true)
    })

    it('should reject insecure credentials for project creation', async () => {
      // Simulate project creation with weak credentials
      const weakCredentials = {
        user: 'admin', // Forbidden name
        passwordHash: 'password123', // Weak password
        isComplete: true
      }

      const validationResult = await validateProjectCredentials(weakCredentials)
      
      expect(validationResult.isValid).toBe(false)
      expect(validationResult.userValidation.isValid).toBe(false) // Admin is forbidden
      expect(validationResult.passwordValidation.isValid).toBe(false) // Password is weak
    })

    it('should validate credentials during migration', async () => {
      // Simulate credential migration scenario
      const legacyCredentials = {
        user: null,
        passwordHash: null,
        isComplete: false
      }

      // First validate that legacy credentials are incomplete
      const legacyValidation = await validateProjectCredentials(legacyCredentials, { requireComplete: false })
      expect(legacyValidation.userValidation.isValid).toBe(false)
      expect(legacyValidation.passwordValidation.isValid).toBe(false)

      // Then validate new generated credentials
      const newCredentials = {
        user: 'migrated_project_user_456',
        passwordHash: 'G3n3r@ted!M1gr@t10n#P@ss',
        isComplete: true
      }

      const newValidation = await validateProjectCredentials(newCredentials)
      expect(newValidation.isValid).toBe(true)
    })
  })
})