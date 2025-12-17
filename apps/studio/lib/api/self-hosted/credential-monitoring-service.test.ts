/**
 * Tests for Credential Monitoring Service
 * Validates monitoring, reporting, and audit capabilities for credential management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  CredentialMonitoringService,
  getCredentialMonitoringService,
  resetCredentialMonitoringService,
  type FallbackUsageStats,
  type ProjectCredentialStatus,
  type HealthCheckResult,
  type CredentialReport,
  type CredentialAuditLog
} from './credential-monitoring-service'
import { getCredentialFallbackManager, resetCredentialFallbackManager } from './credential-fallback-manager'

// Mock the database module
vi.mock('./credential-monitoring-database', () => ({
  createCredentialMonitoringDatabase: vi.fn(() => {
    throw new Error('Database not available in test environment')
  })
}))

describe('CredentialMonitoringService', () => {
  let service: CredentialMonitoringService
  let fallbackManager: ReturnType<typeof getCredentialFallbackManager>

  beforeEach(() => {
    // Reset all singletons
    resetCredentialMonitoringService()
    resetCredentialFallbackManager()
    
    // Create fresh instances
    service = getCredentialMonitoringService()
    fallbackManager = getCredentialFallbackManager()
    
    // Clear any existing logs
    service.clearAuditLog()
    fallbackManager.clearFallbackUsageLog()
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getFallbackUsageStats', () => {
    it('should return correct statistics when no fallback usage exists', () => {
      const stats = service.getFallbackUsageStats()

      expect(stats).toMatchObject({
        totalProjects: 0,
        projectsUsingFallback: 0,
        fallbackUsagePercentage: 0,
        recentFallbackUsage: []
      })
    })

    it('should calculate correct statistics with fallback usage', () => {
      // Add some fallback usage
      fallbackManager.logFallbackUsage('project-1', 'Missing user credentials')
      fallbackManager.logFallbackUsage('project-2', 'Missing password credentials')
      fallbackManager.logFallbackUsage('project-1', 'Missing user credentials') // Same project again

      const stats = service.getFallbackUsageStats()

      expect(stats.totalProjects).toBe(2) // Two unique projects
      expect(stats.projectsUsingFallback).toBe(2)
      expect(stats.fallbackUsagePercentage).toBe(100)
      expect(stats.recentFallbackUsage).toHaveLength(3)
    })

    it('should calculate correct percentage with mixed usage', () => {
      // Simulate scenario where we have more total projects than those using fallback
      fallbackManager.logFallbackUsage('project-1', 'Missing credentials')
      
      // Mock the fallback manager to return higher unique project count
      const originalGetStats = fallbackManager.getFallbackUsageStats
      vi.spyOn(fallbackManager, 'getFallbackUsageStats').mockReturnValue({
        ...originalGetStats.call(fallbackManager),
        uniqueProjects: 4 // Simulate 4 total projects known to the system
      })

      const stats = service.getFallbackUsageStats()

      expect(stats.totalProjects).toBe(4)
      expect(stats.projectsUsingFallback).toBe(1)
      expect(stats.fallbackUsagePercentage).toBe(25)
    })
  })

  describe('getProjectCredentialStatus', () => {
    it('should return empty array when no projects use fallback', () => {
      const statuses = service.getProjectCredentialStatus()
      expect(statuses).toEqual([])
    })

    it('should return correct status for projects using fallback', () => {
      fallbackManager.logFallbackUsage('project-1', 'Missing user', 'user')
      fallbackManager.logFallbackUsage('project-2', 'Missing password', 'password')
      fallbackManager.logFallbackUsage('project-3', 'Missing both', 'both')

      const statuses = service.getProjectCredentialStatus()

      expect(statuses).toHaveLength(3)
      
      const project1Status = statuses.find(s => s.projectRef === 'project-1')
      expect(project1Status).toMatchObject({
        projectRef: 'project-1',
        hasCredentials: false,
        credentialStatus: 'missing_user',
        usesFallback: true
      })

      const project2Status = statuses.find(s => s.projectRef === 'project-2')
      expect(project2Status).toMatchObject({
        projectRef: 'project-2',
        hasCredentials: false,
        credentialStatus: 'missing_password',
        usesFallback: true
      })

      const project3Status = statuses.find(s => s.projectRef === 'project-3')
      expect(project3Status).toMatchObject({
        projectRef: 'project-3',
        hasCredentials: false,
        credentialStatus: 'missing_both',
        usesFallback: true
      })
    })

    it('should use most recent usage for credential status', async () => {
      fallbackManager.logFallbackUsage('project-1', 'Missing user', 'user')
      
      // Add delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))
      fallbackManager.logFallbackUsage('project-1', 'Missing both', 'both')

      const statuses = service.getProjectCredentialStatus()
      const project1Status = statuses.find(s => s.projectRef === 'project-1')
      
      expect(project1Status?.credentialStatus).toBe('missing_both')
    })
  })

  describe('performCredentialHealthCheck', () => {
    it('should return healthy status when no fallback usage', () => {
      const healthCheck = service.performCredentialHealthCheck()

      expect(healthCheck.status).toBe('healthy')
      expect(healthCheck.totalProjects).toBe(0)
      expect(healthCheck.projectsUsingFallback).toBe(0)
      expect(healthCheck.fallbackUsagePercentage).toBe(0)
      expect(healthCheck.issues).toEqual([])
      expect(healthCheck.recommendations).toContain('System is healthy - continue monitoring credential usage')
    })

    it('should return warning status for moderate fallback usage', () => {
      // Create scenario with 25% fallback usage (1 out of 4 projects)
      fallbackManager.logFallbackUsage('project-1', 'Missing credentials')
      
      // Mock to simulate 4 total projects
      const originalGetStats = fallbackManager.getFallbackUsageStats
      vi.spyOn(fallbackManager, 'getFallbackUsageStats').mockReturnValue({
        ...originalGetStats.call(fallbackManager),
        uniqueProjects: 4
      })

      const healthCheck = service.performCredentialHealthCheck()

      expect(healthCheck.status).toBe('warning')
      expect(healthCheck.fallbackUsagePercentage).toBe(25)
      expect(healthCheck.issues).toContain('Moderate fallback usage: 25% of projects using fallback credentials')
      expect(healthCheck.recommendations).toContain('Consider migrating projects with missing credentials')
    })

    it('should return critical status for high fallback usage', () => {
      // Create scenario with 75% fallback usage (3 out of 4 projects)
      fallbackManager.logFallbackUsage('project-1', 'Missing credentials')
      fallbackManager.logFallbackUsage('project-2', 'Missing credentials')
      fallbackManager.logFallbackUsage('project-3', 'Missing credentials')
      
      // Mock to simulate 4 total projects
      const originalGetStats = fallbackManager.getFallbackUsageStats
      vi.spyOn(fallbackManager, 'getFallbackUsageStats').mockReturnValue({
        ...originalGetStats.call(fallbackManager),
        uniqueProjects: 4
      })

      const healthCheck = service.performCredentialHealthCheck()

      expect(healthCheck.status).toBe('critical')
      expect(healthCheck.fallbackUsagePercentage).toBe(75)
      expect(healthCheck.issues).toContain('High fallback usage: 75% of projects using fallback credentials')
      expect(healthCheck.recommendations).toContain('Prioritize credential migration for projects using fallback credentials')
    })

    it('should include project-specific issues and recommendations', () => {
      fallbackManager.logFallbackUsage('project-1', 'Missing credentials')
      fallbackManager.logFallbackUsage('project-2', 'Missing credentials')

      const healthCheck = service.performCredentialHealthCheck()

      expect(healthCheck.issues).toContain('2 projects are using fallback credentials')
      expect(healthCheck.recommendations).toContain('Run credential migration tool to add project-specific credentials')
    })

    it('should log health check event', async () => {
      const logSpy = vi.spyOn(service, 'logAuditEvent')
      
      service.performCredentialHealthCheck()

      expect(logSpy).toHaveBeenCalledWith(
        'health_check',
        'system',
        expect.objectContaining({
          healthStatus: 'healthy',
          fallbackUsagePercentage: 0,
          projectsUsingFallback: 0,
          totalIssues: 0
        })
      )
    })
  })

  describe('generateCredentialReport', () => {
    it('should generate comprehensive report', () => {
      fallbackManager.logFallbackUsage('project-1', 'Missing user credentials')
      fallbackManager.logFallbackUsage('project-2', 'Missing password credentials')

      const report = service.generateCredentialReport()

      expect(report).toMatchObject({
        generatedAt: expect.any(String),
        summary: {
          totalProjects: 2,
          projectsWithCredentials: 0,
          projectsUsingFallback: 2,
          fallbackUsagePercentage: 100
        }
      })

      expect(report.projectStatuses).toHaveLength(2)
      expect(report.recentFallbackUsage).toHaveLength(2)
      expect(report.healthStatus).toBeDefined()
      expect(report.recommendations).toContain('Migrate 2 projects to use project-specific credentials')
    })

    it('should include monitoring recommendations for high usage', () => {
      // Create scenario with high fallback usage
      for (let i = 1; i <= 5; i++) {
        fallbackManager.logFallbackUsage(`project-${i}`, 'Missing credentials')
      }

      const report = service.generateCredentialReport()

      expect(report.recommendations).toContain('Set up monitoring alerts for fallback credential usage')
    })

    it('should remove duplicate recommendations', () => {
      fallbackManager.logFallbackUsage('project-1', 'Missing credentials')

      const report = service.generateCredentialReport()

      // Check that recommendations are unique
      const uniqueRecommendations = [...new Set(report.recommendations)]
      expect(report.recommendations).toEqual(uniqueRecommendations)
    })

    it('should log report generation event', async () => {
      const logSpy = vi.spyOn(service, 'logAuditEvent')
      
      service.generateCredentialReport()

      expect(logSpy).toHaveBeenCalledWith(
        'report_generated',
        'system',
        expect.objectContaining({
          reportType: 'credential_report',
          projectCount: expect.any(Number),
          fallbackUsagePercentage: expect.any(Number)
        })
      )
    })
  })

  describe('logAuditEvent', () => {
    it('should log audit event with all details', async () => {
      const eventDetails = { reason: 'test', count: 5 }
      
      await service.logAuditEvent('fallback_used', 'test-project', eventDetails, 'user-123')

      const auditLog = await service.getAuditLog(1)
      expect(auditLog).toHaveLength(1)
      expect(auditLog[0]).toMatchObject({
        project_ref: 'test-project',
        event_type: 'fallback_used',
        event_details: eventDetails,
        user_id: 'user-123'
      })
    })

    it('should log to console', async () => {
      const consoleSpy = vi.spyOn(console, 'log')
      
      await service.logAuditEvent('validation_failed', 'test-project', { error: 'invalid' })

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Credential Audit] VALIDATION_FAILED: test-project',
        { error: 'invalid' }
      )
    })

    it('should maintain audit log size limit', async () => {
      // Add more than 5000 entries
      for (let i = 0; i < 5005; i++) {
        await service.logAuditEvent('fallback_used', `project-${i}`, { test: i })
      }

      const auditLog = await service.getAuditLog(6000)
      expect(auditLog.length).toBeLessThanOrEqual(5000)
    })
  })

  describe('getAuditLog', () => {
    beforeEach(async () => {
      await service.logAuditEvent('fallback_used', 'project-1', { reason: 'test1' })
      await service.logAuditEvent('validation_failed', 'project-2', { reason: 'test2' })
      await service.logAuditEvent('fallback_used', 'project-3', { reason: 'test3' })
    })

    it('should return all entries when no filter applied', async () => {
      const auditLog = await service.getAuditLog()
      expect(auditLog).toHaveLength(3)
    })

    it('should filter by event type', async () => {
      const auditLog = await service.getAuditLog(100, 'fallback_used')
      expect(auditLog).toHaveLength(2)
      expect(auditLog.every(entry => entry.event_type === 'fallback_used')).toBe(true)
    })

    it('should respect limit parameter', async () => {
      const auditLog = await service.getAuditLog(2)
      expect(auditLog).toHaveLength(2)
    })

    it('should return entries in reverse chronological order', async () => {
      const auditLog = await service.getAuditLog()
      
      // Should be ordered by timestamp descending (newest first)
      for (let i = 1; i < auditLog.length; i++) {
        const current = new Date(auditLog[i - 1].timestamp).getTime()
        const next = new Date(auditLog[i].timestamp).getTime()
        expect(current).toBeGreaterThanOrEqual(next)
      }
    })
  })

  describe('getAuditLogStats', () => {
    beforeEach(async () => {
      await service.logAuditEvent('fallback_used', 'project-1', { reason: 'test1' })
      await service.logAuditEvent('fallback_used', 'project-2', { reason: 'test2' })
      await service.logAuditEvent('validation_failed', 'project-3', { reason: 'test3' })
      await service.logAuditEvent('health_check', 'system', { status: 'healthy' })
    })

    it('should return correct statistics', async () => {
      const stats = await service.getAuditLogStats()

      expect(stats.totalEntries).toBe(4)
      expect(stats.eventTypeCounts).toEqual([
        { eventType: 'fallback_used', count: 2 },
        { eventType: 'validation_failed', count: 1 },
        { eventType: 'health_check', count: 1 }
      ])
      expect(stats.recentActivity).toHaveLength(4)
    })

    it('should sort event types by count descending', async () => {
      // Add more entries to create different counts
      await service.logAuditEvent('validation_failed', 'project-4', { reason: 'test4' })
      await service.logAuditEvent('validation_failed', 'project-5', { reason: 'test5' })

      const stats = await service.getAuditLogStats()

      expect(stats.eventTypeCounts[0]).toEqual({ eventType: 'validation_failed', count: 3 })
      expect(stats.eventTypeCounts[1]).toEqual({ eventType: 'fallback_used', count: 2 })
    })
  })

  describe('clearAuditLog', () => {
    it('should clear all audit log entries', async () => {
      await service.logAuditEvent('fallback_used', 'project-1', { reason: 'test' })
      await service.logAuditEvent('validation_failed', 'project-2', { reason: 'test' })

      expect((await service.getAuditLog()).length).toBe(2)

      service.clearAuditLog()

      expect((await service.getAuditLog()).length).toBe(0)
      expect((await service.getAuditLogStats()).totalEntries).toBe(0)
    })
  })

  describe('singleton behavior', () => {
    it('should return the same instance', () => {
      const instance1 = getCredentialMonitoringService()
      const instance2 = getCredentialMonitoringService()

      expect(instance1).toBe(instance2)
    })

    it('should maintain state across instances', async () => {
      const instance1 = getCredentialMonitoringService()
      await instance1.logAuditEvent('fallback_used', 'test-project', { reason: 'test' })

      const instance2 = getCredentialMonitoringService()
      const auditLog = await instance2.getAuditLog()

      expect(auditLog).toHaveLength(1)
    })

    it('should reset properly', async () => {
      const instance1 = getCredentialMonitoringService()
      await instance1.logAuditEvent('fallback_used', 'test-project', { reason: 'test' })

      expect((await instance1.getAuditLog()).length).toBe(1)

      resetCredentialMonitoringService()
      const instance2 = getCredentialMonitoringService()

      expect((await instance2.getAuditLog()).length).toBe(0)
    })
  })
})