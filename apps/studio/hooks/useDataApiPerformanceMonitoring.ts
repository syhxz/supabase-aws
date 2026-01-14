import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'common'

interface PerformanceMetrics {
  configLoadTime: number | null
  lastUpdateTime: number | null
  errorCount: number
  successCount: number
  averageResponseTime: number
  lastOperationDuration: number | null
}

interface PerformanceMonitoringOptions {
  enableMetrics?: boolean
  trackErrors?: boolean
  trackSuccessfulOperations?: boolean
  maxMetricsHistory?: number
}

export const useDataApiPerformanceMonitoring = (
  options: PerformanceMonitoringOptions = {}
) => {
  const {
    enableMetrics = true,
    trackErrors = true,
    trackSuccessfulOperations = true,
    maxMetricsHistory = 100,
  } = options

  const { ref: projectRef } = useParams()
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    configLoadTime: null,
    lastUpdateTime: null,
    errorCount: 0,
    successCount: 0,
    averageResponseTime: 0,
    lastOperationDuration: null,
  })

  const operationStartTime = useRef<number | null>(null)
  const responseTimes = useRef<number[]>([])

  // Start timing an operation
  const startOperation = useCallback(() => {
    if (!enableMetrics) return
    operationStartTime.current = performance.now()
  }, [enableMetrics])

  // End timing an operation and record metrics
  const endOperation = useCallback((success: boolean = true) => {
    if (!enableMetrics || operationStartTime.current === null) return

    const duration = performance.now() - operationStartTime.current
    operationStartTime.current = null

    setMetrics(prev => {
      const newResponseTimes = [...responseTimes.current, duration]
      if (newResponseTimes.length > maxMetricsHistory) {
        newResponseTimes.shift()
      }
      responseTimes.current = newResponseTimes

      const averageResponseTime = newResponseTimes.reduce((a, b) => a + b, 0) / newResponseTimes.length

      return {
        ...prev,
        lastOperationDuration: duration,
        errorCount: success ? prev.errorCount : prev.errorCount + 1,
        successCount: success ? prev.successCount + 1 : prev.successCount,
        averageResponseTime,
        lastUpdateTime: Date.now(),
      }
    })
  }, [enableMetrics, maxMetricsHistory])

  // Record configuration load time
  const recordConfigLoadTime = useCallback((loadTime: number) => {
    if (!enableMetrics) return
    setMetrics(prev => ({
      ...prev,
      configLoadTime: loadTime,
    }))
  }, [enableMetrics])

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const totalOperations = metrics.successCount + metrics.errorCount
    const successRate = totalOperations > 0 ? (metrics.successCount / totalOperations) * 100 : 0

    return {
      ...metrics,
      totalOperations,
      successRate,
      isPerformant: metrics.averageResponseTime < 1000, // Less than 1 second
      hasErrors: metrics.errorCount > 0,
    }
  }, [metrics])

  // Reset metrics
  const resetMetrics = useCallback(() => {
    setMetrics({
      configLoadTime: null,
      lastUpdateTime: null,
      errorCount: 0,
      successCount: 0,
      averageResponseTime: 0,
      lastOperationDuration: null,
    })
    responseTimes.current = []
  }, [])

  // Log performance warnings
  useEffect(() => {
    if (!enableMetrics) return

    const { averageResponseTime, errorCount, successCount } = metrics
    const totalOperations = successCount + errorCount

    // Warn about slow operations
    if (averageResponseTime > 2000 && totalOperations > 5) {
      console.warn(`[Data API Performance] Slow operations detected. Average response time: ${averageResponseTime.toFixed(2)}ms`)
    }

    // Warn about high error rate
    if (totalOperations > 10 && (errorCount / totalOperations) > 0.2) {
      console.warn(`[Data API Performance] High error rate detected. ${errorCount}/${totalOperations} operations failed`)
    }
  }, [metrics, enableMetrics])

  return {
    metrics,
    startOperation,
    endOperation,
    recordConfigLoadTime,
    getPerformanceSummary,
    resetMetrics,
    isEnabled: enableMetrics,
  }
}