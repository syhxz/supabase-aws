/**
 * Tests for user isolation verification and security utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  verifyCrossProjectAccessDenial,
  verifyUserPermissions,
  logUserAccess,
  runIsolationVerification,
  generateIsolationVerificationScript,
  type UserAccessAuditLog,
  type SecurityViolation
} from '../user-isolation-security'
import { DatabaseUserError, DatabaseUserErrorCode } from '../database-user-manager'

// Mock the dependencies
vi.mock('../query', () => ({
  executeQuery: vi.fn()
}))

vi.mock('../database-user-manager', () => ({
  validateUsername: vi.fn(),
  getUserPermissions: vi.fn(),
  userExists: vi.fn(),
  DatabaseUserError: class extends Error {
    constructor(public code: string, message: string, public details?: any) {
      super(message)
      this.name = 'DatabaseUserError'
    }
  },
  DatabaseUserErrorCode: {
    INVALID_USERNAME: 'INVALID_USERNAME',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  }
}))

const mockExecuteQuery = vi.mocked((await import('../query')).executeQuery)
const mockValidateUsername = vi.mocked((await import('../database-user-manager')).validateUsername)
const mockGetUserPermissions = vi.mocked((await import('../database-user-manager')).getUserPermissions)
const mockUserExists = vi.mocked((await import('../database-user-manager')).userExists)

describe('user-isolation-security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('verifyCrossProjectAccessDenial', () => {
    it('should return access denied when user has no permissions on target database', async () => {
      mockValidateUsername.mockImplementation(() => {})
      mockUserExists.mockResolvedValue({ data: true, error: undefined })
      
      // Mock permission checks to return false
      mockExecuteQuery.mockResolvedValue({
        data: [{ has_privilege: false }],
        error: undefined
      })

      const result = await verifyCrossProjectAccessDenial('proj_test', 'other_project_db')

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual({
        canAccess: false,
        permissions: [],
        error: undefined
      })
    })

    it('should return access granted when user has permissions on target database', async () => {
      mockValidateUsername.mockImplementation(() => {})
      mockUserExists.mockResolvedValue({ data: true, error: undefined })
      
      // Mock permission checks - first call returns true (CONNECT), others false
      mockExecuteQuery
        .mockResolvedValueOnce({ data: [{ has_privilege: true }], error: undefined })
        .mockResolvedValueOnce({ data: [{ has_privilege: false }], error: undefined })
        .mockResolvedValueOnce({ data: [{ has_privilege: false }], error: undefined })

      const result = await verifyCrossProjectAccessDenial('proj_test', 'other_project_db')

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual({
        canAccess: true,
        permissions: ['CONNECT'],
        error: 'User has unauthorized access to database "other_project_db"'
      })
    })

    it('should handle invalid username', async () => {
      mockValidateUsername.mockImplementation(() => {
        throw new DatabaseUserError(DatabaseUserErrorCode.INVALID_USERNAME, 'Invalid username')
      })

      const result = await verifyCrossProjectAccessDenial('invalid-user', 'test_db')

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseUserError)
      expect(result.error?.code).toBe(DatabaseUserErrorCode.INVALID_USERNAME)
    })

    it('should handle non-existent user', async () => {
      mockValidateUsername.mockImplementation(() => {})
      mockUserExists.mockResolvedValue({ data: false, error: undefined })

      const result = await verifyCrossProjectAccessDenial('proj_nonexistent', 'test_db')

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseUserError)
      expect(result.error?.code).toBe(DatabaseUserErrorCode.INVALID_USERNAME)
    })
  })

  describe('verifyUserPermissions', () => {
    it('should return no violations for properly configured user', async () => {
      mockValidateUsername.mockImplementation(() => {})
      mockGetUserPermissions.mockResolvedValue({
        data: {
          username: 'proj_test',
          databases: ['test_db'],
          privileges: { 'test_db': ['CONNECT', 'CREATE'] },
          canCreateDb: false,
          canCreateRole: false,
          isSuperuser: false
        },
        error: undefined
      })

      const result = await verifyUserPermissions('proj_test', 'test_db')

      expect(result.error).toBeUndefined()
      expect(result.data?.hasCorrectPermissions).toBe(true)
      expect(result.data?.violations).toHaveLength(0)
    })

    it('should detect cross-project access violation', async () => {
      mockValidateUsername.mockImplementation(() => {})
      mockGetUserPermissions.mockResolvedValue({
        data: {
          username: 'proj_test',
          databases: ['test_db', 'other_project_db'],
          privileges: { 
            'test_db': ['CONNECT', 'CREATE'],
            'other_project_db': ['CONNECT']
          },
          canCreateDb: false,
          canCreateRole: false,
          isSuperuser: false
        },
        error: undefined
      })

      const result = await verifyUserPermissions('proj_test', 'test_db')

      expect(result.error).toBeUndefined()
      expect(result.data?.hasCorrectPermissions).toBe(false)
      expect(result.data?.violations).toHaveLength(1)
      expect(result.data?.violations[0].type).toBe('CROSS_PROJECT_ACCESS')
      expect(result.data?.violations[0].severity).toBe('HIGH')
    })

    it('should detect excessive privileges', async () => {
      mockValidateUsername.mockImplementation(() => {})
      mockGetUserPermissions.mockResolvedValue({
        data: {
          username: 'proj_test',
          databases: ['test_db'],
          privileges: { 'test_db': ['CONNECT', 'CREATE'] },
          canCreateDb: true,
          canCreateRole: true,
          isSuperuser: true
        },
        error: undefined
      })

      const result = await verifyUserPermissions('proj_test', 'test_db')

      expect(result.error).toBeUndefined()
      expect(result.data?.hasCorrectPermissions).toBe(false)
      expect(result.data?.violations).toHaveLength(3)
      
      const violationTypes = result.data?.violations.map(v => v.type)
      expect(violationTypes).toContain('EXCESSIVE_PRIVILEGES')
      
      const severities = result.data?.violations.map(v => v.severity)
      expect(severities).toContain('CRITICAL') // superuser
      expect(severities).toContain('HIGH') // createrole
      expect(severities).toContain('MEDIUM') // createdb
    })

    it('should detect missing access to assigned database', async () => {
      mockValidateUsername.mockImplementation(() => {})
      mockGetUserPermissions.mockResolvedValue({
        data: {
          username: 'proj_test',
          databases: [], // No access to any database
          privileges: {},
          canCreateDb: false,
          canCreateRole: false,
          isSuperuser: false
        },
        error: undefined
      })

      const result = await verifyUserPermissions('proj_test', 'test_db')

      expect(result.error).toBeUndefined()
      expect(result.data?.hasCorrectPermissions).toBe(false)
      expect(result.data?.violations).toHaveLength(1)
      expect(result.data?.violations[0].type).toBe('MISSING_ISOLATION')
      expect(result.data?.violations[0].severity).toBe('CRITICAL')
    })
  })

  describe('logUserAccess', () => {
    it('should log user access to console', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const auditLog: UserAccessAuditLog = {
        username: 'proj_test',
        database: 'test_db',
        timestamp: new Date('2023-01-01T00:00:00Z'),
        accessType: 'SELECT',
        granted: true,
        details: 'Test access'
      }

      const result = await logUserAccess(auditLog)

      expect(result.error).toBeUndefined()
      expect(consoleSpy).toHaveBeenCalledWith(
        '[USER_ACCESS_AUDIT]',
        JSON.stringify({
          timestamp: '2023-01-01T00:00:00.000Z',
          username: 'proj_test',
          database: 'test_db',
          accessType: 'SELECT',
          granted: true,
          details: 'Test access'
        })
      )

      consoleSpy.mockRestore()
    })
  })

  describe('runIsolationVerification', () => {
    it('should return secure status when no violations found', async () => {
      // Mock getting project users
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ usename: 'proj_test1' }, { usename: 'proj_test2' }],
          error: undefined
        })
        // Mock getting project databases
        .mockResolvedValueOnce({
          data: [{ datname: 'test1' }, { datname: 'test2' }],
          error: undefined
        })

      // Mock user permissions for both users
      mockGetUserPermissions
        .mockResolvedValueOnce({
          data: {
            username: 'proj_test1',
            databases: ['test1'],
            privileges: { 'test1': ['CONNECT'] },
            canCreateDb: false,
            canCreateRole: false,
            isSuperuser: false
          },
          error: undefined
        })
        .mockResolvedValueOnce({
          data: {
            username: 'proj_test2',
            databases: ['test2'],
            privileges: { 'test2': ['CONNECT'] },
            canCreateDb: false,
            canCreateRole: false,
            isSuperuser: false
          },
          error: undefined
        })

      // Mock userExists for cross-project access checks
      mockUserExists.mockResolvedValue({ data: true, error: undefined })
      
      // Mock cross-project access checks (all should return false)
      mockExecuteQuery
        .mockResolvedValue({ data: [{ has_privilege: false }], error: undefined })

      const result = await runIsolationVerification()

      expect(result.error).toBeUndefined()
      expect(result.data?.isolationStatus).toBe('SECURE')
      expect(result.data?.violations).toHaveLength(0)
      expect(result.data?.usersChecked).toEqual(['proj_test1', 'proj_test2'])
      expect(result.data?.databasesChecked).toEqual(['test1', 'test2'])
    })

    it('should return compromised status when violations found', async () => {
      // Mock getting project users
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ usename: 'proj_test1' }],
          error: undefined
        })
        // Mock getting project databases
        .mockResolvedValueOnce({
          data: [{ datname: 'test1' }, { datname: 'test2' }],
          error: undefined
        })

      // Mock user permissions with violations
      mockGetUserPermissions.mockResolvedValue({
        data: {
          username: 'proj_test1',
          databases: ['test1', 'test2'], // Access to multiple databases
          privileges: { 
            'test1': ['CONNECT'],
            'test2': ['CONNECT'] 
          },
          canCreateDb: false,
          canCreateRole: false,
          isSuperuser: true // Superuser violation
        },
        error: undefined
      })

      // Mock userExists for cross-project access checks
      mockUserExists.mockResolvedValue({ data: true, error: undefined })
      
      // Mock cross-project access checks to return false (no additional violations from access checks)
      mockExecuteQuery
        .mockResolvedValue({ data: [{ has_privilege: false }], error: undefined })

      const result = await runIsolationVerification()

      expect(result.error).toBeUndefined()
      expect(result.data?.isolationStatus).toBe('COMPROMISED')
      expect(result.data?.violations.length).toBeGreaterThan(0)
    })
  })

  describe('generateIsolationVerificationScript', () => {
    it('should generate SQL script for manual verification', () => {
      const script = generateIsolationVerificationScript()

      expect(script).toContain('PROJECT USERS')
      expect(script).toContain('DATABASE PERMISSIONS')
      expect(script).toContain('POTENTIAL VIOLATIONS')
      expect(script).toContain('EXCESSIVE PRIVILEGES')
      expect(script).toContain('SUMMARY')
      expect(script).toContain("usename LIKE 'proj_%'")
    })
  })
})