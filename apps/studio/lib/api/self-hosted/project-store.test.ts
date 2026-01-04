/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import {
  save,
  findAll,
  findById,
  findByRef,
  findByDatabaseName,
  findByOrganizationId,
  update,
  deleteProject,
  ProjectStoreError,
  ProjectStoreErrorCode,
  type ProjectMetadata,
} from './project-store'

// Use a test-specific storage path
const TEST_STORE_PATH = '.kiro/data/test-projects.json'
process.env.PROJECT_STORE_PATH = TEST_STORE_PATH

describe('project-store', () => {
  beforeEach(async () => {
    // Clean up test file before each test
    try {
      await fs.unlink(TEST_STORE_PATH)
    } catch {
      // Ignore if file doesn't exist
    }
  })

  afterEach(async () => {
    // Clean up test file after each test
    try {
      await fs.unlink(TEST_STORE_PATH)
    } catch {
      // Ignore if file doesn't exist
    }
  })

  describe('save', () => {
    it('should save a new project', async () => {
      const project = {
        ref: 'test-ref-1',
        name: 'Test Project',
        database_name: 'test_db',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const result = await save(project)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data?.id).toBe(1)
      expect(result.data?.name).toBe('Test Project')
      expect(result.data?.database_name).toBe('test_db')
    })

    it('should auto-generate ID if not provided', async () => {
      const project1 = {
        ref: 'ref-1',
        name: 'Project 1',
        database_name: 'db1',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const project2 = {
        ref: 'ref-2',
        name: 'Project 2',
        database_name: 'db2',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const result1 = await save(project1)
      const result2 = await save(project2)

      expect(result1.data?.id).toBe(1)
      expect(result2.data?.id).toBe(2)
    })

    it('should reject duplicate ref', async () => {
      const project1 = {
        ref: 'duplicate-ref',
        name: 'Project 1',
        database_name: 'db1',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const project2 = {
        ref: 'duplicate-ref',
        name: 'Project 2',
        database_name: 'db2',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await save(project1)
      const result = await save(project2)

      expect(result.error).toBeDefined()
      expect(result.error).toBeInstanceOf(ProjectStoreError)
      expect((result.error as ProjectStoreError).code).toBe(
        ProjectStoreErrorCode.PROJECT_ALREADY_EXISTS
      )
    })

    it('should reject duplicate database name', async () => {
      const project1 = {
        ref: 'ref-1',
        name: 'Project 1',
        database_name: 'duplicate_db',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const project2 = {
        ref: 'ref-2',
        name: 'Project 2',
        database_name: 'duplicate_db',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await save(project1)
      const result = await save(project2)

      expect(result.error).toBeDefined()
      expect((result.error as ProjectStoreError).code).toBe(
        ProjectStoreErrorCode.PROJECT_ALREADY_EXISTS
      )
    })

    it('should reject invalid project data', async () => {
      const invalidProject = {
        ref: 'test-ref',
        // Missing name
        database_name: 'test_db',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any

      const result = await save(invalidProject)

      expect(result.error).toBeDefined()
      expect((result.error as ProjectStoreError).code).toBe(
        ProjectStoreErrorCode.INVALID_PROJECT_DATA
      )
    })
  })

  describe('findAll', () => {
    it('should return empty array when no projects exist', async () => {
      const result = await findAll()

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual([])
    })

    it('should return all projects', async () => {
      const project1 = {
        ref: 'ref-1',
        name: 'Project 1',
        database_name: 'db1',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const project2 = {
        ref: 'ref-2',
        name: 'Project 2',
        database_name: 'db2',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await save(project1)
      await save(project2)

      const result = await findAll()

      expect(result.error).toBeUndefined()
      expect(result.data).toHaveLength(2)
      expect(result.data?.[0].name).toBe('Project 1')
      expect(result.data?.[1].name).toBe('Project 2')
    })
  })

  describe('findById', () => {
    it('should find project by ID', async () => {
      const project = {
        ref: 'test-ref',
        name: 'Test Project',
        database_name: 'test_db',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const saved = await save(project)
      const result = await findById(saved.data!.id)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data?.name).toBe('Test Project')
    })

    it('should return null for non-existent ID', async () => {
      const result = await findById(999)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeNull()
    })
  })

  describe('findByRef', () => {
    it('should find project by ref', async () => {
      const project = {
        ref: 'unique-ref',
        name: 'Test Project',
        database_name: 'test_db',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await save(project)
      const result = await findByRef('unique-ref')

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data?.ref).toBe('unique-ref')
    })

    it('should return null for non-existent ref', async () => {
      const result = await findByRef('non-existent')

      expect(result.error).toBeUndefined()
      expect(result.data).toBeNull()
    })
  })

  describe('findByDatabaseName', () => {
    it('should find project by database name', async () => {
      const project = {
        ref: 'test-ref',
        name: 'Test Project',
        database_name: 'unique_db_name',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await save(project)
      const result = await findByDatabaseName('unique_db_name')

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data?.database_name).toBe('unique_db_name')
    })
  })

  describe('findByOrganizationId', () => {
    it('should find projects by organization ID', async () => {
      const project1 = {
        ref: 'ref-1',
        name: 'Project 1',
        database_name: 'db1',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const project2 = {
        ref: 'ref-2',
        name: 'Project 2',
        database_name: 'db2',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const project3 = {
        ref: 'ref-3',
        name: 'Project 3',
        database_name: 'db3',
        organization_id: 2,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await save(project1)
      await save(project2)
      await save(project3)

      const result = await findByOrganizationId(1)

      expect(result.error).toBeUndefined()
      expect(result.data).toHaveLength(2)
      expect(result.data?.every((p) => p.organization_id === 1)).toBe(true)
    })
  })

  describe('update', () => {
    it('should update project', async () => {
      const project = {
        ref: 'test-ref',
        name: 'Original Name',
        database_name: 'test_db',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const saved = await save(project)
      const result = await update(saved.data!.id, { name: 'Updated Name' })

      expect(result.error).toBeUndefined()
      expect(result.data?.name).toBe('Updated Name')
      expect(result.data?.database_name).toBe('test_db')
    })

    it('should return error for non-existent project', async () => {
      const result = await update(999, { name: 'Updated' })

      expect(result.error).toBeDefined()
      expect((result.error as ProjectStoreError).code).toBe(
        ProjectStoreErrorCode.PROJECT_NOT_FOUND
      )
    })
  })

  describe('deleteProject', () => {
    it('should delete project', async () => {
      const project = {
        ref: 'test-ref',
        name: 'Test Project',
        database_name: 'test_db',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'us-east-1',
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const saved = await save(project)
      const deleteResult = await deleteProject(saved.data!.id)

      expect(deleteResult.error).toBeUndefined()

      const findResult = await findById(saved.data!.id)
      expect(findResult.data).toBeNull()
    })

    it('should return error for non-existent project', async () => {
      const result = await deleteProject(999)

      expect(result.error).toBeDefined()
      expect((result.error as ProjectStoreError).code).toBe(
        ProjectStoreErrorCode.PROJECT_NOT_FOUND
      )
    })
  })
})
