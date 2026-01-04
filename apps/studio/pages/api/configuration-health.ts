/**
 * Configuration Health Check API
 * 
 * Provides comprehensive configuration validation and health checking
 * with detailed error handling and user guidance.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { validateConfiguration, quickHealthCheck } from 'lib/configuration-validation-service'
import { generateTroubleshootingGuide } from 'common/error-handling-guidance'
import { detectEnvironment } from 'common/environment-detection'

export interface ConfigurationHealthResponse {
  /** Overall health status */
  isHealthy: boolean
  /** Health summary message */
  summary: string
  /** Environment detected */
  environment: string
  /** Validation timestamp */
  timestamp: string
  /** Quick health check result */
  quickCheck: ReturnType<typeof quickHealthCheck>
  /** Detailed validation (only if requested) */
  detailed?: ReturnType<typeof validateConfiguration>
  /** Troubleshooting guide */
  troubleshootingGuide?: ReturnType<typeof generateTroubleshootingGuide>
}

async function handleGet(req: NextApiRequest, res: NextApiResponse<ConfigurationHealthResponse>) {
  const { detailed = 'false', troubleshooting = 'false' } = req.query
  const includeDetailed = detailed === 'true'
  const includeTroubleshooting = troubleshooting === 'true'

  try {
    console.log('[Configuration Health API] Performing configuration health check')
    
    // Quick health check
    const quickCheck = quickHealthCheck()
    
    // Detect environment
    const envInfo = detectEnvironment()
    
    let detailedValidation: ReturnType<typeof validateConfiguration> | undefined
    let troubleshootingGuide: ReturnType<typeof generateTroubleshootingGuide> | undefined

    // Perform detailed validation if requested
    if (includeDetailed) {
      console.log('[Configuration Health API] Performing detailed validation')
      detailedValidation = validateConfiguration({
        includeFrontend: true,
        includeDockerChecks: true,
        logResults: false, // Don't log to console for API calls
      })
    }

    // Include troubleshooting guide if requested or if there are issues
    if (includeTroubleshooting || !quickCheck.isHealthy) {
      troubleshootingGuide = generateTroubleshootingGuide(envInfo.environment)
    }

    const response: ConfigurationHealthResponse = {
      isHealthy: quickCheck.isHealthy,
      summary: quickCheck.summary,
      environment: envInfo.environment,
      timestamp: new Date().toISOString(),
      quickCheck,
      detailed: detailedValidation,
      troubleshootingGuide,
    }

    // Set appropriate HTTP status based on health
    const statusCode = quickCheck.isHealthy ? 200 : quickCheck.criticalIssues > 0 ? 503 : 200

    console.log(`[Configuration Health API] Health check complete: ${quickCheck.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`)
    console.log(`[Configuration Health API] Critical issues: ${quickCheck.criticalIssues}`)
    
    res.status(statusCode).json(response)
  } catch (error) {
    console.error('[Configuration Health API] Health check failed:', error)
    
    res.status(500).json({
      isHealthy: false,
      summary: 'Configuration health check failed',
      environment: 'unknown',
      timestamp: new Date().toISOString(),
      quickCheck: {
        isHealthy: false,
        summary: 'Health check failed with error',
        criticalIssues: 1,
        recommendations: [
          'Check server logs for detailed error information',
          'Verify environment variables are properly set',
          'Contact system administrator if issues persist',
        ],
      },
    })
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  // POST endpoint for triggering configuration validation with custom parameters
  const { 
    includeFrontend = true, 
    includeDockerChecks = true,
    customUrls = {} 
  } = req.body || {}

  try {
    console.log('[Configuration Health API] Performing custom configuration validation')
    
    const validation = validateConfiguration({
      includeFrontend,
      includeDockerChecks,
      logResults: false,
      customUrls,
    })

    const response = {
      isValid: validation.isValid,
      summary: validation.summary,
      environment: validation.environmentInfo.environment,
      timestamp: validation.timestamp,
      errors: validation.errors.map(error => ({
        type: error.type,
        severity: error.severity,
        message: error.message,
        description: error.description,
        recommendations: error.recommendations,
        relatedVariables: error.relatedVariables,
        affectedComponents: error.affectedComponents,
      })),
      troubleshootingGuide: validation.troubleshootingGuide,
    }

    const statusCode = validation.isValid ? 200 : validation.criticalErrors.length > 0 ? 400 : 200
    
    res.status(statusCode).json(response)
  } catch (error) {
    console.error('[Configuration Health API] Custom validation failed:', error)
    
    res.status(500).json({
      isValid: false,
      summary: 'Configuration validation failed',
      environment: 'unknown',
      timestamp: new Date().toISOString(),
      errors: [{
        type: 'validation-error',
        severity: 'critical',
        message: 'Configuration validation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        recommendations: ['Check server logs', 'Verify configuration'],
        relatedVariables: [],
        affectedComponents: ['Configuration Validation'],
      }],
    })
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  // Set CORS headers for health check endpoint
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({
        isHealthy: false,
        summary: `Method ${method} Not Allowed`,
        environment: 'unknown',
        timestamp: new Date().toISOString(),
        quickCheck: {
          isHealthy: false,
          summary: 'Method not allowed',
          criticalIssues: 0,
          recommendations: ['Use GET or POST methods'],
        },
      })
  }
}