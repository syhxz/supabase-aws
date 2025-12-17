/**
 * Tests for Credential Usage Metrics API endpoint
 */

import { createMocks } from 'node-mocks-http'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import handler from '../../../../pages/api/metrics/credential-usage'

// Mock the dependencies
vi.mock('../../../../lib/api/self-hosted', () => ({
  getCredentialMonitoringService: vi.fn()
}))

import { getCredentialMonitoringService } from '../../../../lib/api/self-hosted'

const mockGetCredentialMonitoringService = getCredentialMonitoringService as any

describe('/api/metrics/credential-usage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return JSON metrics by default', async () => {
    const mockHealthCheck = {
      status: 'healthy' as const,
      totalProjects: 10,
      projectsWithCredentials: 8,
      projectsUsingFallback: 2,
      fallbackUsagePercentage: 20,
      issues: [],
      recommendations: ['System is healthy'],
      timestamp: '2025-12-13T12:00:00.000Z'
    }

    const mockFallbackStats = {
      totalProjects: 10,
      projectsUsingFallback: 2,
      fallbackUsagePercentage: 20,
      recentFallbackUsage: []
    }

    const mockAuditStats = {
      totalEntries: 100,
      eventTypeCounts: [
        { eventType: 'fallback_used', count: 50 },
        { eventType: 'health_check', count: 30 },
        { eventType: 'report_generated', count: 20 }
      ],
      recentActivity: []
    }

    const mockMonitoringService = {
      performCredentialHealthCheck: vi.fn().mockReturnValue(mockHealthCheck),
      getFallbackUsageStats: vi.fn().mockReturnValue(mockFallbackStats),
      getAuditLogStats: vi.fn().mockResolvedValue(mockAuditStats)
    }

    mockGetCredentialMonitoringService.mockReturnValue(mockMonitoringService as any)

    const { req, res } = createMocks({
      method: 'GET'
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(res.getHeader('Content-Type')).toBe('application/json')
    
    const responseData = JSON.parse(res._getData())
    
    expect(responseData).toMatchObject({
      timestamp: expect.any(String),
      metrics: {
        credential_system_health_status: {
          value: 1, // healthy = 1
          labels: { status: 'healthy' }
        },
        credential_total_projects: { value: 10 },
        credential_projects_with_credentials: { value: 8 },
        credential_projects_using_fallback: { value: 2 },
        credential_fallback_usage_percentage: { value: 20 },
        credential_audit_total_entries: { value: 100 },
        credential_system_issues_count: { value: 0 },
        credential_system_recommendations_count: { value: 1 }
      }
    })

    expect(responseData.metrics.credential_audit_events_by_type).toHaveLength(3)
    expect(responseData.metrics.credential_audit_events_by_type[0]).toMatchObject({
      value: 50,
      labels: { event_type: 'fallback_used' }
    })
  })

  it('should return Prometheus format when requested', async () => {
    const mockHealthCheck = {
      status: 'warning' as const,
      totalProjects: 5,
      projectsWithCredentials: 3,
      projectsUsingFallback: 2,
      fallbackUsagePercentage: 40,
      issues: ['High fallback usage'],
      recommendations: ['Migrate projects'],
      timestamp: '2025-12-13T12:00:00.000Z'
    }

    const mockFallbackStats = {
      totalProjects: 5,
      projectsUsingFallback: 2,
      fallbackUsagePercentage: 40,
      recentFallbackUsage: []
    }

    const mockAuditStats = {
      totalEntries: 50,
      eventTypeCounts: [
        { eventType: 'fallback_used', count: 30 },
        { eventType: 'health_check', count: 20 }
      ],
      recentActivity: []
    }

    const mockMonitoringService = {
      performCredentialHealthCheck: vi.fn().mockReturnValue(mockHealthCheck),
      getFallbackUsageStats: vi.fn().mockReturnValue(mockFallbackStats),
      getAuditLogStats: vi.fn().mockResolvedValue(mockAuditStats)
    }

    mockGetCredentialMonitoringService.mockReturnValue(mockMonitoringService as any)

    const { req, res } = createMocks({
      method: 'GET',
      query: { format: 'prometheus' }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(res.getHeader('Content-Type')).toBe('text/plain; version=0.0.4; charset=utf-8')
    
    const responseData = res._getData()
    
    // Check for Prometheus format
    expect(responseData).toContain('# HELP credential_system_health_status')
    expect(responseData).toContain('# TYPE credential_system_health_status gauge')
    expect(responseData).toContain('credential_system_health_status{status="warning"} 0.5')
    expect(responseData).toContain('credential_total_projects 5')
    expect(responseData).toContain('credential_projects_using_fallback 2')
    expect(responseData).toContain('credential_fallback_usage_percentage 40')
    expect(responseData).toContain('credential_audit_events_by_type{event_type="fallback_used"} 30')
  })

  it('should reject non-GET methods', async () => {
    const { req, res } = createMocks({
      method: 'POST'
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
    expect(JSON.parse(res._getData())).toMatchObject({
      error: 'Method Not Allowed'
    })
  })
})