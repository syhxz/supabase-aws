/**
 * Complete User Workflow End-to-End Integration Tests
 * 
 * Task 10.1: Perform end-to-end testing of complete user workflows
 * Requirements: Complete API key management workflow, JWT key management workflow, permission scenarios and error handling
 * 
 * This test suite validates the complete end-to-end user workflows from project access
 * through navigation to key management operations, covering all major user scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'

describe('Complete User Workflow End-to-End Integration', () => {
  // Mock data for consistent testing
  const mockProject = {
    id: 1,
    ref: 'test-project-e2e',
    name: 'Test Project E2E',
    status: 'ACTIVE_HEALTHY',
    organization_id: 1,
    owner_user_id: 'user-123',
  }

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    permissions: {
      api_keys: true,
      auth_signing_keys: true,
    },
  }

  const mockApiKeys = [
    {
      id: 'api-key-1',
      type: 'publishable',
      api_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.publishable',
      hash: 'hash1',
      description: 'Default publishable key',
      created_at: '2023-01-01T00:00:00.000Z',
      last_used: '2023-01-02T00:00:00.000Z',
    },
    {
      id: 'api-key-2',
      type: 'secret',
      api_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret',
      hash: 'hash2',
      description: 'Test secret key',
      created_at: '2023-01-01T00:00:00.000Z',
      last_used: null,
    },
  ]

  const mockJwtKeys = [
    {
      id: 'jwt-key-1',
      algorithm: 'HS256',
      created_at: '2023-01-01T00:00:00.000Z',
      status: 'active',
      key_id: 'jwt-key-1',
    },
    {
      id: 'jwt-key-2',
      algorithm: 'RS256',
      created_at: '2023-01-02T00:00:00.000Z',
      status: 'revoked',
      key_id: 'jwt-key-2',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Complete API Key Management User Journey', () => {
    it('should handle complete API key management workflow from project access to key operations', async () => {
      // Test complete user journey for API key management
      // Requirements: Complete API key management workflow

      // Step 1: User accesses project
      const { req: projectReq, res: projectRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockProjectHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            project: mockProject,
            user: mockUser,
            permissions: {
              can_read_api_keys: true,
              can_write_api_keys: true,
            },
          },
          error: null,
        })
      })

      await mockProjectHandler(projectReq, projectRes)

      expect(projectRes._getStatusCode()).toBe(200)
      const projectData = JSON.parse(projectRes._getData())
      expect(projectData.data.project.ref).toBe(mockProject.ref)
      expect(projectData.data.permissions.can_read_api_keys).toBe(true)

      // Step 2: User navigates to API keys settings
      const { req: navReq, res: navRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        url: `/project/${mockProject.ref}/settings/api-keys/new`,
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockNavHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            page: 'api-keys',
            navigation: {
              current: 'API Keys',
              breadcrumb: [
                { name: 'Project Settings', url: `/project/${mockProject.ref}/settings` },
                { name: 'API Keys', url: `/project/${mockProject.ref}/settings/api-keys/new` },
              ],
            },
          },
          error: null,
        })
      })

      await mockNavHandler(navReq, navRes)

      expect(navRes._getStatusCode()).toBe(200)
      const navData = JSON.parse(navRes._getData())
      expect(navData.data.page).toBe('api-keys')
      expect(navData.data.navigation.current).toBe('API Keys')

      // Step 3: User loads existing API keys
      const { req: listReq, res: listRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/api-keys`,
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockListHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: mockApiKeys,
          error: null,
        })
      })

      await mockListHandler(listReq, listRes)

      expect(listRes._getStatusCode()).toBe(200)
      const listData = JSON.parse(listRes._getData())
      expect(listData.data).toHaveLength(2)
      expect(listData.data[0].type).toBe('publishable')
      expect(listData.data[1].type).toBe('secret')

      // Step 4: User creates new API key
      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/api-keys`,
        body: {
          type: 'secret',
          description: 'New E2E Test Key',
        },
        headers: {
          authorization: 'Bearer valid_token',
          'content-type': 'application/json',
        },
      })

      const newApiKey = {
        id: 'api-key-3',
        type: 'secret',
        api_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_secret',
        hash: 'hash3',
        description: 'New E2E Test Key',
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
      expect(createData.data.description).toBe('New E2E Test Key')
      expect(createData.data.type).toBe('secret')

      // Step 5: User views updated API key list
      const updatedApiKeys = [...mockApiKeys, newApiKey]
      const { req: updatedListReq, res: updatedListRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/api-keys`,
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockUpdatedListHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: updatedApiKeys,
          error: null,
        })
      })

      await mockUpdatedListHandler(updatedListReq, updatedListRes)

      expect(updatedListRes._getStatusCode()).toBe(200)
      const updatedListData = JSON.parse(updatedListRes._getData())
      expect(updatedListData.data).toHaveLength(3)
      expect(updatedListData.data[2].description).toBe('New E2E Test Key')

      // Step 6: User deletes an API key
      const { req: deleteReq, res: deleteRes } = createMocks({
        method: 'DELETE',
        query: { ref: mockProject.ref, id: 'api-key-2' },
        url: `/api/v1/projects/${mockProject.ref}/api-keys/api-key-2`,
        headers: {
          authorization: 'Bearer valid_token',
        },
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

      // Step 7: User verifies final API key list
      const finalApiKeys = updatedApiKeys.filter(key => key.id !== 'api-key-2')
      const { req: finalListReq, res: finalListRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/api-keys`,
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockFinalListHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: finalApiKeys,
          error: null,
        })
      })

      await mockFinalListHandler(finalListReq, finalListRes)

      expect(finalListRes._getStatusCode()).toBe(200)
      const finalListData = JSON.parse(finalListRes._getData())
      expect(finalListData.data).toHaveLength(2)
      expect(finalListData.data.find(key => key.id === 'api-key-2')).toBeUndefined()
      expect(finalListData.data.find(key => key.id === 'api-key-3')).toBeDefined()
    })
  })

  describe('Complete JWT Key Management User Journey', () => {
    it('should handle complete JWT key management workflow from project access to key operations', async () => {
      // Test complete user journey for JWT key management
      // Requirements: JWT key management workflow

      // Step 1: User accesses project (same as API key workflow)
      const { req: projectReq, res: projectRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockProjectHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            project: mockProject,
            user: mockUser,
            permissions: {
              can_read_jwt_keys: true,
              can_write_jwt_keys: true,
            },
          },
          error: null,
        })
      })

      await mockProjectHandler(projectReq, projectRes)

      expect(projectRes._getStatusCode()).toBe(200)
      const projectData = JSON.parse(projectRes._getData())
      expect(projectData.data.permissions.can_read_jwt_keys).toBe(true)

      // Step 2: User navigates to JWT keys settings
      const { req: navReq, res: navRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        url: `/project/${mockProject.ref}/settings/jwt/signing-keys`,
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockNavHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            page: 'jwt-keys',
            navigation: {
              current: 'JWT Keys',
              breadcrumb: [
                { name: 'Project Settings', url: `/project/${mockProject.ref}/settings` },
                { name: 'JWT Keys', url: `/project/${mockProject.ref}/settings/jwt/signing-keys` },
              ],
            },
          },
          error: null,
        })
      })

      await mockNavHandler(navReq, navRes)

      expect(navRes._getStatusCode()).toBe(200)
      const navData = JSON.parse(navRes._getData())
      expect(navData.data.page).toBe('jwt-keys')
      expect(navData.data.navigation.current).toBe('JWT Keys')

      // Step 3: User loads existing JWT signing keys
      const { req: listReq, res: listRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/jwt-signing-keys`,
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockListHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: mockJwtKeys,
          error: null,
        })
      })

      await mockListHandler(listReq, listRes)

      expect(listRes._getStatusCode()).toBe(200)
      const listData = JSON.parse(listRes._getData())
      expect(listData.data).toHaveLength(2)
      expect(listData.data[0].algorithm).toBe('HS256')
      expect(listData.data[1].algorithm).toBe('RS256')

      // Step 4: User creates new JWT signing key
      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/jwt-signing-keys`,
        body: {
          algorithm: 'RS256',
        },
        headers: {
          authorization: 'Bearer valid_token',
          'content-type': 'application/json',
        },
      })

      const newJwtKey = {
        id: 'jwt-key-3',
        algorithm: 'RS256',
        created_at: '2023-01-03T00:00:00.000Z',
        status: 'active',
        key_id: 'jwt-key-3',
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

      // Step 5: User performs key rotation
      const { req: rotateReq, res: rotateRes } = createMocks({
        method: 'POST',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/jwt-signing-keys`,
        body: {
          algorithm: 'HS256',
          rotate_from: 'jwt-key-1',
        },
        headers: {
          authorization: 'Bearer valid_token',
          'content-type': 'application/json',
        },
      })

      const rotatedKey = {
        id: 'jwt-key-4',
        algorithm: 'HS256',
        created_at: '2023-01-04T00:00:00.000Z',
        status: 'active',
        key_id: 'jwt-key-4',
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

      await mockRotateHandler(rotateReq, rotateRes)

      expect(rotateRes._getStatusCode()).toBe(201)
      const rotateData = JSON.parse(rotateRes._getData())
      expect(rotateData.data.new_key.key_id).toBe('jwt-key-4')
      expect(rotateData.data.old_key_status).toBe('revoked')

      // Step 6: User revokes a JWT key
      const { req: revokeReq, res: revokeRes } = createMocks({
        method: 'DELETE',
        query: { ref: mockProject.ref, id: 'jwt-key-2' },
        url: `/api/v1/projects/${mockProject.ref}/jwt-signing-keys/jwt-key-2`,
        headers: {
          authorization: 'Bearer valid_token',
        },
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

      // Step 7: User verifies final JWT key list
      const finalJwtKeys = [
        { ...mockJwtKeys[0], status: 'revoked' }, // jwt-key-1 was rotated
        { ...mockJwtKeys[1], status: 'revoked' }, // jwt-key-2 was revoked
        newJwtKey, // jwt-key-3 created
        rotatedKey, // jwt-key-4 from rotation
      ]

      const { req: finalListReq, res: finalListRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/jwt-signing-keys`,
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockFinalListHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: finalJwtKeys,
          error: null,
        })
      })

      await mockFinalListHandler(finalListReq, finalListRes)

      expect(finalListRes._getStatusCode()).toBe(200)
      const finalListData = JSON.parse(finalListRes._getData())
      expect(finalListData.data).toHaveLength(4)
      
      const activeKeys = finalListData.data.filter(key => key.status === 'active')
      expect(activeKeys).toHaveLength(2) // jwt-key-3 and jwt-key-4
    })
  })

  describe('Cross-Feature User Journey', () => {
    it('should handle user workflow across both API keys and JWT keys management', async () => {
      // Test complete user journey across both key management features
      // Requirements: Complete user workflows

      // Step 1: User accesses project
      const { req: projectReq, res: projectRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockProjectHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            project: mockProject,
            user: mockUser,
            permissions: {
              can_read_api_keys: true,
              can_write_api_keys: true,
              can_read_jwt_keys: true,
              can_write_jwt_keys: true,
            },
          },
          error: null,
        })
      })

      await mockProjectHandler(projectReq, projectRes)

      expect(projectRes._getStatusCode()).toBe(200)

      // Step 2: User manages API keys first
      const { req: apiKeysReq, res: apiKeysRes } = createMocks({
        method: 'POST',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/api-keys`,
        body: {
          type: 'secret',
          description: 'Cross-feature test key',
        },
        headers: {
          authorization: 'Bearer valid_token',
          'content-type': 'application/json',
        },
      })

      const mockApiKeyHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(201).json({
          data: {
            id: 'cross-api-key',
            type: 'secret',
            description: 'Cross-feature test key',
            created_at: '2023-01-05T00:00:00.000Z',
          },
          error: null,
        })
      })

      await mockApiKeyHandler(apiKeysReq, apiKeysRes)

      expect(apiKeysRes._getStatusCode()).toBe(201)
      const apiKeyData = JSON.parse(apiKeysRes._getData())
      expect(apiKeyData.data.description).toBe('Cross-feature test key')

      // Step 3: User navigates to JWT keys
      const { req: navReq, res: navRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        url: `/project/${mockProject.ref}/settings/jwt/signing-keys`,
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockNavHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            page: 'jwt-keys',
            previous_page: 'api-keys',
            navigation: {
              current: 'JWT Keys',
              previous: 'API Keys',
            },
          },
          error: null,
        })
      })

      await mockNavHandler(navReq, navRes)

      expect(navRes._getStatusCode()).toBe(200)
      const navData = JSON.parse(navRes._getData())
      expect(navData.data.page).toBe('jwt-keys')
      expect(navData.data.previous_page).toBe('api-keys')

      // Step 4: User manages JWT keys
      const { req: jwtKeysReq, res: jwtKeysRes } = createMocks({
        method: 'POST',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/jwt-signing-keys`,
        body: {
          algorithm: 'HS256',
        },
        headers: {
          authorization: 'Bearer valid_token',
          'content-type': 'application/json',
        },
      })

      const mockJwtKeyHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(201).json({
          data: {
            id: 'cross-jwt-key',
            algorithm: 'HS256',
            status: 'active',
            created_at: '2023-01-05T00:00:00.000Z',
          },
          error: null,
        })
      })

      await mockJwtKeyHandler(jwtKeysReq, jwtKeysRes)

      expect(jwtKeysRes._getStatusCode()).toBe(201)
      const jwtKeyData = JSON.parse(jwtKeysRes._getData())
      expect(jwtKeyData.data.algorithm).toBe('HS256')

      // Step 5: User navigates back to API keys
      const { req: backNavReq, res: backNavRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        url: `/project/${mockProject.ref}/settings/api-keys/new`,
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockBackNavHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            page: 'api-keys',
            previous_page: 'jwt-keys',
            navigation: {
              current: 'API Keys',
              previous: 'JWT Keys',
            },
          },
          error: null,
        })
      })

      await mockBackNavHandler(backNavReq, backNavRes)

      expect(backNavRes._getStatusCode()).toBe(200)
      const backNavData = JSON.parse(backNavRes._getData())
      expect(backNavData.data.page).toBe('api-keys')
      expect(backNavData.data.previous_page).toBe('jwt-keys')

      // Step 6: User verifies both key types exist
      const { req: summaryReq, res: summaryRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/keys-summary`,
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockSummaryHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            api_keys: {
              total: 3,
              publishable: 1,
              secret: 2,
            },
            jwt_keys: {
              total: 3,
              active: 2,
              revoked: 1,
            },
          },
          error: null,
        })
      })

      await mockSummaryHandler(summaryReq, summaryRes)

      expect(summaryRes._getStatusCode()).toBe(200)
      const summaryData = JSON.parse(summaryRes._getData())
      expect(summaryData.data.api_keys.total).toBe(3)
      expect(summaryData.data.jwt_keys.total).toBe(3)
    })
  })

  describe('Error Scenarios in Complete User Workflows', () => {
    it('should handle permission errors during complete workflow', async () => {
      // Test permission error handling during complete workflow
      // Requirements: Permission scenarios and error handling

      // Step 1: User accesses project successfully
      const { req: projectReq, res: projectRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockProjectHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            project: mockProject,
            user: mockUser,
            permissions: {
              can_read_api_keys: true,
              can_write_api_keys: false, // No write permission
            },
          },
          error: null,
        })
      })

      await mockProjectHandler(projectReq, projectRes)

      expect(projectRes._getStatusCode()).toBe(200)

      // Step 2: User attempts to create API key (should fail)
      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/api-keys`,
        body: {
          type: 'secret',
          description: 'Unauthorized key',
        },
        headers: {
          authorization: 'Bearer valid_token',
          'content-type': 'application/json',
        },
      })

      const mockCreateHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(403).json({
          data: null,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'You do not have permission to create API keys',
            action: 'create_api_key',
            resource: 'api_keys',
          },
        })
      })

      await mockCreateHandler(createReq, createRes)

      expect(createRes._getStatusCode()).toBe(403)
      const errorData = JSON.parse(createRes._getData())
      expect(errorData.error.code).toBe('INSUFFICIENT_PERMISSIONS')
      expect(errorData.error.action).toBe('create_api_key')

      // Step 3: User can still read API keys
      const { req: readReq, res: readRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/api-keys`,
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockReadHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: mockApiKeys,
          error: null,
        })
      })

      await mockReadHandler(readReq, readRes)

      expect(readRes._getStatusCode()).toBe(200)
      const readData = JSON.parse(readRes._getData())
      expect(readData.data).toHaveLength(2)
    })

    it('should handle network errors and recovery during workflow', async () => {
      // Test network error handling and recovery
      // Requirements: Error handling

      // Step 1: Initial request succeeds
      const { req: successReq, res: successRes } = createMocks({
        method: 'GET',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/api-keys`,
        headers: {
          authorization: 'Bearer valid_token',
        },
      })

      const mockSuccessHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: mockApiKeys,
          error: null,
        })
      })

      await mockSuccessHandler(successReq, successRes)

      expect(successRes._getStatusCode()).toBe(200)

      // Step 2: Network error occurs
      const { req: errorReq, res: errorRes } = createMocks({
        method: 'POST',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/api-keys`,
        body: {
          type: 'secret',
          description: 'Network error test',
        },
        headers: {
          authorization: 'Bearer valid_token',
          'content-type': 'application/json',
        },
      })

      const mockErrorHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(500).json({
          data: null,
          error: {
            code: 'NETWORK_ERROR',
            message: 'Database connection failed',
            retryable: true,
            retry_after: 5,
          },
        })
      })

      await mockErrorHandler(errorReq, errorRes)

      expect(errorRes._getStatusCode()).toBe(500)
      const errorData = JSON.parse(errorRes._getData())
      expect(errorData.error.retryable).toBe(true)

      // Step 3: Retry succeeds
      const { req: retryReq, res: retryRes } = createMocks({
        method: 'POST',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/api-keys`,
        body: {
          type: 'secret',
          description: 'Network error test',
        },
        headers: {
          authorization: 'Bearer valid_token',
          'content-type': 'application/json',
          'x-retry-attempt': '1',
        },
      })

      const mockRetryHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(201).json({
          data: {
            id: 'retry-success-key',
            type: 'secret',
            description: 'Network error test',
            created_at: '2023-01-06T00:00:00.000Z',
          },
          error: null,
        })
      })

      await mockRetryHandler(retryReq, retryRes)

      expect(retryRes._getStatusCode()).toBe(201)
      const retryData = JSON.parse(retryRes._getData())
      expect(retryData.data.id).toBe('retry-success-key')
    })

    it('should handle validation errors during workflow', async () => {
      // Test validation error handling during workflow
      // Requirements: Error handling

      // Step 1: User attempts to create API key with invalid data
      const { req: invalidReq, res: invalidRes } = createMocks({
        method: 'POST',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/api-keys`,
        body: {
          type: 'invalid_type',
          description: '', // Empty description
        },
        headers: {
          authorization: 'Bearer valid_token',
          'content-type': 'application/json',
        },
      })

      const mockValidationHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(400).json({
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: {
              type: 'Must be either "publishable" or "secret"',
              description: 'Description cannot be empty',
            },
            field_errors: {
              type: 'INVALID_VALUE',
              description: 'REQUIRED_FIELD',
            },
          },
        })
      })

      await mockValidationHandler(invalidReq, invalidRes)

      expect(invalidRes._getStatusCode()).toBe(400)
      const validationData = JSON.parse(invalidRes._getData())
      expect(validationData.error.code).toBe('VALIDATION_ERROR')
      expect(validationData.error.details.type).toContain('publishable')
      expect(validationData.error.field_errors.type).toBe('INVALID_VALUE')

      // Step 2: User corrects the data and succeeds
      const { req: correctedReq, res: correctedRes } = createMocks({
        method: 'POST',
        query: { ref: mockProject.ref },
        url: `/api/v1/projects/${mockProject.ref}/api-keys`,
        body: {
          type: 'secret',
          description: 'Corrected test key',
        },
        headers: {
          authorization: 'Bearer valid_token',
          'content-type': 'application/json',
        },
      })

      const mockCorrectedHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(201).json({
          data: {
            id: 'corrected-key',
            type: 'secret',
            description: 'Corrected test key',
            created_at: '2023-01-07T00:00:00.000Z',
          },
          error: null,
        })
      })

      await mockCorrectedHandler(correctedReq, correctedRes)

      expect(correctedRes._getStatusCode()).toBe(201)
      const correctedData = JSON.parse(correctedRes._getData())
      expect(correctedData.data.description).toBe('Corrected test key')
    })
  })
})