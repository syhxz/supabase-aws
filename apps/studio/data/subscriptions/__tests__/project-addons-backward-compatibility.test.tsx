/**
 * Integration tests for project addons backward compatibility
 * 
 * These tests verify that the project addons query handles various API response
 * formats correctly, ensuring backward compatibility when data structures change.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'

import { get } from 'data/fetchers'
import { useProjectAddonsQuery } from '../project-addons-query'

// Mock the fetchers module
vi.mock('data/fetchers', () => ({
  get: vi.fn(),
  handleError: vi.fn()
}))

// Mock constants
vi.mock('lib/constants', () => ({
  IS_PLATFORM: true
}))

const mockGet = get as MockedFunction<typeof get>

describe('useProjectAddonsQuery backward compatibility', () => {
  let queryClient: QueryClient

  const createWrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          cacheTime: 0,
        },
      },
    })
    vi.clearAllMocks()
  })

  it('should handle modern API response format', async () => {
    const modernResponse = {
      error: null,
      data: {
        selected_addons: [
          { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } },
          { type: 'compute_instance', variant: { identifier: 'ci_micro', name: 'Micro' } }
        ],
        available_addons: [
          { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } }
        ],
        ref: 'test-project'
      }
    }

    mockGet.mockResolvedValueOnce(modernResponse)

    const { result } = renderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { wrapper: createWrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      selected_addons: [
        { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } },
        { type: 'compute_instance', variant: { identifier: 'ci_micro', name: 'Micro' } }
      ],
      available_addons: [
        { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } }
      ],
      ref: 'test-project'
    })
  })

  it('should handle legacy v2 format with null selected_addons', async () => {
    const legacyResponse = {
      error: null,
      data: {
        selected_addons: null,
        available_addons: [],
        ref: 'test-project'
      }
    }

    mockGet.mockResolvedValueOnce(legacyResponse)

    const { result } = renderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { wrapper: createWrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      selected_addons: [],
      available_addons: [],
      ref: 'test-project'
    })
  })

  it('should handle legacy v2 format with object selected_addons', async () => {
    const legacyResponse = {
      error: null,
      data: {
        selected_addons: {
          ipv4: { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } },
          compute: { type: 'compute_instance', variant: { identifier: 'ci_micro', name: 'Micro' } }
        },
        available_addons: [],
        ref: 'test-project'
      }
    }

    mockGet.mockResolvedValueOnce(legacyResponse)

    const { result } = renderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { wrapper: createWrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.selected_addons).toHaveLength(2)
    expect(result.current.data?.selected_addons.some(addon => addon.type === 'ipv4')).toBe(true)
    expect(result.current.data?.selected_addons.some(addon => addon.type === 'compute_instance')).toBe(true)
  })

  it('should handle legacy v1 format with addons field', async () => {
    const legacyResponse = {
      error: null,
      data: {
        addons: [
          { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } }
        ],
        ref: 'test-project'
      }
    }

    mockGet.mockResolvedValueOnce(legacyResponse)

    const { result } = renderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { wrapper: createWrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      selected_addons: [
        { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } }
      ],
      available_addons: [],
      ref: 'test-project'
    })
  })

  it('should handle legacy v1 format with subscription field', async () => {
    const legacyResponse = {
      error: null,
      data: {
        subscription: {
          addons: [
            { type: 'compute_instance', variant: { identifier: 'ci_micro', name: 'Micro' } }
          ]
        },
        project_ref: 'test-project'
      }
    }

    mockGet.mockResolvedValueOnce(legacyResponse)

    const { result } = renderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { wrapper: createWrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      selected_addons: [
        { type: 'compute_instance', variant: { identifier: 'ci_micro', name: 'Micro' } }
      ],
      available_addons: [],
      ref: 'test-project'
    })
  })

  it('should handle malformed API response gracefully', async () => {
    const malformedResponse = {
      error: null,
      data: null
    }

    mockGet.mockResolvedValueOnce(malformedResponse)

    const { result } = renderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { wrapper: createWrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      selected_addons: [],
      available_addons: [],
      ref: ''
    })
  })

  it('should handle API response with invalid addon objects', async () => {
    const responseWithInvalidAddons = {
      error: null,
      data: {
        selected_addons: [
          { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } }, // Valid
          { type: 'invalid' }, // Invalid - missing variant
          null, // Invalid - null
          { variant: { identifier: 'test', name: 'Test' } }, // Invalid - missing type
          { type: 'compute_instance', variant: { identifier: 'ci_micro', name: 'Micro' } } // Valid
        ],
        available_addons: [],
        ref: 'test-project'
      }
    }

    mockGet.mockResolvedValueOnce(responseWithInvalidAddons)

    const { result } = renderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { wrapper: createWrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Should filter out invalid addons and keep only valid ones
    expect(result.current.data?.selected_addons).toHaveLength(2)
    expect(result.current.data?.selected_addons[0].type).toBe('ipv4')
    expect(result.current.data?.selected_addons[1].type).toBe('compute_instance')
  })

  it('should handle network errors and return fallback data', async () => {
    const networkError = new TypeError('Network error')
    mockGet.mockRejectedValueOnce(networkError)

    const { result } = renderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { wrapper: createWrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      selected_addons: [],
      available_addons: [],
      ref: 'test-project'
    })
  })

  it('should handle syntax errors and return fallback data', async () => {
    const syntaxError = new SyntaxError('Invalid JSON')
    mockGet.mockRejectedValueOnce(syntaxError)

    const { result } = renderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { wrapper: createWrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      selected_addons: [],
      available_addons: [],
      ref: 'test-project'
    })
  })

  it('should handle empty object response', async () => {
    const emptyResponse = {
      error: null,
      data: {}
    }

    mockGet.mockResolvedValueOnce(emptyResponse)

    const { result } = renderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { wrapper: createWrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      selected_addons: [],
      available_addons: [],
      ref: ''
    })
  })

  it('should handle mixed legacy and modern fields', async () => {
    const mixedResponse = {
      error: null,
      data: {
        // Legacy field
        addons: [
          { type: 'legacy_addon', variant: { identifier: 'legacy', name: 'Legacy' } }
        ],
        // Modern fields (should take precedence)
        selected_addons: [
          { type: 'modern_addon', variant: { identifier: 'modern', name: 'Modern' } }
        ],
        available_addons: [],
        ref: 'test-project'
      }
    }

    mockGet.mockResolvedValueOnce(mixedResponse)

    const { result } = renderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { wrapper: createWrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Should use modern format since it's detected as modern
    expect(result.current.data?.selected_addons).toHaveLength(1)
    expect(result.current.data?.selected_addons[0].type).toBe('modern_addon')
  })
})