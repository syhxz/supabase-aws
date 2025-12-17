/**
 * Credential Monitoring Dashboard Component
 * Displays credential usage patterns, health status, and system metrics
 */

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, RefreshCw, Download, Eye, EyeOff } from 'lucide-react'
import { Button, Card, Badge, Alert_Shadcn_, AlertDescription_Shadcn_, AlertTitle_Shadcn_ } from 'ui'
import type { 
  HealthCheckResult, 
  CredentialReport, 
  FallbackUsageStats,
  ProjectCredentialStatus 
} from '../../../../lib/api/self-hosted/credential-monitoring-service'

interface CredentialMonitoringDashboardProps {
  projectRef?: string
}

interface DashboardMetrics {
  healthCheck: HealthCheckResult | null
  fallbackStats: FallbackUsageStats | null
  projectStatuses: ProjectCredentialStatus[]
  auditStats: {
    totalEntries: number
    eventTypeCounts: { eventType: string; count: number }[]
    recentActivity: any[]
  } | null
  lastUpdated: string | null
}

export function CredentialMonitoringDashboard({ projectRef }: CredentialMonitoringDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    healthCheck: null,
    fallbackStats: null,
    projectStatuses: [],
    auditStats: null,
    lastUpdated: null
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showProjectDetails, setShowProjectDetails] = useState(false)

  const fetchMetrics = async () => {
    try {
      setError(null)
      
      // Fetch health check
      const healthResponse = await fetch('/api/platform/credential-monitoring/health')
      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.statusText}`)
      }
      const healthCheck = await healthResponse.json()

      // Fetch stats
      const statsResponse = await fetch('/api/platform/credential-monitoring/stats')
      if (!statsResponse.ok) {
        throw new Error(`Stats fetch failed: ${statsResponse.statusText}`)
      }
      const statsData = await statsResponse.json()

      setMetrics({
        healthCheck,
        fallbackStats: statsData.fallbackUsage,
        projectStatuses: [], // Will be populated from health check data
        auditStats: statsData.auditLog,
        lastUpdated: new Date().toISOString()
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchMetrics()
  }

  const downloadReport = async () => {
    try {
      const response = await fetch('/api/platform/credential-monitoring/report')
      if (!response.ok) {
        throw new Error(`Report generation failed: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `credential-report-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download report')
    }
  }

  useEffect(() => {
    fetchMetrics()
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Credential Monitoring</h3>
          <div className="animate-spin">
            <RefreshCw className="h-4 w-4" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert_Shadcn_ variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle_Shadcn_>Error Loading Credential Monitoring</AlertTitle_Shadcn_>
        <AlertDescription_Shadcn_>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2" 
            onClick={handleRefresh}
          >
            Retry
          </Button>
        </AlertDescription_Shadcn_>
      </Alert_Shadcn_>
    )
  }

  const { healthCheck, fallbackStats, auditStats } = metrics

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Credential Monitoring</h3>
          <p className="text-sm text-gray-600">
            Monitor credential usage patterns and system health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadReport}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        </div>
      </div>

      {/* Health Status */}
      {healthCheck && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">System Health</h4>
            <Badge className={getHealthStatusColor(healthCheck.status)}>
              {getHealthStatusIcon(healthCheck.status)}
              <span className="ml-2 capitalize">{healthCheck.status}</span>
            </Badge>
          </div>
          
          {healthCheck.issues.length > 0 && (
            <Alert_Shadcn_ variant={healthCheck.status === 'critical' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle_Shadcn_>Issues Detected</AlertTitle_Shadcn_>
              <AlertDescription_Shadcn_>
                <ul className="list-disc list-inside space-y-1">
                  {healthCheck.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </AlertDescription_Shadcn_>
            </Alert_Shadcn_>
          )}

          {healthCheck.recommendations.length > 0 && (
            <div className="mt-4">
              <h5 className="font-medium mb-2">Recommendations</h5>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                {healthCheck.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold">{healthCheck?.totalProjects || 0}</p>
            </div>
          </div>
        </Card>

        {/* Projects with Credentials */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">With Credentials</p>
              <p className="text-2xl font-bold text-green-600">
                {healthCheck?.projectsWithCredentials || 0}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        {/* Projects Using Fallback */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Using Fallback</p>
              <p className="text-2xl font-bold text-yellow-600">
                {healthCheck?.projectsUsingFallback || 0}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        {/* Fallback Usage Percentage */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Fallback Usage</p>
              <p className="text-2xl font-bold">
                {healthCheck?.fallbackUsagePercentage?.toFixed(1) || 0}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      {fallbackStats && fallbackStats.recentFallbackUsage.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">Recent Fallback Usage</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProjectDetails(!showProjectDetails)}
            >
              {showProjectDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="ml-2">{showProjectDetails ? 'Hide' : 'Show'} Details</span>
            </Button>
          </div>
          
          {showProjectDetails && (
            <div className="space-y-2">
              {fallbackStats.recentFallbackUsage.slice(0, 10).map((usage, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-mono text-sm">{usage.projectRef}</span>
                    <span className="ml-2 text-sm text-gray-600">
                      ({usage.credentialType} credential missing)
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(usage.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Audit Log Summary */}
      {auditStats && (
        <Card className="p-4">
          <h4 className="font-medium mb-4">Audit Log Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-xl font-bold">{auditStats.totalEntries}</p>
            </div>
            {auditStats.eventTypeCounts.slice(0, 3).map((event, index) => (
              <div key={index}>
                <p className="text-sm font-medium text-gray-600 capitalize">
                  {event.eventType.replace('_', ' ')}
                </p>
                <p className="text-xl font-bold">{event.count}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Last Updated */}
      {metrics.lastUpdated && (
        <p className="text-xs text-gray-500 text-center">
          Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  )
}