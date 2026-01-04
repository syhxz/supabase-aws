/**
 * Tests for GoTrue Recovery Detection functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getRecoveryDetector,
  resetRecoveryDetector,
  processHealthCheckForRecovery,
  getCurrentHealthState,
  getRecoveryHistory,
  onRecoveryNotification,
  triggerManualRecoveryCheck,
  type RecoveryConfig
} from '../../lib/gotrue-recovery-detection'
import type { GoTrueHealthResult } from '../../lib/gotrue-health'

describe('GoTrue Recovery Detection', () => {
  beforeEach(() => {
    resetRecoveryDetector()
    vi.clearAllMocks()
  })

  describe('Health State Tracking', () => {
    it('should start with unknown status', () => {
      const state = getCurrentHealthState()
      expect(state.status).toBe('unknown')
      expect(state.consecutiveFailures).toBe(0)
      expect(state.consecutiveSuccesses).toBe(0)
    })

    it('should track consecutive successes', () => {
      const successResult: GoTrueHealthResult = {
        available: true,
        responseTime: 100,
      }

      processHealthCheckForRecovery(successResult)
      processHealthCheckForRecovery(successResult)
      processHealthCheckForRecovery(successResult)

      const state = getCurrentHealthState()
      expect(state.consecutiveSuccesses).toBe(3)
      expect(state.consecutiveFailures).toBe(0)
      expect(state.status).toBe('healthy')
    })

    it('should track consecutive failures', () => {
      const failureResult: GoTrueHealthResult = {
        available: false,
        error: 'Service unavailable',
        responseTime: 0,
      }

      processHealthCheckForRecovery(failureResult)
      processHealthCheckForRecovery(failureResult)
      processHealthCheckForRecovery(failureResult)

      const state = getCurrentHealthState()
      expect(state.consecutiveFailures).toBe(3)
      expect(state.consecutiveSuccesses).toBe(0)
      expect(state.status).toBe('unhealthy')
    })

    it('should reset counters when status changes', () => {
      const failureResult: GoTrueHealthResult = {
        available: false,
        error: 'Service unavailable',
        responseTime: 0,
      }
      const successResult: GoTrueHealthResult = {
        available: true,
        responseTime: 100,
      }

      // Build up failures
      processHealthCheckForRecovery(failureResult)
      processHealthCheckForRecovery(failureResult)
      
      let state = getCurrentHealthState()
      expect(state.consecutiveFailures).toBe(2)

      // Then success should reset failure counter
      processHealthCheckForRecovery(successResult)
      
      state = getCurrentHealthState()
      expect(state.consecutiveFailures).toBe(0)
      expect(state.consecutiveSuccesses).toBe(1)
    })
  })

  describe('Recovery Detection', () => {
    it('should detect recovery after consecutive failures', () => {
      const config: Partial<RecoveryConfig> = {
        failureThreshold: 2,
        recoveryThreshold: 2,
      }

      const failureResult: GoTrueHealthResult = {
        available: false,
        error: 'Service unavailable',
        responseTime: 0,
      }
      const successResult: GoTrueHealthResult = {
        available: true,
        responseTime: 100,
      }

      const detector = getRecoveryDetector(config)
      
      // Build up failures to trigger unhealthy status
      detector.processHealthCheckResult(failureResult)
      detector.processHealthCheckResult(failureResult)
      
      let state = detector.getHealthState()
      expect(state.status).toBe('unhealthy')

      // Now recover
      detector.processHealthCheckResult(successResult)
      detector.processHealthCheckResult(successResult)
      
      state = detector.getHealthState()
      expect(state.status).toBe('healthy')

      // Check recovery history
      const history = detector.getRecoveryHistory()
      expect(history.length).toBe(1)
      expect(history[0].failureCount).toBe(2) // Should match the failure threshold
      expect(history[0].trigger).toBe('automatic')
    })

    it('should track downtime duration', async () => {
      const config: Partial<RecoveryConfig> = {
        failureThreshold: 1,
        recoveryThreshold: 1,
      }

      const failureResult: GoTrueHealthResult = {
        available: false,
        error: 'Service unavailable',
        responseTime: 0,
      }
      const successResult: GoTrueHealthResult = {
        available: true,
        responseTime: 100,
      }

      const detector = getRecoveryDetector(config)
      
      // Trigger failure
      detector.processHealthCheckResult(failureResult)
      
      // Wait a bit
      const startTime = Date.now()
      
      // Simulate some time passing by waiting
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Recover
      detector.processHealthCheckResult(successResult)
      
      const history = detector.getRecoveryHistory()
      expect(history.length).toBe(1)
      expect(history[0].downtimeDuration).toBeGreaterThan(0)
    })
  })

  describe('Recovery Notifications', () => {
    it('should send recovery notifications', () => {
      const config: Partial<RecoveryConfig> = {
        failureThreshold: 1,
        recoveryThreshold: 1,
        enableNotifications: true,
      }

      const notifications: any[] = []
      const callback = vi.fn((notification) => {
        notifications.push(notification)
      })

      const detector = getRecoveryDetector(config)
      detector.onNotification(callback)

      const failureResult: GoTrueHealthResult = {
        available: false,
        error: 'Service unavailable',
        responseTime: 0,
      }
      const successResult: GoTrueHealthResult = {
        available: true,
        responseTime: 100,
      }
      
      // Trigger failure then recovery
      detector.processHealthCheckResult(failureResult)
      detector.processHealthCheckResult(successResult)

      expect(callback).toHaveBeenCalled()
      expect(notifications.length).toBeGreaterThan(0)
      
      const recoveryNotification = notifications.find(n => n.type === 'recovery_detected')
      expect(recoveryNotification).toBeDefined()
      expect(recoveryNotification.severity).toBe('info')
    })

    it('should respect notification cooldown', () => {
      const config: Partial<RecoveryConfig> = {
        failureThreshold: 1,
        recoveryThreshold: 1,
        enableNotifications: true,
        notificationCooldownMs: 1000,
      }

      const callback = vi.fn()
      const detector = getRecoveryDetector(config)
      detector.onNotification(callback)

      const failureResult: GoTrueHealthResult = {
        available: false,
        error: 'Service unavailable',
        responseTime: 0,
      }
      const successResult: GoTrueHealthResult = {
        available: true,
        responseTime: 100,
      }
      
      // First recovery
      detector.processHealthCheckResult(failureResult)
      detector.processHealthCheckResult(successResult)
      
      const firstCallCount = callback.mock.calls.length

      // Second recovery immediately (should be throttled)
      detector.processHealthCheckResult(failureResult)
      detector.processHealthCheckResult(successResult)
      
      const secondCallCount = callback.mock.calls.length
      
      // Should not have increased due to cooldown
      expect(secondCallCount).toBe(firstCallCount)
    })
  })

  describe('Manual Recovery Triggers', () => {
    it('should allow manual recovery triggers', () => {
      const config: Partial<RecoveryConfig> = {
        failureThreshold: 1,
        enableNotifications: true,
      }

      const callback = vi.fn()
      const detector = getRecoveryDetector(config)
      detector.onNotification(callback)

      const failureResult: GoTrueHealthResult = {
        available: false,
        error: 'Service unavailable',
        responseTime: 0,
      }
      
      // Trigger failure
      detector.processHealthCheckResult(failureResult)
      
      let state = detector.getHealthState()
      expect(state.status).toBe('unhealthy')

      // Manual recovery trigger
      detector.triggerRecoveryCheck('manual')
      
      state = detector.getHealthState()
      expect(state.status).toBe('recovering')
      
      // Should have sent notification
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('Recovery History', () => {
    it('should maintain recovery history', () => {
      const config: Partial<RecoveryConfig> = {
        failureThreshold: 1,
        recoveryThreshold: 1,
      }

      const failureResult: GoTrueHealthResult = {
        available: false,
        error: 'Service unavailable',
        responseTime: 0,
      }
      const successResult: GoTrueHealthResult = {
        available: true,
        responseTime: 100,
      }

      const detector = getRecoveryDetector(config)
      
      // First recovery cycle
      detector.processHealthCheckResult(failureResult)
      detector.processHealthCheckResult(successResult)
      
      // Second recovery cycle
      detector.processHealthCheckResult(failureResult)
      detector.processHealthCheckResult(successResult)

      const history = detector.getRecoveryHistory()
      expect(history.length).toBe(2)
      
      history.forEach(event => {
        expect(event.timestamp).toBeGreaterThan(0)
        expect(event.failureCount).toBe(1) // Each recovery should have 1 failure
        expect(event.trigger).toBe('automatic')
      })
    })

    it('should filter recent recoveries', () => {
      const config: Partial<RecoveryConfig> = {
        failureThreshold: 1,
        recoveryThreshold: 1,
      }

      const failureResult: GoTrueHealthResult = {
        available: false,
        error: 'Service unavailable',
        responseTime: 0,
      }
      const successResult: GoTrueHealthResult = {
        available: true,
        responseTime: 100,
      }

      const detector = getRecoveryDetector(config)
      
      // Recovery
      detector.processHealthCheckResult(failureResult)
      detector.processHealthCheckResult(successResult)

      const recentRecoveries = detector.getRecentRecoveries(1000) // Last 1 second
      expect(recentRecoveries.length).toBe(1)
      
      const oldRecoveries = detector.getRecentRecoveries(0) // None
      expect(oldRecoveries.length).toBe(0)
    })
  })
})