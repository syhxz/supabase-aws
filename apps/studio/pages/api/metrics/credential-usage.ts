/**
 * Credential Usage Metrics API Endpoint
 * 
 * Provides metrics specifically formatted for monitoring dashboards and alerting systems.
 * Returns Prometheus-style metrics for credential usage patterns.
 * 
 * This endpoint is used by:
 * - Monitoring dashboards (Grafana, etc.)
 * - Alerting systems
 * - Metrics collection systems
 * - Performance monitoring tools
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { getCredentialMonitoringService } from '../../../lib/api/self-hosted'

interface CredentialUsageMetrics {
  timestamp: string
  metrics: {
    // Core metrics
    credential_system_health_status: {
      value: number // 1 = healthy, 0.5 = warning, 0 = critical
      labels: { status: string }
    }
    credential_total_projects: {
      value: number
    }
    credential_projects_with_credentials: {
      value: number
    }
    credential_projects_using_fallback: {
      value: number
    }
    credential_fallback_usage_percentage: {
      value: number
    }
    
    // Audit metrics
    credential_audit_total_entries: {
      value: number
    }
    credential_audit_events_by_type: {
      value: number
      labels: { event_type: string }
    }[]
    
    // Health indicators
    credential_system_issues_count: {
      value: number
    }
    credential_system_recommendations_count: {
      value: number
    }
  }
  
  // Prometheus-style text format (optional)
  prometheus?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query } = req
  const format = query.format as string || 'json'

  switch (method) {
    case 'GET':
      return handleGet(req, res, format)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ 
        error: 'Method Not Allowed',
        message: `Method ${method} not allowed. Use GET to retrieve credential usage metrics.`
      })
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, format: string) {
  try {
    console.log('[Credential Metrics API] Fetching credential usage metrics...')
    
    // Get credential monitoring service
    const monitoringService = getCredentialMonitoringService()
    
    // Fetch all required data
    const [healthCheck, fallbackStats, auditStats] = await Promise.all([
      monitoringService.performCredentialHealthCheck(),
      monitoringService.getFallbackUsageStats(),
      monitoringService.getAuditLogStats()
    ])
    
    // Convert health status to numeric value
    const healthStatusValue = healthCheck.status === 'healthy' ? 1 : 
                             healthCheck.status === 'warning' ? 0.5 : 0
    
    // Build metrics response
    const metrics: CredentialUsageMetrics = {
      timestamp: new Date().toISOString(),
      metrics: {
        credential_system_health_status: {
          value: healthStatusValue,
          labels: { status: healthCheck.status }
        },
        credential_total_projects: {
          value: healthCheck.totalProjects
        },
        credential_projects_with_credentials: {
          value: healthCheck.projectsWithCredentials
        },
        credential_projects_using_fallback: {
          value: healthCheck.projectsUsingFallback
        },
        credential_fallback_usage_percentage: {
          value: healthCheck.fallbackUsagePercentage
        },
        credential_audit_total_entries: {
          value: auditStats.totalEntries
        },
        credential_audit_events_by_type: auditStats.eventTypeCounts.map(event => ({
          value: event.count,
          labels: { event_type: event.eventType }
        })),
        credential_system_issues_count: {
          value: healthCheck.issues.length
        },
        credential_system_recommendations_count: {
          value: healthCheck.recommendations.length
        }
      }
    }
    
    // Generate Prometheus format if requested
    if (format === 'prometheus') {
      const prometheusMetrics = generatePrometheusFormat(metrics)
      metrics.prometheus = prometheusMetrics
      
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      return res.status(200).send(prometheusMetrics)
    }
    
    // Return JSON format
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json(metrics)
    
  } catch (error) {
    console.error('[Credential Metrics API] Error fetching metrics:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return res.status(500).json({
      error: 'Failed to fetch credential usage metrics',
      message: errorMessage,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Generates Prometheus-style metrics format
 */
function generatePrometheusFormat(metrics: CredentialUsageMetrics): string {
  const timestamp = Math.floor(new Date(metrics.timestamp).getTime() / 1000)
  
  const lines: string[] = [
    '# HELP credential_system_health_status Health status of the credential system (1=healthy, 0.5=warning, 0=critical)',
    '# TYPE credential_system_health_status gauge',
    `credential_system_health_status{status="${metrics.metrics.credential_system_health_status.labels.status}"} ${metrics.metrics.credential_system_health_status.value} ${timestamp}`,
    '',
    '# HELP credential_total_projects Total number of projects in the system',
    '# TYPE credential_total_projects gauge',
    `credential_total_projects ${metrics.metrics.credential_total_projects.value} ${timestamp}`,
    '',
    '# HELP credential_projects_with_credentials Number of projects with complete credentials',
    '# TYPE credential_projects_with_credentials gauge',
    `credential_projects_with_credentials ${metrics.metrics.credential_projects_with_credentials.value} ${timestamp}`,
    '',
    '# HELP credential_projects_using_fallback Number of projects using fallback credentials',
    '# TYPE credential_projects_using_fallback gauge',
    `credential_projects_using_fallback ${metrics.metrics.credential_projects_using_fallback.value} ${timestamp}`,
    '',
    '# HELP credential_fallback_usage_percentage Percentage of projects using fallback credentials',
    '# TYPE credential_fallback_usage_percentage gauge',
    `credential_fallback_usage_percentage ${metrics.metrics.credential_fallback_usage_percentage.value} ${timestamp}`,
    '',
    '# HELP credential_audit_total_entries Total number of audit log entries',
    '# TYPE credential_audit_total_entries counter',
    `credential_audit_total_entries ${metrics.metrics.credential_audit_total_entries.value} ${timestamp}`,
    '',
    '# HELP credential_audit_events_by_type Number of audit events by type',
    '# TYPE credential_audit_events_by_type counter'
  ]
  
  // Add event type metrics
  metrics.metrics.credential_audit_events_by_type.forEach(event => {
    lines.push(`credential_audit_events_by_type{event_type="${event.labels.event_type}"} ${event.value} ${timestamp}`)
  })
  
  lines.push(
    '',
    '# HELP credential_system_issues_count Number of current system issues',
    '# TYPE credential_system_issues_count gauge',
    `credential_system_issues_count ${metrics.metrics.credential_system_issues_count.value} ${timestamp}`,
    '',
    '# HELP credential_system_recommendations_count Number of current system recommendations',
    '# TYPE credential_system_recommendations_count gauge',
    `credential_system_recommendations_count ${metrics.metrics.credential_system_recommendations_count.value} ${timestamp}`,
    ''
  )
  
  return lines.join('\n')
}