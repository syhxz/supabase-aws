/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { NextApiRequest, NextApiResponse } from 'next'
import handler from '../index'

// Mock the self-hosted module
vi.mock('lib/api/self-hosted', () => ({
  findAllProjects: vi.fn(),
  generateConnectionString: vi.fn(),
  generateDisplayConnectionString: vi.fn(),
}))

// Mock apiWrapper to pass through to handler
vi.mock('lib/api/apiWrapper', () => ({
  default: (req: NextApiRequest, res: NextApiResponse, handler: Function) => handler(req, res),
}))

// Mock constants
vi.mock('lib/constants/api', () => ({
  DEFAULT_PROJECT: {
    id: 1,
    ref: 'default',
    name: 'Default Project',
    status: 'ACTIVE_HEALTHY',
    region: 'local',
    cloud_provider: 'localhost',
    inserted_at: '2024-01-01T00:00:00.000Z',
  },
}))

import { findAllProjects, generateDisplayConnectionString } from 'lib/api/self-hosted'

const mockFindAllProjects = findAllProjects as ReturnType<typeof vi.fn>
const mockGenerateDisplayConnectionString = generateDisplayConnectionString as ReturnType<typeof vi.fn>

describe('GET /api/platform/projects', () => {
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
      method: 'GET',
      query: {},
      headers: {},
    }

    res = {
      status: statusMock as any,
      setHeader: setHeaderMock,
    }

    // Default mock implementation
    mockGenerateDisplayConnectionString.mockReturnValue('postgresql://supabase_admin:[YOUR_PASSWORD]@db:5432/test_db')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Success scenarios', () => {
    it('should return empty project list when no projects exist', async () => {
      mockFindAllProjects.mockResolvedValue({
        data: [],
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        projects: [],
        pagination: {
          count: 0,
          limit: 100,
          offset: 0,
        },
      })
    })

    it('should return all projects', async () => {
      const mockProjects = [
        {
          id: 1,
          ref: 'project-1',
          name: 'Project 1',
          database_name: 'project_1_db',
          organization_id: 1,
          status: 'ACTIVE_HEALTHY' as const,
          region: 'us-east-1',
          inserted_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          ref: 'project-2',
          name: 'Project 2',
          database_name: 'project_2_db',
          organization_id: 1,
          status: 'ACTIVE_HEALTHY' as const,
          region: 'us-west-1',
          inserted_at: '2024-01-02T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z',
        },
      ]

      mockFindAllProjects.mockResolvedValue({
        data: mockProjects,
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        projects: [
          expect.objectContaining({
            id: 1,
            ref: 'project-1',
            name: 'Project 1',
            database_name: 'project_1_db',
            organization_id: 1,
            status: 'ACTIVE_HEALTHY',
            region: 'us-east-1',
            cloud_provider: 'localhost',
            connectionString: 'postgresql://supabase_admin:[YOUR_PASSWORD]@db:5432/test_db',
            databases: [
              {
                identifier: 'project-1',
                infra_compute_size: 'micro',
              },
            ],
          }),
          expect.objectContaining({
            id: 2,
            ref: 'project-2',
            name: 'Project 2',
            database_name: 'project_2_db',
          }),
        ],
        pagination: {
          count: 2,
          limit: 100,
          offset: 0,
        },
      })
      expect(mockGenerateDisplayConnectionString).toHaveBeenCalledTimes(2)
    })

    it('should include database_name field in response', async () => {
      const mockProjects = [
        {
          id: 1,
          ref: 'test-ref',
          name: 'Test Project',
          database_name: 'test_database',
          organization_id: 1,
          status: 'ACTIVE_HEALTHY' as const,
          region: 'local',
          inserted_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      ]

      mockFindAllProjects.mockResolvedValue({
        data: mockProjects,
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      const response = jsonMock.mock.calls[0][0]
      expect(response.projects[0]).toHaveProperty('database_name', 'test_database')
    })

    it('should generate connection strings for each project', async () => {
      const mockProjects = [
        {
          id: 1,
          ref: 'project-1',
          name: 'Project 1',
          database_name: 'db1',
          organization_id: 1,
          status: 'ACTIVE_HEALTHY' as const,
          region: 'local',
          inserted_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          ref: 'project-2',
          name: 'Project 2',
          database_name: 'db2',
          organization_id: 1,
          status: 'ACTIVE_HEALTHY' as const,
          region: 'local',
          inserted_at: '2024-01-02T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z',
        },
      ]

      mockFindAllProjects.mockResolvedValue({
        data: mockProjects,
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(mockGenerateDisplayConnectionString).toHaveBeenCalledWith({
        databaseName: 'db1',
        readOnly: false,
      })
      expect(mockGenerateDisplayConnectionString).toHaveBeenCalledWith({
        databaseName: 'db2',
        readOnly: false,
      })
    })
  })

  describe('Pagination', () => {
    it('should apply default pagination', async () => {
      const mockProjects = Array.from({ length: 150 }, (_, i) => ({
        id: i + 1,
        ref: `project-${i + 1}`,
        name: `Project ${i + 1}`,
        database_name: `db_${i + 1}`,
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'local',
        inserted_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      }))

      mockFindAllProjects.mockResolvedValue({
        data: mockProjects,
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      const response = jsonMock.mock.calls[0][0]
      expect(response.projects).toHaveLength(100) // Default limit
      expect(response.pagination).toEqual({
        count: 150,
        limit: 100,
        offset: 0,
      })
    })

    it('should apply custom limit', async () => {
      req.query = { limit: '10' }

      const mockProjects = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        ref: `project-${i + 1}`,
        name: `Project ${i + 1}`,
        database_name: `db_${i + 1}`,
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'local',
        inserted_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      }))

      mockFindAllProjects.mockResolvedValue({
        data: mockProjects,
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      const response = jsonMock.mock.calls[0][0]
      expect(response.projects).toHaveLength(10)
      expect(response.pagination).toEqual({
        count: 50,
        limit: 10,
        offset: 0,
      })
    })

    it('should apply custom offset', async () => {
      req.query = { limit: '10', offset: '20' }

      const mockProjects = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        ref: `project-${i + 1}`,
        name: `Project ${i + 1}`,
        database_name: `db_${i + 1}`,
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'local',
        inserted_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      }))

      mockFindAllProjects.mockResolvedValue({
        data: mockProjects,
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      const response = jsonMock.mock.calls[0][0]
      expect(response.projects).toHaveLength(10)
      expect(response.projects[0].id).toBe(21) // Starting from offset 20
      expect(response.pagination).toEqual({
        count: 50,
        limit: 10,
        offset: 20,
      })
    })

    it('should handle offset beyond total count', async () => {
      req.query = { limit: '10', offset: '100' }

      const mockProjects = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        ref: `project-${i + 1}`,
        name: `Project ${i + 1}`,
        database_name: `db_${i + 1}`,
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'local',
        inserted_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      }))

      mockFindAllProjects.mockResolvedValue({
        data: mockProjects,
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      const response = jsonMock.mock.calls[0][0]
      expect(response.projects).toHaveLength(0)
      expect(response.pagination).toEqual({
        count: 50,
        limit: 10,
        offset: 100,
      })
    })
  })

  describe('Error handling', () => {
    it('should return empty list when store read fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockFindAllProjects.mockResolvedValue({
        data: undefined,
        error: new Error('Failed to read project store'),
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        projects: [],
        pagination: {
          count: 0,
          limit: 100,
          offset: 0,
        },
      })
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should return empty list when store is empty', async () => {
      mockFindAllProjects.mockResolvedValue({
        data: [],
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      const response = jsonMock.mock.calls[0][0]
      expect(response.projects).toHaveLength(0)
      expect(response.pagination.count).toBe(0)
    })
  })

  describe('HTTP method handling', () => {
    it('should return 405 for non-GET methods', async () => {
      req.method = 'POST'

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(setHeaderMock).toHaveBeenCalledWith('Allow', ['GET'])
      expect(statusMock).toHaveBeenCalledWith(405)
      expect(jsonMock).toHaveBeenCalledWith({
        data: null,
        error: { message: 'Method POST Not Allowed' },
      })
    })

    it('should return 405 for DELETE method', async () => {
      req.method = 'DELETE'

      await handler(req as NextApiRequest, res as NextApiResponse)

      expect(setHeaderMock).toHaveBeenCalledWith('Allow', ['GET'])
      expect(statusMock).toHaveBeenCalledWith(405)
    })
  })

  describe('Response format', () => {
    it('should include all required fields in project response', async () => {
      const mockProjects = [
        {
          id: 1,
          ref: 'test-ref',
          name: 'Test Project',
          database_name: 'test_db',
          organization_id: 1,
          status: 'ACTIVE_HEALTHY' as const,
          region: 'us-east-1',
          inserted_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      ]

      mockFindAllProjects.mockResolvedValue({
        data: mockProjects,
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      const response = jsonMock.mock.calls[0][0]
      const project = response.projects[0]

      expect(project).toHaveProperty('id')
      expect(project).toHaveProperty('ref')
      expect(project).toHaveProperty('name')
      expect(project).toHaveProperty('database_name')
      expect(project).toHaveProperty('organization_id')
      expect(project).toHaveProperty('cloud_provider')
      expect(project).toHaveProperty('status')
      expect(project).toHaveProperty('region')
      expect(project).toHaveProperty('inserted_at')
      expect(project).toHaveProperty('connectionString')
      expect(project).toHaveProperty('databases')
      expect(project.databases).toHaveLength(1)
      expect(project.databases[0]).toHaveProperty('identifier')
      expect(project.databases[0]).toHaveProperty('infra_compute_size')
    })

    it('should set cloud_provider to localhost', async () => {
      const mockProjects = [
        {
          id: 1,
          ref: 'test-ref',
          name: 'Test Project',
          database_name: 'test_db',
          organization_id: 1,
          status: 'ACTIVE_HEALTHY' as const,
          region: 'local',
          inserted_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      ]

      mockFindAllProjects.mockResolvedValue({
        data: mockProjects,
        error: undefined,
      })

      await handler(req as NextApiRequest, res as NextApiResponse)

      const response = jsonMock.mock.calls[0][0]
      expect(response.projects[0].cloud_provider).toBe('localhost')
    })
  })
})
