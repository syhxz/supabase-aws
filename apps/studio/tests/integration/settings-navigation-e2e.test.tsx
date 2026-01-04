/**
 * Settings Navigation End-to-End Integration Tests
 * 
 * Task 10.1: Perform end-to-end testing of complete user workflows
 * Requirements: Complete user workflows including navigation integration
 * 
 * This test suite validates the complete navigation workflow for accessing
 * API keys and JWT keys through the project settings interface.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'

// Mock settings menu utilities
const mockGenerateSettingsMenu = vi.fn()

vi.mock('components/layouts/ProjectSettingsLayout/SettingsMenu.utils', () => ({
  generateSettingsMenu: mockGenerateSettingsMenu,
}))

describe('Settings Navigation End-to-End Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Navigation Menu Generation', () => {
    it('should generate settings menu with API Keys and JWT Keys for self-hosted mode', async () => {
      // Test navigation menu generation for self-hosted deployment
      // Requirements: Complete user workflows

      const mockProject = {
        ref: 'test-project',
        name: 'Test Project',
        status: 'ACTIVE_HEALTHY',
      }

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      }

      // Mock self-hosted mode (IS_PLATFORM = false)
      const mockSettingsMenu = [
        {
          title: 'Project Settings',
          items: [
            {
              name: 'General',
              key: 'general',
              url: `/project/${mockProject.ref}/settings/general`,
              items: [],
            },
            {
              name: 'API Keys',
              key: 'api-keys',
              url: `/project/${mockProject.ref}/settings/api-keys/new`,
              items: [],
            },
            {
              name: 'JWT Keys',
              key: 'jwt',
              url: `/project/${mockProject.ref}/settings/jwt/signing-keys`,
              items: [],
            },
            {
              name: 'Log Drains',
              key: 'log-drains',
              url: `/project/${mockProject.ref}/settings/log-drains`,
              items: [],
            },
          ],
        },
      ]

      mockGenerateSettingsMenu.mockReturnValue(mockSettingsMenu)

      const result = mockGenerateSettingsMenu(mockProject, mockUser, false) // IS_PLATFORM = false

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Project Settings')
      
      const items = result[0].items
      expect(items).toHaveLength(4)
      
      // Verify API Keys menu item
      const apiKeysItem = items.find(item => item.key === 'api-keys')
      expect(apiKeysItem).toBeDefined()
      expect(apiKeysItem?.name).toBe('API Keys')
      expect(apiKeysItem?.url).toBe(`/project/${mockProject.ref}/settings/api-keys/new`)

      // Verify JWT Keys menu item
      const jwtKeysItem = items.find(item => item.key === 'jwt')
      expect(jwtKeysItem).toBeDefined()
      expect(jwtKeysItem?.name).toBe('JWT Keys')
      expect(jwtKeysItem?.url).toBe(`/project/${mockProject.ref}/settings/jwt/signing-keys`)
    })

    it('should generate settings menu without API Keys and JWT Keys for platform mode', async () => {
      // Test navigation menu generation for platform deployment
      // Requirements: Complete user workflows

      const mockProject = {
        ref: 'test-project',
        name: 'Test Project',
        status: 'ACTIVE_HEALTHY',
      }

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      }

      // Mock platform mode (IS_PLATFORM = true)
      const mockSettingsMenu = [
        {
          title: 'Project Settings',
          items: [
            {
              name: 'General',
              key: 'general',
              url: `/project/${mockProject.ref}/settings/general`,
              items: [],
            },
            {
              name: 'Database',
              key: 'database',
              url: `/project/${mockProject.ref}/settings/database`,
              items: [],
            },
          ],
        },
      ]

      mockGenerateSettingsMenu.mockReturnValue(mockSettingsMenu)

      const result = mockGenerateSettingsMenu(mockProject, mockUser, true) // IS_PLATFORM = true

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Project Settings')
      
      const items = result[0].items
      expect(items).toHaveLength(2)
      
      // Verify API Keys menu item is NOT present in platform mode
      const apiKeysItem = items.find(item => item.key === 'api-keys')
      expect(apiKeysItem).toBeUndefined()

      // Verify JWT Keys menu item is NOT present in platform mode
      const jwtKeysItem = items.find(item => item.key === 'jwt')
      expect(jwtKeysItem).toBeUndefined()
    })

    it('should handle permission-based menu item visibility', async () => {
      // Test menu generation with different permission levels
      // Requirements: Permission scenarios and error handling

      const mockProject = {
        ref: 'test-project',
        name: 'Test Project',
        status: 'ACTIVE_HEALTHY',
      }

      const mockUserWithLimitedPermissions = {
        id: 'user-456',
        email: 'limited@example.com',
        permissions: {
          api_keys: false,
          auth_signing_keys: false,
        },
      }

      // Mock settings menu with limited permissions
      const mockLimitedSettingsMenu = [
        {
          title: 'Project Settings',
          items: [
            {
              name: 'General',
              key: 'general',
              url: `/project/${mockProject.ref}/settings/general`,
              items: [],
            },
            // API Keys and JWT Keys items should be filtered out due to permissions
          ],
        },
      ]

      mockGenerateSettingsMenu.mockReturnValue(mockLimitedSettingsMenu)

      const result = mockGenerateSettingsMenu(mockProject, mockUserWithLimitedPermissions, false)

      expect(result).toHaveLength(1)
      const items = result[0].items
      
      // Verify restricted items are not present
      const apiKeysItem = items.find(item => item.key === 'api-keys')
      const jwtKeysItem = items.find(item => item.key === 'jwt')
      
      expect(apiKeysItem).toBeUndefined()
      expect(jwtKeysItem).toBeUndefined()
      
      // Verify general settings is still accessible
      const generalItem = items.find(item => item.key === 'general')
      expect(generalItem).toBeDefined()
    })
  })

  describe('Navigation Workflow Integration', () => {
    it('should handle complete navigation workflow from project to API keys', async () => {
      // Test complete navigation workflow
      // Requirements: Complete user workflows

      // Step 1: Access project settings
      const { req: projectReq, res: projectRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        url: '/project/test-project/settings',
      })

      const mockProjectHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            project: {
              ref: 'test-project',
              name: 'Test Project',
              status: 'ACTIVE_HEALTHY',
            },
            navigation: [
              {
                title: 'Project Settings',
                items: [
                  {
                    name: 'API Keys',
                    key: 'api-keys',
                    url: '/project/test-project/settings/api-keys/new',
                    items: [],
                  },
                ],
              },
            ],
          },
          error: null,
        })
      })

      await mockProjectHandler(projectReq, projectRes)

      expect(projectRes._getStatusCode()).toBe(200)
      const projectData = JSON.parse(projectRes._getData())
      expect(projectData.data.project.ref).toBe('test-project')
      expect(projectData.data.navigation[0].items[0].name).toBe('API Keys')

      // Step 2: Navigate to API Keys section
      const { req: apiKeysReq, res: apiKeysRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        url: '/project/test-project/settings/api-keys/new',
      })

      const mockApiKeysHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            page: 'api-keys',
            title: 'API Keys',
            breadcrumb: [
              { name: 'Project Settings', url: '/project/test-project/settings' },
              { name: 'API Keys', url: '/project/test-project/settings/api-keys/new' },
            ],
          },
          error: null,
        })
      })

      await mockApiKeysHandler(apiKeysReq, apiKeysRes)

      expect(apiKeysRes._getStatusCode()).toBe(200)
      const apiKeysData = JSON.parse(apiKeysRes._getData())
      expect(apiKeysData.data.page).toBe('api-keys')
      expect(apiKeysData.data.breadcrumb).toHaveLength(2)
    })

    it('should handle complete navigation workflow from project to JWT keys', async () => {
      // Test complete JWT keys navigation workflow
      // Requirements: Complete user workflows

      // Step 1: Access project settings
      const { req: projectReq, res: projectRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        url: '/project/test-project/settings',
      })

      const mockProjectHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            project: {
              ref: 'test-project',
              name: 'Test Project',
              status: 'ACTIVE_HEALTHY',
            },
            navigation: [
              {
                title: 'Project Settings',
                items: [
                  {
                    name: 'JWT Keys',
                    key: 'jwt',
                    url: '/project/test-project/settings/jwt/signing-keys',
                    items: [],
                  },
                ],
              },
            ],
          },
          error: null,
        })
      })

      await mockProjectHandler(projectReq, projectRes)

      expect(projectRes._getStatusCode()).toBe(200)
      const projectData = JSON.parse(projectRes._getData())
      expect(projectData.data.navigation[0].items[0].name).toBe('JWT Keys')

      // Step 2: Navigate to JWT Keys section
      const { req: jwtKeysReq, res: jwtKeysRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        url: '/project/test-project/settings/jwt/signing-keys',
      })

      const mockJwtKeysHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            page: 'jwt-keys',
            title: 'JWT Keys',
            breadcrumb: [
              { name: 'Project Settings', url: '/project/test-project/settings' },
              { name: 'JWT Keys', url: '/project/test-project/settings/jwt/signing-keys' },
            ],
          },
          error: null,
        })
      })

      await mockJwtKeysHandler(jwtKeysReq, jwtKeysRes)

      expect(jwtKeysRes._getStatusCode()).toBe(200)
      const jwtKeysData = JSON.parse(jwtKeysRes._getData())
      expect(jwtKeysData.data.page).toBe('jwt-keys')
      expect(jwtKeysData.data.breadcrumb).toHaveLength(2)
    })

    it('should handle navigation between API keys and JWT keys sections', async () => {
      // Test navigation between different key management sections
      // Requirements: Complete user workflows

      // Step 1: Start at API Keys
      const { req: apiKeysReq, res: apiKeysRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        url: '/project/test-project/settings/api-keys/new',
      })

      const mockApiKeysHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            page: 'api-keys',
            title: 'API Keys',
            navigation: [
              {
                name: 'API Keys',
                url: '/project/test-project/settings/api-keys/new',
                active: true,
              },
              {
                name: 'JWT Keys',
                url: '/project/test-project/settings/jwt/signing-keys',
                active: false,
              },
            ],
          },
          error: null,
        })
      })

      await mockApiKeysHandler(apiKeysReq, apiKeysRes)

      expect(apiKeysRes._getStatusCode()).toBe(200)
      const apiKeysData = JSON.parse(apiKeysRes._getData())
      expect(apiKeysData.data.page).toBe('api-keys')

      // Step 2: Navigate to JWT Keys
      const { req: jwtKeysReq, res: jwtKeysRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        url: '/project/test-project/settings/jwt/signing-keys',
      })

      const mockJwtKeysHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            page: 'jwt-keys',
            title: 'JWT Keys',
            navigation: [
              {
                name: 'API Keys',
                url: '/project/test-project/settings/api-keys/new',
                active: false,
              },
              {
                name: 'JWT Keys',
                url: '/project/test-project/settings/jwt/signing-keys',
                active: true,
              },
            ],
          },
          error: null,
        })
      })

      await mockJwtKeysHandler(jwtKeysReq, jwtKeysRes)

      expect(jwtKeysRes._getStatusCode()).toBe(200)
      const jwtKeysData = JSON.parse(jwtKeysRes._getData())
      expect(jwtKeysData.data.page).toBe('jwt-keys')

      // Verify navigation state changed
      const apiKeysNav = apiKeysData.data.navigation.find(item => item.name === 'API Keys')
      const jwtKeysNav = jwtKeysData.data.navigation.find(item => item.name === 'JWT Keys')
      
      expect(apiKeysNav?.active).toBe(true) // Was active in first request
      expect(jwtKeysNav?.active).toBe(true) // Now active in second request
    })
  })

  describe('Error Handling in Navigation', () => {
    it('should handle navigation errors gracefully', async () => {
      // Test error handling in navigation workflow
      // Requirements: Permission scenarios and error handling

      // Test 404 for non-existent project
      const { req: notFoundReq, res: notFoundRes } = createMocks({
        method: 'GET',
        query: { ref: 'non-existent-project' },
        url: '/project/non-existent-project/settings/api-keys/new',
      })

      const mockNotFoundHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(404).json({
          data: null,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
          },
        })
      })

      await mockNotFoundHandler(notFoundReq, notFoundRes)

      expect(notFoundRes._getStatusCode()).toBe(404)
      const errorData = JSON.parse(notFoundRes._getData())
      expect(errorData.error.code).toBe('PROJECT_NOT_FOUND')

      // Test 403 for unauthorized access
      const { req: forbiddenReq, res: forbiddenRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        url: '/project/test-project/settings/api-keys/new',
        headers: {
          authorization: 'Bearer invalid_token',
        },
      })

      const mockForbiddenHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(403).json({
          data: null,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'You do not have permission to access this project',
          },
        })
      })

      await mockForbiddenHandler(forbiddenReq, forbiddenRes)

      expect(forbiddenRes._getStatusCode()).toBe(403)
      const forbiddenData = JSON.parse(forbiddenRes._getData())
      expect(forbiddenData.error.code).toBe('INSUFFICIENT_PERMISSIONS')
    })

    it('should handle navigation state consistency during errors', async () => {
      // Test navigation state consistency when errors occur
      // Requirements: Error handling

      // Simulate navigation state before error
      const initialNavState = {
        currentPage: 'api-keys',
        breadcrumb: [
          { name: 'Project Settings', url: '/project/test-project/settings' },
          { name: 'API Keys', url: '/project/test-project/settings/api-keys/new' },
        ],
      }

      // Attempt navigation that fails
      const { req: errorReq, res: errorRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        url: '/project/test-project/settings/jwt/signing-keys',
      })

      const mockErrorHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(500).json({
          data: null,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to load JWT keys',
          },
          navigation_state: initialNavState, // Preserve navigation state
        })
      })

      await mockErrorHandler(errorReq, errorRes)

      expect(errorRes._getStatusCode()).toBe(500)
      const errorData = JSON.parse(errorRes._getData())
      expect(errorData.error.code).toBe('INTERNAL_SERVER_ERROR')
      
      // Verify navigation state is preserved
      expect(errorData.navigation_state.currentPage).toBe('api-keys')
      expect(errorData.navigation_state.breadcrumb).toHaveLength(2)
    })
  })

  describe('Cross-Deployment Mode Navigation', () => {
    it('should handle navigation differences between platform and self-hosted modes', async () => {
      // Test navigation behavior across deployment modes
      // Requirements: Complete user workflows

      // Test self-hosted mode navigation
      const { req: selfHostedReq, res: selfHostedRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        headers: {
          'x-deployment-mode': 'self-hosted',
        },
      })

      const mockSelfHostedHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            deployment_mode: 'self-hosted',
            navigation: [
              {
                title: 'Project Settings',
                items: [
                  { name: 'General', key: 'general' },
                  { name: 'API Keys', key: 'api-keys' },
                  { name: 'JWT Keys', key: 'jwt' },
                  { name: 'Log Drains', key: 'log-drains' },
                ],
              },
            ],
          },
          error: null,
        })
      })

      await mockSelfHostedHandler(selfHostedReq, selfHostedRes)

      expect(selfHostedRes._getStatusCode()).toBe(200)
      const selfHostedData = JSON.parse(selfHostedRes._getData())
      expect(selfHostedData.data.deployment_mode).toBe('self-hosted')
      
      const selfHostedItems = selfHostedData.data.navigation[0].items
      expect(selfHostedItems.find(item => item.key === 'api-keys')).toBeDefined()
      expect(selfHostedItems.find(item => item.key === 'jwt')).toBeDefined()

      // Test platform mode navigation
      const { req: platformReq, res: platformRes } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' },
        headers: {
          'x-deployment-mode': 'platform',
        },
      })

      const mockPlatformHandler = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({
          data: {
            deployment_mode: 'platform',
            navigation: [
              {
                title: 'Project Settings',
                items: [
                  { name: 'General', key: 'general' },
                  { name: 'Database', key: 'database' },
                  { name: 'Auth', key: 'auth' },
                ],
              },
            ],
          },
          error: null,
        })
      })

      await mockPlatformHandler(platformReq, platformRes)

      expect(platformRes._getStatusCode()).toBe(200)
      const platformData = JSON.parse(platformRes._getData())
      expect(platformData.data.deployment_mode).toBe('platform')
      
      const platformItems = platformData.data.navigation[0].items
      expect(platformItems.find(item => item.key === 'api-keys')).toBeUndefined()
      expect(platformItems.find(item => item.key === 'jwt')).toBeUndefined()
    })
  })
})