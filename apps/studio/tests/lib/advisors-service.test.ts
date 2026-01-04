/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  AdvisorsServiceAdapter,
  getAdvisorsServiceAdapter,
  resetAdvisorsServiceAdapter,
} from '../../lib/advisors-service/AdvisorsServiceAdapter'
import { getServiceRouter, resetServiceRouter } from '../../lib/service-router/ServiceRouter'

// Mock the service router
vi.mock('../../lib/service-router/ServiceRouter', () => ({
  getServiceRouter: vi.fn(),
  resetServiceRouter: vi.fn(),
}))

describe('AdvisorsServiceAdapter', () => {
  let adapter: AdvisorsServiceAdapter
  let mockServiceRouter: any

  beforeEach(() => {
    // Reset the singleton
    resetAdvisorsServiceAdapter()

    // Create mock service router
    mockServiceRouter = {
      query: vi.fn(),
      getProjectConfig: vi.fn(),
    }

    // Mock getServiceRouter to return our mock
    vi.mocked(getServiceRouter).mockReturnValue(mockServiceRouter)

    // Create adapter instance
    adapter = getAdvisorsServiceAdapter()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('analyzeQueries', () => {
    it('should analyze queries successfully', async () => {
      const mockRows = [
        {
          query: 'SELECT * FROM users WHERE id = $1',
          calls: '100',
          total_time: '1500.5',
          mean_time: '15.005',
          min_time: '10.2',
          max_time: '25.8',
          rows: '100',
        },
        {
          query: 'SELECT * FROM posts ORDER BY created_at DESC',
          calls: '50',
          total_time: '2500.0',
          mean_time: '50.0',
          min_time: '45.0',
          max_time: '60.0',
          rows: '500',
        },
      ]

      // Mock extension creation and query
      mockServiceRouter.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // CREATE EXTENSION
        .mockResolvedValueOnce({ rows: mockRows, rowCount: 2 }) // SELECT from pg_stat_statements

      const analysis = await adapter.analyzeQueries('project-a')

      expect(analysis).toHaveLength(2)
      expect(analysis[0]).toEqual({
        query: 'SELECT * FROM users WHERE id = $1',
        calls: 100,
        total_time: 1500.5,
        mean_time: 15.005,
        min_time: 10.2,
        max_time: 25.8,
        rows: 100,
      })
      expect(analysis[1]).toEqual({
        query: 'SELECT * FROM posts ORDER BY created_at DESC',
        calls: 50,
        total_time: 2500.0,
        mean_time: 50.0,
        min_time: 45.0,
        max_time: 60.0,
        rows: 500,
      })
    })

    it('should handle extension creation failure gracefully', async () => {
      // Mock extension creation failure
      mockServiceRouter.query
        .mockRejectedValueOnce(new Error('Extension not available'))
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      const analysis = await adapter.analyzeQueries('project-a')

      expect(analysis).toEqual([])
    })
  })

  describe('suggestIndexes', () => {
    it('should suggest indexes for foreign keys without indexes', async () => {
      const mockFkRows = [
        {
          table_name: 'posts',
          column_name: 'user_id',
          constraint_name: 'fk_posts_user_id',
        },
        {
          table_name: 'comments',
          column_name: 'post_id',
          constraint_name: 'fk_comments_post_id',
        },
      ]

      mockServiceRouter.query
        .mockResolvedValueOnce({ rows: mockFkRows, rowCount: 2 }) // Foreign keys
        .mockRejectedValueOnce(new Error('pg_stat_user_tables not available')) // Sequential scans

      const suggestions = await adapter.suggestIndexes('project-a')

      expect(suggestions).toHaveLength(2)
      expect(suggestions[0]).toEqual({
        table_name: 'posts',
        column_name: 'user_id',
        reason: 'Foreign key column without index (constraint: fk_posts_user_id)',
        estimated_impact: 'high',
        create_statement: 'CREATE INDEX idx_posts_user_id ON posts(user_id);',
      })
    })

    it('should suggest indexes for tables with high sequential scans', async () => {
      const mockSeqScanRows = [
        {
          schemaname: 'public',
          tablename: 'large_table',
          seq_scan: 5000,
          seq_tup_read: 500000,
          idx_scan: 100,
          n_live_tup: 10000,
        },
      ]

      const mockColumnRows = [
        { column_name: 'created_at', data_type: 'timestamp' },
        { column_name: 'status', data_type: 'text' },
      ]

      mockServiceRouter.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Foreign keys
        .mockResolvedValueOnce({ rows: mockSeqScanRows, rowCount: 1 }) // Sequential scans
        .mockResolvedValueOnce({ rows: mockColumnRows, rowCount: 2 }) // Columns

      const suggestions = await adapter.suggestIndexes('project-a')

      expect(suggestions).toHaveLength(2)
      expect(suggestions[0].table_name).toBe('large_table')
      expect(suggestions[0].estimated_impact).toBe('medium')
      expect(suggestions[0].reason).toContain('high sequential scan count')
    })

    it('should return empty array if no suggestions', async () => {
      mockServiceRouter.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Foreign keys
        .mockRejectedValueOnce(new Error('pg_stat_user_tables not available')) // Sequential scans

      const suggestions = await adapter.suggestIndexes('project-a')

      expect(suggestions).toEqual([])
    })
  })

  describe('detectSlowQueries', () => {
    it('should detect slow queries successfully', async () => {
      const mockRows = [
        {
          query: 'SELECT * FROM large_table WHERE status = $1',
          execution_time: '250.5',
          timestamp: '2025-01-27T10:00:00Z',
        },
        {
          query: 'SELECT COUNT(*) FROM posts',
          execution_time: '150.2',
          timestamp: '2025-01-27T10:05:00Z',
        },
      ]

      mockServiceRouter.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // CREATE EXTENSION
        .mockResolvedValueOnce({ rows: mockRows, rowCount: 2 }) // SELECT slow queries

      const slowQueries = await adapter.detectSlowQueries('project-a', 100)

      expect(slowQueries).toHaveLength(2)
      expect(slowQueries[0]).toEqual({
        query: 'SELECT * FROM large_table WHERE status = $1',
        execution_time: 250.5,
        timestamp: '2025-01-27T10:00:00Z',
      })
    })

    it('should throw error for invalid threshold', async () => {
      await expect(adapter.detectSlowQueries('project-a', 0)).rejects.toThrow(
        'Threshold must be greater than 0'
      )

      await expect(adapter.detectSlowQueries('project-a', -10)).rejects.toThrow(
        'Threshold must be greater than 0'
      )
    })

    it('should return empty array if pg_stat_statements not available', async () => {
      mockServiceRouter.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // CREATE EXTENSION
        .mockRejectedValueOnce(new Error('pg_stat_statements not available'))

      const slowQueries = await adapter.detectSlowQueries('project-a', 100)

      expect(slowQueries).toEqual([])
    })
  })

  describe('generatePerformanceReport', () => {
    beforeEach(() => {
      // Mock project config
      mockServiceRouter.getProjectConfig.mockResolvedValue({
        projectRef: 'project-a',
        databaseName: 'project_a_db',
        connectionString: 'postgres://...',
        ownerUserId: 'user-123',
      })
    })

    it('should generate comprehensive performance report', async () => {
      // Mock all queries for performance report
      // The order matters - Promise.all runs them in parallel but each method has its own sequence
      
      // For detectSlowQueries
      const slowQueriesExtension = { rows: [], rowCount: 0 }
      const slowQueriesData = {
        rows: [
          {
            query: 'SELECT * FROM large_table',
            execution_time: '250.5',
            timestamp: '2025-01-27T10:00:00Z',
          },
        ],
        rowCount: 1,
      }
      
      // For analyzeQueries
      const analyzeExtension = { rows: [], rowCount: 0 }
      const analyzeData = {
        rows: [
          {
            query: 'SELECT * FROM users',
            calls: '100',
            total_time: '1500.5',
            mean_time: '15.005',
            min_time: '10.2',
            max_time: '25.8',
            rows: '100',
          },
        ],
        rowCount: 1,
      }
      
      // For suggestIndexes
      const fkData = {
        rows: [
          {
            table_name: 'posts',
            column_name: 'user_id',
            constraint_name: 'fk_posts_user_id',
          },
        ],
        rowCount: 1,
      }
      const seqScanData = { rows: [], rowCount: 0 }
      
      // For getDatabaseStats
      const sizeData = { rows: [{ size: '1048576' }], rowCount: 1 }
      const tableCountData = { rows: [{ count: '10' }], rowCount: 1 }
      const indexCountData = { rows: [{ count: '15' }], rowCount: 1 }

      mockServiceRouter.query
        .mockResolvedValueOnce(slowQueriesExtension)
        .mockResolvedValueOnce(slowQueriesData)
        .mockResolvedValueOnce(analyzeExtension)
        .mockResolvedValueOnce(analyzeData)
        .mockResolvedValueOnce(fkData)
        .mockResolvedValueOnce(seqScanData)
        .mockResolvedValueOnce(sizeData)
        .mockResolvedValueOnce(tableCountData)
        .mockResolvedValueOnce(indexCountData)

      const report = await adapter.generatePerformanceReport('project-a')

      expect(report.project_ref).toBe('project-a')
      expect(report.generated_at).toBeDefined()
      expect(report.slow_queries).toBeDefined()
      expect(report.query_analysis).toBeDefined()
      expect(report.index_suggestions).toBeDefined()
      expect(report.database_stats).toBeDefined()
      expect(report.database_stats.size_bytes).toBeGreaterThan(0)
      expect(report.database_stats.table_count).toBeGreaterThanOrEqual(0)
      expect(report.database_stats.index_count).toBeGreaterThanOrEqual(0)
    })

    it('should throw error if project not found', async () => {
      mockServiceRouter.getProjectConfig.mockResolvedValue(null)

      // Mock queries that run before getDatabaseStats
      mockServiceRouter.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // detectSlowQueries: CREATE EXTENSION
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // detectSlowQueries: SELECT
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // analyzeQueries: CREATE EXTENSION
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // analyzeQueries: SELECT
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // suggestIndexes: Foreign keys
        .mockRejectedValueOnce(new Error('Not available')) // suggestIndexes: Sequential scans

      await expect(adapter.generatePerformanceReport('project-a')).rejects.toThrow(
        'Project not found: project-a'
      )
    })
  })

  describe('subscribeToAlerts', () => {
    it('should subscribe to alerts successfully', async () => {
      mockServiceRouter.getProjectConfig.mockResolvedValue({
        projectRef: 'project-a',
        databaseName: 'project_a_db',
        connectionString: 'postgres://...',
        ownerUserId: 'user-123',
      })

      await expect(
        adapter.subscribeToAlerts('project-a', 'user-123')
      ).resolves.not.toThrow()
    })

    it('should throw error if project not found', async () => {
      mockServiceRouter.getProjectConfig.mockResolvedValue(null)

      await expect(adapter.subscribeToAlerts('project-a', 'user-123')).rejects.toThrow(
        'Project not found: project-a'
      )
    })
  })

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getAdvisorsServiceAdapter()
      const instance2 = getAdvisorsServiceAdapter()

      expect(instance1).toBe(instance2)
    })

    it('should create new instance after reset', () => {
      const instance1 = getAdvisorsServiceAdapter()
      resetAdvisorsServiceAdapter()
      const instance2 = getAdvisorsServiceAdapter()

      expect(instance1).not.toBe(instance2)
    })
  })
})
