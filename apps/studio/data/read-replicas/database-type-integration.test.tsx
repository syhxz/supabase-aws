/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDatabaseType, useDatabasesWithTypes } from './replicas-query'
import type { Database } from './replicas-query'

// Mock the API call
vi.mock('data/fetchers', () => ({
  get: vi.fn(),
  handleError: vi.fn(),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const mockDatabase: Database = {
  identifier: 'test-project-123',
  region: 'us-east-1',
  db_host: 'db.example.com',
  db_port: 5432,
  db_name: 'postgres',
  db_user: 'postgres',
  status: 'ACTIVE_HEALTHY',
  inserted_at: '2023-01-01T00:00:00Z',
  cloud_provider: 'AWS',
  size: 'micro',
  restUrl: 'https://test.supabase.co',
}

describe('Database Type Integration Tests', () => {
  it('should identify primary database correctly', () => {
    // Mock the query to return our test database
    vi.doMock('./replicas-query', async () => {
      const actual = await vi.importActual('./replicas-query')
      return {
        ...actual,
        useReadReplicasQuery: () => ({
          data: [mockDatabase],
          isLoading: false,
          error: null,
          isError: false,
          isSuccess: true,
        }),
      }
    })

    const { result } = renderHook(
      () => useDatabaseType({ 
        projectRef: 'test-project-123', 
        databaseId: 'test-project-123' 
      }),
      { wrapper: createWrapper() }
    )

    expect(result.current.type).toBe('primary')
    expect(result.current.label).toBe('Primary Database')
    expect(result.current.isPrimary).toBe(true)
  })

  it('should identify replica database correctly', () => {
    const replicaDatabase: Database = {
      ...mockDatabase,
      identifier: 'replica-456',
    }

    vi.doMock('./replicas-query', async () => {
      const actual = await vi.importActual('./replicas-query')
      return {
        ...actual,
        useReadReplicasQuery: () => ({
          data: [mockDatabase, replicaDatabase],
          isLoading: false,
          error: null,
          isError: false,
          isSuccess: true,
        }),
      }
    })

    const { result } = renderHook(
      () => useDatabaseType({ 
        projectRef: 'test-project-123', 
        databaseId: 'replica-456' 
      }),
      { wrapper: createWrapper() }
    )

    expect(result.current.type).toBe('replica')
    expect(result.current.label).toBe('Read Replica')
    expect(result.current.isPrimary).toBe(false)
  })

  it('should handle loading state', () => {
    vi.doMock('./replicas-query', async () => {
      const actual = await vi.importActual('./replicas-query')
      return {
        ...actual,
        useReadReplicasQuery: () => ({
          data: [],
          isLoading: true,
          error: null,
          isError: false,
          isSuccess: false,
        }),
      }
    })

    const { result } = renderHook(
      () => useDatabaseType({ 
        projectRef: 'test-project-123', 
        databaseId: 'test-project-123' 
      }),
      { wrapper: createWrapper() }
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.type).toBe('primary') // Default during loading
    expect(result.current.label).toBe('Primary Database')
  })

  it('should return databases with type information', () => {
    const databases = [
      mockDatabase,
      { ...mockDatabase, identifier: 'replica-456' }
    ]

    vi.doMock('./replicas-query', async () => {
      const actual = await vi.importActual('./replicas-query')
      return {
        ...actual,
        useReadReplicasQuery: () => ({
          data: databases,
          isLoading: false,
          error: null,
          isError: false,
          isSuccess: true,
        }),
      }
    })

    const { result } = renderHook(
      () => useDatabasesWithTypes({ projectRef: 'test-project-123' }),
      { wrapper: createWrapper() }
    )

    expect(result.current.databases).toHaveLength(2)
    
    const primaryDb = result.current.databases.find(db => db.identifier === 'test-project-123')
    const replicaDb = result.current.databases.find(db => db.identifier === 'replica-456')
    
    expect(primaryDb?.type).toBe('primary')
    expect(primaryDb?.label).toBe('Primary Database')
    expect(primaryDb?.isPrimary).toBe(true)
    
    expect(replicaDb?.type).toBe('replica')
    expect(replicaDb?.label).toBe('Read Replica')
    expect(replicaDb?.isPrimary).toBe(false)
  })
})