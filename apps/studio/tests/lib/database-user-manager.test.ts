/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createProjectUser,
  deleteProjectUser,
  validateUserCredentials,
  getUserPermissions,
  userExists,
  validateUsername,
  validatePassword,
  generateUsername,
  DatabaseUserError,
  DatabaseUserErrorCode,
  type CreateUserOptions,
  type UserPermissions,
} from '../../lib/api/self-hosted/database-user-manager'

// Mock the executeQuery function
vi.mock('../../lib/api/self-hosted/query', () => ({
  executeQuery: vi.fn(),
}))

// Mock the database-manager module
vi.mock('../../lib/api/self-hosted/database-manager', () => ({
  databaseExists: vi.fn(),
}))

import { executeQuery } from '../../lib/api/self-hosted/query'
import { databaseExists } from '../../lib/api/self-hosted/database-manager'

const mockExecuteQuery = vi.mocked(executeQuery)
const mockDatabaseExists = vi.mocked(databaseExists)

describe('Database User Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateUsername', () => {
    it('should accept valid usernames', () => {
      expect(() => validateUsername('valid_user')).not.toThrow()
      expect(() => validateUsername('user123')).not.toThrow()
      expect(() => validateUsername('_underscore')).not.toThrow()
      expect(() => validateUsername('user$dollar')).not.toThrow()
    })

    it('should reject invalid usernames', () => {
      expect(() => validateUsername('')).toThrow(DatabaseUserError)
      expect(() => validateUsername('123invalid')).toThrow(DatabaseUserError)
      expect(() => validateUsername('user-dash')).toThrow(DatabaseUserError)
      expect(() => validateUsername('user space')).toThrow(DatabaseUserError)
      expect(() => validateUsername('a'.repeat(64))).toThrow(DatabaseUserError)
    })

    it('should reject reserved usernames', () => {
      expect(() => validateUsername('postgres')).toThrow(DatabaseUserError)
      expect(() => validateUsername('supabase_admin')).toThrow(DatabaseUserError)
      expect(() => validateUsername('authenticator')).toThrow(DatabaseUserError)
    })

    it('should reject non-string inputs', () => {
      expect(() => validateUsername(null as any)).toThrow(DatabaseUserError)
      expect(() => validateUsername(undefined as any)).toThrow(DatabaseUserError)
      expect(() => validateUsername(123 as any)).toThrow(DatabaseUserError)
    })
  })

  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      expect(() => validatePassword('password123')).not.toThrow()
      expect(() => validatePassword('MySecure1Pass')).not.toThrow()
      expect(() => validatePassword('complex$Pass123')).not.toThrow()
    })

    it('should reject invalid passwords', () => {
      expect(() => validatePassword('')).toThrow(DatabaseUserError)
      expect(() => validatePassword('short1')).toThrow(DatabaseUserError)
      expect(() => validatePassword('onlyletters')).toThrow(DatabaseUserError)
      expect(() => validatePassword('12345678')).toThrow(DatabaseUserError)
      expect(() => validatePassword('a'.repeat(129))).toThrow(DatabaseUserError)
    })

    it('should reject non-string inputs', () => {
      expect(() => validatePassword(null as any)).toThrow(DatabaseUserError)
      expect(() => validatePassword(undefined as any)).toThrow(DatabaseUserError)
      expect(() => validatePassword(123 as any)).toThrow(DatabaseUserError)
    })
  })

  describe('generateUsername', () => {
    it('should generate valid usernames from project names', () => {
      const result1 = generateUsername('my-project')
      const result2 = generateUsername('Project123')
      const result3 = generateUsername('test_project')
      
      // Should follow new format: user_projectname_xxxx
      expect(result1).toMatch(/^user_my_project_[a-z0-9]{4}$/)
      expect(result2).toMatch(/^user_project123_[a-z0-9]{4}$/)
      expect(result3).toMatch(/^user_test_project_[a-z0-9]{4}$/)
    })

    it('should handle special characters', () => {
      const result1 = generateUsername('my-special@project!')
      const result2 = generateUsername('123project')
      
      expect(result1).toMatch(/^user_my_special_project_[a-z0-9]{4}$/)
      expect(result2).toMatch(/^user_proj[a-z0-9]*_[a-z0-9]{4}$/)
    })

    it('should truncate long names', () => {
      const longName = 'a'.repeat(100)
      const result = generateUsername(longName)
      expect(result.length).toBeLessThanOrEqual(63)
      expect(result.startsWith('user_')).toBe(true)
      expect(result).toMatch(/^user_[a-z0-9_]+_[a-z0-9]{4}$/)
    })

    it('should reject invalid inputs', () => {
      expect(() => generateUsername('')).toThrow(DatabaseUserError)
      expect(() => generateUsername(null as any)).toThrow(DatabaseUserError)
      expect(() => generateUsername(undefined as any)).toThrow(DatabaseUserError)
    })
  })

  describe('userExists', () => {
    it('should return true when user exists', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: [{ exists: true }],
        error: undefined,
      })

      const result = await userExists('test_user')
      expect(result.data).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mockExecuteQuery).toHaveBeenCalledWith({
        query: expect.stringContaining('SELECT EXISTS'),
        parameters: ['test_user'],
        readOnly: true,
      })
    })

    it('should return false when user does not exist', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: [{ exists: false }],
        error: undefined,
      })

      const result = await userExists('nonexistent_user')
      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it('should handle query errors', async () => {
      const queryError = new Error('Database connection failed')
      mockExecuteQuery.mockResolvedValue({
        data: undefined,
        error: queryError,
      })

      const result = await userExists('test_user')
      expect(result.data).toBeUndefined()
      expect(result.error).toBe(queryError)
    })
  })

  describe('createProjectUser', () => {
    const validOptions: CreateUserOptions = {
      username: 'test_user',
      password: 'password123',
      databaseName: 'test_db',
      projectRef: 'test-project',
    }

    beforeEach(() => {
      // Mock user doesn't exist
      mockExecuteQuery.mockImplementation(async ({ query }) => {
        if (query.includes('SELECT EXISTS') && query.includes('pg_user')) {
          return { data: [{ exists: false }], error: undefined }
        }
        if (query.includes('CREATE USER')) {
          return { data: undefined, error: undefined }
        }
        if (query.includes('GRANT')) {
          return { data: undefined, error: undefined }
        }
        return { data: undefined, error: undefined }
      })

      // Mock database exists
      mockDatabaseExists.mockResolvedValue({
        data: true,
        error: undefined,
      })
    })

    it('should create a user successfully', async () => {
      const result = await createProjectUser(validOptions)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
      
      // Should check if user exists
      expect(mockExecuteQuery).toHaveBeenCalledWith({
        query: expect.stringContaining('SELECT EXISTS'),
        parameters: ['test_user'],
        readOnly: true,
      })
      
      // Should create the user
      expect(mockExecuteQuery).toHaveBeenCalledWith({
        query: 'CREATE USER "test_user" WITH PASSWORD \'password123\'',
        readOnly: false,
      })
      
      // Should grant database privileges
      expect(mockExecuteQuery).toHaveBeenCalledWith({
        query: 'GRANT ALL PRIVILEGES ON DATABASE "test_db" TO "test_user"',
        readOnly: false,
      })
    })

    it('should reject invalid username', async () => {
      const invalidOptions = { ...validOptions, username: 'invalid-user' }
      
      const result = await createProjectUser(invalidOptions)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseUserError)
      expect(result.error?.code).toBe(DatabaseUserErrorCode.INVALID_USERNAME)
    })

    it('should reject invalid password', async () => {
      const invalidOptions = { ...validOptions, password: 'short' }
      
      const result = await createProjectUser(invalidOptions)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseUserError)
      expect(result.error?.code).toBe(DatabaseUserErrorCode.INVALID_PASSWORD)
    })

    it('should handle existing user error', async () => {
      mockExecuteQuery.mockImplementation(async ({ query }) => {
        if (query.includes('SELECT EXISTS') && query.includes('pg_user')) {
          return { data: [{ exists: true }], error: undefined }
        }
        return { data: undefined, error: undefined }
      })

      const result = await createProjectUser(validOptions)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseUserError)
      expect(result.error?.code).toBe(DatabaseUserErrorCode.USER_ALREADY_EXISTS)
    })

    it('should handle database not found error', async () => {
      mockDatabaseExists.mockResolvedValue({
        data: false,
        error: undefined,
      })

      const result = await createProjectUser(validOptions)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseUserError)
      expect(result.error?.code).toBe(DatabaseUserErrorCode.DATABASE_NOT_FOUND)
    })

    it('should handle PostgreSQL errors during user creation', async () => {
      mockExecuteQuery.mockImplementation(async ({ query }) => {
        if (query.includes('SELECT EXISTS') && query.includes('pg_user')) {
          return { data: [{ exists: false }], error: undefined }
        }
        if (query.includes('CREATE USER')) {
          return { 
            data: undefined, 
            error: { message: 'permission denied for role creation' } 
          }
        }
        return { data: undefined, error: undefined }
      })

      const result = await createProjectUser(validOptions)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseUserError)
      expect(result.error?.code).toBe(DatabaseUserErrorCode.PERMISSION_DENIED)
    })
  })

  describe('deleteProjectUser', () => {
    beforeEach(() => {
      // Mock user exists
      mockExecuteQuery.mockImplementation(async ({ query }) => {
        if (query.includes('SELECT EXISTS') && query.includes('pg_user')) {
          return { data: [{ exists: true }], error: undefined }
        }
        if (query.includes('pg_terminate_backend')) {
          return { data: [{ pg_terminate_backend: true }], error: undefined }
        }
        if (query.includes('DROP USER')) {
          return { data: undefined, error: undefined }
        }
        return { data: undefined, error: undefined }
      })
    })

    it('should delete a user successfully', async () => {
      const result = await deleteProjectUser('test_user')
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
      
      // Should check if user exists
      expect(mockExecuteQuery).toHaveBeenCalledWith({
        query: expect.stringContaining('SELECT EXISTS'),
        parameters: ['test_user'],
        readOnly: true,
      })
      
      // Should terminate connections
      expect(mockExecuteQuery).toHaveBeenCalledWith({
        query: expect.stringContaining('pg_terminate_backend'),
        parameters: ['test_user'],
        readOnly: false,
      })
      
      // Should drop the user
      expect(mockExecuteQuery).toHaveBeenCalledWith({
        query: 'DROP USER "test_user"',
        readOnly: false,
      })
    })

    it('should handle non-existent user gracefully', async () => {
      mockExecuteQuery.mockImplementation(async ({ query }) => {
        if (query.includes('SELECT EXISTS') && query.includes('pg_user')) {
          return { data: [{ exists: false }], error: undefined }
        }
        return { data: undefined, error: undefined }
      })

      const result = await deleteProjectUser('nonexistent_user')
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
      
      // Should not attempt to drop user
      expect(mockExecuteQuery).not.toHaveBeenCalledWith({
        query: expect.stringContaining('DROP USER'),
        readOnly: false,
      })
    })

    it('should reject invalid username', async () => {
      const result = await deleteProjectUser('invalid-user')
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseUserError)
      expect(result.error?.code).toBe(DatabaseUserErrorCode.INVALID_USERNAME)
    })

    it('should handle PostgreSQL errors during deletion', async () => {
      mockExecuteQuery.mockImplementation(async ({ query }) => {
        if (query.includes('SELECT EXISTS') && query.includes('pg_user')) {
          return { data: [{ exists: true }], error: undefined }
        }
        if (query.includes('pg_terminate_backend')) {
          return { data: [], error: undefined }
        }
        if (query.includes('DROP USER')) {
          return { 
            data: undefined, 
            error: { message: 'cannot be dropped because some objects depend on it' } 
          }
        }
        return { data: undefined, error: undefined }
      })

      const result = await deleteProjectUser('test_user')
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseUserError)
      expect(result.error?.code).toBe(DatabaseUserErrorCode.UNKNOWN_ERROR)
      expect(result.error?.message).toContain('some database objects depend on it')
    })
  })

  describe('validateUserCredentials', () => {
    it('should return true for valid credentials of existing user', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: [{ exists: true }],
        error: undefined,
      })

      const result = await validateUserCredentials('test_user', 'password123')
      
      expect(result.data).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return false for non-existent user', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: [{ exists: false }],
        error: undefined,
      })

      const result = await validateUserCredentials('nonexistent_user', 'password123')
      
      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it('should return false for invalid username format', async () => {
      const result = await validateUserCredentials('invalid-user', 'password123')
      
      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it('should return false for invalid password format', async () => {
      const result = await validateUserCredentials('test_user', 'short')
      
      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })
  })

  describe('getUserPermissions', () => {
    const mockUserInfo = {
      usename: 'test_user',
      usesuper: false,
      usecreatedb: false,
      usecreaterole: false,
    }

    const mockPrivileges = [
      { database_name: 'test_db', privileges: ['CONNECT', 'CREATE'] },
      { database_name: 'other_db', privileges: ['CONNECT'] },
    ]

    beforeEach(() => {
      mockExecuteQuery.mockImplementation(async ({ query }) => {
        if (query.includes('SELECT EXISTS') && query.includes('pg_user')) {
          return { data: [{ exists: true }], error: undefined }
        }
        if (query.includes('usename') && query.includes('FROM pg_user')) {
          return { data: [mockUserInfo], error: undefined }
        }
        if (query.includes('has_database_privilege')) {
          return { data: mockPrivileges, error: undefined }
        }
        return { data: undefined, error: undefined }
      })
    })

    it('should return user permissions successfully', async () => {
      const result = await getUserPermissions('test_user')
      
      expect(result.data).toEqual({
        username: 'test_user',
        databases: ['test_db', 'other_db'],
        privileges: {
          test_db: ['CONNECT', 'CREATE'],
          other_db: ['CONNECT'],
        },
        canCreateDb: false,
        canCreateRole: false,
        isSuperuser: false,
      })
      expect(result.error).toBeUndefined()
    })

    it('should handle non-existent user', async () => {
      mockExecuteQuery.mockImplementation(async ({ query }) => {
        if (query.includes('SELECT EXISTS') && query.includes('pg_user')) {
          return { data: [{ exists: false }], error: undefined }
        }
        return { data: undefined, error: undefined }
      })

      const result = await getUserPermissions('nonexistent_user')
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseUserError)
      expect(result.error?.code).toBe(DatabaseUserErrorCode.INVALID_USERNAME)
    })

    it('should reject invalid username', async () => {
      const result = await getUserPermissions('invalid-user')
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseUserError)
      expect(result.error?.code).toBe(DatabaseUserErrorCode.INVALID_USERNAME)
    })
  })
})