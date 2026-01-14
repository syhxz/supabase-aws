/**
 * Edge Functions Health Endpoint with CORS Support
 * 
 * Provides health check endpoint with proper CORS configuration for Studio monitoring.
 * Specifically addresses user-agent header CORS issues and preflight request handling.
 * 
 * Requirements: 19.3, 20.1, 20.4, 20.5
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { withCORS } from 'lib/functions-service/cors/CORSMiddleware'
import { getEdgeFunctionsClient } from 'lib/functions-service/EdgeFunctionsClient'
import { discoverEdgeFunctionsService } from 'lib/service-discovery'
import { validateCORSConfigurationAtStartup } from 'lib/functions-service/cors/CORSErrorHandler'

/**
 * Health status interface
 */
interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  version?: string
  uptime?: number
  checks: {
    storage: boolean
    deno: boolean
    service: boolean
    cors: boolean
  }
  details?: {
    storage?: any
    deno?: any
    service?: any
    cors?: any
    responseTime?: number
  }
  errors?: string[]
}

/**
 * Health endpoint handler
 */
async function healthHandler(_req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now()

  try {
    console.log('[Edge Functions Health] Checking health status...')

    // Validate CORS configuration at startup (first time only)
    if (!process.env.CORS_VALIDATION_DONE) {
      validateCORSConfigurationAtStartup()
      process.env.CORS_VALIDATION_DONE = 'true'
    }
    // Initialize health status
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        storage: false,
        deno: false,
        service: false,
        cors: true, // CORS is always healthy if we reach this point
      },
      details: {},
      errors: [],
    }

    // Check Edge Functions service availability
    try {
      const serviceEndpoint = await discoverEdgeFunctionsService()
      health.checks.service = serviceEndpoint.healthy
      health.details!.service = {
        url: serviceEndpoint.url,
        version: serviceEndpoint.version,
        error: serviceEndpoint.error,
        lastChecked: serviceEndpoint.lastChecked,
      }

      if (!serviceEndpoint.healthy) {
        health.errors!.push(`Edge Functions service unhealthy: ${serviceEndpoint.error}`)
      }
    } catch (error) {
      health.checks.service = false
      health.errors!.push(`Failed to check Edge Functions service: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Check storage backend health
    try {
      const edgeFunctionsClient = getEdgeFunctionsClient()
      const storageHealth = await edgeFunctionsClient.getStorageHealth()
      health.checks.storage = storageHealth.healthy
      health.details!.storage = storageHealth

      if (!storageHealth.healthy) {
        health.errors!.push(`Storage backend unhealthy: ${storageHealth.error}`)
      }
    } catch (error) {
      health.checks.storage = false
      health.errors!.push(`Failed to check storage health: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Check Deno runtime health
    try {
      const edgeFunctionsClient = getEdgeFunctionsClient()
      const denoHealth = await edgeFunctionsClient.getDenoHealth()
      health.checks.deno = denoHealth.healthy
      health.details!.deno = denoHealth

      if (!denoHealth.healthy) {
        health.errors!.push(`Deno runtime unhealthy: ${denoHealth.error}`)
      }
    } catch (error) {
      health.checks.deno = false
      health.errors!.push(`Failed to check Deno runtime health: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Determine overall health status
    const allHealthy = Object.values(health.checks).every(check => check)
    health.status = allHealthy ? 'healthy' : 'unhealthy'

    // Add response time
    const responseTime = Date.now() - startTime
    health.details!.responseTime = responseTime

    // Log health check result
    console.log('[Edge Functions Health] Health check completed:', {
      status: health.status,
      checks: health.checks,
      responseTime,
      errors: health.errors?.length || 0,
    })

    // Return appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 503

    // Add custom headers for debugging
    res.setHeader('X-Health-Check-Time', responseTime.toString())
    res.setHeader('X-Edge-Functions-Status', health.status)
    res.setHeader('X-Service-Version', process.env.npm_package_version || 'unknown')

    return res.status(statusCode).json(health)

  } catch (error) {
    console.error('[Edge Functions Health] Health check failed:', error)

    const errorHealth: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        storage: false,
        deno: false,
        service: false,
        cors: true,
      },
      errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      details: {
        responseTime: Date.now() - startTime,
      },
    }

    res.setHeader('X-Health-Check-Time', (Date.now() - startTime).toString())
    res.setHeader('X-Edge-Functions-Status', 'unhealthy')

    return res.status(503).json(errorHealth)
  }
}

/**
 * Export handler with CORS middleware
 * 
 * The CORS middleware automatically handles:
 * - OPTIONS preflight requests
 * - user-agent header inclusion in Access-Control-Allow-Headers
 * - Origin validation
 * - Proper CORS headers for all responses
 */
export default withCORS(healthHandler, {
  handlePreflight: true,
  addHeaders: true,
  corsConfig: {
    // Ensure user-agent is explicitly included
    allowedHeaders: [
      'user-agent',
      'content-type',
      'authorization',
      'x-client-info',
      'apikey',
      'x-supabase-api-version',
      'cache-control',
      'pragma',
      'accept',
      'accept-language',
      'accept-encoding',
    ],
  },
})