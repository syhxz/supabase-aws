/**
 * CORS Diagnostics Endpoint for Edge Functions
 * 
 * Provides diagnostic tools to test and validate CORS configuration for Edge Functions endpoints.
 * Helps developers troubleshoot CORS issues and validate their configuration.
 * 
 * Requirements: 22.5
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { withCORS, getCORSDiagnostics, validateCORSRequest } from 'lib/functions-service/cors/CORSMiddleware'
import { getCORSService } from 'lib/functions-service/cors/CORSConfigurationService'

/**
 * CORS diagnostics response interface
 */
interface CORSDiagnosticsResponse {
  timestamp: string
  configuration: {
    valid: boolean
    errors: string[]
    warnings: string[]
    suggestions: string[]
  }
  environment: Record<string, any>
  requestValidation?: {
    valid: boolean
    errors: string[]
    origin?: string
    method?: string
    headers?: string[]
  }
  testResults?: {
    preflightTest: {
      passed: boolean
      errors: string[]
    }
    actualRequestTest: {
      passed: boolean
      errors: string[]
    }
  }
}

/**
 * CORS diagnostics handler
 */
async function corseDiagnosticsHandler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[CORS Diagnostics] Processing diagnostics request:', {
    method: req.method,
    origin: req.headers.origin,
    userAgent: req.headers['user-agent'],
  })

  try {
    const corsService = getCORSService()
    const diagnostics = getCORSDiagnostics()
    
    // Build diagnostics response
    const response: CORSDiagnosticsResponse = {
      timestamp: new Date().toISOString(),
      configuration: corsService.validateConfiguration(),
      environment: diagnostics.environment,
    }

    // If this is a test request, validate it
    if (req.method !== 'OPTIONS') {
      response.requestValidation = validateCORSRequest(req)
    }

    // Run CORS tests if requested
    if (req.query.runTests === 'true') {
      response.testResults = await runCORSTests(req)
    }

    // Log diagnostics result
    console.log('[CORS Diagnostics] Diagnostics completed:', {
      configValid: response.configuration.valid,
      configErrors: response.configuration.errors.length,
      configWarnings: response.configuration.warnings.length,
      requestValid: response.requestValidation?.valid,
      testsRun: !!response.testResults,
    })

    return res.status(200).json(response)

  } catch (error) {
    console.error('[CORS Diagnostics] Diagnostics failed:', error)

    const errorResponse: CORSDiagnosticsResponse = {
      timestamp: new Date().toISOString(),
      configuration: {
        valid: false,
        errors: [`Diagnostics failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        suggestions: ['Check CORS configuration and try again'],
      },
      environment: {},
    }

    return res.status(500).json(errorResponse)
  }
}

/**
 * Run CORS tests to validate configuration
 */
async function runCORSTests(req: NextApiRequest): Promise<CORSDiagnosticsResponse['testResults']> {
  const corsService = getCORSService()
  const origin = req.headers.origin as string || 'http://localhost:3000'
  
  const results = {
    preflightTest: {
      passed: false,
      errors: [] as string[],
    },
    actualRequestTest: {
      passed: false,
      errors: [] as string[],
    },
  }

  try {
    // Test preflight request
    const preflightRequest = new Request('http://localhost/test', {
      method: 'OPTIONS',
      headers: {
        'origin': origin,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'user-agent,content-type,authorization',
      },
    })

    const preflightResponse = corsService.handlePreflightRequest(preflightRequest)
    
    if (preflightResponse.status === 200) {
      results.preflightTest.passed = true
    } else {
      results.preflightTest.errors.push(`Preflight failed with status ${preflightResponse.status}`)
    }

    // Test actual request validation
    if (corsService.validateOrigin(origin)) {
      results.actualRequestTest.passed = true
    } else {
      results.actualRequestTest.errors.push(`Origin '${origin}' is not allowed`)
    }

    // Test header validation
    const testHeaders = ['user-agent', 'content-type', 'authorization']
    for (const header of testHeaders) {
      if (!corsService.validateHeader(header)) {
        results.actualRequestTest.passed = false
        results.actualRequestTest.errors.push(`Header '${header}' is not allowed`)
      }
    }

  } catch (error) {
    results.preflightTest.errors.push(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    results.actualRequestTest.errors.push(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return results
}

/**
 * Export handler with CORS middleware
 */
export default withCORS(corseDiagnosticsHandler, {
  handlePreflight: true,
  addHeaders: true,
  corsConfig: {
    // Ensure comprehensive header support for diagnostics
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
      'x-requested-with',
    ],
  },
})