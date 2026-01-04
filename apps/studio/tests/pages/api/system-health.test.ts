/**
 * Tests for System Health API endpoint
 */

import { createMocks } from 'node-mocks-http'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import handler from '../../../pages/api/system-health'

// Mock the dependencies
vi.mock('../../../lib/config-health', () => ({
  performConfigHealthCheck: vi.fn(),
  formatHealthCheckResult: vi.fn()
}))

vi.mock('../../../lib/api/self-hosted', () => ({
  getCredentialMonitoringService: vi.fn()
}))

import { performConfigHealthCheck, formatHealthCheckResult } from '../../../lib/config-health'
import { getCredentialMonitoringService } from '../../../lib/api/self-hosted'

const mockPerformConfigHealthCheck = performConfigHealthCheck as any
const mockFormatHealthCheckResult = formatHealthCheckResult as any
const mockGetCredentialMonitoringService = getCredentialMonitoringService as any

describe('/api/system-health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return comprehensive system health status', async () => {
    // Mock config health check
    const mockConfigHealth = {
      healthy: true,
      timestamp: '2025-12-13T12:00:00.000Z',
      checks: {
        runtimeConfigAvailable: { healthy: true, responseTime: 10 },
        gotrueReachable: { healthy: true, url: 'http://localhost:8000/auth/v1', responseTime: 20 },
        apiGatewayReachable: { healthy: true, url: 'http://localhost:8000', responseTime: 15 }
      },
      config: {
        environment: 'development',
        source: 'derived',
        gotrueUrl: 'http://localhost:8000/auth/v1',
        supabaseUrl: 'http://localhost:8000',
        apiUrl: 'http://localhost:8000'
      },
      errors: [],
      warnings: []
    }

    // Mock credential health check
    const mockCredentialHealth = {
      status: 'healthy' as const,
      totalProjects: 5,
      projectsWithCredentials: 4,
      projectsUsingFallback: 1,
      fallbackUsagePercentage: 20,
      issues: [],
      recommendations: ['System is healthy - continue monitoring credential usage'],
      timestamp: '2025-12-13T12:00:00.000Z'
    }

    const mockMonitoringService = {
      performCredentialHealthCheck: vi.fn().mockReturnValue(mockCredentialHealth)
    }

    mockPerformConfigHealthCheck.mockResolvedValue(mockConfigHealth)
    mockFormatHealthCheckResult.mockReturnValue('Mock formatted result')
    mockGetCredentialMonitoringService.mockReturnValue(mockMonitoringService as any)

    const { req, res } = createMocks({
      method: 'GET'
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    
    const responseData = JSON.parse(res._getData())
    
    expect(responseData).toMatchObject({
      healthy: true,
      overallStatus: 'healthy',
      checks: {
        runtimeConfig: { healthy: true },
        gotrue: { healthy: true },
        apiGateway: { healthy: true },
        credentialSystem: {
          healthy: true,
          status: 'healthy',
          fallbackUsagePercentage: 20,
          projectsUsingFallback: 1,
          totalProjects: 5
        }
      }
    })

    expect(responseData.timestamp).toBeDefined()
    expect(responseData.recommendations).toContain('System is healthy - continue monitoring credential usage')
  })

  it('should return warning status when credential system has issues', async () => {
    const mockConfigHealth = {
      healthy: true,
      timestamp: '2025-12-13T12:00:00.000Z',
      checks: {
        runtimeConfigAvailable: { healthy: true, responseTime: 10 },
        gotrueReachable: { healthy: true, url: 'http://localhost:8000/auth/v1', responseTime: 20 },
        apiGatewayReachable: { healthy: true, url: 'http://localhost:8000', responseTime: 15 }
      },
      config: {
        environment: 'development',
        source: 'derived'
      },
      errors: [],
      warnings: []
    }

    const mockCredentialHealth = {
      status: 'warning' as const,
      totalProjects: 10,
      projectsWithCredentials: 7,
      projectsUsingFallback: 3,
      fallbackUsagePercentage: 30,
      issues: ['Moderate fallback usage: 30% of projects using fallback credentials'],
      recommendations: ['Consider migrating projects with missing credentials'],
      timestamp: '2025-12-13T12:00:00.000Z'
    }

    const mockMonitoringService = {
      performCredentialHealthCheck: vi.fn().mockReturnValue(mockCredentialHealth)
    }

    mockPerformConfigHealthCheck.mockResolvedValue(mockConfigHealth)
    mockFormatHealthCheckResult.mockReturnValue('Mock formatted result')
    mockGetCredentialMonitoringService.mockReturnValue(mockMonitoringService as any)

    const { req, res } = createMocks({
      method: 'GET'
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    
    const responseData = JSON.parse(res._getData())
    
    expect(responseData.overallStatus).toBe('warning')
    expect(responseData.checks.credentialSystem.status).toBe('warning')
    expect(responseData.warnings).toContain('Moderate fallback usage: 30% of projects using fallback credentials')
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