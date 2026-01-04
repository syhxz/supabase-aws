/**
 * Tests for GoTrue Health Monitoring functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getHealthMonitor,
  resetHealthMonitor,
  checkGoTrueHealthWithRateLimit,
  type RateLimitConfig,
  type PerformanceThresholds
} from '../../lib/gotrue-health-monitoring'
import type { GoTrueHealthResult } from '../../lib/gotrue-health'

describe('GoTrue Health Monitoring', () => {
  beforeEach(() => {
    resetHealthMonitor()
    vi.clearAllMocks()
  })

  describe('Rate Limiting', () => {
    it('should allow health checks when within rate limits', async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue({
        available: true,
        responseTime: 100,
      } as GoTrueHealthResult)

      const result = await checkGoTrueHealthWithRateLimit(mockHealthCheck)

      expect(result.available).toBe(true)
      expect(mockHealthCheck).toHaveBeenCalledOnce()
    })

    it('should throttle health checks when minimum interval not met', async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue({
        available: true,
        responseTime: 100,
      } as GoTrueHealthResult)

      const rateLimitConfig: Partial<RateLimitConfig> = {
        minHealthCheckInterval: 1000, // 1 second
      }

      // First call should succeed
      const result1 = await checkGoTrueHealthWithRateLimit(mockHealthCheck, rateLimitConfig)
      expect(result1.available).toBe(true)

      // Second call immediately should be throttled
      const result2 = await checkGoTrueHealthWithRateLimit(mockHealthCheck, rateLimitConfig)
      expect(result2.available).toBe(false)
      expect(result2.error).toContain('throttled')

      expect(mockHealthCheck).toHaveBeenCalledOnce()
    })

    it('should track metrics correctly', async () => {
      const mockHealthCheck = vi.fn()
        .mockResolvedValueOnce({
          available: true,
          responseTime: 100,
        } as GoTrueHealthResult)
        .mockResolvedValueOnce({
          available: false,
          responseTime: 200,
          error: 'Service unavailable',
        } as GoTrueHealthResult)

      // First successful call
      await checkGoTrueHealthWithRateLimit(mockHealthCheck)
      
      // Wait a bit to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Second failed call
      await checkGoTrueHealthWithRateLimit(mockHealthCheck)

      const monitor = getHealthMonitor()
      const metrics = monitor.getMetrics()

      expect(metrics.totalRequests).toBe(2)
      expect(metrics.successfulRequests).toBe(1)
      expect(metrics.failedRequests).toBe(1)
      expect(metrics.averageResponseTime).toBe(50) // (100 + 0) / 2 = 50
      expect(metrics.minResponseTime).toBe(0) // Throttled request has 0 response time
      expect(metrics.maxResponseTime).toBe(100)
    })
  })

  describe('Performance Analysis', () => {
    it('should provide performance analysis', async () => {
      const mockHealthCheck = vi.fn()
        .mockResolvedValueOnce({
          available: true,
          responseTime: 100,
        } as GoTrueHealthResult)
        .mockResolvedValueOnce({
          available: false,
          responseTime: 200,
          error: 'Service unavailable',
        } as GoTrueHealthResult)

      // Make some calls
      await checkGoTrueHealthWithRateLimit(mockHealthCheck)
      await new Promise(resolve => setTimeout(resolve, 10))
      await checkGoTrueHealthWithRateLimit(mockHealthCheck)

      const monitor = getHealthMonitor()
      const analysis = monitor.getPerformanceAnalysis()

      expect(analysis.recentFailureRate).toBe(0.5) // 1 failure out of 2 requests
      expect(analysis.averageRecentResponseTime).toBe(50) // (100 + 0) / 2
      expect(analysis.performanceStatus).toBe('critical') // 50% failure rate exceeds default 10% threshold
      expect(Array.isArray(analysis.recommendations)).toBe(true)
    })

    it('should detect performance issues', async () => {
      const performanceThresholds: Partial<PerformanceThresholds> = {
        responseTimeWarning: 50,
        responseTimeCritical: 100,
        maxFailureRate: 0.1,
      }

      const mockHealthCheck = vi.fn()
        .mockResolvedValueOnce({
          available: false,
          responseTime: 150,
          error: 'Service unavailable',
        } as GoTrueHealthResult)
        .mockResolvedValueOnce({
          available: false,
          responseTime: 200,
          error: 'Service unavailable',
        } as GoTrueHealthResult)

      // Make calls that exceed thresholds
      await checkGoTrueHealthWithRateLimit(mockHealthCheck, undefined, performanceThresholds)
      await new Promise(resolve => setTimeout(resolve, 10))
      await checkGoTrueHealthWithRateLimit(mockHealthCheck, undefined, performanceThresholds)

      const monitor = getHealthMonitor(undefined, performanceThresholds)
      const analysis = monitor.getPerformanceAnalysis()

      expect(analysis.recentFailureRate).toBe(1.0) // 100% failure rate
      expect(analysis.performanceStatus).toBe('critical')
      expect(analysis.recommendations.length).toBeGreaterThan(0)
      expect(analysis.recommendations.some(r => r.includes('High failure rate'))).toBe(true)
    })
  })

  describe('Health Monitor Instance Management', () => {
    it('should return the same instance when called multiple times', () => {
      const monitor1 = getHealthMonitor()
      const monitor2 = getHealthMonitor()

      expect(monitor1).toBe(monitor2)
    })

    it('should reset the global instance', () => {
      const monitor1 = getHealthMonitor()
      resetHealthMonitor()
      const monitor2 = getHealthMonitor()

      expect(monitor1).not.toBe(monitor2)
    })
  })
})