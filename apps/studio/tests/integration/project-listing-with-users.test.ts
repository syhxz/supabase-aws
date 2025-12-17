import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'

// Integration test for project listing with database user information
describe('Project Listing with Database Users Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle complete project lifecycle with database users', async () => {
    // Mock the self-hosted API functions
    vi.doMock('lib/api/self-hosted', () => ({
      findAllProjects: vi.fn(),
      findProjectByRef: vi.fn(),
      deleteProject: vi.fn(),
      deleteDatabase: vi.fn(),
      deleteProjectUser: vi.fn(),
      generateDisplayConnectionString: vi.fn(),
      generateConnectionString: vi.fn(),
      parseConnectionString: vi.fn(),
    }))

    // Mock auth helpers
    vi.doMock('lib/api/auth-helpers', () => ({
      getCurrentUserId: vi.fn(),
    }))

    // Mock constants
    vi.doMock('lib/constants', () => ({
      IS_PLATFORM: false,
    }))

    vi.doMock('lib/constants/api', () => ({
      DEFAULT_PROJECT: {},
      PROJECT_REST_URL: 'http://localhost:3000/rest/v1/',
    }))

    vi.doMock('lib/service-router', () => ({
      getServiceRouter: vi.fn(() => ({
        isProjectRegistered: vi.fn().mockResolvedValue(false),
        unregisterProject: vi.fn(),
      })),
    }))

    vi.doMock('lib/project-initialization/ProjectInitializationService', () => ({
      ProjectInitializationService: vi.fn(() => ({
        deleteProjectDirectories: vi.fn().mockResolvedValue(undefined),
      })),
    }))

    const { findAllProjects, findProjectByRef, deleteProject, deleteDatabase, deleteProjectUser, generateDisplayConnectionString, generateConnectionString, parseConnectionString } = await import('lib/api/self-hosted')
    const { getCurrentUserId } = await import('lib/api/auth-helpers')

    // Test project with database user information
    const testProject = {
      id: 1,
      ref: 'test-project-with-user',
      name: 'Test Project with Database User',
      database_name: 'test_project_db',
      database_user: 'test_project_user',
      database_password_hash: 'hashed_password_123',
      organization_id: 1,
      owner_user_id: 'user123',
      status: 'ACTIVE_HEALTHY',
      region: 'localhost',
      inserted_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      connection_string: 'postgresql://test_project_user:password@localhost:5432/test_project_db',
    }

    // Setup mocks
    vi.mocked(findAllProjects).mockResolvedValue({
      data: [testProject],
      error: null,
    })

    vi.mocked(findProjectByRef).mockResolvedValue({
      data: testProject,
      error: null,
    })

    vi.mocked(getCurrentUserId).mockResolvedValue('user123')

    vi.mocked(generateDisplayConnectionString).mockReturnValue(
      'postgresql://test_project_user:[YOUR_PASSWORD]@localhost:5432/test_project_db'
    )

    vi.mocked(generateConnectionString).mockReturnValue(
      'postgresql://test_project_user:password@localhost:5432/test_project_db'
    )

    vi.mocked(parseConnectionString).mockReturnValue({
      host: 'localhost',
      port: 5432,
      database: 'test_project_db',
      user: 'test_project_user',
    })

    vi.mocked(deleteProjectUser).mockResolvedValue({
      data: undefined,
      error: null,
    })

    vi.mocked(deleteDatabase).mockResolvedValue({
      data: undefined,
      error: null,
    })

    vi.mocked(deleteProject).mockResolvedValue({
      data: undefined,
      error: null,
    })

    // Test 1: List projects should include database user information
    const orgProjectsHandler = (await import('../../pages/api/platform/organizations/[slug]/projects')).default
    const { req: listReq, res: listRes } = createMocks({
      method: 'GET',
      query: { slug: 'test-org' },
    })

    await orgProjectsHandler(listReq, listRes)

    expect(listRes._getStatusCode()).toBe(200)
    const listResponseData = JSON.parse(listRes._getData())
    
    expect(listResponseData.projects).toHaveLength(1)
    expect(listResponseData.projects[0]).toMatchObject({
      id: 1,
      ref: 'test-project-with-user',
      name: 'Test Project with Database User',
      database_name: 'test_project_db',
      database_user: 'test_project_user',
    })

    // Test 2: Get project detail should include database user information
    const projectDetailHandler = (await import('../../pages/api/platform/projects/[ref]/index')).default
    const { req: detailReq, res: detailRes } = createMocks({
      method: 'GET',
      query: { ref: 'test-project-with-user' },
    })

    await projectDetailHandler(detailReq, detailRes)

    expect(detailRes._getStatusCode()).toBe(200)
    const detailResponseData = JSON.parse(detailRes._getData())
    
    expect(detailResponseData).toMatchObject({
      id: 1,
      ref: 'test-project-with-user',
      name: 'Test Project with Database User',
      database_name: 'test_project_db',
      database_user: 'test_project_user',
    })

    // Test 3: Delete project should clean up database user
    const { req: deleteReq, res: deleteRes } = createMocks({
      method: 'DELETE',
      query: { ref: 'test-project-with-user' },
    })

    await projectDetailHandler(deleteReq, deleteRes)

    expect(deleteRes._getStatusCode()).toBe(200)
    
    // Verify cleanup sequence was called correctly
    expect(deleteProjectUser).toHaveBeenCalledWith('test_project_user')
    expect(deleteDatabase).toHaveBeenCalledWith('test_project_db')
    expect(deleteProject).toHaveBeenCalledWith(1)
  })
})