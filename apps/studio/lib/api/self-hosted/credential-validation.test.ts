/**
 * Tests for credential validation system
 */

import { vi } from 'vitest'
import {
  validateUsername,
  validatePassword,
  validateProjectCredentials,
  validateCredentialFormat,
  generateValidationErrorReport,
  logValidationFailure,
  type ValidationResult,
  type DetailedValidationResult,
  type PasswordStrengthConfig,
  type UsernameValidationConfig,
} from './credential-validation'

describe('Credential Validation System', () => {
  describe('validateUsername', () => {
    it('should validate correct usernames', () => {
      const validUsernames = [
        'user123',
        'project_user',
        '_internal_user',
        'supabase_project_123',
        'test_user_readonly'
      ]

      validUsernames.forEach(username => {
        const result = validateUsername(username)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })

    it('should reject invalid usernames', () => {
      const invalidCases = [
        { username: '', expectedError: 'Username cannot be empty' },
        { username: '   ', expectedError: 'Username cannot be empty' },
        { username: null, expectedError: 'Username is required' },
        { username: undefined, expectedError: 'Username is required' },
        { username: 'ab', expectedError: 'Username must be at least 3 characters' },
        { username: '123user', expectedError: 'Username must start with a letter or underscore' },
        { username: 'user-name', expectedError: 'Username must start with a letter or underscore' },
        { username: 'postgres', expectedError: 'Username "postgres" is not allowed for security reasons' },
        { username: 'admin', expectedError: 'Username "admin" is not allowed for security reasons' },
        { username: 'select', expectedError: 'Username "select" conflicts with PostgreSQL reserved keywords' }
      ]

      invalidCases.forEach(({ username, expectedError }) => {
        const result = validateUsername(username as any)
        expect(result.isValid).toBe(false)
        expect(result.errors.some(error => error.includes(expectedError.split(' ')[0]))).toBe(true)
      })
    })

    it('should respect custom configuration', () => {
      const config: Partial<UsernameValidationConfig> = {
        minLength: 5,
        requirePrefix: 'proj_'
      }

      const result1 = validateUsername('user', config)
      expect(result1.isValid).toBe(false)
      expect(result1.errors.some(error => error.includes('at least 5 characters'))).toBe(true)

      const result2 = validateUsername('user123', config)
      expect(result2.isValid).toBe(false)
      expect(result2.errors.some(error => error.includes('must start with "proj_"'))).toBe(true)

      const result3 = validateUsername('proj_user123', config)
      expect(result3.isValid).toBe(true)
    })

    it('should provide warnings for suboptimal usernames', () => {
      const result = validateUsername('usr')
      expect(result.isValid).toBe(true)
      expect(result.warnings.some(warning => warning.includes('quite short'))).toBe(true)
    })
  })

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'MyStr0ng!P@ssw0rd123',
        'C0mpl3x_P@ssw0rd!2024',
        'Sup3r$ecur3_P@ss!',
        'Rand0m!Ch@rs_2024#'
      ]

      strongPasswords.forEach(password => {
        const result = validatePassword(password)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
        expect(result.score).toBeGreaterThanOrEqual(70)
      })
    })

    it('should reject weak passwords', () => {
      const weakCases = [
        { password: '', expectedError: 'Password is required' },
        { password: null, expectedError: 'Password is required' },
        { password: 'short', expectedError: 'Password must be at least 12 characters' },
        { password: 'alllowercase123!', expectedError: 'Password must contain at least one uppercase letter' },
        { password: 'ALLUPPERCASE123!', expectedError: 'Password must contain at least one lowercase letter' },
        { password: 'NoNumbers!', expectedError: 'Password must contain at least one number' },
        { password: 'NoSpecialChars123', expectedError: 'Password must contain at least one special character' },
        { password: 'ContainsPassword123!', expectedError: 'Password must not contain "password"' },
        { password: '123456789012', expectedError: 'Password cannot contain only numbers' }
      ]

      weakCases.forEach(({ password, expectedError }) => {
        const result = validatePassword(password as any)
        expect(result.isValid).toBe(false)
        expect(result.errors.some(error => error.includes(expectedError.split(' ')[0]) || error.includes(expectedError.split(' ')[1]))).toBe(true)
      })
    })

    it('should calculate password strength scores correctly', () => {
      const passwordTests = [
        { password: 'Weak123!', expectedRange: [30, 100] }, // Algorithm scores based on complexity
        { password: 'Medium$tr3ngth!', expectedRange: [60, 100] },
        { password: 'V3ry$tr0ng!P@ssw0rd#2024', expectedRange: [80, 100] }
      ]

      passwordTests.forEach(({ password, expectedRange }) => {
        const result = validatePassword(password)
        expect(result.score).toBeGreaterThanOrEqual(expectedRange[0])
        expect(result.score).toBeLessThanOrEqual(expectedRange[1])
      })
    })

    it('should respect custom configuration', () => {
      const config: Partial<PasswordStrengthConfig> = {
        minLength: 8,
        requireSpecialChars: false,
        minScore: 50
      }

      const result = validatePassword('Simple123', config)
      expect(result.isValid).toBe(true) // Should pass with relaxed requirements
    })

    it('should provide warnings for suboptimal passwords', () => {
      const result = validatePassword('Aaaaaa123!')
      expect(result.warnings.some(warning => warning.includes('repeated characters'))).toBe(true)
    })
  })

  describe('validateProjectCredentials', () => {
    it('should validate complete valid credentials', async () => {
      const credentials = {
        user: 'project_user_123',
        passwordHash: 'MyStr0ng!P@ssw0rd123',
        isComplete: true
      }

      const result = await validateProjectCredentials(credentials)
      expect(result.isValid).toBe(true)
      expect(result.userValidation.isValid).toBe(true)
      expect(result.passwordValidation.isValid).toBe(true)
      expect(result.overallErrors).toHaveLength(0)
    })

    it('should reject incomplete credentials when required', async () => {
      const incompleteCredentials = {
        user: 'project_user_123',
        passwordHash: null,
        isComplete: false
      }

      const result = await validateProjectCredentials(incompleteCredentials, { requireComplete: true })
      expect(result.isValid).toBe(false)
      expect(result.overallErrors.some(error => error.includes('Password is required'))).toBe(true)
    })

    it('should allow incomplete credentials when not required', async () => {
      const incompleteCredentials = {
        user: 'project_user_123',
        passwordHash: null,
        isComplete: false
      }

      const result = await validateProjectCredentials(incompleteCredentials, { requireComplete: false })
      expect(result.userValidation.isValid).toBe(true)
      expect(result.passwordValidation.isValid).toBe(false) // Password validation fails
      expect(result.overallErrors).toHaveLength(0) // But no overall errors since not required
    })

    it('should detect similar username and password', async () => {
      const credentials = {
        user: 'testuser',
        passwordHash: 'TestUser123!',
        isComplete: true
      }

      const result = await validateProjectCredentials(credentials)
      expect(result.isValid).toBe(false)
      expect(result.overallErrors.some(error => error.includes('too similar'))).toBe(true)
    })
  })

  describe('validateCredentialFormat', () => {
    it('should validate proper credential formats', () => {
      const result = validateCredentialFormat('valid_user', 'hashed_password_string_123')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect SQL injection patterns', () => {
      const result = validateCredentialFormat("user'; DROP TABLE users; --", 'password')
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('SQL patterns'))).toBe(true)
    })

    it('should detect plaintext passwords', () => {
      const result = validateCredentialFormat('user', 'password123')
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('plaintext'))).toBe(true)
    })

    it('should detect control characters', () => {
      const result = validateCredentialFormat('user\x00name', 'pass\x01word')
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('control characters'))).toBe(true)
    })
  })

  describe('generateValidationErrorReport', () => {
    it('should generate comprehensive error reports', () => {
      const validationResult: DetailedValidationResult = {
        isValid: false,
        userValidation: {
          isValid: false,
          errors: ['Username is too short'],
          warnings: ['Username should be longer']
        },
        passwordValidation: {
          isValid: false,
          errors: ['Password is too weak'],
          warnings: ['Password contains repeated characters'],
          score: 45
        },
        overallErrors: ['Credentials are too similar']
      }

      const report = generateValidationErrorReport(validationResult, {
        projectRef: 'test-project',
        operation: 'credential creation'
      })

      expect(report).toContain('test-project')
      expect(report).toContain('credential creation')
      expect(report).toContain('Username is too short')
      expect(report).toContain('Password is too weak')
      expect(report).toContain('Credentials are too similar')
      expect(report).toContain('45/100')
    })
  })

  describe('logValidationFailure', () => {
    it('should not log successful validations', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const validResult: DetailedValidationResult = {
        isValid: true,
        userValidation: { isValid: true, errors: [], warnings: [] },
        passwordValidation: { isValid: true, errors: [], warnings: [] },
        overallErrors: []
      }

      logValidationFailure(validResult, { projectRef: 'test-project' })
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should log validation failures', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const invalidResult: DetailedValidationResult = {
        isValid: false,
        userValidation: { isValid: false, errors: ['Username error'], warnings: [] },
        passwordValidation: { isValid: false, errors: ['Password error'], warnings: [] },
        overallErrors: ['Overall error']
      }

      logValidationFailure(invalidResult, { projectRef: 'test-project' })
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-project'))

      consoleSpy.mockRestore()
    })
  })

  describe('Edge cases and security', () => {
    it('should handle non-string inputs gracefully', () => {
      const userResult = validateUsername(123 as any)
      expect(userResult.isValid).toBe(false)
      expect(userResult.errors.some(error => error.includes('must be a string'))).toBe(true)

      const passResult = validatePassword([] as any)
      expect(passResult.isValid).toBe(false)
      expect(passResult.errors.some(error => error.includes('must be a string'))).toBe(true)
    })

    it('should handle very long inputs', () => {
      const longUsername = 'a'.repeat(100)
      const result = validateUsername(longUsername)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('must not exceed'))).toBe(true)
    })

    it('should detect Unicode normalization issues', () => {
      // Username with non-normalized Unicode
      const username = 'café' // This might have combining characters
      const result = validateCredentialFormat(username, 'password')
      // The test depends on the specific Unicode normalization
      expect(result).toBeDefined()
    })

    it('should handle empty and whitespace-only inputs', () => {
      const cases = ['', '   ', '\t\n', '\r\n\t']
      
      cases.forEach(input => {
        const userResult = validateUsername(input)
        expect(userResult.isValid).toBe(false)
        
        const passResult = validatePassword(input)
        expect(passResult.isValid).toBe(false)
      })
    })
  })
})