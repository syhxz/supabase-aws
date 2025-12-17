/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../../../../../pages/api/platform/projects/create'

// Mock all the dependencies
vi.mock('../../../../../lib/api/self-hosted', () => ({
  createDatabaseWithRetry: vi.fn(),
  getTemplateDatabaseName: vi.fn(),
  saveProject: vi.fn(),
  generateConnectionString: vi.fn(),
  generateDisplayConnectionString: vi.fn(),
  deleteDatabase: vi.fn(),
  createProjectUser: vi.fn(),
  deleteProjectUser: vi.fn(),
  validatePassword: vi.fn(),
  parseConnectionString: vi.fn(),
  DatabaseError: class DatabaseError extends Error {
    constructor(public code: string, message: string, public details?: any) {
      super(message)
    }
  },
  DatabaseErrorCode: {
    DATABASE_ALREADY_EXISTS: 'DATABASE_ALREADY_EXISTS',
    INVALID_DATABASE_NAME: 'INVALID_DATABASE_NAME',
    TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    DISK_SPACE_FULL: 'DISK_SPACE_FULL',
    CONNECTION_FAILED: 'CONNECTION_FAILED',
  },
  DatabaseUserError: class DatabaseUserError extends Error {
    constructor(public code: string, message: string, public details?: any) {
      super(message)
    }
  },
  DatabaseUserErrorCode: {
    USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
    INVALID_USERNAME: 'INVALID_USERNAME',
    INVALID_PASSWORD: 'INVALID_PASSWORD',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    CONNECTION_FAILED: 'CONNECTION_FAILED',
    DATABASE_NOT_FOUND: 'DATABASE_NOT_FOUND',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  },
  ProjectStoreError: class ProjectStoreError extends Error {
    constructor(public code: string, message: string, public details?: any) {
      super(message)
    }
  },
  ProjectStoreErrorCode: {
    PROJECT_ALREADY_EXISTS: 'PROJECT_ALREADY_EXISTS',
    INVALID_PROJECT_DATA: 'INVALID_PROJECT_DATA',
  },
}))

vi.mock('../../../../../lib/api/auth-helpers', () => ({
  getCurrentUserId: vi.fn(),
  isUserIsolationEnabled: vi.fn(),
}))

vi.mock('../../../../../lib/project-initialization/ProjectInitializationService', () => ({
  ProjectInitializationService: vi.fn().mockImplementation(() => ({
    initializeProject: vi.fn(),
    createProjectDirectories: vi.fn(),
    deleteProjectDirectories: vi.fn(),
    close: vi.fn(),
  })),
}))

vi.mock('../../../../../lib/service-router', () => ({
  getServiceRouter: vi.fn(() => ({
    registerProject: vi.fn(),
    isProjectRegistered: vi.fn(),
  })),
}))

vi.mock('../../../../../lib/api/self-hosted/enhanced-credential-generation', () => ({
  generateDatabaseNameWithCollisionDetection: vi.fn(),
  generateUsernameWithCollisionDetection: vi.fn(),
  CredentialGenerationError: class CredentialGenerationError extends Error {
    constructor(public code: string, message: string, public details?: any) {
      super(message)
    }
  },
  CredentialGenerationErrorCode: {
    RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
    INVALID_PROJECT_NAME: 'INVALID_PROJECT_NAME',
    GENERATION_FAILED: 'GENERATION_FAILED',
    UNIQUENESS_CHECK_FAILED: 'UNIQUENESS_CHECK_FAILED',
  },
}))

vi.mock('../../../../../lib/api/self-hosted/credential-generation-fallback', () => ({
  generateCredentialWithFallbackSupport: vi.fn(),
  DEFAULT_FALLBACK_CONFIG: {},
}))

import {
  createDatabaseWithRetry,
  getTemplateDatabaseName,
  saveProject,
  generateConnectionString,
  generateDisplayConnectionString,
  createProjectUser,
  validatePassword,
  parseConnectionString,
} from '../../../../../lib/api/self-hosted'
import {
  generateDatabaseNameWithCollisionDetection,
  generateUsernameWithCollisionDetection,
} from '../../../../../lib/api/self-hosted/enhanced-credential-generation'
import {
  generateCredentialWithFallbackSupport,
} from '../../../../../lib/api/self-hosted/credential-generation-fallback'
import { isUserIsolationEnabled } from '../../../../../lib/api/auth-helpers'
import { ProjectInitializationService } from '../../../../../lib/project-initialization/ProjectInitializationService'

const mockCreateDatabaseWithRetry = vi.mocked(createDatabaseWithRetry)
const mockGetTemplateDatabaseName = vi.mocked(getTemplateDatabaseName)
const mockSaveProject = vi.mocked(saveProject)
const mockGenerateConnectionString = vi.mocked(generateConnectionString)
const mockGenerateDisplayConnectionString = vi.mocked(generateDisplayConnectionString)
const mockCreateProjectUser = vi.mocked(createProjectUser)
const mockValidatePassword = vi.mocked(validatePassword)
const mockParseConnectionString = vi.mocked(parseConnectionString)
const mockIsUserIsolationEnabled = vi.mocked(isUserIsolationEnabled)
const mockGenerateDatabaseNameWithCollisionDetection = vi.mocked(generateDatabaseNameWithCollisionDetection)
const mockGenerateUsernameWithCollisionDetection = vi.mocked(generateUsernameWithCollisionDetection)
const mockGenerateCredentialWithFallbackSupport = vi.mocked(generateCredentialWithFallbackSupport)

