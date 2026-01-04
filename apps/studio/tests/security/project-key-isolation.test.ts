import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextApiRequest, NextApiResponse } from 'next'
import { createMocks } from 'node-mocks-http'

// Import the API handlers
import apiKeysHandler from '../../pages/api/v1/projects/[ref]/api-keys'
import apiKeyHandler from '../../pages/api/v1/projects/[ref]/api-keys/[id]'

// Mock the entire apiWrapper to control authentication behavior
vi.mock('../../lib/api/apiWrapper', () => ({
  default: vi.fn(),
}))

describe('Project-Level Key Isolation Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('API Keys Endpoint Project Isolation', () => {
    it('should only return keys for the specified project', async () => {
      const { default: apiWrapper } = await import('../../lib/api/apiWrapper')
      
      // Mock apiWrapper to call the handler directly (simulating successful auth)
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler) => {
        return handler(req, res)
      })

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { ref: 'project-123' },
      })

      await apiKeysHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      // Verify that all returned keys are scoped to the project
      expect(Array.isArray(responseData)).toBe(true)
      responseData.forEach((key: any) => {
        expect(key).toHaveProperty('id')
        expect(key).toHaveProperty('type')
        expect(key).toHaveProperty('project_ref', 'project-123')
      })
    })

    it('should reject requests without proper authentication', async () => {
      const { default: apiWrapper } = await import('../../lib/api/apiWrapper')
      
      // Mock apiWrapper to return 401 (simulating auth failure)
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler) => {
        return res.status(401).json({
          error: { message: 'Unauthorized: missing access token' }
        })
      })

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { ref: 'project-123' },
      })

      await apiKeysHandler(req, res)

      expect(res._getStatusCode()).toBe(401)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.message).toContain('Unauthorized')
    })

    it('should prevent access to keys from different projects', async () => {
      const { default: apiWrapper } = await import('../../lib/api/apiWrapper')
      
      // Mock apiWrapper to call the handler directly (simulating successful auth)
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler) => {
        return handler(req, res)
      })

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { ref: 'project-456', id: 'key-from-project-123' },
      })

      await apiKeyHandler(req, res)

      // Should return 404 for keys not belonging to the project
      expect(res._getStatusCode()).toBe(404)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.message).toBe('API key not found')
    })
  })

  describe('API Key Creation Project Scoping', () => {
    it('should create keys scoped to the correct project', async () => {
      const { default: apiWrapper } = await import('../../lib/api/apiWrapper')
      
      // Mock apiWrapper to call the handler directly (simulating successful auth)
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler) => {
        return handler(req, res)
      })

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { ref: 'project-789' },
        body: {
          name: 'Test Key',
          type: 'secret',
          description: 'Test description',
        },
      })

      await apiKeysHandler(req, res)

      expect(res._getStatusCode()).toBe(201)
      const responseData = JSON.parse(res._getData())
      
      // Verify the created key has proper structure and project scoping
      expect(responseData).toHaveProperty('id')
      expect(responseData).toHaveProperty('name', 'Test Key')
      expect(responseData).toHaveProperty('type', 'secret')
      expect(responseData).toHaveProperty('project_ref', 'project-789')
      expect(responseData.api_key).toMatch(/^sb_secret_/)
      expect(responseData).toHaveProperty('inserted_at')
      expect(responseData).toHaveProperty('updated_at')
    })

    it('should reject key creation without authentication', async () => {
      const { default: apiWrapper } = await import('../../lib/api/apiWrapper')
      
      // Mock apiWrapper to return 401 (simulating auth failure)
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler) => {
        return res.status(401).json({
          error: { message: 'Unauthorized: missing access token' }
        })
      })

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { ref: 'project-789' },
        body: {
          name: 'Test Key',
          type: 'secret',
        },
      })

      await apiKeysHandler(req, res)

      expect(res._getStatusCode()).toBe(401)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.message).toContain('Unauthorized')
    })
  })

  describe('API Key Deletion Project Scoping', () => {
    it('should only allow deletion of keys within the same project', async () => {
      const { default: apiWrapper } = await import('../../lib/api/apiWrapper')
      
      // Mock apiWrapper to call the handler directly (simulating successful auth)
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler) => {
        return handler(req, res)
      })

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
        query: { ref: 'project-123', id: 'custom-key-123' },
      })

      await apiKeyHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData.message).toContain('deleted successfully')
    })

    it('should prevent deletion of legacy keys', async () => {
      const { default: apiWrapper } = await import('../../lib/api/apiWrapper')
      
      // Mock apiWrapper to call the handler directly (simulating successful auth)
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler) => {
        return handler(req, res)
      })

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
        query: { ref: 'project-123', id: 'anon' },
      })

      await apiKeyHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.message).toBe('Cannot delete legacy API keys')
    })
  })

  describe('Project Reference Validation', () => {
    it('should require project reference for all operations', async () => {
      const { default: apiWrapper } = await import('../../lib/api/apiWrapper')
      
      // Mock apiWrapper to call the handler directly (simulating successful auth)
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler) => {
        return handler(req, res)
      })

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: {}, // Missing ref parameter
      })

      await apiKeysHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.message).toBe('Project reference is required')
    })

    it('should validate project reference format', async () => {
      const { default: apiWrapper } = await import('../../lib/api/apiWrapper')
      
      // Mock apiWrapper to call the handler directly (simulating successful auth)
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler) => {
        return handler(req, res)
      })

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { ref: ['invalid', 'array'] }, // Invalid ref format
      })

      await apiKeysHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error.message).toBe('Project reference is required')
    })
  })
})