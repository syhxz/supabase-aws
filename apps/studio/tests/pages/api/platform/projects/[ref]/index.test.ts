import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../../../../../../pages/api/platform/projects/[ref]/index'

// Mock the self-hosted API
vi.mock('lib/api/self-hosted', () => ({
  findProjectByRef: vi.fn(),
  deleteProject: vi.fn(),
  deleteDatabase: vi.fn(),
  deleteProjectUser: vi.fn(),
}))

// Mock constants
vi.mock('lib/constants', () => ({
  IS_PLATFORM: false,
}))

// Mock other dependencies
vi.mock('lib/constants/api', () => ({
  DEFAULT_PROJECT: {},
  PROJECT_REST_URL: 'http://localhost:3000/rest/v1/',
}))

vi.mock('lib/service-router', () => ({
  getServiceRouter: vi.fn(() => ({
    isProjectRegistered: vi.fn(),
    unregisterProject: vi.fn(),
  })),
}))

vi.mock('lib/project-initialization/ProjectInitializationService', () => ({
  ProjectInitializationService: vi.fn(() => ({
    deleteProjectDirectories: vi.fn(),
  })),
}))

describe('/api/platform/projects/[ref]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should include database_user in project detail response', async () => {
      const { findProjectByRef } = await import('lib/api/self-hosted')

      // Mock project data with database user information
      const mockProject = {
        id: 1,
        ref: 'test-project',
        name: 'Test Project',
        database_name: 'test_db',
        database_user: 'test_user', // This should be included in response
        database_password_hash: 'hashed_password',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY',
        region: 'localhost',
        inserted_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        connection_string: 'postgresql://test_user:password@localhost:5432/test_db',
      }

      vi.mocked(findProjectByRef).mockResolvedValue({
        data: mockProject,
        error: null,
      })

      const { req, res } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      expect(responseData).toMatchObject({
        id: 1,
        ref: 'test-project',
        name: 'Test Project',
        database_name: 'test_db',
        database_user: 'test_user', // Verify database_user is included
      })
    })

    it('should return 404 for non-existent project', async () => {
      const { findProjectByRef } = await import('lib/api/self-hosted')

      vi.mocked(findProjectByRef).mockResolvedValue({
        data: null,
        error: null,
      })

      const { req, res } = createMocks({
        method: 'GET',
        query: { ref: 'non-existent' },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(404)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.message).toBe('Project not found: non-existent')
    })
  })

  describe('DELETE', () => {
    it('should delete database user when deleting project', async () => {
      const { findProjectByRef, deleteProject, deleteDatabase, deleteProjectUser } = await import('lib/api/self-hosted')
      const { getServiceRouter } = await import('lib/service-router')
      const { ProjectInitializationService } = await import('lib/project-initialization/ProjectInitializationService')

      // Mock project data with database user
      const mockProject = {
        id: 1,
        ref: 'test-project',
        name: 'Test Project',
        database_name: 'test_db',
        database_user: 'test_user',
        database_password_hash: 'hashed_password',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY',
        region: 'localhost',
        inserted_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        connection_string: 'postgresql://test_user:password@localhost:5432/test_db',
      }

      vi.mocked(findProjectByRef).mockResolvedValue({
        data: mockProject,
        error: null,
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

      const mockServiceRouter = {
        isProjectRegistered: vi.fn().mockResolvedValue(true),
        unregisterProject: vi.fn().mockResolvedValue(undefined),
      }
      vi.mocked(getServiceRouter).mockReturnValue(mockServiceRouter)

      const mockInitService = {
        deleteProjectDirectories: vi.fn().mockResolvedValue(undefined),
      }
      vi.mocked(ProjectInitializationService).mockReturnValue(mockInitService)

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { ref: 'test-project' },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      
      // Verify that database user deletion was called
      expect(deleteProjectUser).toHaveBeenCalledWith('test_user')
      expect(deleteDatabase).toHaveBeenCalledWith('test_db')
      expect(deleteProject).toHaveBeenCalledWith(1)
    })

    it('should not attempt to delete database user if project has none', async () => {
      const { findProjectByRef, deleteProject, deleteDatabase, deleteProjectUser } = await import('lib/api/self-hosted')
      const { getServiceRouter } = await import('lib/service-router')
      const { ProjectInitializationService } = await import('lib/project-initialization/ProjectInitializationService')

      // Mock legacy project data without database user
      const mockProject = {
        id: 1,
        ref: 'legacy-project',
        name: 'Legacy Project',
        database_name: 'legacy_db',
        // No database_user field
        organization_id: 1,
        status: 'ACTIVE_HEALTHY',
        region: 'localhost',
        inserted_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        connection_string: 'postgresql://postgres:password@localhost:5432/legacy_db',
      }

      vi.mocked(findProjectByRef).mockResolvedValue({
        data: mockProject,
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

      const mockServiceRouter = {
        isProjectRegistered: vi.fn().mockResolvedValue(false),
        unregisterProject: vi.fn(),
      }
      vi.mocked(getServiceRouter).mockReturnValue(mockServiceRouter)

      const mockInitService = {
        deleteProjectDirectories: vi.fn().mockResolvedValue(undefined),
      }
      vi.mocked(ProjectInitializationService).mockReturnValue(mockInitService)

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { ref: 'legacy-project' },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      
      // Verify that database user deletion was NOT called
      expect(deleteProjectUser).not.toHaveBeenCalled()
      expect(deleteDatabase).toHaveBeenCalledWith('legacy_db')
      expect(deleteProject).toHaveBeenCalledWith(1)
    })
  })
})