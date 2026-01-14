import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { getProjectDatabaseClient } from 'lib/api/project-database-client'
import { getSSLErrorHandler } from 'lib/api/ssl-error-handler'
import { SSLConfig, SSLMode, SSLValidationResult } from 'lib/api/ssl-types'

/**
 * SSL Configuration Management API
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

export default withSecureProjectAccess(handler, {
  permissions: { read: true, write: true, admin: true }
})

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res, context)
    case 'PUT':
      return handlePut(req, res, context)
    case 'POST':
      return handleTest(req, res, context)
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'POST'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

/**
 * Get current SSL configuration for a project
 * Requirements: 12.1, 12.2
 */
const handleGet = async (req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) => {
  try {
    const { ref } = req.query
    const { userId } = context

    if (!ref || typeof ref !== 'string') {
      return res.status(400).json({
        data: null,
        error: { message: 'Project reference is required' }
      })
    }

    const projectClient = getProjectDatabaseClient()
    const connectionInfo = await projectClient.getProjectConnectionInfo(ref, userId)

    if (!connectionInfo) {
      return res.status(404).json({
        data: null,
        error: { message: 'Project not found or access denied' }
      })
    }

    const sslErrorHandler = getSSLErrorHandler()
    const environment = process.env.NODE_ENV as 'development' | 'production' | 'test'
    const recommendations = sslErrorHandler.getSSLRecommendations(environment)

    const response = {
      projectRef: ref,
      currentConfig: {
        enabled: connectionInfo.sslEnabled,
        mode: connectionInfo.sslConfig?.rejectUnauthorized ? 'verify-ca' : 'require',
        source: connectionInfo.sslSource,
        details: connectionInfo.sslConfig
      },
      recommendations,
      environment,
      connectionSource: connectionInfo.connectionSource
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error('SSL configuration GET error:', error)
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}

/**
 * Update SSL configuration for a project
 * Requirements: 12.2, 12.3, 12.4
 */
const handlePut = async (req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) => {
  try {
    const { ref } = req.query
    const { userId } = context
    const { sslConfig } = req.body

    if (!ref || typeof ref !== 'string') {
      return res.status(400).json({
        data: null,
        error: { message: 'Project reference is required' }
      })
    }

    if (!sslConfig) {
      return res.status(400).json({
        data: null,
        error: { message: 'SSL configuration is required' }
      })
    }

    // Validate SSL configuration
    const sslErrorHandler = getSSLErrorHandler()
    const validation = sslErrorHandler.validateSSLConfig(sslConfig)

    if (!validation.isValid) {
      return res.status(400).json({
        data: null,
        error: { 
          message: 'Invalid SSL configuration',
          details: validation.errors,
          warnings: validation.warnings
        }
      })
    }

    // For self-hosted deployments, SSL configuration changes would typically
    // require infrastructure-level changes or database configuration updates.
    // This endpoint validates the configuration and provides guidance.
    
    const response = {
      projectRef: ref,
      requestedConfig: sslConfig,
      validation,
      appliedSuccessfully: false, // Set to false for self-hosted as it requires manual configuration
      message: 'SSL configuration validated successfully. For self-hosted deployments, you may need to update your database configuration or environment variables to apply these settings.',
      nextSteps: [
        'Update your database server SSL configuration if needed',
        'Set appropriate environment variables (POSTGRES_SSL_MODE, etc.)',
        'Restart the application if SSL mode changes require it',
        'Test the connection using the test endpoint'
      ]
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error('SSL configuration PUT error:', error)
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}

/**
 * Test SSL connection for a project
 * Requirements: 12.4, 12.5
 */
const handleTest = async (req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) => {
  try {
    const { ref } = req.query
    const { userId } = context
    const { sslMode } = req.body

    if (!ref || typeof ref !== 'string') {
      return res.status(400).json({
        data: null,
        error: { message: 'Project reference is required' }
      })
    }

    const projectClient = getProjectDatabaseClient()
    const testResult = await projectClient.testProjectConnection(ref, userId)

    // If a specific SSL mode was requested for testing, include that in the response
    if (sslMode) {
      const sslErrorHandler = getSSLErrorHandler()
      const validation = sslErrorHandler.validateSSLConfig(sslMode)
      
      if (!validation.isValid) {
        return res.status(400).json({
          data: null,
          error: { 
            message: 'Invalid SSL mode for testing',
            details: validation.errors
          }
        })
      }
    }

    const response = {
      projectRef: ref,
      testResult,
      timestamp: new Date().toISOString(),
      testedMode: sslMode || 'current_configuration'
    }

    // Return appropriate status based on test result
    if (testResult.success) {
      return res.status(200).json(response)
    } else {
      return res.status(503).json({
        ...response,
        error: { message: 'Connection test failed', details: testResult.error }
      })
    }
  } catch (error) {
    console.error('SSL connection test error:', error)
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}