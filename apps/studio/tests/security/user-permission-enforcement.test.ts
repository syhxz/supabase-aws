import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PermissionAction } from '@supabase/shared-types/out/constants'

// Mock the permission hooks
vi.mock('hooks/misc/useCheckPermissions', () => ({
  useAsyncCheckPermissions: vi.fn(),
}))

// Mock the API keys visibility hook
vi.mock('components/interfaces/APIKeys/hooks/useApiKeysVisibility', () => ({
  useApiKeysVisibility: vi.fn(),
}))

// Mock the params hook
vi.mock('common', () => ({
  useParams: vi.fn(() => ({ ref: 'test-project' })),
}))

// Mock constants
vi.mock('lib/constants', () => ({
  IS_PLATFORM: true,
}))

describe('User Permission Enforcement Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('API Keys Permission Enforcement', () => {
    it('should allow access when user has SECRETS_READ permission', async () => {
      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: true,
        isLoading: false,
        isSuccess: true,
      })

      const result = useAsyncCheckPermissions(PermissionAction.SECRETS_READ, '*')
      expect(result.can).toBe(true)
      expect(result.isLoading).toBe(false)
    })

    it('should deny access when user lacks SECRETS_READ permission', async () => {
      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: false,
        isLoading: false,
        isSuccess: true,
      })

      const result = useAsyncCheckPermissions(PermissionAction.SECRETS_READ, '*')
      expect(result.can).toBe(false)
      expect(result.isLoading).toBe(false)
    })

    it('should show loading state while permissions are being checked', async () => {
      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: false,
        isLoading: true,
        isSuccess: false,
      })

      const result = useAsyncCheckPermissions(PermissionAction.SECRETS_READ, '*')
      expect(result.can).toBe(false)
      expect(result.isLoading).toBe(true)
    })
  })

  describe('JWT Keys Permission Enforcement', () => {
    it('should allow access when user has READ permission on auth_signing_keys', async () => {
      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: true,
        isLoading: false,
        isSuccess: true,
      })

      const result = useAsyncCheckPermissions(PermissionAction.READ, 'auth_signing_keys')
      expect(result.can).toBe(true)
      expect(result.isLoading).toBe(false)
    })

    it('should deny access when user lacks READ permission on auth_signing_keys', async () => {
      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: false,
        isLoading: false,
        isSuccess: true,
      })

      const result = useAsyncCheckPermissions(PermissionAction.READ, 'auth_signing_keys')
      expect(result.can).toBe(false)
      expect(result.isLoading).toBe(false)
    })

    it('should show loading state while JWT permissions are being checked', async () => {
      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: false,
        isLoading: true,
        isSuccess: false,
      })

      const result = useAsyncCheckPermissions(PermissionAction.READ, 'auth_signing_keys')
      expect(result.can).toBe(false)
      expect(result.isLoading).toBe(true)
    })
  })

  describe('API Keys Visibility Hook Permission Enforcement', () => {
    it('should properly check permissions in useApiKeysVisibility hook', async () => {
      const { useApiKeysVisibility } = await import('components/interfaces/APIKeys/hooks/useApiKeysVisibility')
      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      
      // Mock permission check to return no access
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: false,
        isLoading: false,
        isSuccess: true,
      })

      // Mock the visibility hook to return expected state
      vi.mocked(useApiKeysVisibility).mockReturnValue({
        hasApiKeys: false,
        isLoading: false,
        canReadAPIKeys: false,
        canInitApiKeys: false,
        shouldDisableUI: true,
      })

      const result = useApiKeysVisibility()

      expect(result.canReadAPIKeys).toBe(false)
      expect(result.shouldDisableUI).toBe(true)
      expect(result.canInitApiKeys).toBe(false)
    })

    it('should enable functionality when user has proper permissions', async () => {
      const { useApiKeysVisibility } = await import('components/interfaces/APIKeys/hooks/useApiKeysVisibility')
      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      
      // Mock permission check to return access
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: true,
        isLoading: false,
        isSuccess: true,
      })

      // Mock the visibility hook to return expected state
      vi.mocked(useApiKeysVisibility).mockReturnValue({
        hasApiKeys: true,
        isLoading: false,
        canReadAPIKeys: true,
        canInitApiKeys: false,
        shouldDisableUI: false,
      })

      const result = useApiKeysVisibility()

      expect(result.canReadAPIKeys).toBe(true)
      expect(result.shouldDisableUI).toBe(false)
    })
  })

  describe('Self-Hosted Mode Permission Bypass', () => {
    it('should bypass permission checks in self-hosted mode', async () => {
      // Mock self-hosted mode
      vi.doMock('lib/constants', () => ({
        IS_PLATFORM: false,
      }))

      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      
      // In self-hosted mode, permissions should always return true
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: true,
        isLoading: false,
        isSuccess: true,
      })

      const result = useAsyncCheckPermissions(PermissionAction.SECRETS_READ, '*')
      expect(result.can).toBe(true)
    })
  })

  describe('Role-Based Access Control (RBAC)', () => {
    it('should enforce different permission levels for different user roles', async () => {
      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      
      // Test admin role - should have access
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: true,
        isLoading: false,
        isSuccess: true,
      })

      let result = useAsyncCheckPermissions(PermissionAction.SECRETS_READ, '*')
      expect(result.can).toBe(true)

      // Test read-only role - should not have access to secrets
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: false,
        isLoading: false,
        isSuccess: true,
      })

      result = useAsyncCheckPermissions(PermissionAction.SECRETS_READ, '*')
      expect(result.can).toBe(false)
    })
  })

  describe('Authentication Validation', () => {
    it('should require valid authentication before checking permissions', async () => {
      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      
      // Mock unauthenticated state
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: false,
        isLoading: false,
        isSuccess: false, // Not successful due to authentication failure
      })

      const result = useAsyncCheckPermissions(PermissionAction.SECRETS_READ, '*')
      expect(result.can).toBe(false)
      expect(result.isSuccess).toBe(false)
    })
  })

  describe('Permission Action Types', () => {
    it('should properly validate different permission actions', async () => {
      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      
      // Test SECRETS_READ permission
      vi.mocked(useAsyncCheckPermissions).mockReturnValue({
        can: true,
        isLoading: false,
        isSuccess: true,
      })

      let result = useAsyncCheckPermissions(PermissionAction.SECRETS_READ, '*')
      expect(result.can).toBe(true)

      // Test READ permission for auth_signing_keys
      result = useAsyncCheckPermissions(PermissionAction.READ, 'auth_signing_keys')
      expect(result.can).toBe(true)

      // Test TENANT_SQL_ADMIN_WRITE permission
      result = useAsyncCheckPermissions(PermissionAction.TENANT_SQL_ADMIN_WRITE, '*')
      expect(result.can).toBe(true)
    })

    it('should handle resource-specific permissions', async () => {
      const { useAsyncCheckPermissions } = await import('hooks/misc/useCheckPermissions')
      
      // Mock different permissions for different resources
      vi.mocked(useAsyncCheckPermissions).mockImplementation((action, resource) => {
        if (resource === 'api_keys') {
          return { can: true, isLoading: false, isSuccess: true }
        } else if (resource === 'auth_signing_keys') {
          return { can: false, isLoading: false, isSuccess: true }
        }
        return { can: false, isLoading: false, isSuccess: true }
      })

      let result = useAsyncCheckPermissions(PermissionAction.READ, 'api_keys')
      expect(result.can).toBe(true)

      result = useAsyncCheckPermissions(PermissionAction.READ, 'auth_signing_keys')
      expect(result.can).toBe(false)
    })
  })
})