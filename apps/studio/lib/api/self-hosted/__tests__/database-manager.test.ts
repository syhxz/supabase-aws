/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createDatabase,
  databaseExists,
  listDatabases,
  deleteDatabase,
  getTemplateDatabaseName,
  DatabaseError,
  DatabaseErrorCode,
  type CreateDatabaseOptions,
  type DatabaseInfo,
} from '../database-manager'
import type { WrappedResult } from '../types'

// Mock the query module
vi.mock('../query', () => ({
  executeQuery: vi.fn(),
}))

// Mock the constants module
vi.mock('../constants', () => ({
  POSTGRES_DATABASE: 'postgres',
}))

// Mock the database-naming module
vi.mock('../database-naming', () => ({
  validateDatabaseName: vi.fn((name: string) => {
    if (!name || name.trim().length === 0) {
      throw new Error('Database name cannot be empty')
    }
    if (name.length > 63) {
      throw new Error('Database name cannot exceed 63 characters')
    }
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      throw new Error(
        'Database name must start with a lowercase letter and contain only lowercase letters, numbers, and underscores'
      )
    }
    const reserved = ['postgres', 'template0', 'template1', 'supabase', 'auth', 'storage', 'realtime']
    if (reserved.includes(name.toLowerCase())) {
      throw new Error(`Database name "${name}" is reserved and cannot be used`)
    }
  }),
}))

import { executeQuery } from '../query'

const mockExecuteQuery = executeQuery as ReturnType<typeof vi.fn>

