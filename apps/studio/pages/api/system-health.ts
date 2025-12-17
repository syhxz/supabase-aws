/**
 * Comprehensive System Health Check API Endpoint
 * 
 * Provides comprehensive health status for the Studio application including:
 * - Runtime configuration availability
 * - GoTrue service reachability
 * - API gateway reachability
 * - Credential system health
 * - Overall system health with recommendations
 * 
 * This endpoint is used by:
 * - Load balancers for health checks
 * - Monitoring systems
 * - Dashboard metrics
 * - Troubleshooting and diagnostics
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { performConfigHealthCheck, formatHealthCheckResult } from '../../lib/config-health'
import { getCredentialMonitoringService } from '../../lib/api/self-hosted'

interface SystemHealthResponse {
  healthy: boolean
  timestamp: string
  overallStatus: 'healthy' | 'warning' | 'critical'
  checks: {
    runtimeConfig: {
      healthy: boolean
      responseTime?: number
      error?: string
    }
    gotrue: {
      healthy: boolean
      url?: string
      responseTime?: number
      error?: string
    }
    apiGateway: {
      healthy: boolean
      url?: string
      responseTime?: number
      error?: string
    }
    credentialSystem: {
      healthy: boolean
      status: 'healthy' | 'warning' | 'critical'
      fallbackUsagePercentage: number
      projectsUsingFallback: number
      totalProjects: number
      issues: string[]
      recommendations: string[]
    }
  }
  config?: {
    environment: string
    source: string
    gotrueUrl?: string
    supabaseUrl?: string
    apiUrl?: string
  }
  errors: string[]
  warnings: string[]
  recommendations: string[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ 
        error: 'Method Not Allowed',
        message: `Method ${method} not allowed. Use GET to check system health status.`
      })
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('[System Health API] Performing comprehensive system health check...')
    
    // Perform configuration health check
    const configHealthResult = await performConfigHealthCheck()
    
    // Perform credential system health check
    let credentialHealthResult
    try {
      const monitoringService = getCredentialMonitoringService()
      credentialHealthResult = monitoringService.performCredentialHealthCheck()
    } catch (error) {
      console.warn('[System Health API] Credential monitoring not available:', error)
      credentialHealthResult = {
        status: 'warning' as const,
        totalProjects: 0,
        projectsWithCredentials: 0,
        projectsUsingFallback: 0,
        fallbackUsagePercentage: 0,
        issues: ['Credential monitoring service not available'],
        recommendations: ['Check credential monitoring service configuration'],
        timestamp: new Date().toISOString()
      }
    }
    
    // Log the results for debugging
    console.log(formatHealthCheckResult(configHealthResult))
    console.log('[System Health API] Credential health:', credentialHealthResult.status)
    
    // Determine overall system health
    const isDevelopment = configHealthResult.config?.environment === 'development'
    const hasRuntimeConfig = configHealthResult.checks.runtimeConfigAvailable.healthy
    
    // For development: healthy if runtime config is available
    // For production: healthy only if all checks pass
    const configHealthy = isDevelopment ? hasRuntimeConfig : configHealthResult.healthy
    const credentialHealthy = credentialHealthResult.status === 'healthy'
    
    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (!configHealthy || credentialHealthResult.status === 'critical') {
      overallStatus = 'critical'
    } else if (!credentialHealthy || credentialHealthResult.status === 'warning') {
      overallStatus = 'warning'
    }
    
    const isHealthy = overallStatus === 'healthy'
    const statusCode = overallStatus === 'critical' ? 503 : 200
    
    // Compile all recommendations
    const recommendations = [
      ...configHealthResult.warnings,
      ...credentialHealthResult.recommendations
    ]
    
    // Build comprehensive response
    const response: SystemHealthResponse = {
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      overallStatus,
      checks: {
        runtimeConfig: {
          healthy: configHealthResult.checks.runtimeConfigAvailable.healthy,
          responseTime: configHealthResult.checks.runtimeConfigAvailable.responseTime,
          error: configHealthResult.checks.runtimeConfigAvailable.error,
        },
        gotrue: {
          healthy: configHealthResult.checks.gotrueReachable.healthy,
          url: configHealthResult.checks.gotrueReachable.url,
          responseTime: configHealthResult.checks.gotrueReachable.responseTime,
          error: configHealthResult.checks.gotrueReachable.error,
        },
        apiGateway: {
          healthy: configHealthResult.checks.apiGatewayReachable.healthy,
          url: configHealthResult.checks.apiGatewayReachable.url,
          responseTime: configHealthResult.checks.apiGatewayReachable.responseTime,
          error: configHealthResult.checks.apiGatewayReachable.error,
        },
        credentialSystem: {
          healthy: credentialHealthy,
          status: credentialHealthResult.status,
          fallbackUsagePercentage: credentialHealthResult.fallbackUsagePercentage,
          projectsUsingFallback: credentialHealthResult.projectsUsingFallback,
          totalProjects: credentialHealthResult.totalProjects,
          issues: credentialHealthResult.issues,
          recommendations: credentialHealthResult.recommendations,
        },
      },
      config: configHealthResult.config ? {
        environment: configHealthResult.config.environment,
        source: configHealthResult.config.source,
        gotrueUrl: configHealthResult.config.gotrueUrl,
        supabaseUrl: configHealthResult.config.supabaseUrl,
        apiUrl: configHealthResult.config.apiUrl,
        // Note: We don't expose the anonKey for security reasons
      } : undefined,
      errors: [
        ...configHealthResult.errors,
        ...credentialHealthResult.issues.filter(issue => 
          credentialHealthResult.status === 'critical'
        )
      ],
      warnings: [
        ...configHealthResult.warnings,
        ...credentialHealthResult.issues.filter(issue => 
          credentialHealthResult.status === 'warning'
        )
      ],
      recommendations: [...new Set(recommendations)] // Remove duplicates
    }
    
    console.log(`[System Health API] Overall system health: ${overallStatus.toUpperCase()}`)
    
    return res.status(statusCode).json(response)
  } catch (error) {
    console.error('[System Health API] System health check failed with exception:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return res.status(500).json({
      healthy: false,
      timestamp: new Date().toISOString(),
      overallStatus: 'critical',
      error: 'System health check failed',
      message: errorMessage,
      checks: {
        runtimeConfig: { healthy: false, error: 'Health check exception' },
        gotrue: { healthy: false, error: 'Health check exception' },
        apiGateway: { healthy: false, error: 'Health check exception' },
        credentialSystem: { 
          healthy: false, 
          status: 'critical',
          fallbackUsagePercentage: 0,
          projectsUsingFallback: 0,
          totalProjects: 0,
          issues: ['Health check exception'],
          recommendations: []
        },
      },
      errors: [errorMessage],
      warnings: [],
      recommendations: ['Check system logs for detailed error information']
    } as SystemHealthResponse)
  }
}