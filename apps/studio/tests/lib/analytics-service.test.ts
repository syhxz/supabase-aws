/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  AnalyticsServiceAdapter,
  getAnalyticsServiceAdapter,
  resetAnalyticsServiceAdapter,
} from '../../lib/analytics-service/AnalyticsServiceAdapter'
import { getServiceRouter, resetServiceRouter } from '../../lib/service-router/ServiceRouter'

// Mock the service router
vi.mock('../../lib/service-router/ServiceRouter', () => ({
  getServiceRouter: vi.fn(),
  resetServiceRouter: vi.fn(),
}))

describe('AnalyticsServiceAdapter', () => {
  let adapter: AnalyticsServiceAdapter
  let mockServiceRouter: any

  beforeEach(() => {
    // Reset the singleton
    resetAnalyticsServiceAdapter()

    // Create mock service router
    mockServiceRouter = {
      query: vi.fn(),
      getProjectConfig: vi.fn(),
      getPoolStats: vi.fn(),
    }

    // Mock getServiceRouter to return our mock
    vi.mocked(getServiceRouter).mockReturnValue(mockServiceRouter)

    // Create adapter instance
    adapter = getAnalyticsServiceAdapter()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('trackEvent', () => {
    it('should track an event successfully', async () => {
      mockServiceRouter.query.mockResolvedValue({ rows: [], rowCount: 1 })

      await adapter.trackEvent('project-a', {
        event_type: 'api_call',
        event_data: { endpoint: '/api/users', method: 'GET' },
        user_id: 'user-123',
      })

      expect(mockServiceRouter.query).toHaveBeenCalledWith(
        'project-a',
        expect.stringContaining('INSERT INTO analytics.events'),
        expect.arrayContaining([
          expect.any(String), // UUID
          'api_call',
          expect.stringContaining('endpoint'),
          'user-123',
          expect.any(String), // timestamp
        ])
      )
    })

    it('should track an event without user_id', async () => {
      mockServiceRouter.query.mockResolvedValue({ rows: [], rowCount: 1 })

      await adapter.trackEvent('project-a', {
        event_type: 'system_event',
      })

      expect(mockServiceRouter.query).toHaveBeenCalledWith(
        'project-a',
        expect.stringContaining('INSERT INTO analytics.events'),
        expect.arrayContaining([
          expect.any(String),
          'system_event',
          null,
          null,
          expect.any(String),
        ])
      )
    })

    it('should throw error for missing event_type', async () => {
      await expect(
        adapter.trackEvent('project-a', {
          event_type: '',
        })
      ).rejects.toThrow('Event type is required')
    })
  })

  describe('getMetrics', () => {
    it('should retrieve metrics successfully', async () => {
      const mockRows = [
        {
          metric_name: 'response_time_ms',
          metric_value: '145.5',
          dimensions: JSON.stringify({ endpoint: '/api/users' }),
          timestamp: '2025-01-27T10:00:00Z',
        },
        {
          metric_name: 'error_rate',
          metric_value: '0.05',
          dimensions: null,
          timestamp: '2025-01-27T10:00:00Z',
        },
      ]

      mockServiceRouter.query.mockResolvedValue({ rows: mockRows, rowCount: 2 })

      const timeRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31'),
      }

      const metrics = await adapter.getMetrics(
        'project-a',
        ['response_time_ms', 'error_rate'],
        timeRange
      )

      expect(metrics).toHaveLength(2)
      expect(metrics[0]).toEqual({
        metric_name: 'response_time_ms',
        metric_value: 145.5,
        dimensions: { endpoint: '/api/users' },
        timestamp: '2025-01-27T10:00:00Z',
      })
      expect(metrics[1]).toEqual({
        metric_name: 'error_rate',
        metric_value: 0.05,
        dimensions: undefined,
        timestamp: '2025-01-27T10:00:00Z',
      })
    })

    it('should throw error for empty metrics array', async () => {
      const timeRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31'),
      }

      await expect(adapter.getMetrics('project-a', [], timeRange)).rejects.toThrow(
        'At least one metric name must be specified'
      )
    })
  })

  describe('getDatabaseSize', () => {
    it('should return database size', async () => {
      mockServiceRouter.getProjectConfig.mockResolvedValue({
        projectRef: 'project-a',
        databaseName: 'project_a_db',
        connectionString: 'postgres://...',
        ownerUserId: 'user-123',
      })

      mockServiceRouter.query.mockResolvedValue({
        rows: [{ size: '1048576' }],
        rowCount: 1,
      })

      const size = await adapter.getDatabaseSize('project-a')

      expect(size).toBe(1048576)
      expect(mockServiceRouter.query).toHaveBeenCalledWith(
        'project-a',
        expect.stringContaining('pg_database_size'),
        ['project_a_db']
      )
    })

    it('should throw error if project not found', async () => {
      mockServiceRouter.getProjectConfig.mockResolvedValue(null)

      await expect(adapter.getDatabaseSize('project-a')).rejects.toThrow(
        'Project not found: project-a'
      )
    })

    it('should throw error if size query fails', async () => {
      mockServiceRouter.getProjectConfig.mockResolvedValue({
        projectRef: 'project-a',
        databaseName: 'project_a_db',
        connectionString: 'postgres://...',
        ownerUserId: 'user-123',
      })

      mockServiceRouter.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      })

      await expect(adapter.getDatabaseSize('project-a')).rejects.toThrow(
        'Failed to get database size for project: project-a'
      )
    })
  })

  describe('generateReport', () => {
    beforeEach(() => {
      // Mock project config
      mockServiceRouter.getProjectConfig.mockResolvedValue({
        projectRef: 'project-a',
        databaseName: 'project_a_db',
        connectionString: 'postgres://...',
        ownerUserId: 'user-123',
      })
    })

    it('should generate usage report', async () => {
      // Mock database size query
      mockServiceRouter.query
        .mockResolvedValueOnce({ rows: [{ size: '1048576' }], rowCount: 1 })
        // Mock event count query
        .mockResolvedValueOnce({ rows: [{ count: '150' }], rowCount: 1 })

      const report = await adapter.generateReport('project-a', 'usage')

      expect(report.report_type).toBe('usage')
      expect(report.project_ref).toBe('project-a')
      expect(report.data.database_size_bytes).toBe(1048576)
      expect(report.data.database_size_mb).toBe(1)
      expect(report.data.events_last_30_days).toBe(150)
    })

    it('should generate events report', async () => {
      mockServiceRouter.query.mockResolvedValueOnce({
        rows: [
          { event_type: 'api_call', count: '100' },
          { event_type: 'user_action', count: '50' },
        ],
        rowCount: 2,
      })

      const report = await adapter.generateReport('project-a', 'events')

      expect(report.report_type).toBe('events')
      expect(report.data.total_events).toBe(150)
      expect(report.data.events_by_type).toHaveLength(2)
      expect(report.data.events_by_type[0]).toEqual({
        event_type: 'api_call',
        count: 100,
      })
    })

    it('should generate metrics report', async () => {
      // Mock metric names query
      mockServiceRouter.query
        .mockResolvedValueOnce({
          rows: [{ metric_name: 'response_time_ms' }, { metric_name: 'error_rate' }],
          rowCount: 2,
        })
        // Mock latest value queries
        .mockResolvedValueOnce({
          rows: [{ metric_value: '145.5', timestamp: '2025-01-27T10:00:00Z' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ metric_value: '0.05', timestamp: '2025-01-27T10:00:00Z' }],
          rowCount: 1,
        })

      const report = await adapter.generateReport('project-a', 'metrics')

      expect(report.report_type).toBe('metrics')
      expect(report.data.metric_count).toBe(2)
      expect(report.data.metrics.response_time_ms).toEqual({
        latest_value: 145.5,
        timestamp: '2025-01-27T10:00:00Z',
      })
    })

    it('should generate summary report', async () => {
      // Mock all queries for summary report
      mockServiceRouter.query
        // Usage: database size
        .mockResolvedValueOnce({ rows: [{ size: '1048576' }], rowCount: 1 })
        // Usage: event count
        .mockResolvedValueOnce({ rows: [{ count: '150' }], rowCount: 1 })
        // Events: events by type
        .mockResolvedValueOnce({
          rows: [{ event_type: 'api_call', count: '100' }],
          rowCount: 1,
        })
        // Metrics: metric names
        .mockResolvedValueOnce({
          rows: [{ metric_name: 'response_time_ms' }],
          rowCount: 1,
        })
        // Metrics: latest value
        .mockResolvedValueOnce({
          rows: [{ metric_value: '145.5', timestamp: '2025-01-27T10:00:00Z' }],
          rowCount: 1,
        })

      const report = await adapter.generateReport('project-a', 'summary')

      expect(report.report_type).toBe('summary')
      expect(report.data.usage).toBeDefined()
      expect(report.data.events).toBeDefined()
      expect(report.data.metrics).toBeDefined()
    })

    it('should throw error for unsupported report type', async () => {
      await expect(adapter.generateReport('project-a', 'invalid')).rejects.toThrow(
        'Unsupported report type: invalid'
      )
    })
  })

  describe('getApiCallCount', () => {
    it('should return API call count', async () => {
      mockServiceRouter.query.mockResolvedValue({
        rows: [{ count: '250' }],
        rowCount: 1,
      })

      const timeRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31'),
      }

      const count = await adapter.getApiCallCount('project-a', timeRange)

      expect(count).toBe(250)
      expect(mockServiceRouter.query).toHaveBeenCalledWith(
        'project-a',
        expect.stringContaining("event_type LIKE 'api%'"),
        expect.any(Array)
      )
    })

    it('should return 0 if no API calls found', async () => {
      mockServiceRouter.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      })

      const timeRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31'),
      }

      const count = await adapter.getApiCallCount('project-a', timeRange)

      expect(count).toBe(0)
    })
  })

  describe('getActiveConnections', () => {
    it('should return active connections count', async () => {
      mockServiceRouter.getPoolStats.mockReturnValue({
        totalCount: 10,
        idleCount: 3,
        waitingCount: 0,
      })

      const count = await adapter.getActiveConnections('project-a')

      expect(count).toBe(7) // 10 - 3
    })

    it('should return 0 if pool stats not available', async () => {
      mockServiceRouter.getPoolStats.mockReturnValue(null)

      const count = await adapter.getActiveConnections('project-a')

      expect(count).toBe(0)
    })
  })

  describe('recordMetric', () => {
    it('should record a metric successfully', async () => {
      mockServiceRouter.query.mockResolvedValue({ rows: [], rowCount: 1 })

      await adapter.recordMetric('project-a', 'response_time_ms', 145.5, {
        endpoint: '/api/users',
      })

      expect(mockServiceRouter.query).toHaveBeenCalledWith(
        'project-a',
        expect.stringContaining('INSERT INTO analytics.metrics'),
        expect.arrayContaining([
          expect.any(String), // UUID
          'response_time_ms',
          145.5,
          expect.stringContaining('endpoint'),
          expect.any(String), // timestamp
        ])
      )
    })

    it('should record a metric without dimensions', async () => {
      mockServiceRouter.query.mockResolvedValue({ rows: [], rowCount: 1 })

      await adapter.recordMetric('project-a', 'error_rate', 0.05)

      expect(mockServiceRouter.query).toHaveBeenCalledWith(
        'project-a',
        expect.stringContaining('INSERT INTO analytics.metrics'),
        expect.arrayContaining([expect.any(String), 'error_rate', 0.05, null, expect.any(String)])
      )
    })

    it('should throw error for missing metric name', async () => {
      await expect(adapter.recordMetric('project-a', '', 100)).rejects.toThrow(
        'Metric name is required'
      )
    })

    it('should throw error for invalid metric value', async () => {
      await expect(adapter.recordMetric('project-a', 'test_metric', NaN)).rejects.toThrow(
        'Metric value must be a valid number'
      )
    })
  })

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getAnalyticsServiceAdapter()
      const instance2 = getAnalyticsServiceAdapter()

      expect(instance1).toBe(instance2)
    })

    it('should create new instance after reset', () => {
      const instance1 = getAnalyticsServiceAdapter()
      resetAnalyticsServiceAdapter()
      const instance2 = getAnalyticsServiceAdapter()

      expect(instance1).not.toBe(instance2)
    })
  })
})
