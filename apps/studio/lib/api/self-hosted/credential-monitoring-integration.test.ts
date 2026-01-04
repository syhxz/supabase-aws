/**
 * Integration tests for Credential Monitoring System
 * Tests the integration between credential fallback manager and monitoring service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  getCredentialFallbackManager,
  resetCredentialFallbackManager,
  getCredentialMonitoringService,
  resetCredentialMonitoringService
} from './index'

// Mock the database module
vi.mock('./credential-monitoring-database', () => ({
  createCredentialMonitoringDatabase: vi.fn(() => {
    throw new Error('Database not available in test environment')
  })
}))

describe('Credential Monitoring Integration', () => {
  beforeEach(() => {
    // Reset all singletons
    resetCredentialFallbackManager()
    resetCredentialMonitoringService()
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Fallback Manager and Monitoring Service Integration', () => {
    it('should automatically log to monitoring service when fallback is used', async () => {
      const fallbackManager = getCredentialFallbackManager()
      const monitoringService = getCredentialMonitoringService()

      // Log fallback usage
      fallbackManager.logFallbackUsage('test-project', 'Missing credentials', 'both')

      // Wait a bit for async logging to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      // Check that monitoring service received the log
      const auditLog = await monitoringService.getAuditLog(10, 'fallback_used')
      
      // Should have at least one entry (the one we just logged)
      expect(auditLog.length).toBeGreaterThan(0)
      
      const relevantEntry = auditLog.find(entry => 
        entry.project_ref === 'test-project' && 
        entry.event_details.reason === 'Missing credentials'
      )
      
      expect(relevantEntry).toBeDefined()
      expect(relevantEntry?.event_type).toBe('fallback_used')
      expect(relevantEntry?.event_details.credentialType).toBe('both')
    })

    it('should track fallback usage statistics correctly', async () => {
      const fallbackManager = getCredentialFallbackManager()
      const monitoringService = getCredentialMonitoringService()

      // Log multiple fallback usages
      fallbackManager.logFallbackUsage('project-1', 'Missing user', 'user')
      fallbackManager.logFallbackUsage('project-2', 'Missing password', 'password')
      fallbackManager.logFallbackUsage('project-1', 'Missing user again', 'user')

      // Wait for async logging
      await new Promise(resolve => setTimeout(resolve, 10))

      // Get statistics
      const stats = monitoringService.getFallbackUsageStats()

      expect(stats.totalProjects).toBe(2) // Two unique projects
      expect(stats.projectsUsingFallback).toBe(2)
      expect(stats.fallbackUsagePercentage).toBe(100)
      expect(stats.recentFallbackUsage.length).toBe(3) // Three total usage entries
    })

    it('should generate health check with correct fallback data', async () => {
      const fallbackManager = getCredentialFallbackManager()
      const monitoringService = getCredentialMonitoringService()

      // Create a scenario with moderate fallback usage - add multiple projects
      fallbackManager.logFallbackUsage('project-1', 'Missing credentials')
      fallbackManager.logFallbackUsage('project-2', 'Missing credentials')
      fallbackManager.logFallbackUsage('project-3', 'Missing credentials')
      
      // Mock the monitoring service's getFallbackUsageStats to simulate more total projects
      const originalGetStats = monitoringService.getFallbackUsageStats
      vi.spyOn(monitoringService, 'getFallbackUsageStats').mockReturnValue({
        totalProjects: 10, // Simulate 10 total projects
        projectsUsingFallback: 3, // 3 using fallback
        fallbackUsagePercentage: 30, // 30% usage
        recentFallbackUsage: fallbackManager.getRecentFallbackUsage()
      })

      // Wait for async logging
      await new Promise(resolve => setTimeout(resolve, 10))

      const healthCheck = monitoringService.performCredentialHealthCheck()

      expect(healthCheck.status).toBe('warning') // 30% fallback usage
      expect(healthCheck.totalProjects).toBe(10)
      expect(healthCheck.projectsUsingFallback).toBe(3)
      expect(healthCheck.fallbackUsagePercentage).toBe(30)
      expect(healthCheck.issues).toContain('Moderate fallback usage: 30% of projects using fallback credentials')
    })

    it('should handle monitoring service unavailability gracefully', () => {
      const fallbackManager = getCredentialFallbackManager()

      // This should not throw even if monitoring service has issues
      expect(() => {
        fallbackManager.logFallbackUsage('test-project', 'Test reason')
      }).not.toThrow()

      // Fallback manager should still work independently
      const recentUsage = fallbackManager.getRecentFallbackUsage(1)
      expect(recentUsage).toHaveLength(1)
      expect(recentUsage[0].projectRef).toBe('test-project')
    })

    it('should generate comprehensive reports with fallback data', async () => {
      const fallbackManager = getCredentialFallbackManager()
      const monitoringService = getCredentialMonitoringService()

      // Create test data
      fallbackManager.logFallbackUsage('project-1', 'Missing user credentials', 'user')
      fallbackManager.logFallbackUsage('project-2', 'Missing password credentials', 'password')
      fallbackManager.logFallbackUsage('project-3', 'Missing both credentials', 'both')

      // Wait for async logging
      await new Promise(resolve => setTimeout(resolve, 10))

      const report = monitoringService.generateCredentialReport()

      expect(report.summary.totalProjects).toBe(3)
      expect(report.summary.projectsUsingFallback).toBe(3)
      expect(report.summary.fallbackUsagePercentage).toBe(100)
      
      expect(report.projectStatuses).toHaveLength(3)
      expect(report.recentFallbackUsage).toHaveLength(3)
      
      expect(report.recommendations).toContain('Migrate 3 projects to use project-specific credentials')
      expect(report.healthStatus.status).toBe('critical') // 100% fallback usage
    })

    it('should track different credential types correctly', async () => {
      const fallbackManager = getCredentialFallbackManager()
      const monitoringService = getCredentialMonitoringService()

      // Log different types of credential issues
      fallbackManager.logFallbackUsage('project-1', 'Missing user only', 'user')
      fallbackManager.logFallbackUsage('project-2', 'Missing password only', 'password')
      fallbackManager.logFallbackUsage('project-3', 'Missing both', 'both')

      // Wait for async logging
      await new Promise(resolve => setTimeout(resolve, 10))

      const projectStatuses = monitoringService.getProjectCredentialStatus()

      const project1Status = projectStatuses.find(s => s.projectRef === 'project-1')
      const project2Status = projectStatuses.find(s => s.projectRef === 'project-2')
      const project3Status = projectStatuses.find(s => s.projectRef === 'project-3')

      expect(project1Status?.credentialStatus).toBe('missing_user')
      expect(project2Status?.credentialStatus).toBe('missing_password')
      expect(project3Status?.credentialStatus).toBe('missing_both')
    })
  })

  describe('Error Handling', () => {
    it('should handle async logging errors gracefully', async () => {
      const fallbackManager = getCredentialFallbackManager()
      
      // Mock console.warn to capture warnings
      const warnSpy = vi.spyOn(console, 'warn')

      // This should not throw even if there are async issues
      fallbackManager.logFallbackUsage('test-project', 'Test reason')

      // Wait for potential async operations
      await new Promise(resolve => setTimeout(resolve, 20))

      // Should not have thrown any errors
      expect(() => {
        fallbackManager.getRecentFallbackUsage()
      }).not.toThrow()
    })

    it('should continue working when monitoring database is unavailable', async () => {
      const monitoringService = getCredentialMonitoringService()

      // Should work with in-memory storage when database is unavailable
      await monitoringService.logAuditEvent('validation_failed', 'test-project', { error: 'test' })

      const auditLog = await monitoringService.getAuditLog(1)
      expect(auditLog).toHaveLength(1)
      expect(auditLog[0].event_type).toBe('validation_failed')
    })
  })
})