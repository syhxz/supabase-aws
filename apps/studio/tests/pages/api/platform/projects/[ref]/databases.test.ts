/**
 * Tests for the databases API endpoint
 * Verifies fallback credential functionality and API response completeness
 */

import { NextApiRequest, NextApiResponse } from 'next'
import handler from '../../../../../../pages/api/platform/projects/[ref]/databases'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'

// Mock the self-hosted module
const mockFindProjectByRef = vi.fn()
const mockGenerateConnectionStringWithFallback = vi.fn()
const mockParseConnectionStringWithFallback = vi.fn()
const mockGetCredentialFallbackManager = vi.fn()

vi.mock('lib/api/self-hosted', () => ({
  findProjectByRef: mockFindProjectByRef,
  generateConnectionStringWithFallback: mockGenerateConnectionStringWithFallback,
  parseConnectionStringWithFallback: mockParseConnectionStringWithFallback,
  getCredentialFallbackManager: mockGetCredentialFallbackManager,
}))

// Mock console.log and console.error to avoid noise in tests
const originalConsoleLog = console.log
const originalConsoleError = console.error

beforeEach(() => {
  vi.clearAllMocks()
  console.log = vi.fn()
  console.error = vi.fn()
})

afterEach(() => {
  console.log = originalConsoleLog
  console.error = originalConsoleError
})

describe('/api/platform/projects/[ref]/databases', () => {
  const mockReq = (ref: string) => ({
    method: 'GET',
    query: { ref },
  } as NextApiRequest)

  const mockRes = () => {
    const res = {} as NextApiResponse
    res.status = vi.fn().mockReturnValue(res)
    res.json = vi.fn().mockReturnValue(res)
    res.setHeader = vi.fn().mockReturnValue(res)
    return res
  }

  const mockProject = {
    ref: 'test-project',
    database_name: 'test_db',
    database_user: 'test_user',
    database_password_hash: 'test_password_hash',
    inserted_at: '2023-01-01T00:00:00Z',
    region: 'local',
    status: 'ACTIVE_HEALTHY'
  }

  const mockCredentialFallbackManager = {
    getProjectCredentials: vi.fn(),
    logFallbackUsage: vi.fn(),
  }

  beforeEach(() => {
    mockGetCredentialFallbackManager.mockReturnValue(mockCredentialFallbackManager)
  })

  it('should return database information with complete project credentials', async () => {
    // Setup mocks for complete credentials scenario
    mockFindProjectByRef.mockResolvedValue({ data: mockProject, error: null })
    
    mockCredentialFallbackManager.getProjectCredentials.mockReturnValue({
      user: 'test_user',
      passwordHash: 'test_password_hash',
      isComplete: true
    })

    mockGenerateConnectionStringWithFallback.mockReturnValue({
      connectionString: 'postgresql://test_user:[YOUR_PASSWORD]@localhost:5432/test_db',
      usedFallback: false,
      fallbackReason: undefined,
      fallbackType: undefined
    })

    mockParseConnectionStringWithFallback.mockReturnValue({
      host: 'localhost',
      port: 5432,
      user: 'test_user',
      database: 'test_db',
      isValid: true
    })

    const req = mockReq('test-project')
    const res = mockRes()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        db_host: 'localhost',
        db_name: 'test_db',
        db_port: 5432,
        db_user: 'test_user',
        identifier: 'test-project',
        connectionString: 'postgresql://test_user:[YOUR_PASSWORD]@localhost:5432/test_db'
      })
    ])
  })

  it('should use fallback credentials when project credentials are missing', async () => {
    // Setup mocks for missing credentials scenario
    const projectWithMissingCredentials = {
      ...mockProject,
      database_user: null,
      database_password_hash: null
    }

    mockFindProjectByRef.mockResolvedValue({ data: projectWithMissingCredentials, error: null })
    
    mockCredentialFallbackManager.getProjectCredentials.mockReturnValue({
      user: null,
      passwordHash: null,
      isComplete: false
    })

    mockGenerateConnectionStringWithFallback.mockReturnValue({
      connectionString: 'postgresql://postgres:[YOUR_PASSWORD]@localhost:5432/test_db',
      usedFallback: true,
      fallbackReason: 'Both user and password missing from project credentials',
      fallbackType: 'both'
    })

    mockParseConnectionStringWithFallback.mockReturnValue({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      database: 'test_db',
      isValid: true
    })

    const req = mockReq('test-project')
    const res = mockRes()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        db_host: 'localhost',
        db_name: 'test_db',
        db_port: 5432,
        db_user: 'postgres',
        identifier: 'test-project',
        connectionString: 'postgresql://postgres:[YOUR_PASSWORD]@localhost:5432/test_db'
      })
    ])

    // Verify fallback usage was logged
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[Databases API] Using fallback credentials for project test-project')
    )
  })

  it('should return 404 when project is not found', async () => {
    mockFindProjectByRef.mockResolvedValue({ data: null, error: null })

    const req = mockReq('nonexistent-project')
    const res = mockRes()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Project not found: nonexistent-project' }
    })
  })

  it('should return 400 when project ref is missing', async () => {
    const req = { method: 'GET', query: {} } as NextApiRequest
    const res = mockRes()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Project ref is required' }
    })
  })

  it('should handle credential-related errors gracefully', async () => {
    mockFindProjectByRef.mockResolvedValue({ data: mockProject, error: null })
    mockCredentialFallbackManager.getProjectCredentials.mockReturnValue({
      user: 'test_user',
      passwordHash: 'test_password_hash',
      isComplete: true
    })

    // Mock a credential-related error
    mockGenerateConnectionStringWithFallback.mockImplementation(() => {
      throw new Error('Invalid credential configuration: user cannot be empty')
    })

    const req = mockReq('test-project')
    const res = mockRes()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: { 
        message: 'Failed to resolve database credentials. Please check project configuration.',
        details: 'Invalid credential configuration: user cannot be empty'
      }
    })

    // Verify error was logged
    expect(mockCredentialFallbackManager.logFallbackUsage).toHaveBeenCalledWith(
      'test-project',
      expect.stringContaining('Credential resolution failed'),
      'both'
    )
  })

  it('should return 405 for non-GET methods', async () => {
    const req = { method: 'POST', query: { ref: 'test-project' } } as NextApiRequest
    const res = mockRes()

    await handler(req, res)

    expect(res.setHeader).toHaveBeenCalledWith('Allow', ['GET'])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.json).toHaveBeenCalledWith({
      data: null,
      error: { message: 'Method POST Not Allowed' }
    })
  })
})