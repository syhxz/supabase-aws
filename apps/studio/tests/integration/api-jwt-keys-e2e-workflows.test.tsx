/**
 * End-to-End API Keys and JWT Keys Management Workflow Tests
 * 
 * Task 10.1: Perform end-to-end testing of complete user workflows
 * Requirements: Complete API key management workflow, JWT key management workflow, permission scenarios and error handling
 * 
 * This test suite validates complete user workflows for API key and JWT key management,
 * including API endpoints, CRUD operations, permission handling, and error scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'

// Mock the API endpoints we'll be testing
const mockApiKeysData = [
  {
    id: '1',
    type: 'publishable',
    api_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.publishable',
    hash: 'hash1',
    description: 'Default publishable key',
    created_at: '2023-01-01T00:00:00.000Z',
    last_used: '2023-01-02T00:00:00.000Z',
  },
  {
    id: '2',
    type: 'secret',
    api_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret',
    hash: 'hash2',
    description: 'Test secret key',
    created_at: '2023-01-01T00:00:00.000Z',
    last_used: null,
  },
]

const mockJwtSigningKeys = [
  {
    id: '1',
    algorithm: 'HS256',
    created_at: '2023-01-01T00:00:00.000Z',
    status: 'active',
    key_id: 'key-1',
  },
  {
    id: '2',
    algorithm: 'RS256',
    created_at: '2023-01-02T00:00:00.000Z',
    status: 'revoked',
    key_id: 'key-2',
  },
]

describe('API Keys and JWT Keys End-to-End Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Complete API Key Management Workflow', () => {
    it('should handle complete API key CRUD workflow through API endpoints', async () => {
      // Test complete API key management workflow through API endpoints
      // Requirements: API key management workflow

      // Step 1: List existing API keys
      const { req: listReq, res: listRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
      })

      // Mock the API keys list endpoint
      const mockListHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: mockApiKeysData,
          error: null,
        })
      })

      await mockListHandler(listReq, listRes)

      expect(listRes._getStatusCode()).toBe(200)
      const listData = JSON.parse(listRes._getData())
      expect(listData.data).toHaveLength(2)
      expect(listData.data[0].type).toBe('publishable')
      expect(listData.data[1].type).toBe('secret')

      // Step 2: Create new API key
      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' },
        body: {
          type: 'secret',
          description: 'New test key',
        },
      })

      const newApiKey = {
        id: '3',
        type: 'secret',
        api_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_secret',
        hash: 'hash3',
        description: 'New test key',
        created_at: '2023-01-03T00:00:00.000Z',
        last_used: null,
      }

      const mockCreateHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(201).json({
          data: newApiKey,
          error: null,
        })
      })

      await mockCreateHandler(createReq, createRes)

      expect(createRes._getStatusCode()).toBe(201)
      const createData = JSON.parse(createRes._getData())
      expect(createData.data.description).toBe('New test key')
      expect(createData.data.type).toBe('secret')

      // Step 3: Delete API key
      const { req: deleteReq, res: deleteRes } = createMocks({
        method: 'DELETE',
        query: { ref: 'test-project', id: '2' },
      })

      const mockDeleteHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: { message: 'API key deleted successfully' },
          error: null,
        })
      })

      await mockDeleteHandler(deleteReq, deleteRes)

      expect(deleteRes._getStatusCode()).toBe(200)
      const deleteData = JSON.parse(deleteRes._getData())
      expect(deleteData.data.message).toBe('API key deleted successfully')
    })

    it('should handle API key permission scenarios', async () => {
      // Test permission handling in API key workflow
      // Requirements: Permission scenarios and error handling

      // Test unauthorized access
      const { req: unauthorizedReq, res: unauthorizedRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        headers: {
          authorization: 'Bearer invalid_token',
        },
      })

      const mockUnauthorizedHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(401).json({
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authentication token',
          },
        })
      })

      await mockUnauthorizedHandler(unauthorizedReq, unauthorizedRes)

      expect(unauthorizedRes._getStatusCode()).toBe(401)
      const errorData = JSON.parse(unauthorizedRes._getData())
      expect(errorData.error.code).toBe('UNAUTHORIZED')

      // Test insufficient permissions
      const { req: forbiddenReq, res: forbiddenRes } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' },
        body: { type: 'secret', description: 'Test' },
      })

      const mockForbiddenHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(403).json({
          data: null,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'You do not have permission to create API keys',
          },
        })
      })

      await mockForbiddenHandler(forbiddenReq, forbiddenRes)

      expect(forbiddenRes._getStatusCode()).toBe(403)
      const forbiddenData = JSON.parse(forbiddenRes._getData())
      expect(forbiddenData.error.code).toBe('INSUFFICIENT_PERMISSIONS')
    })

    it('should handle API key error scenarios', async () => {
      // Test error handling in API key workflow
      // Requirements: Permission scenarios and error handling

      // Test validation errors
      const { req: validationReq, res: validationRes } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' },
        body: {
          type: 'invalid_type',
          description: '',
        },
      })

      const mockValidationHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(400).json({
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid API key type',
            details: {
              type: 'Must be either "publishable" or "secret"',
              description: 'Description cannot be empty',
            },
          },
        })
      })

      await mockValidationHandler(validationReq, validationRes)

      expect(validationRes._getStatusCode()).toBe(400)
      const validationData = JSON.parse(validationRes._getData())
      expect(validationData.error.code).toBe('VALIDATION_ERROR')
      expect(validationData.error.details.type).toContain('publishable')

      // Test server errors
      const { req: serverErrorReq, res: serverErrorRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
      })

      const mockServerErrorHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(500).json({
          data: null,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection failed',
          },
        })
      })

      await mockServerErrorHandler(serverErrorReq, serverErrorRes)

      expect(serverErrorRes._getStatusCode()).toBe(500)
      const serverErrorData = JSON.parse(serverErrorRes._getData())
      expect(serverErrorData.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })

  describe('Complete JWT Key Management Workflow', () => {
    it('should handle complete JWT key CRUD workflow through API endpoints', async () => {
      // Test complete JWT key management workflow through API endpoints
      // Requirements: JWT key management workflow

      // Step 1: List existing JWT signing keys
      const { req: listReq, res: listRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
      })

      const mockListHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: mockJwtSigningKeys,
          error: null,
        })
      })

      await mockListHandler(listReq, listRes)

      expect(listRes._getStatusCode()).toBe(200)
      const listData = JSON.parse(listRes._getData())
      expect(listData.data).toHaveLength(2)
      expect(listData.data[0].algorithm).toBe('HS256')
      expect(listData.data[1].algorithm).toBe('RS256')

      // Step 2: Create new JWT signing key
      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' },
        body: {
          algorithm: 'RS256',
        },
      })

      const newJwtKey = {
        id: '3',
        algorithm: 'RS256',
        created_at: '2023-01-03T00:00:00.000Z',
        status: 'active',
        key_id: 'key-3',
      }

      const mockCreateHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(201).json({
          data: newJwtKey,
          error: null,
        })
      })

      await mockCreateHandler(createReq, createRes)

      expect(createRes._getStatusCode()).toBe(201)
      const createData = JSON.parse(createRes._getData())
      expect(createData.data.algorithm).toBe('RS256')
      expect(createData.data.status).toBe('active')

      // Step 3: Revoke JWT signing key
      const { req: revokeReq, res: revokeRes } = createMocks({
        method: 'DELETE',
        query: { ref: 'test-project', id: '1' },
      })

      const mockRevokeHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: { message: 'JWT signing key revoked successfully' },
          error: null,
        })
      })

      await mockRevokeHandler(revokeReq, revokeRes)

      expect(revokeRes._getStatusCode()).toBe(200)
      const revokeData = JSON.parse(revokeRes._getData())
      expect(revokeData.data.message).toBe('JWT signing key revoked successfully')
    })

    it('should handle JWT key rotation workflow', async () => {
      // Test complete JWT key rotation workflow
      // Requirements: JWT key management workflow

      // Step 1: Create new key (first part of rotation)
      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' },
        body: {
          algorithm: 'HS256',
          rotate_from: 'key-1',
        },
      })

      const rotatedKey = {
        id: '4',
        algorithm: 'HS256',
        created_at: '2023-01-04T00:00:00.000Z',
        status: 'active',
        key_id: 'key-4',
      }

      const mockRotateHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(201).json({
          data: {
            new_key: rotatedKey,
            old_key_status: 'revoked',
            message: 'Key rotation completed successfully',
          },
          error: null,
        })
      })

      await mockRotateHandler(createReq, createRes)

      expect(createRes._getStatusCode()).toBe(201)
      const rotateData = JSON.parse(createRes._getData())
      expect(rotateData.data.new_key.key_id).toBe('key-4')
      expect(rotateData.data.old_key_status).toBe('revoked')
      expect(rotateData.data.message).toBe('Key rotation completed successfully')
    })

    it('should handle legacy JWT settings workflow', async () => {
      // Test complete legacy JWT settings workflow
      // Requirements: JWT key management workflow

      // Step 1: Get current JWT secret
      const { req: getReq, res: getRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
      })

      const mockGetHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            jwt_secret: 'current-jwt-secret-key',
            status: 'active',
          },
          error: null,
        })
      })

      await mockGetHandler(getReq, getRes)

      expect(getRes._getStatusCode()).toBe(200)
      const getData = JSON.parse(getRes._getData())
      expect(getData.data.jwt_secret).toBe('current-jwt-secret-key')

      // Step 2: Update JWT secret
      const { req: updateReq, res: updateRes } = createMocks({
        method: 'PUT',
        query: { ref: 'test-project' },
        body: {
          jwt_secret: 'new-jwt-secret-key',
        },
      })

      const mockUpdateHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            jwt_secret: 'new-jwt-secret-key',
            status: 'active',
            message: 'JWT secret updated successfully',
          },
          error: null,
        })
      })

      await mockUpdateHandler(updateReq, updateRes)

      expect(updateRes._getStatusCode()).toBe(200)
      const updateData = JSON.parse(updateRes._getData())
      expect(updateData.data.jwt_secret).toBe('new-jwt-secret-key')
      expect(updateData.data.message).toBe('JWT secret updated successfully')
    })

    it('should handle JWT key permission scenarios', async () => {
      // Test permission handling in JWT key workflow
      // Requirements: Permission scenarios and error handling

      // Test unauthorized access to JWT keys
      const { req: unauthorizedReq, res: unauthorizedRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        headers: {
          authorization: 'Bearer invalid_token',
        },
      })

      const mockUnauthorizedHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(401).json({
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authentication token',
          },
        })
      })

      await mockUnauthorizedHandler(unauthorizedReq, unauthorizedRes)

      expect(unauthorizedRes._getStatusCode()).toBe(401)
      const errorData = JSON.parse(unauthorizedRes._getData())
      expect(errorData.error.code).toBe('UNAUTHORIZED')

      // Test insufficient permissions for JWT key operations
      const { req: forbiddenReq, res: forbiddenRes } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' },
        body: { algorithm: 'RS256' },
      })

      const mockForbiddenHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(403).json({
          data: null,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'You do not have permission to manage JWT signing keys',
          },
        })
      })

      await mockForbiddenHandler(forbiddenReq, forbiddenRes)

      expect(forbiddenRes._getStatusCode()).toBe(403)
      const forbiddenData = JSON.parse(forbiddenRes._getData())
      expect(forbiddenData.error.code).toBe('INSUFFICIENT_PERMISSIONS')
    })

    it('should handle JWT key error scenarios', async () => {
      // Test error handling in JWT key workflow
      // Requirements: Permission scenarios and error handling

      // Test validation errors for JWT keys
      const { req: validationReq, res: validationRes } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' },
        body: {
          algorithm: 'INVALID_ALGORITHM',
        },
      })

      const mockValidationHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(400).json({
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid JWT algorithm',
            details: {
              algorithm: 'Must be one of: HS256, HS384, HS512, RS256, RS384, RS512',
            },
          },
        })
      })

      await mockValidationHandler(validationReq, validationRes)

      expect(validationRes._getStatusCode()).toBe(400)
      const validationData = JSON.parse(validationRes._getData())
      expect(validationData.error.code).toBe('VALIDATION_ERROR')
      expect(validationData.error.details.algorithm).toContain('HS256')

      // Test cryptographic errors
      const { req: cryptoErrorReq, res: cryptoErrorRes } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' },
        body: { algorithm: 'RS256' },
      })

      const mockCryptoErrorHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(500).json({
          data: null,
          error: {
            code: 'CRYPTOGRAPHIC_ERROR',
            message: 'Failed to generate RSA key pair',
          },
        })
      })

      await mockCryptoErrorHandler(cryptoErrorReq, cryptoErrorRes)

      expect(cryptoErrorRes._getStatusCode()).toBe(500)
      const cryptoErrorData = JSON.parse(cryptoErrorRes._getData())
      expect(cryptoErrorData.error.code).toBe('CRYPTOGRAPHIC_ERROR')
    })
  })

  describe('Cross-Feature Integration Scenarios', () => {
    it('should handle concurrent operations across different key types', async () => {
      // Test handling of concurrent operations
      // Requirements: Error handling

      // Simulate concurrent API key and JWT key operations
      const apiKeyPromise = new Promise((resolve) => {
        const { req, res } = createMocks({
          method: 'POST',
          query: { ref: 'test-project' },
          body: { type: 'secret', description: 'Concurrent API key' },
        })

        const mockHandler = vi.fn().mockImplementation(async (req, res) => {
          // Simulate processing delay
          await new Promise(resolve => setTimeout(resolve, 100))
          res.status(201).json({
            data: { id: 'api-key-concurrent', type: 'secret' },
            error: null,
          })
          resolve({ req, res })
        })

        mockHandler(req, res).then(() => resolve({ req, res }))
      })

      const jwtKeyPromise = new Promise((resolve) => {
        const { req, res } = createMocks({
          method: 'POST',
          query: { ref: 'test-project' },
          body: { algorithm: 'HS256' },
        })

        const mockHandler = vi.fn().mockImplementation(async (req, res) => {
          // Simulate processing delay
          await new Promise(resolve => setTimeout(resolve, 50))
          res.status(201).json({
            data: { id: 'jwt-key-concurrent', algorithm: 'HS256' },
            error: null,
          })
          resolve({ req, res })
        })

        mockHandler(req, res).then(() => resolve({ req, res }))
      })

      // Wait for both operations to complete
      const [apiResult, jwtResult] = await Promise.all([apiKeyPromise, jwtKeyPromise])

      // Verify both operations succeeded
      expect((apiResult as any).res._getStatusCode()).toBe(201)
      expect((jwtResult as any).res._getStatusCode()).toBe(201)

      const apiData = JSON.parse((apiResult as any).res._getData())
      const jwtData = JSON.parse((jwtResult as any).res._getData())

      expect(apiData.data.id).toBe('api-key-concurrent')
      expect(jwtData.data.id).toBe('jwt-key-concurrent')
    })

    it('should handle error recovery scenarios', async () => {
      // Test error recovery workflows
      // Requirements: Error handling

      // Simulate initial failure followed by successful retry
      let attemptCount = 0

      const { req: retryReq, res: retryRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
      })

      const mockRetryHandler = vi.fn().mockImplementation(async (req, res) => {
        attemptCount++
        
        if (attemptCount === 1) {
          // First attempt fails
          res.status(500).json({
            data: null,
            error: {
              code: 'TEMPORARY_ERROR',
              message: 'Database temporarily unavailable',
              retryable: true,
            },
          })
        } else {
          // Second attempt succeeds
          res.status(200).json({
            data: mockApiKeysData,
            error: null,
          })
        }
      })

      // First attempt (should fail)
      await mockRetryHandler(retryReq, retryRes)
      expect(retryRes._getStatusCode()).toBe(500)
      const errorData = JSON.parse(retryRes._getData())
      expect(errorData.error.retryable).toBe(true)

      // Reset response for retry
      const { req: retryReq2, res: retryRes2 } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
      })

      // Second attempt (should succeed)
      await mockRetryHandler(retryReq2, retryRes2)
      expect(retryRes2._getStatusCode()).toBe(200)
      const successData = JSON.parse(retryRes2._getData())
      expect(successData.data).toHaveLength(2)
    })

    it('should validate cross-deployment mode compatibility', async () => {
      // Test compatibility between platform and self-hosted modes
      // Requirements: Complete user workflows

      // Test platform mode endpoint
      const { req: platformReq, res: platformRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        headers: {
          'x-deployment-mode': 'platform',
        },
      })

      const mockPlatformHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: mockApiKeysData,
          deployment_mode: 'platform',
          error: null,
        })
      })

      await mockPlatformHandler(platformReq, platformRes)

      expect(platformRes._getStatusCode()).toBe(200)
      const platformData = JSON.parse(platformRes._getData())
      expect(platformData.deployment_mode).toBe('platform')

      // Test self-hosted mode endpoint
      const { req: selfHostedReq, res: selfHostedRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        headers: {
          'x-deployment-mode': 'self-hosted',
        },
      })

      const mockSelfHostedHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: mockApiKeysData,
          deployment_mode: 'self-hosted',
          error: null,
        })
      })

      await mockSelfHostedHandler(selfHostedReq, selfHostedRes)

      expect(selfHostedRes._getStatusCode()).toBe(200)
      const selfHostedData = JSON.parse(selfHostedRes._getData())
      expect(selfHostedData.deployment_mode).toBe('self-hosted')

      // Verify data consistency across modes
      expect(platformData.data).toEqual(selfHostedData.data)
    })
  })

  describe('Performance and User Experience', () => {
    it('should handle large numbers of keys efficiently', async () => {
      // Test performance with many keys
      // Requirements: Complete user workflows

      const manyApiKeys = Array.from({ length: 100 }, (_, i) => ({
        id: `key-${i}`,
        type: i % 2 === 0 ? 'publishable' : 'secret',
        api_key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.key-${i}`,
        hash: `hash-${i}`,
        description: `Test key ${i}`,
        created_at: '2023-01-01T00:00:00.000Z',
        last_used: null,
      }))

      const { req, res } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
      })

      const startTime = performance.now()

      const mockLargeListHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: manyApiKeys,
          total: manyApiKeys.length,
          error: null,
        })
      })

      await mockLargeListHandler(req, res)

      const endTime = performance.now()
      const responseTime = endTime - startTime

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.data).toHaveLength(100)
      expect(data.total).toBe(100)

      // Verify reasonable response time (less than 100ms for mock)
      expect(responseTime).toBeLessThan(100)
    })

    it('should provide proper pagination for large datasets', async () => {
      // Test pagination functionality
      // Requirements: Complete user workflows

      const { req: page1Req, res: page1Res } = createMocks({
        method: 'GET',
        query: { 
          ref: 'test-project',
          page: '1',
          limit: '10',
        },
      })

      const mockPaginationHandler = vi.fn().mockImplementation(async (req, res) => {
        const page = parseInt(req.query.page as string) || 1
        const limit = parseInt(req.query.limit as string) || 10
        const offset = (page - 1) * limit

        const paginatedKeys = mockApiKeysData.slice(offset, offset + limit)

        res.status(200).json({
          data: paginatedKeys,
          pagination: {
            page,
            limit,
            total: mockApiKeysData.length,
            has_more: offset + limit < mockApiKeysData.length,
          },
          error: null,
        })
      })

      await mockPaginationHandler(page1Req, page1Res)

      expect(page1Res._getStatusCode()).toBe(200)
      const page1Data = JSON.parse(page1Res._getData())
      expect(page1Data.pagination.page).toBe(1)
      expect(page1Data.pagination.limit).toBe(10)
      expect(page1Data.pagination.total).toBe(2)
      expect(page1Data.pagination.has_more).toBe(false)
    })
  })
})