describe('database-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    delete process.env.TEMPLATE_DATABASE_NAME
    delete process.env.POSTGRES_DB
  })

  describe('getTemplateDatabaseName', () => {
    it('returns TEMPLATE_DATABASE_NAME when set', () => {
      process.env.TEMPLATE_DATABASE_NAME = 'custom_template'
      expect(getTemplateDatabaseName()).toBe('custom_template')
    })

    it('returns default "postgres" when TEMPLATE_DATABASE_NAME is not set', () => {
      expect(getTemplateDatabaseName()).toBe('postgres')
    })
  })

  describe('databaseExists', () => {
    it('returns true when database exists', async () => {
      mockExecuteQuery.mockResolvedValueOnce({
        data: [{ exists: true }],
        error: undefined,
      })

      const result = await databaseExists('test_db')

      expect(result.data).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mockExecuteQuery).toHaveBeenCalledWith({
        query: expect.stringContaining('SELECT EXISTS'),
        parameters: ['test_db'],
        readOnly: true,
      })
    })

    it('returns false when database does not exist', async () => {
      mockExecuteQuery.mockResolvedValueOnce({
        data: [{ exists: false }],
        error: undefined,
      })

      const result = await databaseExists('nonexistent_db')

      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it('returns error when query fails', async () => {
      const mockError = new Error('Connection failed')
      mockExecuteQuery.mockResolvedValueOnce({
        data: undefined,
        error: mockError,
      })

      const result = await databaseExists('test_db')

      expect(result.data).toBeUndefined()
      expect(result.error).toBe(mockError)
    })
  })

  describe('listDatabases', () => {
    it('returns list of databases', async () => {
      const mockDatabases: DatabaseInfo[] = [
        {
          name: 'db1',
          owner: 'postgres',
          encoding: 'UTF8',
          collate: 'en_US.utf8',
          ctype: 'en_US.utf8',
        },
        {
          name: 'db2',
          owner: 'postgres',
          encoding: 'UTF8',
          collate: 'en_US.utf8',
          ctype: 'en_US.utf8',
        },
      ]

      mockExecuteQuery.mockResolvedValueOnce({
        data: mockDatabases,
        error: undefined,
      })

      const result = await listDatabases()

      expect(result.data).toEqual(mockDatabases)
      expect(result.error).toBeUndefined()
      expect(mockExecuteQuery).toHaveBeenCalledWith({
        query: expect.stringContaining('SELECT'),
        readOnly: true,
      })
    })

    it('returns empty array when no databases found', async () => {
      mockExecuteQuery.mockResolvedValueOnce({
        data: [],
        error: undefined,
      })

      const result = await listDatabases()

      expect(result.data).toEqual([])
      expect(result.error).toBeUndefined()
    })

    it('returns error when query fails', async () => {
      const mockError = new Error('Query failed')
      mockExecuteQuery.mockResolvedValueOnce({
        data: undefined,
        error: mockError,
      })

      const result = await listDatabases()

      expect(result.data).toBeUndefined()
      expect(result.error).toBe(mockError)
    })
  })

  describe('createDatabase', () => {
    const validOptions: CreateDatabaseOptions = {
      name: 'test_db',
      template: 'postgres',
    }

    it('creates database successfully', async () => {
      // Mock database existence checks
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ exists: false }], // Database doesn't exist
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [{ exists: true }], // Template exists
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [], // terminateConnections query
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: undefined, // CREATE DATABASE success
          error: undefined,
        })

      const result = await createDatabase(validOptions)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
      expect(mockExecuteQuery).toHaveBeenCalledWith({
        query: 'CREATE DATABASE "test_db" WITH TEMPLATE "postgres"',
        readOnly: false,
      })
    })

    it('creates database with owner', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ exists: false }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [{ exists: true }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [], // terminateConnections query
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: undefined,
          error: undefined,
        })

      const options: CreateDatabaseOptions = {
        ...validOptions,
        owner: 'custom_owner',
      }

      const result = await createDatabase(options)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
      expect(mockExecuteQuery).toHaveBeenCalledWith({
        query: 'CREATE DATABASE "test_db" WITH TEMPLATE "postgres" OWNER "custom_owner"',
        readOnly: false,
      })
    })

    it('returns error when database name is invalid', async () => {
      const invalidOptions: CreateDatabaseOptions = {
        name: 'Invalid-Name!',
        template: 'postgres',
      }

      const result = await createDatabase(invalidOptions)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseError)
      expect((result.error as DatabaseError).code).toBe(DatabaseErrorCode.INVALID_DATABASE_NAME)
      expect(mockExecuteQuery).not.toHaveBeenCalled()
    })

    it('returns error when database already exists', async () => {
      mockExecuteQuery.mockResolvedValueOnce({
        data: [{ exists: true }], // Database already exists
        error: undefined,
      })

      const result = await createDatabase(validOptions)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseError)
      expect((result.error as DatabaseError).code).toBe(DatabaseErrorCode.DATABASE_ALREADY_EXISTS)
      expect((result.error as DatabaseError).message).toContain('already exists')
    })

    it('returns error when template database does not exist', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ exists: false }], // Database doesn't exist
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [{ exists: false }], // Template doesn't exist
          error: undefined,
        })

      const result = await createDatabase(validOptions)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseError)
      expect((result.error as DatabaseError).code).toBe(DatabaseErrorCode.TEMPLATE_NOT_FOUND)
      expect((result.error as DatabaseError).message).toContain('not found')
    })

    it('handles PostgreSQL "already exists" error', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ exists: false }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [{ exists: true }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [], // terminateConnections query
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: undefined,
          error: { message: 'database "test_db" already exists' },
        })

      const result = await createDatabase(validOptions)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseError)
      expect((result.error as DatabaseError).code).toBe(DatabaseErrorCode.DATABASE_ALREADY_EXISTS)
    })

    it('handles PostgreSQL template not found error', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ exists: false }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [{ exists: true }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [], // terminateConnections query
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: undefined,
          error: { message: 'template database "nonexistent" does not exist' },
        })

      const result = await createDatabase(validOptions)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseError)
      expect((result.error as DatabaseError).code).toBe(DatabaseErrorCode.TEMPLATE_NOT_FOUND)
    })

    it('handles permission denied error', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ exists: false }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [{ exists: true }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [], // terminateConnections query
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: undefined,
          error: { message: 'permission denied to create database' },
        })

      const result = await createDatabase(validOptions)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseError)
      expect((result.error as DatabaseError).code).toBe(DatabaseErrorCode.INSUFFICIENT_PERMISSIONS)
    })

    it('handles disk space error', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ exists: false }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [{ exists: true }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [], // terminateConnections query
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: undefined,
          error: { message: 'could not create database: disk space full' },
        })

      const result = await createDatabase(validOptions)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseError)
      expect((result.error as DatabaseError).code).toBe(DatabaseErrorCode.DISK_SPACE_FULL)
    })

    it('handles unknown error', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ exists: false }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [{ exists: true }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: [], // terminateConnections query
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: undefined,
          error: { message: 'some unexpected error' },
        })

      const result = await createDatabase(validOptions)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseError)
      expect((result.error as DatabaseError).code).toBe(DatabaseErrorCode.UNKNOWN_ERROR)
    })
  })

  describe('deleteDatabase', () => {
    it('deletes database successfully', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ exists: true }], // Database exists
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: undefined, // DROP DATABASE success
          error: undefined,
        })

      const result = await deleteDatabase('test_db')

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
      expect(mockExecuteQuery).toHaveBeenCalledWith({
        query: 'DROP DATABASE "test_db"',
        readOnly: false,
      })
    })

    it('returns success when database does not exist', async () => {
      mockExecuteQuery.mockResolvedValueOnce({
        data: [{ exists: false }], // Database doesn't exist
        error: undefined,
      })

      const result = await deleteDatabase('nonexistent_db')

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
      // Should not attempt to drop
      expect(mockExecuteQuery).toHaveBeenCalledTimes(1)
    })

    it('returns error when database name is invalid', async () => {
      const result = await deleteDatabase('Invalid-Name!')

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseError)
      expect((result.error as DatabaseError).code).toBe(DatabaseErrorCode.INVALID_DATABASE_NAME)
      expect(mockExecuteQuery).not.toHaveBeenCalled()
    })

    it('handles permission denied error', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ exists: true }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: undefined,
          error: { message: 'permission denied to drop database' },
        })

      const result = await deleteDatabase('test_db')

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseError)
      expect((result.error as DatabaseError).code).toBe(DatabaseErrorCode.INSUFFICIENT_PERMISSIONS)
    })

    it('handles unknown error', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          data: [{ exists: true }],
          error: undefined,
        })
        .mockResolvedValueOnce({
          data: undefined,
          error: { message: 'some unexpected error' },
        })

      const result = await deleteDatabase('test_db')

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(DatabaseError)
      expect((result.error as DatabaseError).code).toBe(DatabaseErrorCode.UNKNOWN_ERROR)
    })

    it('handles error when checking database existence', async () => {
      const mockError = new Error('Connection failed')
      mockExecuteQuery.mockResolvedValueOnce({
        data: undefined,
        error: mockError,
      })

      const result = await deleteDatabase('test_db')

      expect(result.data).toBeUndefined()
      expect(result.error).toBe(mockError)
    })
  })
})
