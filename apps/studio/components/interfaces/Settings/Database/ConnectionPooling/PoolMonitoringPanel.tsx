import { useMemo } from 'react'
import { AlertTriangle, Activity, Users, Database, Clock } from 'lucide-react'
import { usePoolingStatisticsQuery } from 'data/database/pooling-statistics-query'
import { usePoolingHealthQuery } from 'data/database/pooling-health-query'
import { useSupavisorRecommendationsQuery } from 'data/database/supavisor-recommendations-query'
import { useProjectAddonsQuery } from 'data/subscriptions/project-addons-query'
import { useSelectedProjectQuery } from 'hooks/misc/useSelectedProject'
import { safeFind, ensureArray } from 'lib/array-validation'
import { capitalize } from 'lodash'
import {
  Alert_Shadcn_,
  AlertDescription_Shadcn_,
  AlertTitle_Shadcn_,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'ui'
import ShimmeringLoader from 'ui-patterns/ShimmeringLoader'

interface PoolMonitoringPanelProps {
  projectRef?: string
  environment: 'platform' | 'self-hosted'
  poolingService: 'pgbouncer' | 'supavisor'
}

interface PoolRecommendation {
  type: 'warning' | 'info' | 'success'
  title: string
  description: string
  suggestedPoolSize?: number
}

/**
 * Real-time pool monitoring and statistics display component
 */
export const PoolMonitoringPanel = ({ 
  projectRef, 
  environment, 
  poolingService 
}: PoolMonitoringPanelProps) => {
  const { data: project } = useSelectedProjectQuery()
  const { data: addons } = useProjectAddonsQuery({ projectRef })

  // Compute size and recommendations - must be declared before using in hooks
  const selectedAddons = ensureArray(addons?.selected_addons)
  const computeInstance = safeFind(selectedAddons, (addon: any) => addon?.type === 'compute_instance')
  const computeSize = computeInstance?.variant.name ?? capitalize(project?.infra_compute_size) ?? 'Nano'

  const {
    data: poolingStats,
    isLoading: isLoadingStats,
    error: statsError,
  } = usePoolingStatisticsQuery(
    { projectRef }, 
    { 
      enabled: !!projectRef && environment === 'self-hosted',
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  )

  const {
    data: poolingHealth,
    isLoading: isLoadingHealth,
  } = usePoolingHealthQuery(
    { projectRef }, 
    { 
      enabled: !!projectRef && environment === 'self-hosted',
      refetchInterval: 60000, // Refresh every minute
    }
  )

  const {
    data: apiRecommendations,
  } = useSupavisorRecommendationsQuery(
    { projectRef, computeSize }, 
    { 
      enabled: !!projectRef && !!computeSize && environment === 'self-hosted',
    }
  )

  const recommendations = useMemo((): PoolRecommendation[] => {
    if (!poolingStats || environment === 'platform') return []

    const recommendations: PoolRecommendation[] = []
    const { poolUtilization, activeConnections, totalConnections, clientConnections, maxClientConnections } = poolingStats

    // High pool utilization warning
    if (poolUtilization > 0.8) {
      recommendations.push({
        type: 'warning',
        title: 'High Pool Utilization',
        description: `Pool utilization is at ${Math.round(poolUtilization * 100)}%. Consider increasing pool size to improve performance.`,
        suggestedPoolSize: Math.ceil(totalConnections * 1.5)
      })
    }

    // Pool size recommendations based on compute size
    const computeSizeRecommendations: Record<string, { min: number; optimal: number }> = {
      'Nano': { min: 5, optimal: 15 },
      'Micro': { min: 10, optimal: 20 },
      'Small': { min: 15, optimal: 30 },
      'Medium': { min: 25, optimal: 50 },
      'Large': { min: 40, optimal: 80 },
      'XL': { min: 60, optimal: 120 },
      '2XL': { min: 80, optimal: 160 },
      '4XL': { min: 120, optimal: 240 },
      '8XL': { min: 200, optimal: 400 },
      '12XL': { min: 300, optimal: 600 },
      '16XL': { min: 400, optimal: 800 },
    }

    // Use API recommendations if available, otherwise fall back to local recommendations
    if (apiRecommendations) {
      if (totalConnections < apiRecommendations.recommendedPoolSize * 0.8) {
        recommendations.push({
          type: 'info',
          title: 'Pool Size Below Recommended',
          description: apiRecommendations.reasoning,
          suggestedPoolSize: apiRecommendations.recommendedPoolSize
        })
      }
    } else {
      const sizeRec = computeSizeRecommendations[computeSize]
      if (sizeRec && totalConnections < sizeRec.min) {
        recommendations.push({
          type: 'info',
          title: 'Pool Size Below Recommended Minimum',
          description: `For ${computeSize} compute, consider a pool size of at least ${sizeRec.min} (optimal: ${sizeRec.optimal}).`,
          suggestedPoolSize: sizeRec.optimal
        })
      }
    }

    // Client connection warnings
    const clientUtilization = clientConnections / maxClientConnections
    if (clientUtilization > 0.9) {
      recommendations.push({
        type: 'warning',
        title: 'High Client Connection Usage',
        description: `Client connections are at ${Math.round(clientUtilization * 100)}% of maximum. Consider monitoring for connection leaks.`
      })
    }

    // Healthy status
    if (recommendations.length === 0 && poolUtilization < 0.6) {
      recommendations.push({
        type: 'success',
        title: 'Pool Performance Optimal',
        description: 'Connection pool is operating within healthy parameters.'
      })
    }

    return recommendations
  }, [poolingStats, computeSize, environment])

  // Don't render for platform environments
  if (environment === 'platform') {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Health Status */}
      {poolingHealth && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Service Health</CardTitle>
              <Badge 
                variant={poolingHealth.healthy ? 'default' : 'destructive'}
                className={poolingHealth.healthy ? 'bg-green-100 text-green-800' : ''}
              >
                <Activity className="w-3 h-3 mr-1" />
                {poolingHealth.status}
              </Badge>
            </div>
          </CardHeader>
          {poolingHealth.message && (
            <CardContent className="pt-0">
              <p className="text-xs text-gray-600">{poolingHealth.message}</p>
              {poolingHealth.lastChecked && (
                <p className="text-xs text-gray-500 mt-1">
                  Last checked: {new Date(poolingHealth.lastChecked).toLocaleTimeString()}
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Pool Statistics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Pool Statistics</CardTitle>
          <CardDescription className="text-xs">
            Real-time connection pool metrics (updates every 30 seconds)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <ShimmeringLoader className="h-3 w-20" />
                  <ShimmeringLoader className="h-6 w-12" />
                </div>
              ))}
            </div>
          ) : statsError ? (
            <Alert_Shadcn_ variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle_Shadcn_>Statistics Unavailable</AlertTitle_Shadcn_>
              <AlertDescription_Shadcn_>
                Unable to retrieve pool statistics. The Supavisor service may not be running or accessible.
              </AlertDescription_Shadcn_>
            </Alert_Shadcn_>
          ) : poolingStats ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Database className="w-3 h-3 text-gray-500" />
                    <p className="text-xs text-gray-600">Active</p>
                  </div>
                  <p className="text-lg font-semibold">{poolingStats.activeConnections}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Database className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-600">Idle</p>
                  </div>
                  <p className="text-lg font-semibold">{poolingStats.idleConnections}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-gray-500" />
                    <p className="text-xs text-gray-600">Clients</p>
                  </div>
                  <p className="text-lg font-semibold">{poolingStats.clientConnections}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-gray-500" />
                    <p className="text-xs text-gray-600">Utilization</p>
                  </div>
                  <p className="text-lg font-semibold">
                    {Math.round(poolingStats.poolUtilization * 100)}%
                  </p>
                </div>
              </div>

              {/* Pool Utilization Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Pool Utilization</span>
                  <span>{poolingStats.activeConnections} / {poolingStats.totalConnections}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      poolingStats.poolUtilization > 0.8 
                        ? 'bg-red-500' 
                        : poolingStats.poolUtilization > 0.6 
                        ? 'bg-yellow-500' 
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(poolingStats.poolUtilization * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Uptime */}
              {poolingStats.uptime && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <p className="text-xs text-gray-600">
                    Uptime: {formatUptime(poolingStats.uptime)}
                  </p>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Recommendations and Warnings */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <Alert_Shadcn_ 
              key={index}
              variant={rec.type === 'warning' ? 'destructive' : rec.type === 'success' ? 'default' : 'default'}
              className={
                rec.type === 'success' 
                  ? 'border-green-200 bg-green-50' 
                  : rec.type === 'info'
                  ? 'border-blue-200 bg-blue-50'
                  : ''
              }
            >
              {rec.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
              {rec.type === 'success' && <Activity className="h-4 w-4 text-green-600" />}
              {rec.type === 'info' && <Database className="h-4 w-4 text-blue-600" />}
              <AlertTitle_Shadcn_ className={
                rec.type === 'success' ? 'text-green-800' : 
                rec.type === 'info' ? 'text-blue-800' : ''
              }>
                {rec.title}
              </AlertTitle_Shadcn_>
              <AlertDescription_Shadcn_ className={
                rec.type === 'success' ? 'text-green-700' : 
                rec.type === 'info' ? 'text-blue-700' : ''
              }>
                {rec.description}
                {rec.suggestedPoolSize && (
                  <span className="block mt-1 font-medium">
                    Suggested pool size: {rec.suggestedPoolSize}
                  </span>
                )}
              </AlertDescription_Shadcn_>
            </Alert_Shadcn_>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Format uptime in seconds to human readable format
 */
function formatUptime(uptimeSeconds: number): string {
  const days = Math.floor(uptimeSeconds / 86400)
  const hours = Math.floor((uptimeSeconds % 86400) / 3600)
  const minutes = Math.floor((uptimeSeconds % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}