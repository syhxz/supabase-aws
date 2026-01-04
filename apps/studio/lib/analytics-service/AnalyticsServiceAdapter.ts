import { getServiceRouter } from '../service-router'
import { v4 as uuidv4 } from 'uuid'

/**
 * Analytics event interface
 */
export interface AnalyticsEvent {
  event_type: string
  event_data?: Record<string, any>
  user_id?: string
}

/**
 * Metric data interface
 */
export interface MetricData {
  metric_name: string
  metric_value: number
  dimensions?: Record<string, any>
  timestamp: string
}

/**
 * Time range for queries
 */
export interface TimeRange {
  start: Date
  end: Date
}

/**
 * Report interface
 */
export interface Report {
  report_type: string
  generated_at: string
  project_ref: string
  data: Record<string, any>
}

/**
 * Analytics Service Adapter
 * 
 * Provides project-isolated analytics services.
 * Each project has its own analytics.events and analytics.metrics tables.
 */
export class AnalyticsServiceAdapter {
  private serviceRouter = getServiceRouter()

  /**
   * Track an event for a project
   * 
   * @param projectRef - The project reference
   * @param event - The analytics event
   */
  async trackEvent(projectRef: string, event: AnalyticsEvent): Promise<void> {
    const { event_type, event_data, user_id } = event

    // Validate event
    if (!event_type || event_type.trim().length === 0) {
      throw new Error('Event type is required')
    }

    // Insert event into analytics.events table
    await this.serviceRouter.query(
      projectRef,
      `INSERT INTO analytics.events (id, event_type, event_data, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        uuidv4(),
        event_type,
        event_data ? JSON.stringify(event_data) : null,
        user_id || null,
        new Date().toISOString(),
      ]
    )
  }

  /**
   * Get metrics for a project
   * 
   * @param projectRef - The project reference
   * @param metrics - Array of metric names to retrieve
   * @param timeRange - Time range for the metrics
   * @returns Array of metric data
   */
  async getMetrics(
    projectRef: string,
    metrics: string[],
    timeRange: TimeRange
  ): Promise<MetricData[]> {
    if (!metrics || metrics.length === 0) {
      throw new Error('At least one metric name must be specified')
    }

    // Query metrics from analytics.metrics table
    const result = await this.serviceRouter.query<any>(
      projectRef,
      `SELECT metric_name, metric_value, dimensions, timestamp
       FROM analytics.metrics
       WHERE metric_name = ANY($1)
         AND timestamp >= $2
         AND timestamp <= $3
       ORDER BY timestamp DESC`,
      [metrics, timeRange.start.toISOString(), timeRange.end.toISOString()]
    )

    return result.rows.map((row) => ({
      metric_name: row.metric_name,
      metric_value: parseFloat(row.metric_value),
      dimensions: row.dimensions ? JSON.parse(row.dimensions) : undefined,
      timestamp: row.timestamp,
    }))
  }

  /**
   * Get database size for a project
   * 
   * @param projectRef - The project reference
   * @returns Database size in bytes
   */
  async getDatabaseSize(projectRef: string): Promise<number> {
    // Get project configuration to determine database name
    const config = await this.serviceRouter.getProjectConfig(projectRef)
    
    if (!config) {
      throw new Error(`Project not found: ${projectRef}`)
    }

    // Query database size using pg_database_size
    const result = await this.serviceRouter.query<{ size: string }>(
      projectRef,
      `SELECT pg_database_size($1) as size`,
      [config.databaseName]
    )

    if (result.rows.length === 0) {
      throw new Error(`Failed to get database size for project: ${projectRef}`)
    }

    return parseInt(result.rows[0].size, 10)
  }

  /**
   * Generate a report for a project
   * 
   * @param projectRef - The project reference
   * @param reportType - Type of report to generate
   * @returns Generated report
   */
  async generateReport(projectRef: string, reportType: string): Promise<Report> {
    const generatedAt = new Date().toISOString()

    // Generate report based on type
    let reportData: Record<string, any> = {}

    switch (reportType) {
      case 'usage':
        reportData = await this.generateUsageReport(projectRef)
        break
      case 'events':
        reportData = await this.generateEventsReport(projectRef)
        break
      case 'metrics':
        reportData = await this.generateMetricsReport(projectRef)
        break
      case 'summary':
        reportData = await this.generateSummaryReport(projectRef)
        break
      default:
        throw new Error(`Unsupported report type: ${reportType}`)
    }

    return {
      report_type: reportType,
      generated_at: generatedAt,
      project_ref: projectRef,
      data: reportData,
    }
  }

  /**
   * Generate usage report
   * 
   * @param projectRef - The project reference
   * @returns Usage report data
   */
  private async generateUsageReport(projectRef: string): Promise<Record<string, any>> {
    // Get database size
    const databaseSize = await this.getDatabaseSize(projectRef)

    // Get event count for last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const eventCountResult = await this.serviceRouter.query<{ count: string }>(
      projectRef,
      `SELECT COUNT(*) as count
       FROM analytics.events
       WHERE created_at >= $1`,
      [thirtyDaysAgo.toISOString()]
    )

    const eventCount = parseInt(eventCountResult.rows[0]?.count || '0', 10)

    return {
      database_size_bytes: databaseSize,
      database_size_mb: Math.round(databaseSize / (1024 * 1024) * 100) / 100,
      events_last_30_days: eventCount,
      period: {
        start: thirtyDaysAgo.toISOString(),
        end: new Date().toISOString(),
      },
    }
  }

  /**
   * Generate events report
   * 
   * @param projectRef - The project reference
   * @returns Events report data
   */
  private async generateEventsReport(projectRef: string): Promise<Record<string, any>> {
    // Get event counts by type for last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const eventsByTypeResult = await this.serviceRouter.query<{
      event_type: string
      count: string
    }>(
      projectRef,
      `SELECT event_type, COUNT(*) as count
       FROM analytics.events
       WHERE created_at >= $1
       GROUP BY event_type
       ORDER BY count DESC
       LIMIT 20`,
      [sevenDaysAgo.toISOString()]
    )

    const eventsByType = eventsByTypeResult.rows.map((row) => ({
      event_type: row.event_type,
      count: parseInt(row.count, 10),
    }))

    // Get total event count
    const totalEvents = eventsByType.reduce((sum, item) => sum + item.count, 0)

    return {
      total_events: totalEvents,
      events_by_type: eventsByType,
      period: {
        start: sevenDaysAgo.toISOString(),
        end: new Date().toISOString(),
      },
    }
  }

  /**
   * Generate metrics report
   * 
   * @param projectRef - The project reference
   * @returns Metrics report data
   */
  private async generateMetricsReport(projectRef: string): Promise<Record<string, any>> {
    // Get all unique metric names
    const metricNamesResult = await this.serviceRouter.query<{ metric_name: string }>(
      projectRef,
      `SELECT DISTINCT metric_name
       FROM analytics.metrics
       ORDER BY metric_name`
    )

    const metricNames = metricNamesResult.rows.map((row) => row.metric_name)

    // Get latest value for each metric
    const metricsData: Record<string, any> = {}

    for (const metricName of metricNames) {
      const latestValueResult = await this.serviceRouter.query<{
        metric_value: string
        timestamp: string
      }>(
        projectRef,
        `SELECT metric_value, timestamp
         FROM analytics.metrics
         WHERE metric_name = $1
         ORDER BY timestamp DESC
         LIMIT 1`,
        [metricName]
      )

      if (latestValueResult.rows.length > 0) {
        metricsData[metricName] = {
          latest_value: parseFloat(latestValueResult.rows[0].metric_value),
          timestamp: latestValueResult.rows[0].timestamp,
        }
      }
    }

    return {
      metrics: metricsData,
      metric_count: metricNames.length,
    }
  }

  /**
   * Generate summary report
   * 
   * @param projectRef - The project reference
   * @returns Summary report data
   */
  private async generateSummaryReport(projectRef: string): Promise<Record<string, any>> {
    // Combine data from multiple report types
    const usageData = await this.generateUsageReport(projectRef)
    const eventsData = await this.generateEventsReport(projectRef)
    const metricsData = await this.generateMetricsReport(projectRef)

    return {
      usage: usageData,
      events: eventsData,
      metrics: metricsData,
    }
  }

  /**
   * Get API call count for a project
   * 
   * @param projectRef - The project reference
   * @param timeRange - Time range for the count
   * @returns Number of API calls
   */
  async getApiCallCount(projectRef: string, timeRange: TimeRange): Promise<number> {
    // Count events with event_type 'api_call' or similar
    const result = await this.serviceRouter.query<{ count: string }>(
      projectRef,
      `SELECT COUNT(*) as count
       FROM analytics.events
       WHERE event_type LIKE 'api%'
         AND created_at >= $1
         AND created_at <= $2`,
      [timeRange.start.toISOString(), timeRange.end.toISOString()]
    )

    return parseInt(result.rows[0]?.count || '0', 10)
  }

  /**
   * Get active connections for a project
   * 
   * @param projectRef - The project reference
   * @returns Number of active connections
   */
  async getActiveConnections(projectRef: string): Promise<number> {
    // Get connection pool stats from service router
    const poolStats = this.serviceRouter.getPoolStats(projectRef)

    if (!poolStats) {
      return 0
    }

    return poolStats.totalCount - poolStats.idleCount
  }

  /**
   * Record a metric value
   * 
   * @param projectRef - The project reference
   * @param metricName - Name of the metric
   * @param metricValue - Value of the metric
   * @param dimensions - Optional dimensions for the metric
   */
  async recordMetric(
    projectRef: string,
    metricName: string,
    metricValue: number,
    dimensions?: Record<string, any>
  ): Promise<void> {
    if (!metricName || metricName.trim().length === 0) {
      throw new Error('Metric name is required')
    }

    if (typeof metricValue !== 'number' || isNaN(metricValue)) {
      throw new Error('Metric value must be a valid number')
    }

    await this.serviceRouter.query(
      projectRef,
      `INSERT INTO analytics.metrics (id, metric_name, metric_value, dimensions, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        uuidv4(),
        metricName,
        metricValue,
        dimensions ? JSON.stringify(dimensions) : null,
        new Date().toISOString(),
      ]
    )
  }
}

// Singleton instance
let analyticsServiceAdapter: AnalyticsServiceAdapter | null = null

/**
 * Get the singleton AnalyticsServiceAdapter instance
 */
export function getAnalyticsServiceAdapter(): AnalyticsServiceAdapter {
  if (!analyticsServiceAdapter) {
    analyticsServiceAdapter = new AnalyticsServiceAdapter()
  }
  return analyticsServiceAdapter
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetAnalyticsServiceAdapter(): void {
  analyticsServiceAdapter = null
}
