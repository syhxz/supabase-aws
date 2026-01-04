/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { NextApiRequest, NextApiResponse } from 'next'
import handler from '../create'

// Mock the self-hosted module
vi.mock('lib/api/self-hosted', () => ({
  createDatabase: vi.fn(),
  createDatabaseWithRetry: vi.fn(),
  getTemplateDatabaseName: vi.fn(),
  DatabaseError: class DatabaseError extends Error {
    code: string
    details?: any
    constructor(code: string, message: string, details?: any) {
      super(message)
      this.code = code
      this.details = details
      this.name = 'DatabaseError'
    }
  },
  DatabaseErrorCode: {
    DATABASE_ALREADY_EXISTS: 'DATABASE_ALREADY_EXISTS',
    INVALID_DATABASE_NAME: 'INVALID_DATABASE_NAME',
    TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    DISK_SPACE_FULL: 'DISK_SPACE_FULL',
    CONNECTION_FAILED: 'CONNECTION_FAILED',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  },
  saveProject: vi.fn(),
  generateDatabaseName: vi.fn(),
  validateDatabaseName: vi.fn(),
  generateConnectionString: vi.fn(),
  generateDisplayConnectionString: vi.fn(),
  parseConnectionString: vi.fn(),
  deleteDatabase: vi.fn(),
  terminateConnections: vi.fn(),
  terminateConnectionsAndWait: vi.fn(),
  createProjectUser: vi.fn(),
  deleteProjectUser: vi.fn(),
  validatePassword: vi.fn(),
  ProjectStoreError: class ProjectStoreError extends Error {
    code: string
    details?: any
    constructor(code: string, message: string, details?: any) {
      super(message)
      this.code = code
      this.details = details
      this.name = 'ProjectStoreError'
    }
  },
  ProjectStoreErrorCode: {
    PROJECT_ALREADY_EXISTS: 'PROJECT_ALREADY_EXISTS',
    INVALID_PROJECT_DATA: 'INVALID_PROJECT_DATA',
    PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
    STORAGE_ERROR: 'STORAGE_ERROR',
  },
  DatabaseUserError: class DatabaseUserError extends Error {
    code: string
    details?: any
    constructor(code: string, message: string, details?: any) {
      super(message)
      this.code = code
      this.details = details
      this.name = 'DatabaseUserError'
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
}))

// Mock apiWrapper to pass through to handler
vi.mock('lib/api/apiWrapper', () => ({
  default: (req: NextApiRequest, res: NextApiResponse, handler: Function) => handler(req, res),
}))

// Mock enhanced credential generation
vi.mock('lib/api/self-hosted/enhanced-credential-generation', () => ({
  generateDatabaseNameWithCollisionDetection: vi.fn(),
  generateUsernameWithCollisionDetection: vi.fn(),
  CredentialGenerationError: class CredentialGenerationError extends Error {
    code: string
    details?: any
    constructor(code: string, message: string, details?: any) {
      super(message)
      this.code = code
      this.details = details
      this.name = 'CredentialGenerationError'
    }
  },
  CredentialGenerationErrorCode: {
    RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
    INVALID_PROJECT_NAME: 'INVALID_PROJECT_NAME',
    GENERATION_FAILED: 'GENERATION_FAILED',
    UNIQUENESS_CHECK_FAILED: 'UNIQUENESS_CHECK_FAILED',
  },
}))

// Mock credential generation fallback
vi.mock('lib/api/self-hosted/credential-generation-fallback', () => ({
  generateCredentialWithFallbackSupport: vi.fn(),
  DEFAULT_FALLBACK_CONFIG: {},
}))

// Mock auth helpers
vi.mock('lib/api/auth-helpers', () => ({
  getCurrentUserId: vi.fn(),
  isUserIsolationEnabled: vi.fn(),
}))

// Mock service router
vi.mock('lib/service-router', () => ({
  getServiceRouter: vi.fn(() => ({
    registerProject: vi.fn(),
    isProjectRegistered: vi.fn(),
  })),
}))

// Mock service configuration
vi.mock('lib/service-configuration', () => ({
  getServiceConfigurationManager: vi.fn(() => ({
    configureProjectServices: vi.fn(),
  })),
}))

// Mock ProjectInitializationService
vi.mock('lib/project-initialization/ProjectInitializationService', () => ({
  ProjectInitializationService: class MockProjectInitializationService {
    async initializeProject() {
      return { 
        success: true,
        schemasCreated: ['public', 'auth', 'storage'],
        extensionsCreated: ['uuid-ossp', 'pgcrypto']
      }
    }
    async createProjectDirectories() {
      return { success: true }
    }
    async rollbackInitialization() {
      return { success: true }
    }
    async closeConnectionPool() {
      return
    }
    async close() {
      return
    }
    async deleteProjectDirectories() {
      return
    }
  },
}))

import {
  createDatabase,
  createDatabaseWithRetry,
  getTemplateDatabaseName,
  saveProject,
  generateDatabaseName,
  validateDatabaseName,
  generateConnectionString,
  generateDisplayConnectionString,
  parseConnectionString,
  deleteDatabase,
  terminateConnections,
  terminateConnectionsAndWait,
  createProjectUser,
  deleteProjectUser,
  validatePassword,
  DatabaseError,
  DatabaseErrorCode,
  ProjectStoreError,
  ProjectStoreErrorCode,
  DatabaseUserError,
  DatabaseUserErrorCode,
} from 'lib/api/self-hosted'
import {
  generateDatabaseNameWithCollisionDetection,
  generateUsernameWithCollisionDetection,
} from 'lib/api/self-hosted/enhanced-credential-generation'
import {
  generateCredentialWithFallbackSupport,
} from 'lib/api/self-hosted/credential-generation-fallback'
import { getCurrentUserId, isUserIsolationEnabled } from 'lib/api/auth-helpers'

const mockCreateDatabase = createDatabase as ReturnType<typeof vi.fn>
const mockCreateDatabaseWithRetry = createDatabaseWithRetry as ReturnType<typeof vi.fn>
const mockGetTemplateDatabaseName = getTemplateDatabaseName as ReturnType<typeof vi.fn>
const mockSaveProject = saveProject as ReturnType<typeof vi.fn>
const mockGenerateDatabaseName = generateDatabaseName as ReturnType<typeof vi.fn>
const mockValidateDatabaseName = validateDatabaseName as ReturnType<typeof vi.fn>
const mockGenerateConnectionString = generateConnectionString as ReturnType<typeof vi.fn>
const mockGenerateDisplayConnectionString = generateDisplayConnectionString as ReturnType<typeof vi.fn>
const mockParseConnectionString = parseConnectionString as ReturnType<typeof vi.fn>
const mockDeleteDatabase = deleteDatabase as ReturnType<typeof vi.fn>
const mockTerminateConnections = terminateConnections as ReturnType<typeof vi.fn>
const mockTerminateConnectionsAndWait = terminateConnectionsAndWait as ReturnType<typeof vi.fn>
const mockCreateProjectUser = createProjectUser as ReturnType<typeof vi.fn>
const mockDeleteProjectUser = deleteProjectUser as ReturnType<typeof vi.fn>
const mockValidatePassword = validatePassword as ReturnType<typeof vi.fn>
const mockGenerateDatabaseNameWithCollisionDetection = generateDatabaseNameWithCollisionDetection as ReturnType<typeof vi.fn>
const mockGenerateUsernameWithCollisionDetection = generateUsernameWithCollisionDetection as ReturnType<typeof vi.fn>
const mockGenerateCredentialWithFallbackSupport = generateCredentialWithFallbackSupport as ReturnType<typeof vi.fn>
const mockGetCurrentUserId = getCurrentUserId as ReturnType<typeof vi.fn>
const mockIsUserIsolationEnabled = isUserIsolationEnabled as ReturnType<typeof vi.fn>

describe('POST /api/platform/projects/create', () => {
  let req: Partial<NextApiRequest>
  let res: Partial<NextApiResponse>
  let jsonMock: ReturnType<typeof vi.fn>
  let statusMock: ReturnType<typeof vi.fn>
  let setHeaderMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    jsonMock = vi.fn()
    statusMock = vi.fn(() => ({ json: jsonMock }))
    setHeaderMock = vi.fn()

    req = {
      method: 'POST',
      body: {},
    }

    res = {
      status: statusMock as any,
      setHeader: setHeaderMock,
    }

    // Default mock implementations
    mockGetTemplateDatabaseName.mockReturnValue('postgres')
    mockGenerateConnectionString.mockReturnValue('postgresql://test_user:password@localhost:5432/test_db')
    mockGenerateDisplayConnectionString.mockReturnValue('postgresql://test_user:[YOUR_PASSWORD]@localhost:5432/test_db')
    mockParseConnectionString.mockReturnValue({
      user: 'test_user',
      password: 'password',
      host: 'localhost',
      port: 5432,
      database: 'test_db'
    })
    mockTerminateConnections.mockResolvedValue({ data: undefined, error: undefined })
    mockTerminateConnectionsAndWait.mockResolvedValue({ data: undefined, error: undefined })
    mockDeleteDatabase.mockResolvedValue({ data: undefined, error: undefined })
    mockCreateProjectUser.mockResolvedValue({ data: undefined, error: undefined })
    mockDeleteProjectUser.mockResolvedValue({ data: undefined, error: undefined })
    mockValidatePassword.mockImplementation(() => {}) // No throw = valid
    mockGenerateDatabaseNameWithCollisionDetection.mockResolvedValue('test_db')
    mockGenerateUsernameWithCollisionDetection.mockResolvedValue('test_user')
    mockGenerateCredentialWithFallbackSupport.mockImplementation(async (projectName, type, primaryFn) => {
      const name = await primaryFn()
      return { name, usedFallback: false }
    })
    mockGetCurrentUserId.mockResolvedValue(null)
    mockIsUserIsolationEnabled.mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Success scenarios', () => {
    it('should create project with auto-generated credentials', async () => {
      req.body = {
        name: 'Test Project',
        organization_id: 1,
        database_password: 'password123',
        region: 'us-east-1',
      }

      mockCreateDatabaseWithRetry.mockResolvedValue({ data: undefined, error: undefined })
      mockSaveProject.mockResolvedValue({
        data: {
          id: 1,
          ref: 'test-ref',
          name: 'Test Project',
          database_name: 'test_db',
          database_user: 'test_user',
          organization_id: 1,
          status: 'ACTIVE_HEALTHY',
          region: 'us-east-1',
          inserted_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(201)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          ref: 'test-ref',
          name: 'Test Project',
          database_name: 'test_db',
          organization_id: 1,
          status: 'ACTIVE_HEALTHY',
          region: 'us-east-1',
        })
      )
      expect(mockCreateDatabaseWithRetry).toHaveBeenCalledWith({
        name: 'test_db',
        template: 'postgres',
      })
      expect(mockCreateProjectUser).toHaveBeenCalledWith({
        username: 'test_user',
        password: 'password123',
        databaseName: 'test_db',
        projectRef: expect.any(String),
      })
    })

    it('should create project with auto-generated database name and user', async () => {
      req.body = {
        name: 'My New Project',
        organization_id: 1,
        database_password: 'password123',
      }

      mockGenerateCredentialWithFallbackSupport.mockImplementation(async (projectName, type, primaryFn) => {
        if (type === 'database') {
          return { name: 'my_new_project_abc123', usedFallback: false }
        } else {
          return { name: 'my_new_project_user', usedFallback: false }
        }
      })
      mockCreateDatabaseWithRetry.mockResolvedValue({ data: undefined, error: undefined })
      mockSaveProject.mockResolvedValue({
        data: {
          id: 2,
          ref: 'auto-ref',
          name: 'My New Project',
          database_name: 'my_new_project_abc123',
          database_user: 'my_new_project_user',
          organization_id: 1,
          status: 'ACTIVE_HEALTHY',
          region: 'local',
          inserted_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(201)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My New Project',
          database_name: 'my_new_project_abc123',
        })
      )
      expect(mockCreateDatabaseWithRetry).toHaveBeenCalledWith({
        name: 'my_new_project_abc123',
        template: 'postgres',
      })
    })

    it('should use default organization_id and region when not provided', async () => {
      req.body = {
        name: 'Simple Project',
        database_password: 'password123',
      }

      mockCreateDatabaseWithRetry.mockResolvedValue({ data: undefined, error: undefined })
      mockSaveProject.mockResolvedValue({
        data: {
          id: 3,
          ref: 'simple-ref',
          name: 'Simple Project',
          database_name: 'test_db',
          database_user: 'test_user',
          organization_id: 1,
          status: 'ACTIVE_HEALTHY',
          region: 'local',
          inserted_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(201)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 1,
          region: 'local',
        })
      )
    })
  })

  describe('Validation errors', () => {
    it('should return 400 when project name is missing', async () => {
      req.body = {
        database_name: 'test_db',
      }

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Project name is required and must be a non-empty string',
          code: 'INVALID_PROJECT_NAME',
        },
      })
    })

    it('should return 400 when project name is empty string', async () => {
      req.body = {
        name: '   ',
        database_name: 'test_db',
      }

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Project name is required and must be a non-empty string',
          code: 'INVALID_PROJECT_NAME',
        },
      })
    })

    it('should return 400 when database password is missing', async () => {
      req.body = {
        name: 'Test Project',
      }

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Database password is required and must be a non-empty string',
          code: 'INVALID_DATABASE_PASSWORD',
        },
      })
    })
  })

  describe('Database creation errors', () => {
    it('should return 409 when database already exists', async () => {
      req.body = {
        name: 'Test Project',
        database_password: 'password123',
      }

      mockCreateDatabaseWithRetry.mockResolvedValue({
        data: undefined,
        error: new DatabaseError(
          DatabaseErrorCode.DATABASE_ALREADY_EXISTS,
          'Database "test_db" already exists'
        ),
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(409)
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Database "test_db" already exists',
          code: 'DATABASE_ALREADY_EXISTS',
          details: undefined,
        },
      })
      expect(mockSaveProject).not.toHaveBeenCalled()
    })

    it('should return 500 when template database not found', async () => {
      req.body = {
        name: 'Test Project',
        database_password: 'password123',
      }

      mockCreateDatabaseWithRetry.mockResolvedValue({
        data: undefined,
        error: new DatabaseError(
          DatabaseErrorCode.TEMPLATE_NOT_FOUND,
          'Template database "nonexistent" not found'
        ),
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Template database "nonexistent" not found',
          code: 'TEMPLATE_NOT_FOUND',
          details: undefined,
        },
      })
    })

    it('should return 403 when insufficient permissions', async () => {
      req.body = {
        name: 'Test Project',
        database_password: 'password123',
      }

      mockCreateDatabaseWithRetry.mockResolvedValue({
        data: undefined,
        error: new DatabaseError(
          DatabaseErrorCode.INSUFFICIENT_PERMISSIONS,
          'Permission denied to create database'
        ),
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(403)
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Permission denied to create database',
          code: 'INSUFFICIENT_PERMISSIONS',
          details: undefined,
        },
      })
    })

    it('should return 507 when disk space is full', async () => {
      req.body = {
        name: 'Test Project',
        database_password: 'password123',
      }

      mockCreateDatabaseWithRetry.mockResolvedValue({
        data: undefined,
        error: new DatabaseError(
          DatabaseErrorCode.DISK_SPACE_FULL,
          'Insufficient disk space'
        ),
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(507)
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Insufficient disk space',
          code: 'DISK_SPACE_FULL',
          details: undefined,
        },
      })
    })

    it('should return 503 when connection fails', async () => {
      req.body = {
        name: 'Test Project',
        database_password: 'password123',
      }

      mockCreateDatabaseWithRetry.mockResolvedValue({
        data: undefined,
        error: new DatabaseError(
          DatabaseErrorCode.CONNECTION_FAILED,
          'Failed to connect to database'
        ),
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(503)
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Failed to connect to database',
          code: 'CONNECTION_FAILED',
          details: undefined,
        },
      })
    })
  })

  describe('Project store errors', () => {
    it('should return 409 when project already exists in store', async () => {
      req.body = {
        name: 'Test Project',
        database_password: 'password123',
      }

      mockCreateDatabaseWithRetry.mockResolvedValue({ data: undefined, error: undefined })
      mockSaveProject.mockResolvedValue({
        data: undefined,
        error: new ProjectStoreError(
          ProjectStoreErrorCode.PROJECT_ALREADY_EXISTS,
          'Project with this ref already exists'
        ),
      })
      mockDeleteDatabase.mockResolvedValue({ data: undefined, error: undefined })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(409)
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Project with this ref already exists',
          code: 'PROJECT_ALREADY_EXISTS',
          details: undefined,
        },
      })
      expect(mockDeleteDatabase).toHaveBeenCalledWith('test_db')
    })

    it('should return 400 when project data is invalid', async () => {
      req.body = {
        name: 'Test Project',
        database_password: 'password123',
      }

      mockCreateDatabaseWithRetry.mockResolvedValue({ data: undefined, error: undefined })
      mockSaveProject.mockResolvedValue({
        data: undefined,
        error: new ProjectStoreError(
          ProjectStoreErrorCode.INVALID_PROJECT_DATA,
          'Invalid project data'
        ),
      })
      mockDeleteDatabase.mockResolvedValue({ data: undefined, error: undefined })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(mockDeleteDatabase).toHaveBeenCalledWith('test_db')
    })
  })

  describe('Rollback mechanism', () => {
    it('should rollback database creation when project save fails', async () => {
      req.body = {
        name: 'Test Project',
        database_password: 'password123',
      }

      mockCreateDatabaseWithRetry.mockResolvedValue({ data: undefined, error: undefined })
      mockSaveProject.mockResolvedValue({
        data: undefined,
        error: new ProjectStoreError(
          ProjectStoreErrorCode.STORAGE_ERROR,
          'Failed to save project'
        ),
      })
      mockDeleteDatabase.mockResolvedValue({ data: undefined, error: undefined })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(mockDeleteDatabase).toHaveBeenCalledWith('test_db')
      expect(statusMock).toHaveBeenCalledWith(500)
    })

    it('should handle rollback failure gracefully', async () => {
      req.body = {
        name: 'Test Project',
        database_password: 'password123',
      }

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockCreateDatabaseWithRetry.mockResolvedValue({ data: undefined, error: undefined })
      mockSaveProject.mockResolvedValue({
        data: undefined,
        error: new ProjectStoreError(
          ProjectStoreErrorCode.STORAGE_ERROR,
          'Failed to save project'
        ),
      })
      mockDeleteDatabase.mockResolvedValue({
        data: undefined,
        error: new DatabaseError(
          DatabaseErrorCode.UNKNOWN_ERROR,
          'Failed to delete database'
        ),
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(mockDeleteDatabase).toHaveBeenCalledWith('test_db')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to rollback'),
        expect.any(Object)
      )
      expect(statusMock).toHaveBeenCalledWith(500)

      consoleErrorSpy.mockRestore()
    })

    it('should rollback on unexpected error', async () => {
      req.body = {
        name: 'Test Project',
        database_password: 'password123',
      }

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockCreateDatabaseWithRetry.mockResolvedValue({ data: undefined, error: undefined })
      mockSaveProject.mockRejectedValue(new Error('Unexpected error'))
      mockDeleteDatabase.mockResolvedValue({ data: undefined, error: undefined })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(mockDeleteDatabase).toHaveBeenCalledWith('test_db')
      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Unexpected error',
          code: 'UNKNOWN_ERROR',
          details: { message: 'Unexpected error' },
        },
      })

      consoleErrorSpy.mockRestore()
    })
  })

  describe('HTTP method handling', () => {
    it('should return 405 for non-POST methods', async () => {
      req.method = 'GET'

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(setHeaderMock).toHaveBeenCalledWith('Allow', ['POST'])
      expect(statusMock).toHaveBeenCalledWith(405)
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Method GET Not Allowed',
        },
      })
    })
  })
})
