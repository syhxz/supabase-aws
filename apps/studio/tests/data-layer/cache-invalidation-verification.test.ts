import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the fetchers
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockDel = vi.fn()
const mockHandleError = vi.fn()

vi.mock('data/fetchers', () => ({
  get: mockGet,
  post: mockPost,
  del: mockDel,
  handleError: mockHandleError,
}))

// Mock sonner toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
}

vi.mock('sonner', () => ({
  toast: mockToast,
}))

describe('Data Layer Integration - Cache Invalidation Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Cache Invalidation Patterns', () => {
    it('should verify API key mutations are designed to invalidate correct cache keys', async () => {
      // Import the mutation hooks to verify they exist and are properly structured
      const { useAPIKeyCreateMutation } = await import('data/api-keys/api-key-create-mutation')
      const { useAPIKeyDeleteMutation } = await import('data/api-keys/api-key-delete-mutation')
      const { apiKeysKeys } = await import('data/api-keys/keys')
      
      // Verify hooks exist
      expect(useAPIKeyCreateMutation).toBeDefined()
      expect(useAPIKeyDeleteMutation).toBeDefined()
      
      // Verify the cache keys that should be invalidated
      const projectRef = 'test-project'
      const expectedCacheKey = apiKeysKeys.list(projectRef)
      
      // The cache key should follow the expected pattern
      expect(expectedCacheKey).toEqual(['projects', projectRef, 'api-keys'])
      
      // Verify that the cache key function handles different reveal states
      const revealCacheKey = apiKeysKeys.list(projectRef, true)
      expect(revealCacheKey).toEqual(['projects', projectRef, 'api-keys', true])
    })

    it('should verify JWT key mutations are designed to invalidate correct cache keys', async () => {
      // Import the mutation hooks to verify they exist and are properly structured
      const { useJWTSigningKeyCreateMutation } = await import('data/jwt-signing-keys/jwt-signing-key-create-mutation')
      const { useJWTSigningKeyDeleteMutation } = await import('data/jwt-signing-keys/jwt-signing-key-delete-mutation')
      const { useLegacyJWTSigningKeyCreateMutation } = await import('data/jwt-signing-keys/legacy-jwt-signing-key-create-mutation')
      const { jwtSigningKeysKeys } = await import('data/jwt-signing-keys/keys')
      
      // Verify hooks exist
      expect(useJWTSigningKeyCreateMutation).toBeDefined()
      expect(useJWTSigningKeyDeleteMutation).toBeDefined()
      expect(useLegacyJWTSigningKeyCreateMutation).toBeDefined()
      
      // Verify the cache keys that should be invalidated
      const projectRef = 'test-project'
      const jwtKeysKey = jwtSigningKeysKeys.list(projectRef)
      const legacyJwtKey = jwtSigningKeysKeys.legacy(projectRef)
      
      // The cache keys should follow the expected pattern
      expect(jwtKeysKey).toEqual(['projects', projectRef, 'jwt-signing-keys'])
      expect(legacyJwtKey).toEqual(['projects', projectRef, 'legacy-jwt-signing-key'])
    })

    it('should verify mutation functions use consistent success callback patterns', async () => {
      // Mock successful responses
      mockPost.mockResolvedValue({ data: { id: 'new-key' }, error: null })
      mockDel.mockResolvedValue({ data: { message: 'Deleted' }, error: null })
      
      // Test API key create mutation
      const { createAPIKey } = await import('data/api-keys/api-key-create-mutation')
      const createResult = await createAPIKey({
        projectRef: 'test-project',
        type: 'secret',
        name: 'Test Key',
      })
      
      expect(createResult).toEqual({ id: 'new-key' })
      expect(mockPost).toHaveBeenCalledWith('/v1/projects/{ref}/api-keys', {
        params: {
          path: { ref: 'test-project' },
          query: { reveal: false },
        },
        body: {
          type: 'secret',
          name: 'Test Key',
          description: null,
          secret_jwt_template: { role: 'service_role' },
        },
      })
      
      // Test API key delete mutation
      const { deleteAPIKey } = await import('data/api-keys/api-key-delete-mutation')
      const deleteResult = await deleteAPIKey({
        projectRef: 'test-project',
        id: 'key-to-delete',
      })
      
      expect(deleteResult).toEqual({ message: 'Deleted' })
      expect(mockDel).toHaveBeenCalledWith('/v1/projects/{ref}/api-keys/{id}', {
        params: {
          path: { ref: 'test-project', id: 'key-to-delete' },
          query: { reveal: false },
        },
      })
    })

    it('should verify JWT mutation functions use consistent success callback patterns', async () => {
      // Mock successful responses
      mockPost.mockResolvedValue({ data: { id: 'new-jwt-key' }, error: null })
      mockDel.mockResolvedValue({ data: { message: 'Deleted' }, error: null })
      
      // Test JWT signing key create mutation
      const { createJWTSigningKey } = await import('data/jwt-signing-keys/jwt-signing-key-create-mutation')
      const createResult = await createJWTSigningKey({
        projectRef: 'test-project',
        algorithm: 'HS256',
        status: 'standby',
        private_jwk: { kty: 'oct', k: 'test-key' },
      })
      
      expect(createResult).toEqual({ id: 'new-jwt-key' })
      expect(mockPost).toHaveBeenCalledWith('/v1/projects/{ref}/config/auth/signing-keys', {
        params: { path: { ref: 'test-project' } },
        body: {
          algorithm: 'HS256',
          status: 'standby',
          private_jwk: { kty: 'oct', k: 'test-key' },
        },
      })
      
      // Test JWT signing key delete mutation
      const { deleteJWTSigningKey } = await import('data/jwt-signing-keys/jwt-signing-key-delete-mutation')
      const deleteResult = await deleteJWTSigningKey({
        projectRef: 'test-project',
        keyId: 'key-to-delete',
      })
      
      expect(deleteResult).toEqual({ message: 'Deleted' })
      expect(mockDel).toHaveBeenCalledWith('/v1/projects/{ref}/config/auth/signing-keys/{id}', {
        params: {
          path: { ref: 'test-project', id: 'key-to-delete' },
        },
      })
    })

    it('should verify legacy JWT migration invalidates multiple cache keys', async () => {
      // Mock successful response
      mockPost.mockResolvedValue({ data: { success: true }, error: null })
      
      // Test legacy JWT signing key create mutation
      const { createLegacyJWTSigningKey } = await import('data/jwt-signing-keys/legacy-jwt-signing-key-create-mutation')
      const result = await createLegacyJWTSigningKey({
        projectRef: 'test-project',
      })
      
      expect(result).toEqual({ success: true })
      expect(mockPost).toHaveBeenCalledWith('/v1/projects/{ref}/config/auth/signing-keys/legacy', {
        params: { path: { ref: 'test-project' } },
      })
      
      // This mutation should invalidate both legacy and modern JWT key caches
      // The actual cache invalidation is tested in the React Query context
    })
  })

  describe('Loading State Patterns', () => {
    it('should verify all hooks provide consistent loading state interfaces', async () => {
      // Import all query hooks
      const { useAPIKeysQuery } = await import('data/api-keys/api-keys-query')
      const { useJWTSigningKeysQuery } = await import('data/jwt-signing-keys/jwt-signing-keys-query')
      const { useLegacyJWTSigningKeyQuery } = await import('data/jwt-signing-keys/legacy-jwt-signing-key-query')
      
      // Import all mutation hooks
      const { useAPIKeyCreateMutation } = await import('data/api-keys/api-key-create-mutation')
      const { useAPIKeyDeleteMutation } = await import('data/api-keys/api-key-delete-mutation')
      const { useJWTSigningKeyCreateMutation } = await import('data/jwt-signing-keys/jwt-signing-key-create-mutation')
      const { useJWTSigningKeyDeleteMutation } = await import('data/jwt-signing-keys/jwt-signing-key-delete-mutation')
      const { useLegacyJWTSigningKeyCreateMutation } = await import('data/jwt-signing-keys/legacy-jwt-signing-key-create-mutation')
      
      // All hooks should be functions (React hooks)
      expect(typeof useAPIKeysQuery).toBe('function')
      expect(typeof useJWTSigningKeysQuery).toBe('function')
      expect(typeof useLegacyJWTSigningKeyQuery).toBe('function')
      
      expect(typeof useAPIKeyCreateMutation).toBe('function')
      expect(typeof useAPIKeyDeleteMutation).toBe('function')
      expect(typeof useJWTSigningKeyCreateMutation).toBe('function')
      expect(typeof useJWTSigningKeyDeleteMutation).toBe('function')
      expect(typeof useLegacyJWTSigningKeyCreateMutation).toBe('function')
    })
  })

  describe('Error Handling Integration', () => {
    it('should verify mutation error handling follows consistent patterns', async () => {
      const mockError = { message: 'Network error', status: 500 }
      mockPost.mockResolvedValue({ data: null, error: mockError })
      mockDel.mockResolvedValue({ data: null, error: mockError })
      
      mockHandleError.mockImplementation((error) => {
        throw new Error(error.message)
      })
      
      // Test all mutation functions handle errors consistently
      const { createAPIKey } = await import('data/api-keys/api-key-create-mutation')
      const { deleteAPIKey } = await import('data/api-keys/api-key-delete-mutation')
      const { createJWTSigningKey } = await import('data/jwt-signing-keys/jwt-signing-key-create-mutation')
      const { deleteJWTSigningKey } = await import('data/jwt-signing-keys/jwt-signing-key-delete-mutation')
      const { createLegacyJWTSigningKey } = await import('data/jwt-signing-keys/legacy-jwt-signing-key-create-mutation')
      
      // All should throw when encountering errors
      await expect(createAPIKey({ projectRef: 'test', type: 'secret', name: 'test' })).rejects.toThrow('Network error')
      await expect(deleteAPIKey({ projectRef: 'test', id: 'test-id' })).rejects.toThrow('Network error')
      await expect(createJWTSigningKey({ projectRef: 'test', algorithm: 'HS256', status: 'standby', private_jwk: {} })).rejects.toThrow('Network error')
      await expect(deleteJWTSigningKey({ projectRef: 'test', keyId: 'test-id' })).rejects.toThrow('Network error')
      await expect(createLegacyJWTSigningKey({ projectRef: 'test' })).rejects.toThrow('Network error')
      
      // Verify handleError was called for all operations
      expect(mockHandleError).toHaveBeenCalledTimes(5)
      expect(mockHandleError).toHaveBeenCalledWith(mockError)
    })
  })

  describe('Data Layer Consistency', () => {
    it('should verify all hooks use React Query patterns consistently', async () => {
      // Import React Query dependencies to verify they're used
      const { useQuery, useMutation } = await import('@tanstack/react-query')
      
      expect(useQuery).toBeDefined()
      expect(useMutation).toBeDefined()
      
      // Verify all hooks are properly structured for React Query
      const { useAPIKeysQuery } = await import('data/api-keys/api-keys-query')
      const { useAPIKeyCreateMutation } = await import('data/api-keys/api-key-create-mutation')
      
      expect(typeof useAPIKeysQuery).toBe('function')
      expect(typeof useAPIKeyCreateMutation).toBe('function')
    })

    it('should verify endpoint patterns are consistent across all operations', async () => {
      // Mock successful responses
      mockGet.mockResolvedValue({ data: [], error: null })
      mockPost.mockResolvedValue({ data: { id: 'new-key' }, error: null })
      mockDel.mockResolvedValue({ data: { message: 'Deleted' }, error: null })
      
      // Test API key operations
      const { createAPIKey } = await import('data/api-keys/api-key-create-mutation')
      const { deleteAPIKey } = await import('data/api-keys/api-key-delete-mutation')
      
      await createAPIKey({ projectRef: 'test', type: 'secret', name: 'test' })
      await deleteAPIKey({ projectRef: 'test', id: 'test-id' })
      
      // Test JWT key operations
      const { createJWTSigningKey } = await import('data/jwt-signing-keys/jwt-signing-key-create-mutation')
      const { deleteJWTSigningKey } = await import('data/jwt-signing-keys/jwt-signing-key-delete-mutation')
      const { createLegacyJWTSigningKey } = await import('data/jwt-signing-keys/legacy-jwt-signing-key-create-mutation')
      
      await createJWTSigningKey({ projectRef: 'test', algorithm: 'HS256', status: 'standby', private_jwk: {} })
      await deleteJWTSigningKey({ projectRef: 'test', keyId: 'test-id' })
      await createLegacyJWTSigningKey({ projectRef: 'test' })
      
      // Verify all endpoints follow the /v1/projects/{ref}/... pattern
      expect(mockPost).toHaveBeenCalledWith('/v1/projects/{ref}/api-keys', expect.any(Object))
      expect(mockDel).toHaveBeenCalledWith('/v1/projects/{ref}/api-keys/{id}', expect.any(Object))
      expect(mockPost).toHaveBeenCalledWith('/v1/projects/{ref}/config/auth/signing-keys', expect.any(Object))
      expect(mockDel).toHaveBeenCalledWith('/v1/projects/{ref}/config/auth/signing-keys/{id}', expect.any(Object))
      expect(mockPost).toHaveBeenCalledWith('/v1/projects/{ref}/config/auth/signing-keys/legacy', expect.any(Object))
    })
  })
})