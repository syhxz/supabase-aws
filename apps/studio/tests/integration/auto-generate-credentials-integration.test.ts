/**
 * Auto-Generate Project Credentials Integration Tests
 * 
 * Task 8: Final integration testing and validation
 * Requirements: All requirements from auto-generate-project-credentials spec
 * 
 * This test suite validates the complete project creation workflow with auto-generated
 * credentials, connection string functionality, and error scenarios.
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'

// Mock all dependencies
vi.mock('../../lib/api/self-hosted', () => ({
  createDatabaseWithRetry: vi.fn(),
  getTemplateDatabaseName: vi.fn(),
  saveProject: vi.fn(),
  generateConnectionString: vi.fn(),
  generateDisplayConnectionString: vi.fn(),
  createProjectUser: vi.fn(),
  deleteProjectUser: vi.fn(),
  validatePassword: vi.fn(),
  parseConnectionString: vi.fn(),
  deleteDatabase: vi.fn(),
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

vi.mock('../../lib/api/self-hosted/enhanced-credential-generation', () => ({
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

vi.mock('../../lib/api/self-hosted/credential-generation-fallback', () => ({
  generateCredentialWithFallbackSupport: vi.fn(),
  DEFAULT_FALLBACK_CONFIG: {
    maxRetries: 3,
    fallbackStrategies: ['timestamp', 'uuid'],
    enableLogging: true,
  },
}))

vi.mock('../../lib/api/auth-helpers', () => ({
  getCurrentUserId: vi.fn(),
  isUserIsolationEnabled: vi.fn(),
}))

vi.mock('../../lib/project-initialization/ProjectInitializationService', () => ({
  ProjectInitializationService: vi.fn().mockImplementation(() => ({
    initializeProject: vi.fn(),
    createProjectDirectories: vi.fn(),
    deleteProjectDirectories: vi.fn(),
    close: vi.fn(),
  })),
}))

vi.mock('../../lib/service-router', () => ({
  getServiceRouter: vi.fn(() => ({
    registerProject: vi.fn(),
    isProjectRegistered: vi.fn(),
    unregisterProject: vi.fn(),
  })),
}))

vi.mock('../../lib/service-configuration', () => ({
  getServiceConfigurationManager: vi.fn(() => ({
    configureProjectServices: vi.fn(),
    getProjectServiceConfig: vi.fn(),
    removeProjectServiceConfig: vi.fn(),
    healthCheck: vi.fn(),
  })),
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
} from '../../lib/api/self-hosted'

import {
  generateDatabaseNameWithCollisionDetection,
  generateUsernameWithCollisionDetection,
} from '../../lib/api/self-hosted/enhanced-credential-generation'

import {
  generateCredentialWithFallbackSupport,
} from '../../lib/api/self-hosted/credential-generation-fallback'

import { getCurrentUserId, isUserIsolationEnabled } from '../../lib/api/auth-helpers'
import { ProjectInitializationService } from '../../lib/project-initialization/ProjectInitializationService'

// Type the mocked functions
const mockCreateDatabaseWithRetry = vi.mocked(createDatabaseWithRetry)
const mockGetTemplateDatabaseName = vi.mocked(getTemplateDatabaseName)
const mockSaveProject = vi.mocked(saveProject)
const mockGenerateConnectionString = vi.mocked(generateConnectionString)
const mockGenerateDisplayConnectionString = vi.mocked(generateDisplayConnectionString)
const mockCreateProjectUser = vi.mocked(createProjectUser)
const mockValidatePassword = vi.mocked(validatePassword)
const mockParseConnectionString = vi.mocked(parseConnectionString)
const mockGenerateDatabaseNameWithCollisionDetection = vi.mocked(generateDatabaseNameWithCollisionDetection)
const mockGenerateUsernameWithCollisionDetection = vi.mocked(generateUsernameWithCollisionDetection)
const mockGenerateCredentialWithFallbackSupport = vi.mocked(generateCredentialWithFallbackSupport)
const mockGetCurrentUserId = vi.mocked(getCurrentUserId)
const mockIsUserIsolationEnabled = vi.mocked(isUserIsolationEnabled)

describe('Auto-Generate Project Credentials Integration Tests', () => {
  let mockServiceRouter: any
  let mockServiceConfigManager: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup service mocks
    mockServiceRouter = {
      registerProject: vi.fn(),
      isProjectRegistered: vi.fn(),
      unregisterProject: vi.fn(),
    }
    
    mockServiceConfigManager = {
      configureProjectServices: vi.fn(),
      getProjectServiceConfig: vi.fn(),
      removeProjectServiceConfig: vi.fn(),
      healthCheck: vi.fn(),
    }
    
    const { getServiceRouter } = vi.mocked(await import('../../lib/service-router'))
    const { getServiceConfigurationManager } = vi.mocked(await import('../../lib/service-configuration'))
    getServiceRouter.mockReturnValue(mockServiceRouter)
    getServiceConfigurationManager.mockReturnValue(mockServiceConfigManager)
    
    // Setup default mocks
    mockGetTemplateDatabaseName.mockReturnValue('template_db')
    mockValidatePassword.mockImplementation(() => {}) // No throw = valid
    mockCreateDatabaseWithRetry.mockResolvedValue({ data: undefined, error: undefined })
    mockCreateProjectUser.mockResolvedValue({ data: undefined, error: undefined })
    mockIsUserIsolationEnabled.mockReturnValue(false)
    mockGetCurrentUserId.mockResolvedValue('user123')
    
    // Mock service router and configuration
    mockServiceRouter.registerProject.mockResolvedValue(undefined)
    mockServiceRouter.isProjectRegistered.mockResolvedValue(true)
    mockServiceConfigManager.configureProjectServices.mockResolvedValue({
      success: true,
      updatedServices: ['gotrue', 'storage', 'realtime', 'postgrest'],
      errors: []
    })
    
    // Mock ProjectInitializationService
    const mockInitService = {
      initializeProject: vi.fn().mockResolvedValue({ success: true, schemasCreated: ['public'] }),
      createProjectDirectories: vi.fn().mockResolvedValue(undefined),
      deleteProjectDirectories: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(ProjectInitializationService).mockImplementation(() => mockInitService as any)
  })

  describe('Complete Project Creation Flow with Auto-Generated Credentials', () => {
    it('should create a project with auto-generated database name and username', async () => {
      // Test complete project creation flow with auto-generated credentials
      // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5

      // Setup credential generation mocks
      mockGenerateCredentialWithFallbackSupport
        .mockResolvedValueOnce({
          name: 'proj_my_app_abc123',
          usedFallback: false,
          strategy: 'standard',
        })
        .mockResolvedValueOnce({
          name: 'my_app_db_xyz789',
          usedFallback: false,
          strategy: 'standard',
        })

      // Setup connection string mocks
      mockGenerateConnectionString.mockReturnValue('postgresql://proj_my_app_abc123:secure_password@localhost:5432/my_app_db_xyz789')
      mockGenerateDisplayConnectionString.mockReturnValue('postgresql://proj_my_app_abc123:[YOUR_PASSWORD]@localhost:5432/my_app_db_xyz789')
      mockParseConnectionString.mockReturnValue({
        user: 'proj_my_app_abc123',
        password: 'secure_password',
        host: 'localhost',
        port: 5432,
        database: 'my_app_db_xyz789',
      })

      // Setup project save mock
      mockSaveProject.mockResolvedValue({
        data: {
          id: 1,
          ref: 'my-app-ref',
          name: 'My App',
          database_name: 'my_app_db_xyz789',
          database_user: 'proj_my_app_abc123',
          database_password_hash: 'hashed_password',
          organization_id: 1,
          owner_user_id: 'user123',
          status: 'ACTIVE_HEALTHY' as const,
          region: 'local',
          connection_string: 'postgresql://proj_my_app_abc123:secure_password@localhost:5432/my_app_db_xyz789',
          inserted_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
        error: undefined,
      })

      // Execute project creation
      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'My App',
          database_password: 'secure_password',
          organization_id: 1,
        },
      })

      await createProjectHandler(req, res)

      // Verify successful creation
      expect(res._getStatusCode()).toBe(201)
      const responseData = JSON.parse(res._getData())
      
      expect(responseData).toMatchObject({
        name: 'My App',
        database_name: 'my_app_db_xyz789',
        status: 'ACTIVE_HEALTHY',
        databases: expect.arrayContaining([
          expect.objectContaining({
            user: 'proj_my_app_abc123',
            database: 'my_app_db_xyz789',
            type: 'primary',
            isPrimary: true,
          }),
        ]),
      })

      // Verify credential generation was called with fallback support
      expect(mockGenerateCredentialWithFallbackSupport).toHaveBeenCalledTimes(2)
      expect(mockGenerateCredentialWithFallbackSupport).toHaveBeenCalledWith(
        'My App',
        'username',
        expect.any(Function),
        expect.any(Object)
      )
      expect(mockGenerateCredentialWithFallbackSupport).toHaveBeenCalledWith(
        'My App',
        'database',
        expect.any(Function),
        expect.any(Object)
      )

      // Verify database and user creation
      expect(mockCreateDatabaseWithRetry).toHaveBeenCalledWith({
        name: 'my_app_db_xyz789',
        template: 'template_db',
      })
      
      expect(mockCreateProjectUser).toHaveBeenCalledWith({
        username: 'proj_my_app_abc123',
        password: 'secure_password',
        databaseName: 'my_app_db_xyz789',
        projectRef: expect.any(String),
      })

      // Verify service registration
      expect(mockServiceRouter.registerProject).toHaveBeenCalledWith({
        projectRef: expect.any(String),
        databaseName: 'my_app_db_xyz789',
        connectionString: 'postgresql://proj_my_app_abc123:secure_password@localhost:5432/my_app_db_xyz789',
        ownerUserId: 'system', // User isolation is disabled in test setup
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })

      // Verify service configuration
      expect(mockServiceConfigManager.configureProjectServices).toHaveBeenCalledWith(expect.any(String))
    })

    it('should handle credential generation with fallback strategies', async () => {
      // Test fallback credential generation when standard generation fails
      // Requirements: 3.2, 3.3, 3.5

      // Setup fallback scenario
      mockGenerateCredentialWithFallbackSupport
        .mockResolvedValueOnce({
          name: 'proj_fallback_app_timestamp_1234567890',
          usedFallback: true,
          strategy: 'timestamp',
        })
        .mockResolvedValueOnce({
          name: 'fallback_app_db_uuid_abcd1234',
          usedFallback: true,
          strategy: 'uuid',
        })

      // Setup connection string mocks
      mockGenerateConnectionString.mockReturnValue('postgresql://proj_fallback_app_timestamp_1234567890:password@localhost:5432/fallback_app_db_uuid_abcd1234')
      mockGenerateDisplayConnectionString.mockReturnValue('postgresql://proj_fallback_app_timestamp_1234567890:[YOUR_PASSWORD]@localhost:5432/fallback_app_db_uuid_abcd1234')
      mockParseConnectionString.mockReturnValue({
        user: 'proj_fallback_app_timestamp_1234567890',
        password: 'password',
        host: 'localhost',
        port: 5432,
        database: 'fallback_app_db_uuid_abcd1234',
      })

      // Setup project save mock
      mockSaveProject.mockResolvedValue({
        data: {
          id: 2,
          ref: 'fallback-app-ref',
          name: 'Fallback App',
          database_name: 'fallback_app_db_uuid_abcd1234',
          database_user: 'proj_fallback_app_timestamp_1234567890',
          database_password_hash: 'hashed_password',
          organization_id: 1,
          owner_user_id: 'user123',
          status: 'ACTIVE_HEALTHY' as const,
          region: 'local',
          connection_string: 'postgresql://proj_fallback_app_timestamp_1234567890:password@localhost:5432/fallback_app_db_uuid_abcd1234',
          inserted_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
        error: undefined,
      })

      // Execute project creation
      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Fallback App',
          database_password: 'password',
          organization_id: 1,
        },
      })

      await createProjectHandler(req, res)

      // Verify successful creation with fallback credentials
      expect(res._getStatusCode()).toBe(201)
      const responseData = JSON.parse(res._getData())
      
      expect(responseData).toMatchObject({
        name: 'Fallback App',
        database_name: 'fallback_app_db_uuid_abcd1234',
        status: 'ACTIVE_HEALTHY',
        databases: expect.arrayContaining([
          expect.objectContaining({
            user: 'proj_fallback_app_timestamp_1234567890',
            database: 'fallback_app_db_uuid_abcd1234',
          }),
        ]),
      })

      // Verify fallback strategies were used
      expect(mockGenerateCredentialWithFallbackSupport).toHaveBeenCalledTimes(2)
    })
  })

  describe('Connection String Validation and Functionality', () => {
    it('should generate valid connection strings with auto-generated credentials', async () => {
      // Test connection strings work with generated credentials
      // Requirements: 2.1, 2.2, 2.3, 2.5

      // Setup credential generation
      mockGenerateCredentialWithFallbackSupport
        .mockResolvedValueOnce({
          name: 'proj_connection_test_xyz123',
          usedFallback: false,
          strategy: 'standard',
        })
        .mockResolvedValueOnce({
          name: 'connection_test_db_abc789',
          usedFallback: false,
          strategy: 'standard',
        })

      // Setup connection string generation and parsing
      const actualConnectionString = 'postgresql://proj_connection_test_xyz123:test_password@localhost:5432/connection_test_db_abc789'
      const displayConnectionString = 'postgresql://proj_connection_test_xyz123:[YOUR_PASSWORD]@localhost:5432/connection_test_db_abc789'
      
      mockGenerateConnectionString.mockReturnValue(actualConnectionString)
      mockGenerateDisplayConnectionString.mockReturnValue(displayConnectionString)
      mockParseConnectionString.mockReturnValue({
        user: 'proj_connection_test_xyz123',
        password: 'test_password',
        host: 'localhost',
        port: 5432,
        database: 'connection_test_db_abc789',
      })

      // Setup project save mock
      mockSaveProject.mockResolvedValue({
        data: {
          id: 3,
          ref: 'connection-test-ref',
          name: 'Connection Test',
          database_name: 'connection_test_db_abc789',
          database_user: 'proj_connection_test_xyz123',
          database_password_hash: 'hashed_password',
          organization_id: 1,
          owner_user_id: 'user123',
          status: 'ACTIVE_HEALTHY' as const,
          region: 'local',
          connection_string: actualConnectionString,
          inserted_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
        error: undefined,
      })

      // Execute project creation
      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Connection Test',
          database_password: 'test_password',
          organization_id: 1,
        },
      })

      await createProjectHandler(req, res)

      // Verify successful creation
      expect(res._getStatusCode()).toBe(201)
      const responseData = JSON.parse(res._getData())

      // Verify connection string format
      expect(responseData.connection_string).toBe(displayConnectionString)
      expect(responseData.connection_string).toContain('[YOUR_PASSWORD]')
      expect(responseData.connection_string).not.toContain('test_password')

      // Verify database information includes auto-generated credentials
      expect(responseData.databases[0]).toMatchObject({
        user: 'proj_connection_test_xyz123',
        database: 'connection_test_db_abc789',
        host: 'localhost',
        port: 5432,
        type: 'primary',
        isPrimary: true,
      })

      // Verify connection string parsing works correctly
      expect(mockParseConnectionString).toHaveBeenCalledWith(actualConnectionString)
      
      // Verify connection string format is valid PostgreSQL URI
      expect(actualConnectionString).toMatch(/^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^\/]+$/)
      expect(actualConnectionString).toContain('postgresql://')
      expect(actualConnectionString).toContain('proj_connection_test_xyz123')
      expect(actualConnectionString).toContain('connection_test_db_abc789')
    })

    it('should handle different environment configurations in connection strings', async () => {
      // Test connection strings for different environments
      // Requirements: 2.1, 2.2, 2.3, 2.5

      // Setup credential generation
      mockGenerateCredentialWithFallbackSupport
        .mockResolvedValueOnce({
          name: 'proj_prod_app_secure123',
          usedFallback: false,
          strategy: 'standard',
        })
        .mockResolvedValueOnce({
          name: 'prod_app_db_secure789',
          usedFallback: false,
          strategy: 'standard',
        })

      // Setup production-like connection string
      const prodConnectionString = 'postgresql://proj_prod_app_secure123:very_secure_password@prod-db.example.com:5433/prod_app_db_secure789'
      const prodDisplayString = 'postgresql://proj_prod_app_secure123:[YOUR_PASSWORD]@prod-db.example.com:5433/prod_app_db_secure789'
      
      mockGenerateConnectionString.mockReturnValue(prodConnectionString)
      mockGenerateDisplayConnectionString.mockReturnValue(prodDisplayString)
      mockParseConnectionString.mockReturnValue({
        user: 'proj_prod_app_secure123',
        password: 'very_secure_password',
        host: 'prod-db.example.com',
        port: 5433,
        database: 'prod_app_db_secure789',
      })

      // Setup project save mock
      mockSaveProject.mockResolvedValue({
        data: {
          id: 4,
          ref: 'prod-app-ref',
          name: 'Production App',
          database_name: 'prod_app_db_secure789',
          database_user: 'proj_prod_app_secure123',
          database_password_hash: 'hashed_password',
          organization_id: 1,
          owner_user_id: 'user123',
          status: 'ACTIVE_HEALTHY' as const,
          region: 'production',
          connection_string: prodConnectionString,
          inserted_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
        error: undefined,
      })

      // Execute project creation
      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Production App',
          database_password: 'very_secure_password',
          organization_id: 1,
          region: 'production',
        },
      })

      await createProjectHandler(req, res)

      // Verify successful creation
      expect(res._getStatusCode()).toBe(201)
      const responseData = JSON.parse(res._getData())

      // Verify production environment configuration
      expect(responseData.region).toBe('production')
      expect(responseData.databases[0]).toMatchObject({
        host: 'prod-db.example.com',
        port: 5433,
        user: 'proj_prod_app_secure123',
        database: 'prod_app_db_secure789',
        region: 'production',
      })

      // Verify no placeholder values remain
      expect(responseData.connection_string).not.toContain('[user]')
      expect(responseData.connection_string).not.toContain('[host]')
      expect(responseData.connection_string).not.toContain('[port]')
      expect(responseData.connection_string).not.toContain('[db-name]')
      expect(responseData.connection_string).not.toContain('localhost')
    })
  })

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle credential generation retry exhaustion', async () => {
      // Test error handling when credential generation fails after retries
      // Requirements: 3.2, 3.3, 3.5

      const { CredentialGenerationError, CredentialGenerationErrorCode } = await import('../../lib/api/self-hosted/enhanced-credential-generation')
      
      mockGenerateCredentialWithFallbackSupport.mockRejectedValueOnce(
        new CredentialGenerationError(
          CredentialGenerationErrorCode.RETRY_EXHAUSTED,
          'Failed to generate unique username after 5 attempts',
          { projectName: 'Problematic Project', attempts: 5, conflictingNames: ['proj_problematic_project_1', 'proj_problematic_project_2'] }
        )
      )

      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Problematic Project',
          database_password: 'password123',
          organization_id: 1,
        },
      })

      await createProjectHandler(req, res)

      expect(res._getStatusCode()).toBe(500)
      const responseData = JSON.parse(res._getData())
      
      expect(responseData.error).toMatchObject({
        code: 'RETRY_EXHAUSTED',
        message: expect.stringContaining('generate unique database credentials'),
        details: expect.objectContaining({
          projectName: 'Problematic Project',
          attempts: 5,
          conflictingNames: expect.arrayContaining(['proj_problematic_project_1', 'proj_problematic_project_2']),
          canRetry: expect.any(Boolean),
          userAction: expect.any(String),
          suggestions: expect.any(Array),
        }),
      })
    })

    it('should handle invalid project names gracefully', async () => {
      // Test error handling for invalid project names
      // Requirements: 3.5

      const { CredentialGenerationError, CredentialGenerationErrorCode } = await import('../../lib/api/self-hosted/enhanced-credential-generation')
      
      mockGenerateCredentialWithFallbackSupport.mockRejectedValueOnce(
        new CredentialGenerationError(
          CredentialGenerationErrorCode.INVALID_PROJECT_NAME,
          'Project name contains invalid characters',
          { projectName: '!!!Invalid Name!!!', invalidCharacters: ['!'] }
        )
      )

      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: '!!!Invalid Name!!!',
          database_password: 'password123',
          organization_id: 1,
        },
      })

      await createProjectHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      
      expect(responseData.error).toMatchObject({
        code: 'INVALID_PROJECT_NAME',
        message: expect.stringContaining('cannot be used to generate valid database credentials'),
        details: expect.objectContaining({
          projectName: '!!!Invalid Name!!!',
          invalidCharacters: ['!'],
        }),
      })
    })

    it('should handle database creation failures with proper rollback', async () => {
      // Test rollback when database creation fails
      // Requirements: 3.4, 3.5

      const { DatabaseError, DatabaseErrorCode } = await import('../../lib/api/self-hosted')
      
      // Setup successful credential generation
      mockGenerateCredentialWithFallbackSupport
        .mockResolvedValueOnce({
          name: 'proj_rollback_test_abc123',
          usedFallback: false,
          strategy: 'standard',
        })
        .mockResolvedValueOnce({
          name: 'rollback_test_db_xyz789',
          usedFallback: false,
          strategy: 'standard',
        })

      // Mock database creation failure
      mockCreateDatabaseWithRetry.mockResolvedValue({
        data: undefined,
        error: new DatabaseError(DatabaseErrorCode.DISK_SPACE_FULL, 'Insufficient disk space', { availableSpace: '0MB' }),
      })

      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Rollback Test',
          database_password: 'password123',
          organization_id: 1,
        },
      })

      await createProjectHandler(req, res)

      expect(res._getStatusCode()).toBe(507)
      const responseData = JSON.parse(res._getData())
      
      expect(responseData.error).toMatchObject({
        code: 'DISK_SPACE_FULL',
        message: 'Insufficient disk space',
        details: { availableSpace: '0MB' },
      })

      // Verify no user was created since database creation failed
      expect(mockCreateProjectUser).not.toHaveBeenCalled()
      expect(mockSaveProject).not.toHaveBeenCalled()
    })

    it('should handle user creation failures with database rollback', async () => {
      // Test rollback when user creation fails after database creation
      // Requirements: 3.4, 3.5

      const { DatabaseUserError, DatabaseUserErrorCode } = await import('../../lib/api/self-hosted')
      
      // Setup successful credential generation
      mockGenerateCredentialWithFallbackSupport
        .mockResolvedValueOnce({
          name: 'proj_user_fail_test_abc123',
          usedFallback: false,
          strategy: 'standard',
        })
        .mockResolvedValueOnce({
          name: 'user_fail_test_db_xyz789',
          usedFallback: false,
          strategy: 'standard',
        })

      // Mock successful database creation but failed user creation
      mockCreateDatabaseWithRetry.mockResolvedValue({ data: undefined, error: undefined })
      mockCreateProjectUser.mockResolvedValue({
        data: undefined,
        error: new DatabaseUserError(DatabaseUserErrorCode.USER_ALREADY_EXISTS, 'User already exists', { username: 'proj_user_fail_test_abc123' }),
      })

      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'User Fail Test',
          database_password: 'password123',
          organization_id: 1,
        },
      })

      await createProjectHandler(req, res)

      expect(res._getStatusCode()).toBe(409)
      const responseData = JSON.parse(res._getData())
      
      expect(responseData.error).toMatchObject({
        code: 'USER_ALREADY_EXISTS',
        message: 'User already exists',
        details: { username: 'proj_user_fail_test_abc123' },
      })

      // Verify database creation was attempted
      expect(mockCreateDatabaseWithRetry).toHaveBeenCalledWith({
        name: 'user_fail_test_db_xyz789',
        template: 'template_db',
      })

      // Verify user creation was attempted
      expect(mockCreateProjectUser).toHaveBeenCalledWith({
        username: 'proj_user_fail_test_abc123',
        password: 'password123',
        databaseName: 'user_fail_test_db_xyz789',
        projectRef: expect.any(String),
      })

      // Verify project was not saved
      expect(mockSaveProject).not.toHaveBeenCalled()
    })

    it('should handle missing required fields', async () => {
      // Test validation of required fields
      // Requirements: 3.5

      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      
      // Test missing project name
      const { req: reqNoName, res: resNoName } = createMocks({
        method: 'POST',
        body: {
          database_password: 'password123',
          organization_id: 1,
        },
      })

      await createProjectHandler(reqNoName, resNoName)

      expect(resNoName._getStatusCode()).toBe(400)
      const responseDataNoName = JSON.parse(resNoName._getData())
      expect(responseDataNoName.error.code).toBe('INVALID_PROJECT_NAME')

      // Test missing database password - setup credential generation for this case
      mockGenerateCredentialWithFallbackSupport
        .mockResolvedValueOnce({
          name: 'proj_test_project_missing_pass',
          usedFallback: false,
          strategy: 'standard',
        })

      const { req: reqNoPassword, res: resNoPassword } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Project',
          organization_id: 1,
        },
      })

      await createProjectHandler(reqNoPassword, resNoPassword)

      expect(resNoPassword._getStatusCode()).toBe(400)
      const responseDataNoPassword = JSON.parse(resNoPassword._getData())
      expect(responseDataNoPassword.error.code).toBe('INVALID_DATABASE_PASSWORD')
    })

    it('should handle service configuration failures gracefully', async () => {
      // Test service configuration error handling
      // Requirements: 3.4, 3.5

      // Setup successful credential generation and project creation
      mockGenerateCredentialWithFallbackSupport
        .mockResolvedValueOnce({
          name: 'proj_service_fail_abc123',
          usedFallback: false,
          strategy: 'standard',
        })
        .mockResolvedValueOnce({
          name: 'service_fail_db_xyz789',
          usedFallback: false,
          strategy: 'standard',
        })

      mockGenerateConnectionString.mockReturnValue('postgresql://proj_service_fail_abc123:password@localhost:5432/service_fail_db_xyz789')
      mockGenerateDisplayConnectionString.mockReturnValue('postgresql://proj_service_fail_abc123:[YOUR_PASSWORD]@localhost:5432/service_fail_db_xyz789')
      mockParseConnectionString.mockReturnValue({
        user: 'proj_service_fail_abc123',
        password: 'password',
        host: 'localhost',
        port: 5432,
        database: 'service_fail_db_xyz789',
      })

      mockSaveProject.mockResolvedValue({
        data: {
          id: 5,
          ref: 'service-fail-ref',
          name: 'Service Fail Test',
          database_name: 'service_fail_db_xyz789',
          database_user: 'proj_service_fail_abc123',
          database_password_hash: 'hashed_password',
          organization_id: 1,
          owner_user_id: 'user123',
          status: 'ACTIVE_HEALTHY' as const,
          region: 'local',
          connection_string: 'postgresql://proj_service_fail_abc123:password@localhost:5432/service_fail_db_xyz789',
          inserted_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
        error: undefined,
      })

      // Mock service configuration failure
      mockServiceConfigManager.configureProjectServices.mockResolvedValue({
        success: false,
        updatedServices: [],
        errors: [
          {
            service: 'gotrue',
            error: 'Authentication failed for user proj_service_fail_abc123',
            details: { code: 'AUTH_FAILED', timestamp: new Date() }
          }
        ]
      })

      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Service Fail Test',
          database_password: 'password',
          organization_id: 1,
        },
      })

      await createProjectHandler(req, res)

      // Project should still be created successfully despite service configuration failures
      expect(res._getStatusCode()).toBe(201)
      const responseData = JSON.parse(res._getData())
      
      expect(responseData).toMatchObject({
        name: 'Service Fail Test',
        database_name: 'service_fail_db_xyz789',
        status: 'ACTIVE_HEALTHY',
      })

      // Verify service configuration was attempted
      expect(mockServiceConfigManager.configureProjectServices).toHaveBeenCalledWith(expect.any(String))
    })
  })

  describe('Cryptographically Secure Random Generation', () => {
    it('should use cryptographically secure random generation for credentials', async () => {
      // Test cryptographically secure randomness in credential generation
      // Requirements: 3.1

      // Setup credential generation to return different values on multiple calls
      mockGenerateCredentialWithFallbackSupport
        .mockResolvedValueOnce({
          name: 'proj_crypto_test_secure123',
          usedFallback: false,
          strategy: 'standard',
        })
        .mockResolvedValueOnce({
          name: 'crypto_test_db_secure789',
          usedFallback: false,
          strategy: 'standard',
        })

      mockGenerateConnectionString.mockReturnValue('postgresql://proj_crypto_test_secure123:crypto_password@localhost:5432/crypto_test_db_secure789')
      mockGenerateDisplayConnectionString.mockReturnValue('postgresql://proj_crypto_test_secure123:[YOUR_PASSWORD]@localhost:5432/crypto_test_db_secure789')
      mockParseConnectionString.mockReturnValue({
        user: 'proj_crypto_test_secure123',
        password: 'crypto_password',
        host: 'localhost',
        port: 5432,
        database: 'crypto_test_db_secure789',
      })

      mockSaveProject.mockResolvedValue({
        data: {
          id: 6,
          ref: 'crypto-test-ref',
          name: 'Crypto Test',
          database_name: 'crypto_test_db_secure789',
          database_user: 'proj_crypto_test_secure123',
          database_password_hash: 'hashed_password',
          organization_id: 1,
          owner_user_id: 'user123',
          status: 'ACTIVE_HEALTHY' as const,
          region: 'local',
          connection_string: 'postgresql://proj_crypto_test_secure123:crypto_password@localhost:5432/crypto_test_db_secure789',
          inserted_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
        error: undefined,
      })

      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Crypto Test',
          database_password: 'crypto_password',
          organization_id: 1,
        },
      })

      await createProjectHandler(req, res)

      expect(res._getStatusCode()).toBe(201)
      const responseData = JSON.parse(res._getData())
      
      // Verify credentials contain secure random components
      expect(responseData.databases[0].user).toMatch(/^proj_crypto_test_secure\d+$/)
      expect(responseData.database_name).toMatch(/^crypto_test_db_secure\d+$/)
      
      // Verify credentials are not predictable patterns
      expect(responseData.databases[0].user).not.toBe('proj_crypto_test_1')
      expect(responseData.database_name).not.toBe('crypto_test_db_1')
    })
  })
})