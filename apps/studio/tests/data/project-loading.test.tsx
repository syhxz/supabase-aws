import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

import { useOrgProjectsInfiniteQuery } from 'data/projects/org-projects-infinite-query'
import { useProjectsInfiniteQuery } from 'data/projects/projects-infinite-query'

// Mock the common module
vi.mock('common', () => ({
  useIsLoggedIn: vi.fn(),
  useParams: vi.fn(() => ({})),
}))

// Mock the profile module
vi.mock('lib/profile', () => ({
  useProfile: vi.fn(),
}))

// Mock the fetchers
vi.mock('data/fetchers', () => ({
  get: vi.fn(),
  handleError: vi.fn(),
}))

describe('Project Loading', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  describe('useProjectsInfiniteQuery', () => {
    it('should not load projects when user is not authenticated', async () => {
      const { useIsLoggedIn } = await import('common')
      const { useProfile } = await import('lib/profile')
      
      vi.mocked(useIsLoggedIn).mockReturnValue(false)
      vi.mocked(useProfile).mockReturnValue({
        profile: undefined,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: false,
      })

      const { result } = renderHook(
        () => useProjectsInfiniteQuery({ limit: 10, sort: 'name_asc', search: '' }),
        { wrapper }
      )

      // Query should be disabled when not authenticated
      expect(result.current.fetchStatus).toBe('idle')
    })

    it('should load projects when user is authenticated', async () => {
      const { useIsLoggedIn } = await import('common')
      const { useProfile } = await import('lib/profile')
      const { get } = await import('data/fetchers')
      
      vi.mocked(useIsLoggedIn).mockReturnValue(true)
      vi.mocked(useProfile).mockReturnValue({
        profile: { id: '123', username: 'test' } as any,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      })
      
      vi.mocked(get).mockResolvedValue({
        data: {
          projects: [],
          pagination: { count: 0, offset: 0, limit: 10 },
        },
        error: null,
      })

      const { result } = renderHook(
        () => useProjectsInfiniteQuery({ limit: 10, sort: 'name_asc', search: '' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    it('should handle project loading errors', async () => {
      const { useIsLoggedIn } = await import('common')
      const { useProfile } = await import('lib/profile')
      const { get } = await import('data/fetchers')
      
      vi.mocked(useIsLoggedIn).mockReturnValue(true)
      vi.mocked(useProfile).mockReturnValue({
        profile: { id: '123', username: 'test' } as any,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      })
      
      const mockError = new Error('Failed to load projects')
      vi.mocked(get).mockResolvedValue({
        data: null,
        error: mockError,
      })

      const { result } = renderHook(
        () => useProjectsInfiniteQuery({ limit: 10, sort: 'name_asc', search: '' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
    })
  })

  describe('useOrgProjectsInfiniteQuery', () => {
    it('should not load projects when user is not authenticated', async () => {
      const { useIsLoggedIn } = await import('common')
      const { useProfile } = await import('lib/profile')
      
      vi.mocked(useIsLoggedIn).mockReturnValue(false)
      vi.mocked(useProfile).mockReturnValue({
        profile: undefined,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: false,
      })

      const { result } = renderHook(
        () => useOrgProjectsInfiniteQuery({ slug: 'test-org', limit: 10, sort: 'name_asc' }),
        { wrapper }
      )

      // Query should be disabled when not authenticated
      expect(result.current.fetchStatus).toBe('idle')
    })

    it('should load projects when user is authenticated', async () => {
      const { useIsLoggedIn } = await import('common')
      const { useProfile } = await import('lib/profile')
      const { get } = await import('data/fetchers')
      
      vi.mocked(useIsLoggedIn).mockReturnValue(true)
      vi.mocked(useProfile).mockReturnValue({
        profile: { id: '123', username: 'test' } as any,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      })
      
      vi.mocked(get).mockResolvedValue({
        data: {
          projects: [],
          pagination: { count: 0, offset: 0, limit: 10 },
        },
        error: null,
      })

      const { result } = renderHook(
        () => useOrgProjectsInfiniteQuery({ slug: 'test-org', limit: 10, sort: 'name_asc' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    it('should handle project loading errors gracefully', async () => {
      const { useIsLoggedIn } = await import('common')
      const { useProfile } = await import('lib/profile')
      const { get } = await import('data/fetchers')
      
      vi.mocked(useIsLoggedIn).mockReturnValue(true)
      vi.mocked(useProfile).mockReturnValue({
        profile: { id: '123', username: 'test' } as any,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      })
      
      const mockError = new Error('Failed to load organization projects')
      vi.mocked(get).mockResolvedValue({
        data: null,
        error: mockError,
      })

      const { result } = renderHook(
        () => useOrgProjectsInfiniteQuery({ slug: 'test-org', limit: 10, sort: 'name_asc' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
    })

    it('should show loading state during project fetch', async () => {
      const { useIsLoggedIn } = await import('common')
      const { useProfile } = await import('lib/profile')
      const { get } = await import('data/fetchers')
      
      vi.mocked(useIsLoggedIn).mockReturnValue(true)
      vi.mocked(useProfile).mockReturnValue({
        profile: { id: '123', username: 'test' } as any,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      })
      
      // Delay the response to test loading state
      vi.mocked(get).mockImplementation(() => 
        new Promise((resolve) => 
          setTimeout(() => resolve({
            data: {
              projects: [],
              pagination: { count: 0, offset: 0, limit: 10 },
            },
            error: null,
          }), 100)
        )
      )

      const { result } = renderHook(
        () => useOrgProjectsInfiniteQuery({ slug: 'test-org', limit: 10, sort: 'name_asc' }),
        { wrapper }
      )

      // Initially should be loading
      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })
  })
})
