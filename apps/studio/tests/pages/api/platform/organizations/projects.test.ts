import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../../../../../pages/api/platform/organizations/[slug]/projects'

// Mock the self-hosted API
vi.mock('lib/api/self-hosted', () => ({
  findAllProjects: vi.fn(),
  generateDisplayConnectionString: vi.fn(),
  generateConnectionString: vi.fn(),
  parseConnectionString: vi.fn(),
}))

// Mock auth helpers
vi.mock('lib/api/auth-helpers', () => ({
  getCurrentUserId: vi.fn(),
}))

describe('/api/platform/organizations/[slug]/projects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should include database_user in project response', async () => {
    const { findAllProjects, generateDisplayConnectionString, generateConnectionString, parseConnectionString } = await import('lib/api/self-hosted')
    const { getCurrentUserId } = await import('lib/api/auth-helpers')

    // Mock project data with database user information
    const mockProject = {
      id: 1,
      ref: 'test-project',
      name: 'Test Project',
      database_name: 'test_db',
      database_user: 'test_user', // This should be included in response
      database_password_hash: 'hashed_password',
      organization_id: 1,
      owner_user_id: 'user123', // Add owner_user_id for user isolation
      status: 'ACTIVE_HEALTHY',
      region: 'localhost',
      inserted_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      connection_string: 'postgresql://test_user:password@localhost:5432/test_db',
    }

    vi.mocked(findAllProjects).mockResolvedValue({
      data: [mockProject],
      error: null,
    })

    vi.mocked(getCurrentUserId).mockResolvedValue('user123')

    vi.mocked(generateDisplayConnectionString).mockReturnValue(
      'postgresql://test_user:[YOUR_PASSWORD]@localhost:5432/test_db'
    )

    vi.mocked(generateConnectionString).mockReturnValue(
      'postgresql://test_user:password@localhost:5432/test_db'
    )

    vi.mocked(parseConnectionString).mockReturnValue({
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      user: 'test_user',
    })

    const { req, res } = createMocks({
      method: 'GET',
      query: { slug: 'test-org' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const responseData = JSON.parse(res._getData())
    
    expect(responseData.projects).toHaveLength(1)
    expect(responseData.projects[0]).toMatchObject({
      id: 1,
      ref: 'test-project',
      name: 'Test Project',
      database_name: 'test_db',
      database_user: 'test_user', // Verify database_user is included
    })
  })

  it('should handle projects without database_user gracefully', async () => {
    const { findAllProjects, generateDisplayConnectionString, generateConnectionString, parseConnectionString } = await import('lib/api/self-hosted')
    const { getCurrentUserId } = await import('lib/api/auth-helpers')

    // Mock legacy project data without database user information
    const mockProject = {
      id: 1,
      ref: 'legacy-project',
      name: 'Legacy Project',
      database_name: 'legacy_db',
      // No database_user field (legacy project)
      organization_id: 1,
      owner_user_id: 'user123', // Add owner_user_id for user isolation
      status: 'ACTIVE_HEALTHY',
      region: 'localhost',
      inserted_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      connection_string: 'postgresql://postgres:password@localhost:5432/legacy_db',
    }

    vi.mocked(findAllProjects).mockResolvedValue({
      data: [mockProject],
      error: null,
    })

    vi.mocked(getCurrentUserId).mockResolvedValue('user123')

    vi.mocked(generateDisplayConnectionString).mockReturnValue(
      'postgresql://postgres:[YOUR_PASSWORD]@localhost:5432/legacy_db'
    )

    vi.mocked(generateConnectionString).mockReturnValue(
      'postgresql://postgres:password@localhost:5432/legacy_db'
    )

    vi.mocked(parseConnectionString).mockReturnValue({
      host: 'localhost',
      port: 5432,
      database: 'legacy_db',
      user: 'postgres',
    })

    const { req, res } = createMocks({
      method: 'GET',
      query: { slug: 'test-org' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const responseData = JSON.parse(res._getData())
    
    expect(responseData.projects).toHaveLength(1)
    expect(responseData.projects[0]).toMatchObject({
      id: 1,
      ref: 'legacy-project',
      name: 'Legacy Project',
      database_name: 'legacy_db',
      database_user: 'postgres', // Should fallback to parsed connection string user
    })
  })
})