describe('/api/platform/projects/create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockGetTemplateDatabaseName.mockReturnValue('template_db')
    mockGenerateDatabaseNameWithCollisionDetection.mockResolvedValue('test_db_abc123')
    mockGenerateUsernameWithCollisionDetection.mockResolvedValue('proj_test_project_xyz789')
    mockGenerateCredentialWithFallbackSupport.mockImplementation(async (projectName, type, primaryFn) => {
      const name = await primaryFn()
      return { name, usedFallback: false }
    })
    mockValidatePassword.mockImplementation(() => {}) // No throw = valid
    mockCreateDatabaseWithRetry.mockResolvedValue({ data: undefined, error: undefined })
    mockCreateProjectUser.mockResolvedValue({ data: undefined, error: undefined })
    mockGenerateConnectionString.mockReturnValue('postgresql://proj_test_project_xyz789:password123@localhost:5432/test_db_abc123')
    mockGenerateDisplayConnectionString.mockReturnValue('postgresql://proj_test_project_xyz789:[YOUR_PASSWORD]@localhost:5432/test_db_abc123')
    mockParseConnectionString.mockReturnValue({
      user: 'proj_test_project_xyz789',
      password: 'password123',
      host: 'localhost',
      port: 5432,
      database: 'test_db_abc123',
    })
    mockSaveProject.mockResolvedValue({
      data: {
        id: 1,
        ref: 'test-ref',
        name: 'Test Project',
        database_name: 'test_db_abc123',
        database_user: 'proj_test_project_xyz789',
        database_password_hash: 'hashed_password',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'local',
        connection_string: 'postgresql://proj_test_project_xyz789:password123@localhost:5432/test_db_abc123',
        inserted_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      },
      error: undefined,
    })
    mockIsUserIsolationEnabled.mockReturnValue(false)
    
    // Mock ProjectInitializationService
    const mockInitService = {
      initializeProject: vi.fn().mockResolvedValue({ success: true, schemasCreated: ['public'] }),
      createProjectDirectories: vi.fn().mockResolvedValue(undefined),
      deleteProjectDirectories: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(ProjectInitializationService).mockImplementation(() => mockInitService as any)
  })

  describe('POST', () => {
    it('should create a project with auto-generated credentials successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Project',
          database_password: 'password123',
          organization_id: 1,
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(201)
      const responseData = JSON.parse(res._getData())
      
      expect(responseData).toMatchObject({
        name: 'Test Project',
        database_name: 'test_db_abc123',
        status: 'ACTIVE_HEALTHY',
        databases: expect.arrayContaining([
          expect.objectContaining({
            user: 'proj_test_project_xyz789',
            database: 'test_db_abc123',
          }),
        ]),
      })

      // Verify enhanced credential generation was called
      expect(mockGenerateDatabaseNameWithCollisionDetection).toHaveBeenCalledWith('Test Project')
      expect(mockGenerateUsernameWithCollisionDetection).toHaveBeenCalledWith('Test Project')

      // Verify user creation was called with auto-generated credentials
      expect(mockCreateProjectUser).toHaveBeenCalledWith({
        username: 'proj_test_project_xyz789',
        password: 'password123',
        databaseName: 'test_db_abc123',
        projectRef: expect.any(String),
      })
    })

    it('should handle credential generation failures', async () => {
      const { CredentialGenerationError, CredentialGenerationErrorCode } = await import('../../../../../lib/api/self-hosted/enhanced-credential-generation')
      
      const error = new CredentialGenerationError(
        CredentialGenerationErrorCode.RETRY_EXHAUSTED,
        'Failed to generate unique username after 5 attempts',
        { projectName: 'Test Project', attempts: 5 }
      )
      
      mockGenerateCredentialWithFallbackSupport.mockRejectedValue(error)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Project',
          database_password: 'password123',
          organization_id: 1,
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(500)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.code).toBe('RETRY_EXHAUSTED')
    })

    it('should return 400 for missing project name', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          database_password: 'password123',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.code).toBe('INVALID_PROJECT_NAME')
    })

    it('should return 400 for missing database password', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Project',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.code).toBe('INVALID_DATABASE_PASSWORD')
    })

    it('should handle database name generation failures', async () => {
      const { CredentialGenerationError, CredentialGenerationErrorCode } = await import('../../../../../lib/api/self-hosted/enhanced-credential-generation')
      
      const error = new CredentialGenerationError(
        CredentialGenerationErrorCode.INVALID_PROJECT_NAME,
        'Project name is required and must be a string'
      )
      
      // Mock the fallback to fail for database name generation
      mockGenerateCredentialWithFallbackSupport.mockImplementation(async (projectName, type, primaryFn) => {
        if (type === 'database') {
          throw error
        }
        const name = await primaryFn()
        return { name, usedFallback: false }
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Project',
          database_password: 'password123',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.code).toBe('INVALID_PROJECT_NAME')
    })

    it('should return 400 for invalid password', async () => {
      const { DatabaseUserError, DatabaseUserErrorCode } = await import('../../../../../lib/api/self-hosted')
      
      mockValidatePassword.mockImplementation(() => {
        throw new DatabaseUserError(DatabaseUserErrorCode.INVALID_PASSWORD, 'Password too short')
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Project',
          database_user: 'test_user',
          database_password: 'short',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.code).toBe('INVALID_PASSWORD')
    })

    it('should handle database user creation failure', async () => {
      const { DatabaseUserError, DatabaseUserErrorCode } = await import('../../../../../lib/api/self-hosted')
      
      mockCreateProjectUser.mockResolvedValue({
        data: undefined,
        error: new DatabaseUserError(DatabaseUserErrorCode.USER_ALREADY_EXISTS, 'User already exists'),
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Project',
          database_password: 'password123',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(409)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.code).toBe('USER_ALREADY_EXISTS')
    })

    it('should return 405 for non-POST methods', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(405)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.message).toBe('Method GET Not Allowed')
    })
  })
})