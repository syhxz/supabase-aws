/**
 * Tests for project addons query data validation and error handling
 * 
 * These tests verify that the useProjectAddonsQuery hook properly validates
 * API responses and handles malformed data gracefully to prevent array method errors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'

import { useProjectAddonsQuery, getProjectAddons } from '../project-addons-query'
import { customRenderHook } from 'tests/lib/custom-render'
import * as fetchers from 'data/fetchers'

// Mock the fetchers module
vi.mock('data/fetchers', () => ({
  get: vi.fn(),
  handleError: vi.fn()
}))

// Mock the constants
vi.mock('lib/constants', () => ({
  IS_PLATFORM: true
}))

// Mock console methods to avoid noise in tests
const consoleSpy = {
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {})
}

describe('getProjectAddons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy.warn.mockClear()
    consoleSpy.error.mockClear()
  })

  it('should validate and normalize valid API response', async () => {
    const mockResponse = {
      selected_addons: [
        {
          type: 'compute_instance',
          variant: {
            identifier: 'ci_small',
            name: 'Small',
            price: 10
          }
        }
      ],
      available_addons: [
        {
          name: 'Compute Instance',
          type: 'compute_instance',
          variants: []
        }
      ],
      ref: 'test-project'
    }

    vi.mocked(fetchers.get).mockResolvedValue({
      data: mockResponse,
      error: null
    })

    const result = await getProjectAddons({ projectRef: 'test-project' })

    expect(result).toEqual(mockResponse)
    expect(consoleSpy.warn).not.toHaveBeenCalled()
  })

  it('should handle null/undefined API response', async () => {
    vi.mocked(fetchers.get).mockResolvedValue({
      data: null,
      error: null
    })

    const result = await getProjectAddons({ projectRef: 'test-project' })

    expect(result).toEqual({
      selected_addons: [],
      available_addons: [],
      ref: ''
    })
    // The new backward compatibility validation logs different messages
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      '[Backward Compatibility] Invalid data: expected object, received:',
      'object'
    )
  })

  it('should handle non-array selected_addons', async () => {
    const mockResponse = {
      selected_addons: { type: 'compute_instance' }, // Object instead of array
      available_addons: [],
      ref: 'test-project'
    }

    vi.mocked(fetchers.get).mockResolvedValue({
      data: mockResponse,
      error: null
    })

    const result = await getProjectAddons({ projectRef: 'test-project' })

    expect(result.selected_addons).toEqual([])
    // The backward compatibility validation now migrates the data and logs different messages
    expect(consoleSpy.warn).toHaveBeenCalled()
  })

  it('should filter out invalid addon objects', async () => {
    const mockResponse = {
      selected_addons: [
        {
          type: 'compute_instance',
          variant: { identifier: 'ci_small', name: 'Small' }
        },
        { type: 'invalid_addon' }, // Missing variant
        null, // Null addon
        { variant: { identifier: 'ci_medium' } }, // Missing type
        'invalid' // String instead of object
      ],
      available_addons: [],
      ref: 'test-project'
    }

    vi.mocked(fetchers.get).mockResolvedValue({
      data: mockResponse,
      error: null
    })

    const result = await getProjectAddons({ projectRef: 'test-project' })

    expect(result.selected_addons).toHaveLength(1)
    expect(result.selected_addons[0]).toEqual({
      type: 'compute_instance',
      variant: { identifier: 'ci_small', name: 'Small' }
    })
    expect(consoleSpy.warn).toHaveBeenCalledTimes(4) // 4 invalid addons
  })

  it('should handle network errors gracefully', async () => {
    const networkError = new TypeError('Failed to fetch')
    vi.mocked(fetchers.get).mockRejectedValue(networkError)

    const result = await getProjectAddons({ projectRef: 'test-project' })

    expect(result).toEqual({
      selected_addons: [],
      available_addons: [],
      ref: 'test-project'
    })
    expect(consoleSpy.error).toHaveBeenCalledWith(
      '[Project Addons] Failed to fetch project addons:',
      networkError
    )
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      '[Project Addons] Returning fallback data due to malformed response'
    )
  })

  it('should handle JSON parsing errors gracefully', async () => {
    const syntaxError = new SyntaxError('Unexpected token')
    vi.mocked(fetchers.get).mockRejectedValue(syntaxError)

    const result = await getProjectAddons({ projectRef: 'test-project' })

    expect(result).toEqual({
      selected_addons: [],
      available_addons: [],
      ref: 'test-project'
    })
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      '[Project Addons] Returning fallback data due to malformed response'
    )
  })

  it('should re-throw authentication errors', async () => {
    const authError = new Error('Unauthorized')
    ;(authError as any).status = 401
    vi.mocked(fetchers.get).mockRejectedValue(authError)

    await expect(getProjectAddons({ projectRef: 'test-project' })).rejects.toThrow('Unauthorized')
  })

  it('should require projectRef parameter', async () => {
    await expect(getProjectAddons({ projectRef: undefined as any })).rejects.toThrow(
      'projectRef is required'
    )
  })
})

describe('useProjectAddonsQuery', () => {
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
    consoleSpy.warn.mockClear()
    consoleSpy.error.mockClear()
  })

  it('should return validated data on successful query', async () => {
    const mockResponse = {
      selected_addons: [
        {
          type: 'ipv4',
          variant: {
            identifier: 'ipv4_default',
            name: 'IPv4'
          }
        }
      ],
      available_addons: [],
      ref: 'test-project'
    }

    vi.mocked(fetchers.get).mockResolvedValue({
      data: mockResponse,
      error: null
    })

    const { result } = customRenderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { queryClient }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockResponse)
  })

  it('should handle malformed API responses', async () => {
    vi.mocked(fetchers.get).mockResolvedValue({
      data: { selected_addons: 'not-an-array' },
      error: null
    })

    const { result } = customRenderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { queryClient }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.selected_addons).toEqual([])
    expect(consoleSpy.warn).toHaveBeenCalled()
  })

  it('should be disabled when projectRef is undefined', () => {
    const { result } = customRenderHook(
      () => useProjectAddonsQuery({ projectRef: undefined }),
      { queryClient }
    )

    // The query should be disabled and not fetch data
    expect(result.current.data).toBeUndefined()
  })

  it('should not retry on client errors (4xx)', async () => {
    const clientError = new Error('Bad Request')
    ;(clientError as any).status = 400
    vi.mocked(fetchers.get).mockRejectedValue(clientError)

    const { result } = customRenderHook(
      () => useProjectAddonsQuery({ projectRef: 'test-project' }),
      { queryClient }
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    // Should not retry client errors
    expect(vi.mocked(fetchers.get)).toHaveBeenCalledTimes(1)
  })
})