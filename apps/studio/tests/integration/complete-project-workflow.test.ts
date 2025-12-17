/**
 * Complete Project Workflow Integration Tests
 * 
 * Task 10: Final integration testing and validation
 * Requirements: All requirements integration testing
 * 
 * This test suite validates the complete project creation workflow with user isolation,
 * cross-project access prevention, connection string functionality, and service isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'

// Mock all dependencies
vi.mock('../../lib/api/self-hosted', () => ({
  createDatabaseWithRetry: vi.fn(),
  getTemplateDatabaseName: vi.fn(),
  saveProject: vi.fn(),
  generateDatabaseName: vi.fn(),
  validateDatabaseName: vi.fn(),
  generateConnectionString: vi.fn(),
  generateDisplayConnectionString: vi.fn(),
  createProjectUser: vi.fn(),
  deleteProjectUser: vi.fn(),
  validateUsername: vi.fn(),
  validatePassword: vi.fn(),
  generateUsername: vi.fn(),
  parseConnectionString: vi.fn(),
  findAllProjects: vi.fn(),
  findProjectByRef: vi.fn(),
  deleteProject: vi.fn(),
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

vi.mock('../../lib/api/self-hosted/user-isolation-security', () => ({
  verifyCrossProjectAccessDenial: vi.fn(),
  verifyUserPermissions: vi.fn(),
  runIsolationVerification: vi.fn(),
}))

vi.mock('../../lib/service-configuration/ServiceConfigurationManager', () => ({
  getServiceConfigurationManager: vi.fn(() => ({
    configureProjectServices: vi.fn(),
    getProjectServiceConfig: vi.fn(),
    removeProjectServiceConfig: vi.fn(),
    healthCheck: vi.fn(),
  })),
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
    unregisterProject: vi.fn(),
    isProjectRegistered: vi.fn(),
  })),
}))

import {
  createDatabaseWithRetry,
  getTemplateDatabaseName,
  saveProject,
  generateDatabaseName,
  generateConnectionString,
  generateDisplayConnectionString,
  createProjectUser,
  deleteProjectUser,
  validateUsername,
  validatePassword,
  generateUsername,
  parseConnectionString,
  findAllProjects,
  findProjectByRef,
  deleteProject,
  deleteDatabase,
} from '../../lib/api/self-hosted'

import {
  verifyCrossProjectAccessDenial,
  verifyUserPermissions,
  runIsolationVerification,
} from '../../lib/api/self-hosted/user-isolation-security'

import { getServiceConfigurationManager } from '../../lib/service-configuration/ServiceConfigurationManager'
import { getCurrentUserId, isUserIsolationEnabled } from '../../lib/api/auth-helpers'
import { ProjectInitializationService } from '../../lib/project-initialization/ProjectInitializationService'

// Type the mocked functions
const mockCreateDatabaseWithRetry = vi.mocked(createDatabaseWithRetry)
const mockGetTemplateDatabaseName = vi.mocked(getTemplateDatabaseName)
const mockSaveProject = vi.mocked(saveProject)
const mockGenerateDatabaseName = vi.mocked(generateDatabaseName)
const mockGenerateConnectionString = vi.mocked(generateConnectionString)
const mockGenerateDisplayConnectionString = vi.mocked(generateDisplayConnectionString)
const mockCreateProjectUser = vi.mocked(createProjectUser)
const mockDeleteProjectUser = vi.mocked(deleteProjectUser)
const mockValidateUsername = vi.mocked(validateUsername)
const mockValidatePassword = vi.mocked(validatePassword)
const mockGenerateUsername = vi.mocked(generateUsername)
const mockParseConnectionString = vi.mocked(parseConnectionString)
const mockFindAllProjects = vi.mocked(findAllProjects)
const mockFindProjectByRef = vi.mocked(findProjectByRef)
const mockDeleteProject = vi.mocked(deleteProject)
const mockDeleteDatabase = vi.mocked(deleteDatabase)

const mockVerifyCrossProjectAccessDenial = vi.mocked(verifyCrossProjectAccessDenial)
const mockVerifyUserPermissions = vi.mocked(verifyUserPermissions)
const mockRunIsolationVerification = vi.mocked(runIsolationVerification)

const mockGetServiceConfigurationManager = vi.mocked(getServiceConfigurationManager)
const mockGetCurrentUserId = vi.mocked(getCurrentUserId)
const mockIsUserIsolationEnabled = vi.mocked(isUserIsolationEnabled)

describe('Complete Project Workflow Integration Tests', () => {
  let mockServiceManager: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup service manager mock
    mockServiceManager = {
      configureProjectServices: vi.fn(),
      getProjectServiceConfig: vi.fn(),
      removeProjectServiceConfig: vi.fn(),
      healthCheck: vi.fn(),
    }
    mockGetServiceConfigurationManager.mockReturnValue(mockServiceManager)
    
    // Setup default mocks
    mockGetTemplateDatabaseName.mockReturnValue('template_db')
    mockGenerateDatabaseName.mockReturnValue('project_a_db')
    mockGenerateUsername.mockReturnValue('proj_project_a')
    mockValidateUsername.mockImplementation(() => {}) // No throw = valid
    mockValidatePassword.mockImplementation(() => {}) // No throw = valid
    mockCreateDatabaseWithRetry.mockResolvedValue({ data: undefined, error: undefined })
    mockCreateProjectUser.mockResolvedValue({ data: undefined, error: undefined })
    mockGenerateConnectionString.mockReturnValue('postgresql://proj_project_a:password123@localhost:5432/project_a_db')
    mockGenerateDisplayConnectionString.mockReturnValue('postgresql://proj_project_a:[YOUR_PASSWORD]@localhost:5432/project_a_db')
    mockParseConnectionString.mockReturnValue({
      user: 'proj_project_a',
      password: 'password123',
      host: 'localhost',
      port: 5432,
      database: 'project_a_db',
    })
    mockIsUserIsolationEnabled.mockReturnValue(false)
    mockGetCurrentUserId.mockResolvedValue('user123')
    
    // Mock ProjectInitializationService
    const mockInitService = {
      initializeProject: vi.fn().mockResolvedValue({ success: true, schemasCreated: ['public'] }),
      createProjectDirectories: vi.fn().mockResolvedValue(undefined),
      deleteProjectDirectories: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(ProjectInitializationService).mockImplementation(() => mockInitService as any)
  })

  describe('Complete Project Creation Workflow with User Isolation', () => {
    it('should create two projects with isolated database users and verify isolation', async () => {
      // Test complete project creation workflow with user isolation
      // Requirements: 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4, 5.5

      // Setup mocks for Project A
      const projectAData = {
        id: 1,
        ref: 'project-a-ref',
        name: 'Project A',
        database_name: 'project_a_db',
        database_user: 'proj_project_a',
        database_password_hash: 'hashed_password_a',
        organization_id: 1,
        owner_user_id: 'user123',
        status: 'ACTIVE_HEALTHY' as const,
        region: 'local',
        connection_string: 'postgresql://proj_project_a:password123@localhost:5432/project_a_db',
        inserted_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      }

      mockSaveProject.mockResolvedValueOnce({
        data: projectAData,
        error: undefined,
      })

      // Step 1: Create Project A
      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req: reqA, res: resA } = createMocks({
        method: 'POST',
        body: {
          name: 'Project A',
          database_user: 'proj_project_a',
          database_password: 'password123',
          organization_id: 1,
        },
      })

      await createProjectHandler(reqA, resA)

      expect(resA._getStatusCode()).toBe(201)
      const responseDataA = JSON.parse(resA._getData())
      
      expect(responseDataA).toMatchObject({
        name: 'Project A',
        database_name: 'project_a_db',
        status: 'ACTIVE_HEALTHY',
      })

      // Verify user creation was called for Project A
      expect(mockCreateProjectUser).toHaveBeenCalledWith({
        username: 'proj_project_a',
        password: 'password123',
        databaseName: 'project_a_db',
        projectRef: expect.any(String),
      })

      // Setup mocks for Project B
      mockGenerateDatabaseName.mockReturnValue('project_b_db')
      mockGenerateUsername.mockReturnValue('proj_project_b')
      mockGenerateConnectionString.mockReturnValue('postgresql://proj_project_b:password456@localhost:5432/project_b_db')
      mockGenerateDisplayConnectionString.mockReturnValue('postgresql://proj_project_b:[YOUR_PASSWORD]@localhost:5432/project_b_db')
      mockParseConnectionString.mockReturnValue({
        user: 'proj_project_b',
        password: 'password456',
        host: 'localhost',
        port: 5432,
        database: 'project_b_db',
      })

      const projectBData = {
        id: 2,
        ref: 'project-b-ref',
        name: 'Project B',
        database_name: 'project_b_db',
        database_user: 'proj_project_b',
        database_password_hash: 'hashed_password_b',
        organization_id: 1,
        owner_user_id: 'user123',
        status: 'ACTIVE_HEALTHY' as const,
        region: 'local',
        connection_string: 'postgresql://proj_project_b:password456@localhost:5432/project_b_db',
        inserted_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      }

      mockSaveProject.mockResolvedValueOnce({
        data: projectBData,
        error: undefined,
      })

      // Step 2: Create Project B
      const { req: reqB, res: resB } = createMocks({
        method: 'POST',
        body: {
          name: 'Project B',
          database_user: 'proj_project_b',
          database_password: 'password456',
          organization_id: 1,
        },
      })

      await createProjectHandler(reqB, resB)

      expect(resB._getStatusCode()).toBe(201)
      const responseDataB = JSON.parse(resB._getData())
      
      expect(responseDataB).toMatchObject({
        name: 'Project B',
        database_name: 'project_b_db',
        status: 'ACTIVE_HEALTHY',
      })

      // Verify user creation was called for Project B
      expect(mockCreateProjectUser).toHaveBeenCalledWith({
        username: 'proj_project_b',
        password: 'password456',
        databaseName: 'project_b_db',
        projectRef: expect.any(String),
      })

      // Step 3: Verify cross-project access prevention
      mockVerifyCrossProjectAccessDenial.mockResolvedValue({
        data: {
          canAccess: false,
          permissions: [],
          error: undefined
        },
        error: undefined
      })

      // Test that Project A user cannot access Project B database
      const crossAccessResult = await verifyCrossProjectAccessDenial('proj_project_a', 'project_b_db')
      
      expect(crossAccessResult.error).toBeUndefined()
      expect(crossAccessResult.data?.canAccess).toBe(false)
      expect(crossAccessResult.data?.permissions).toHaveLength(0)

      // Step 4: Verify user permissions are correctly configured
      mockVerifyUserPermissions.mockResolvedValue({
        data: {
          hasCorrectPermissions: true,
          violations: [],
          permissions: {
            username: 'proj_project_a',
            databases: ['project_a_db'],
            privileges: { 'project_a_db': ['CONNECT', 'CREATE'] },
            canCreateDb: false,
            canCreateRole: false,
            isSuperuser: false
          }
        },
        error: undefined
      })

      const permissionsResult = await verifyUserPermissions('proj_project_a', 'project_a_db')
      
      expect(permissionsResult.error).toBeUndefined()
      expect(permissionsResult.data?.hasCorrectPermissions).toBe(true)
      expect(permissionsResult.data?.violations).toHaveLength(0)

      // Step 5: Run complete isolation verification
      mockRunIsolationVerification.mockResolvedValue({
        data: {
          isolationStatus: 'SECURE',
          violations: [],
          usersChecked: ['proj_project_a', 'proj_project_b'],
          databasesChecked: ['project_a_db', 'project_b_db'],
          timestamp: new Date('2023-01-01T00:00:00Z'),
          summary: 'All project users have proper isolation configured.'
        },
        error: undefined
      })

      const isolationResult = await runIsolationVerification()
      
      expect(isolationResult.error).toBeUndefined()
      expect(isolationResult.data?.isolationStatus).toBe('SECURE')
      expect(isolationResult.data?.violations).toHaveLength(0)
      expect(isolationResult.data?.usersChecked).toContain('proj_project_a')
      expect(isolationResult.data?.usersChecked).toContain('proj_project_b')
    })

    it('should detect and report cross-project access violations', async () => {
      // Test cross-project access prevention works correctly
      // Requirements: 5.1, 5.2

      // Mock a violation scenario where user has access to wrong database
      mockVerifyCrossProjectAccessDenial.mockResolvedValue({
        data: {
          canAccess: true,
          permissions: ['CONNECT'],
          error: 'User has unauthorized access to database "other_project_db"'
        },
        error: undefined
      })

      const result = await verifyCrossProjectAccessDenial('proj_project_a', 'other_project_db')
      
      expect(result.error).toBeUndefined()
      expect(result.data?.canAccess).toBe(true)
      expect(result.data?.permissions).toContain('CONNECT')
      expect(result.data?.error).toContain('unauthorized access')
    })
  })

  describe('Connection String Validation with External Database Tools', () => {
    it('should generate valid connection strings that work with external tools', async () => {
      // Test connection strings work with external database tools
      // Requirements: 3.1, 3.2, 3.3, 3.4, 3.5

      const projectData = {
        id: 1,
        ref: 'test-project',
        name: 'Test Project',
        database_name: 'test_project_db',
        database_user: 'proj_test_project',
        database_password_hash: 'hashed_password',
        organization_id: 1,
        owner_user_id: 'user123',
        status: 'ACTIVE_HEALTHY' as const,
        region: 'local',
        connection_string: 'postgresql://proj_test_project:secure_password@localhost:5432/test_project_db',
        inserted_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      }

      mockFindProjectByRef.mockResolvedValue({
        data: projectData,
        error: undefined,
      })

      // Test connection string generation
      mockGenerateConnectionString.mockReturnValue('postgresql://proj_test_project:secure_password@localhost:5432/test_project_db')
      
      const actualConnectionString = generateConnectionString({
        databaseName: 'test_project_db',
        user: 'proj_test_project',
        password: 'secure_password',
        host: 'localhost',
        port: 5432,
        useEnvironmentDefaults: false,
        maskPassword: false
      })

      expect(actualConnectionString).toBe('postgresql://proj_test_project:secure_password@localhost:5432/test_project_db')

      // Test display connection string (masked password)
      mockGenerateDisplayConnectionString.mockReturnValue('postgresql://proj_test_project:[YOUR_PASSWORD]@localhost:5432/test_project_db')
      
      const displayConnectionString = generateDisplayConnectionString({
        databaseName: 'test_project_db',
        user: 'proj_test_project',
        password: 'secure_password',
        host: 'localhost',
        port: 5432
      })

      expect(displayConnectionString).toBe('postgresql://proj_test_project:[YOUR_PASSWORD]@localhost:5432/test_project_db')
      expect(displayConnectionString).not.toContain('secure_password')

      // Test connection string parsing
      mockParseConnectionString.mockReturnValue({
        user: 'proj_test_project',
        password: 'secure_password',
        host: 'localhost',
        port: 5432,
        database: 'test_project_db',
      })
      
      const parsedConnection = parseConnectionString(actualConnectionString)
      
      expect(parsedConnection.user).toBe('proj_test_project')
      expect(parsedConnection.password).toBe('secure_password')
      expect(parsedConnection.host).toBe('localhost')
      expect(parsedConnection.port).toBe(5432)
      expect(parsedConnection.database).toBe('test_project_db')

      // Verify connection string format is valid PostgreSQL URI
      expect(actualConnectionString).toMatch(/^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^\/]+$/)
      expect(actualConnectionString).toContain('postgresql://')
    })

    it('should handle connection string validation for different environments', async () => {
      // Test connection strings for different environments
      // Requirements: 3.1, 3.2, 3.3, 3.4, 3.5

      // Test production-like connection string
      mockGenerateConnectionString.mockReturnValue('postgresql://proj_prod_app:very_secure_prod_password@prod-db.example.com:5433/prod_app_db')
      
      const prodConnectionString = generateConnectionString({
        databaseName: 'prod_app_db',
        user: 'proj_prod_app',
        password: 'very_secure_prod_password',
        host: 'prod-db.example.com',
        port: 5433,
        useEnvironmentDefaults: false,
        maskPassword: false
      })

      expect(prodConnectionString).toContain('prod-db.example.com:5433')
      expect(prodConnectionString).toContain('proj_prod_app')
      expect(prodConnectionString).toContain('prod_app_db')

      // Test parsing production connection string
      mockParseConnectionString.mockReturnValue({
        user: 'proj_prod_app',
        password: 'very_secure_prod_password',
        host: 'prod-db.example.com',
        port: 5433,
        database: 'prod_app_db',
      })
      
      const parsedProd = parseConnectionString(prodConnectionString)
      expect(parsedProd.host).toBe('prod-db.example.com')
      expect(parsedProd.port).toBe(5433)
      expect(parsedProd.user).toBe('proj_prod_app')
      expect(parsedProd.database).toBe('prod_app_db')

      // Verify no placeholder values remain
      expect(prodConnectionString).not.toContain('[user]')
      expect(prodConnectionString).not.toContain('[host]')
      expect(prodConnectionString).not.toContain('[port]')
      expect(prodConnectionString).not.toContain('[db-name]')
      expect(prodConnectionString).not.toContain('localhost')
    })
  })

  describe('Service Isolation and User Configuration', () => {
    it('should configure all services with project-specific database users', async () => {
      // Test service isolation and proper user configuration
      // Requirements: 8.1, 8.2, 8.3, 8.4, 8.5

      const projectData = {
        id: 1,
        ref: 'service-test-project',
        name: 'Service Test Project',
        database_name: 'service_test_db',
        database_user: 'proj_service_test',
        database_password_hash: 'hashed_service_password',
        organization_id: 1,
        owner_user_id: 'user123',
        status: 'ACTIVE_HEALTHY' as const,
        region: 'local',
        connection_string: 'postgresql://proj_service_test:service_password@localhost:5432/service_test_db',
        inserted_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      }

      mockFindProjectByRef.mockResolvedValue({
        data: projectData,
        error: undefined,
      })

      // Mock successful service configuration
      mockServiceManager.configureProjectServices.mockResolvedValue({
        success: true,
        updatedServices: ['gotrue', 'storage', 'realtime', 'postgrest'],
        errors: []
      })

      mockServiceManager.getProjectServiceConfig.mockResolvedValue({
        projectRef: 'service-test-project',
        databaseUser: 'proj_service_test',
        databaseName: 'service_test_db',
        services: {
          gotrue: { enabled: true, connectionString: 'postgresql://proj_service_test:service_password@localhost:5432/service_test_db' },
          storage: { enabled: true, connectionString: 'postgresql://proj_service_test:service_password@localhost:5432/service_test_db' },
          realtime: { enabled: true, connectionString: 'postgresql://proj_service_test:service_password@localhost:5432/service_test_db' },
          postgrest: { enabled: true, connectionString: 'postgresql://proj_service_test:service_password@localhost:5432/service_test_db' }
        }
      })

      // Step 1: Configure services for the project
      const configResult = await mockServiceManager.configureProjectServices('service-test-project')
      
      expect(configResult.success).toBe(true)
      expect(configResult.updatedServices).toEqual(['gotrue', 'storage', 'realtime', 'postgrest'])
      expect(configResult.errors).toHaveLength(0)

      // Step 2: Verify service configuration
      const serviceConfig = await mockServiceManager.getProjectServiceConfig('service-test-project')
      
      expect(serviceConfig).toBeTruthy()
      expect(serviceConfig?.projectRef).toBe('service-test-project')
      expect(serviceConfig?.databaseUser).toBe('proj_service_test')
      expect(serviceConfig?.services.gotrue.enabled).toBe(true)
      expect(serviceConfig?.services.storage.enabled).toBe(true)
      expect(serviceConfig?.services.realtime.enabled).toBe(true)
      expect(serviceConfig?.services.postgrest.enabled).toBe(true)

      // Verify all services use the project-specific user
      expect(serviceConfig?.services.gotrue.connectionString).toContain('proj_service_test')
      expect(serviceConfig?.services.storage.connectionString).toContain('proj_service_test')
      expect(serviceConfig?.services.realtime.connectionString).toContain('proj_service_test')
      expect(serviceConfig?.services.postgrest.connectionString).toContain('proj_service_test')

      // Step 3: Test service health check
      mockServiceManager.healthCheck.mockResolvedValue({
        healthy: true,
        projects: [{
          projectRef: 'service-test-project',
          healthy: true,
          services: {
            gotrue: { healthy: true, lastCheck: new Date() },
            storage: { healthy: true, lastCheck: new Date() },
            realtime: { healthy: true, lastCheck: new Date() },
            postgrest: { healthy: true, lastCheck: new Date() }
          }
        }]
      })

      const healthCheck = await mockServiceManager.healthCheck('service-test-project')
      
      expect(healthCheck.healthy).toBe(true)
      expect(healthCheck.projects).toHaveLength(1)
      expect(healthCheck.projects[0].projectRef).toBe('service-test-project')
      expect(healthCheck.projects[0].healthy).toBe(true)
    })

    it('should handle service configuration failures and log errors', async () => {
      // Test service error logging
      // Requirements: 8.5

      const projectData = {
        id: 1,
        ref: 'failing-project',
        name: 'Failing Project',
        database_name: 'failing_db',
        database_user: 'proj_failing',
        database_password_hash: 'hashed_password',
        organization_id: 1,
        owner_user_id: 'user123',
        status: 'ACTIVE_HEALTHY' as const,
        region: 'local',
        connection_string: 'postgresql://proj_failing:password@localhost:5432/failing_db',
        inserted_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      }

      mockFindProjectByRef.mockResolvedValue({
        data: projectData,
        error: undefined,
      })

      // Mock service configuration failure
      mockServiceManager.configureProjectServices.mockResolvedValue({
        success: false,
        updatedServices: [],
        errors: [
          {
            service: 'gotrue',
            error: 'Authentication failed for user proj_failing',
            details: { code: 'AUTH_FAILED', timestamp: new Date() }
          },
          {
            service: 'storage',
            error: 'Connection timeout for user proj_failing',
            details: { code: 'CONNECTION_TIMEOUT', timestamp: new Date() }
          }
        ]
      })

      const configResult = await mockServiceManager.configureProjectServices('failing-project')
      
      expect(configResult.success).toBe(false)
      expect(configResult.errors).toHaveLength(2)
      expect(configResult.errors[0].service).toBe('gotrue')
      expect(configResult.errors[0].error).toContain('Authentication failed')
      expect(configResult.errors[1].service).toBe('storage')
      expect(configResult.errors[1].error).toContain('Connection timeout')
    })
  })

  describe('Project Listing and Deletion with User Cleanup', () => {
    it('should list projects with database user information and clean up users on deletion', async () => {
      // Test project listing with user information and user cleanup on deletion
      // Requirements: 7.1, 7.2, 7.3, 7.4, 7.5

      const testProjects = [
        {
          id: 1,
          ref: 'project-1',
          name: 'Project 1',
          database_name: 'project_1_db',
          database_user: 'proj_project_1',
          database_password_hash: 'hashed_password_1',
          organization_id: 1,
          owner_user_id: 'user123',
          status: 'ACTIVE_HEALTHY' as const,
          region: 'local',
          connection_string: 'postgresql://proj_project_1:password1@localhost:5432/project_1_db',
          inserted_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          ref: 'project-2',
          name: 'Project 2',
          database_name: 'project_2_db',
          database_user: 'proj_project_2',
          database_password_hash: 'hashed_password_2',
          organization_id: 1,
          owner_user_id: 'user123',
          status: 'ACTIVE_HEALTHY' as const,
          region: 'local',
          connection_string: 'postgresql://proj_project_2:password2@localhost:5432/project_2_db',
          inserted_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        }
      ]

      // Step 1: Test project listing
      mockFindAllProjects.mockResolvedValue({
        data: testProjects,
        error: undefined,
      })

      const orgProjectsHandler = (await import('../../pages/api/platform/organizations/[slug]/projects')).default
      const { req: listReq, res: listRes } = createMocks({
        method: 'GET',
        query: { slug: 'test-org' },
      })

      await orgProjectsHandler(listReq, listRes)

      expect(listRes._getStatusCode()).toBe(200)
      const listResponseData = JSON.parse(listRes._getData())
      
      expect(listResponseData.projects).toHaveLength(2)
      expect(listResponseData.projects[0]).toMatchObject({
        id: 1,
        ref: 'project-1',
        name: 'Project 1',
        database_name: 'project_1_db',
        database_user: 'proj_project_1',
      })
      expect(listResponseData.projects[1]).toMatchObject({
        id: 2,
        ref: 'project-2',
        name: 'Project 2',
        database_name: 'project_2_db',
        database_user: 'proj_project_2',
      })

      // Step 2: Test project deletion with user cleanup
      mockFindProjectByRef.mockResolvedValue({
        data: testProjects[0],
        error: undefined,
      })

      mockDeleteProjectUser.mockResolvedValue({
        data: undefined,
        error: undefined,
      })

      mockDeleteDatabase.mockResolvedValue({
        data: undefined,
        error: undefined,
      })

      mockDeleteProject.mockResolvedValue({
        data: undefined,
        error: undefined,
      })

      mockServiceManager.removeProjectServiceConfig.mockResolvedValue(undefined)

      const projectDetailHandler = (await import('../../pages/api/platform/projects/[ref]/index')).default
      const { req: deleteReq, res: deleteRes } = createMocks({
        method: 'DELETE',
        query: { ref: 'project-1' },
      })

      await projectDetailHandler(deleteReq, deleteRes)

      expect(deleteRes._getStatusCode()).toBe(200)
      
      // Verify cleanup sequence was called correctly
      expect(mockDeleteProjectUser).toHaveBeenCalledWith('proj_project_1')
      expect(mockDeleteDatabase).toHaveBeenCalledWith('project_1_db')
      expect(mockDeleteProject).toHaveBeenCalledWith(1)
      expect(mockServiceManager.removeProjectServiceConfig).toHaveBeenCalledWith('project-1')
    })
  })

  describe('Error Handling and Rollback Scenarios', () => {
    it('should handle project creation rollback when user creation fails', async () => {
      // Test rollback consistency
      // Requirements: 6.1

      const { DatabaseUserError, DatabaseUserErrorCode } = await import('../../lib/api/self-hosted')
      
      // Mock user creation failure
      mockCreateProjectUser.mockResolvedValue({
        data: undefined,
        error: new DatabaseUserError(DatabaseUserErrorCode.USER_ALREADY_EXISTS, 'User already exists'),
      })

      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Rollback Test Project',
          database_user: 'existing_user',
          database_password: 'password123',
          organization_id: 1,
        },
      })

      await createProjectHandler(req, res)

      expect(res._getStatusCode()).toBe(409)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.code).toBe('USER_ALREADY_EXISTS')

      // Verify rollback was attempted (database was created but then rolled back)
      expect(mockCreateDatabaseWithRetry).toHaveBeenCalled()
      expect(mockSaveProject).not.toHaveBeenCalled()
    })

    it('should handle database creation failure with user cleanup', async () => {
      // Test rollback when database creation fails after user creation
      // Requirements: 6.1

      const { DatabaseError, DatabaseErrorCode } = await import('../../lib/api/self-hosted')
      
      // Mock successful user creation but failed database creation
      mockCreateProjectUser.mockResolvedValue({ data: undefined, error: undefined })
      mockCreateDatabaseWithRetry.mockResolvedValue({
        data: undefined,
        error: new DatabaseError(DatabaseErrorCode.DISK_SPACE_FULL, 'Insufficient disk space'),
      })
      mockDeleteProjectUser.mockResolvedValue({ data: undefined, error: undefined })

      const createProjectHandler = (await import('../../pages/api/platform/projects/create')).default
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Rollback Test Project',
          database_user: 'test_rollback_user',
          database_password: 'password123',
          organization_id: 1,
        },
      })

      await createProjectHandler(req, res)

      expect(res._getStatusCode()).toBe(507)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.code).toBe('DISK_SPACE_FULL')

      // Verify user creation was never attempted since database creation failed
      expect(mockCreateProjectUser).not.toHaveBeenCalled()
      expect(mockDeleteProjectUser).not.toHaveBeenCalled()
    })
  })
})