import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSideGoTrueConfig, validateGoTrueUrl } from 'common/gotrue-config'
import { logFailedRequest, logSuccessfulRequest, logConfigurationSource } from 'common/configuration-logging'
import { detectEnvironment } from 'common/environment-detection'

/**
 * Self-hosted signup endpoint
 * 
 * This endpoint allows user registration in self-hosted mode by directly
 * calling GoTrue's signup API with server-side specific URL resolution. 
 * This ensures the correct internal network GoTrue URL is used for container
 * environments while providing external URLs for client-side usage.
 * 
 * We call the GoTrue HTTP API directly instead of using gotrueClient because
 * gotrueClient is initialized at module load time with build-time environment
 * variables, which means it cannot pick up runtime configuration changes.
 * 
 * Network Configuration:
 * - Server-side (this API): Uses internal container addresses (kong:8000)
 * - Client-side: Uses external addresses (localhost:8000)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now()
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const IS_PLATFORM = process.env.NEXT_PUBLIC_IS_PLATFORM === 'true'

  // In platform mode, this endpoint should not be used
  if (IS_PLATFORM) {
    return res.status(404).json({ 
      error: 'This endpoint is only available in self-hosted mode' 
    })
  }

  // Detect environment for context-aware logging
  const envInfo = detectEnvironment()
  
  console.log('[Signup API] 🚀 Processing signup request')
  console.log('[Signup API] Environment:', envInfo.environment.toUpperCase())
  console.log('[Signup API] Detection method:', envInfo.detectionMethod)
  if (envInfo.context) {
    console.log('[Signup API] Environment context:', envInfo.context)
  }

  try {
    const { email, password, hcaptchaToken, redirectTo } = req.body

    // Validate required fields
    if (!email || !password) {
      console.warn('[Signup API] ⚠️  Validation failed: Missing required fields')
      const missingFields = []
      if (!email) missingFields.push('email')
      if (!password) missingFields.push('password')
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}. Please provide all required information.` 
      })
    }

    // Validate data types
    if (typeof email !== 'string' || typeof password !== 'string') {
      console.warn('[Signup API] ⚠️  Validation failed: Invalid data types')
      return res.status(400).json({ 
        error: 'Email and password must be text strings.' 
      })
    }

    // Validate redirectTo URL if provided
    if (redirectTo && typeof redirectTo === 'string') {
      try {
        const redirectUrl = new URL(redirectTo)
        // Only allow http and https protocols
        if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
          console.warn('[Signup API] ⚠️  Validation failed: Invalid redirect URL protocol:', redirectUrl.protocol)
          return res.status(400).json({ 
            error: 'Redirect URL must use http or https protocol.' 
          })
        }
      } catch (urlError) {
        console.warn('[Signup API] ⚠️  Validation failed: Invalid redirect URL format:', redirectTo)
        return res.status(400).json({ 
          error: 'Invalid redirect URL format. Please provide a valid URL.' 
        })
      }
    }

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.warn('[Signup API] ⚠️  Validation failed: Invalid email format:', email)
      return res.status(400).json({ 
        error: 'Invalid email format. Please enter a valid email address (e.g., user@example.com).' 
      })
    }

    // Enhanced password validation with detailed requirements
    const passwordErrors = []
    if (password.length < 8) {
      passwordErrors.push('at least 8 characters long')
    }
    if (!/[A-Z]/.test(password)) {
      passwordErrors.push('at least one uppercase letter')
    }
    if (!/[a-z]/.test(password)) {
      passwordErrors.push('at least one lowercase letter')
    }
    if (!/\d/.test(password)) {
      passwordErrors.push('at least one number')
    }
    
    if (passwordErrors.length > 0) {
      console.warn('[Signup API] ⚠️  Validation failed: Password requirements not met')
      return res.status(400).json({ 
        error: `Password must be ${passwordErrors.join(', ')}.` 
      })
    }

    // Validate email length (reasonable limits)
    if (email.length > 254) {
      console.warn('[Signup API] ⚠️  Validation failed: Email too long:', email.length)
      return res.status(400).json({ 
        error: 'Email address is too long. Please use a shorter email address.' 
      })
    }

    // Validate password length (reasonable upper limit)
    if (password.length > 128) {
      console.warn('[Signup API] ⚠️  Validation failed: Password too long')
      return res.status(400).json({ 
        error: 'Password is too long. Please use a password with fewer than 128 characters.' 
      })
    }

    // Get server-side specific GoTrue configuration
    const serverConfig = getServerSideGoTrueConfig()
    
    // Log configuration details for debugging
    logConfigurationSource(
      'Signup API',
      serverConfig.source,
      { 
        gotrueUrl: serverConfig.internalUrl
      },
      envInfo.environment,
      {
        networkType: serverConfig.networkType,
        isContainer: process.env.HOSTNAME === '::' || process.env.DOCKER_CONTAINER === 'true',
        configValidated: serverConfig.validated,
        externalUrl: serverConfig.externalUrl
      }
    )
    
    // Validate the resolved GoTrue URL
    if (!validateGoTrueUrl(serverConfig.internalUrl)) {
      console.error('[Signup API] ❌ Invalid GoTrue URL resolved:', serverConfig.internalUrl)
      console.error('[Signup API] Configuration source:', serverConfig.source)
      console.error('[Signup API] This is a critical configuration error')
      
      return res.status(500).json({ 
        error: 'Authentication service configuration error. Please contact support.' 
      })
    }
    
    // Get anon key from environment
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!anonKey) {
      console.error('[Signup API] ❌ Missing SUPABASE_ANON_KEY environment variable')
      console.error('[Signup API] This is required for GoTrue authentication')
      return res.status(500).json({ 
        error: 'Server configuration error. Please contact support.' 
      })
    }
    
    console.log('[Signup API] 🔧 Configuration resolved successfully')
    console.log('[Signup API] Using internal URL for server-side communication:', serverConfig.internalUrl)
    console.log('[Signup API] External URL available for client-side:', serverConfig.externalUrl)
    console.log('[Signup API] Configuration source:', serverConfig.source)
    console.log('[Signup API] Network type:', serverConfig.networkType)
    console.log('[Signup API] Environment variables status:')
    console.log('[Signup API]   SUPABASE_ANON_KEY:', anonKey ? 'SET' : 'NOT SET')
    console.log('[Signup API]   NEXT_PUBLIC_GOTRUE_URL:', process.env.NEXT_PUBLIC_GOTRUE_URL || 'NOT SET')
    console.log('[Signup API]   SUPABASE_URL:', process.env.SUPABASE_URL || 'NOT SET')
    console.log('[Signup API]   SUPABASE_PUBLIC_URL:', process.env.SUPABASE_PUBLIC_URL || 'NOT SET')

    // Use internal URL for server-side API calls
    const gotrueUrl = serverConfig.internalUrl
    const signupUrl = gotrueUrl.replace(/\/auth\/v1$/, '') + '/auth/v1/signup'
    
    // Enhanced logging for requirement 3.1: Detailed connection information
    console.log('[Signup API] 📡 Initiating GoTrue signup request')
    console.log('[Signup API] === CONNECTION DETAILS ===')
    console.log('[Signup API] Target URL:', signupUrl)
    console.log('[Signup API] User email:', email)
    console.log('[Signup API] Request timestamp:', new Date().toISOString())
    console.log('[Signup API] Request method: POST')
    console.log('[Signup API] Request headers:', {
      'Content-Type': 'application/json',
      'apikey': anonKey ? `${anonKey.substring(0, 20)}...` : 'NOT SET',
    })
    
    // Log network connectivity details
    console.log('[Signup API] 🔗 Network Connectivity Analysis:')
    console.log('[Signup API]   Server-side execution: YES')
    console.log('[Signup API]   Container environment:', process.env.HOSTNAME === '::' || process.env.DOCKER_CONTAINER === 'true' ? 'YES' : 'NO')
    console.log('[Signup API]   Target host:', new URL(signupUrl).hostname)
    console.log('[Signup API]   Target port:', new URL(signupUrl).port || (new URL(signupUrl).protocol === 'https:' ? '443' : '80'))
    console.log('[Signup API]   Protocol:', new URL(signupUrl).protocol)
    console.log('[Signup API]   Expected response: JSON with user/session data')
    
    // Log request payload structure (without sensitive data)
    console.log('[Signup API] 📦 Request Payload Structure:')
    console.log('[Signup API]   email: [PROVIDED]')
    console.log('[Signup API]   password: [PROVIDED - length:', password.length, 'chars]')
    console.log('[Signup API]   data: {} (empty object)')
    if (redirectTo) {
      console.log('[Signup API]   redirect_to:', redirectTo)
    }
    if (hcaptchaToken) {
      console.log('[Signup API]   gotrue_meta_security.captcha_token: [PROVIDED]')
    }
    console.log('[Signup API] ================================')
    
    const requestStartTime = Date.now()
    
    const gotrueResponse = await fetch(signupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
      },
      body: JSON.stringify({
        email,
        password,
        data: {},
        ...(redirectTo && { redirect_to: redirectTo }),
        gotrue_meta_security: hcaptchaToken ? { captcha_token: hcaptchaToken } : undefined,
      }),
    })
    
    const requestTime = Date.now() - requestStartTime
    
    console.log('[Signup API] 📡 GoTrue response received')
    console.log('[Signup API] Response status:', gotrueResponse.status)
    console.log('[Signup API] Response time:', `${requestTime}ms`)
    
    // Log response headers safely
    const responseHeaders: Record<string, string> = {}
    gotrueResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    console.log('[Signup API] Response headers:', responseHeaders)

    const responseData = await gotrueResponse.json()

    if (!gotrueResponse.ok) {
      // Enhanced logging for requirement 3.2: Detailed error information and attempted URL
      console.error('[Signup API] ❌ GoTrue signup failed')
      console.error('[Signup API] === FAILURE ANALYSIS ===')
      console.error('[Signup API] Status:', gotrueResponse.status)
      console.error('[Signup API] Status text:', gotrueResponse.statusText)
      console.error('[Signup API] Response data:', responseData)
      console.error('[Signup API] Attempted URL:', signupUrl)
      console.error('[Signup API] Request time:', `${requestTime}ms`)
      console.error('[Signup API] Failure timestamp:', new Date().toISOString())
      
      // Enhanced network diagnostics for requirement 3.2
      console.error('[Signup API] 🔍 Network Diagnostics:')
      console.error('[Signup API]   Configuration source:', serverConfig.source)
      console.error('[Signup API]   Network type:', serverConfig.networkType)
      console.error('[Signup API]   Environment:', envInfo.environment)
      console.error('[Signup API]   Internal URL used:', serverConfig.internalUrl)
      console.error('[Signup API]   External URL available:', serverConfig.externalUrl)
      console.error('[Signup API]   Container networking:', process.env.HOSTNAME === '::' || process.env.DOCKER_CONTAINER === 'true' ? 'YES' : 'NO')
      
      // Analyze potential causes based on status code
      console.error('[Signup API] 🔧 Potential Causes Analysis:')
      if (gotrueResponse.status >= 500) {
        console.error('[Signup API]   → Server Error (5xx): GoTrue service internal issue')
        console.error('[Signup API]   → Check GoTrue service health and logs')
        console.error('[Signup API]   → Verify database connectivity from GoTrue')
      } else if (gotrueResponse.status === 404) {
        console.error('[Signup API]   → Not Found (404): Incorrect URL or routing issue')
        console.error('[Signup API]   → Verify Kong gateway routing configuration')
        console.error('[Signup API]   → Check if /auth/v1/signup endpoint exists')
      } else if (gotrueResponse.status === 403) {
        console.error('[Signup API]   → Forbidden (403): Authentication or authorization issue')
        console.error('[Signup API]   → Verify SUPABASE_ANON_KEY is correct')
        console.error('[Signup API]   → Check GoTrue JWT settings')
      } else if (gotrueResponse.status >= 400) {
        console.error('[Signup API]   → Client Error (4xx): Request format or validation issue')
        console.error('[Signup API]   → Check request payload and headers')
      }
      
      console.error('[Signup API] ================================')
      
      // Log failed request for debugging
      logFailedRequest(
        'Signup API',
        {
          url: signupUrl,
          method: 'POST',
          status: gotrueResponse.status,
          responseTime: requestTime,
          success: false,
          error: responseData.error_description || responseData.msg || responseData.message || 'Unknown error',
          context: {
            email,
            configSource: serverConfig.source,
            networkType: serverConfig.networkType,
            environment: envInfo.environment,
            statusText: gotrueResponse.statusText,
            failureTimestamp: new Date().toISOString(),
            containerNetworking: process.env.HOSTNAME === '::' || process.env.DOCKER_CONTAINER === 'true'
          }
        },
        [
          'Verify GoTrue service is running and accessible',
          'Check network connectivity between Studio and GoTrue containers',
          'Verify SUPABASE_ANON_KEY is correct and has proper permissions',
          'Check GoTrue service logs for additional details',
          'Ensure Kong gateway is properly routing requests to GoTrue',
          'Verify container networking allows communication between services',
          'Check if firewall or security groups are blocking container communication',
          'Test direct connectivity: docker exec studio-container curl http://kong:8000/health'
        ]
      )
      
      // Enhanced error handling with specific error type detection
      const errorMessage = (responseData.error_description || responseData.msg || responseData.message || '').toLowerCase()
      const errorCode = responseData.error_code || responseData.code
      
      // Handle user already exists errors
      if (errorMessage.includes('already registered') || 
          errorMessage.includes('already exists') || 
          errorMessage.includes('user already registered') ||
          errorCode === 'user_already_exists') {
        console.warn('[Signup API] ⚠️  User already exists:', email)
        return res.status(400).json({ 
          error: 'A user with this email already exists. Please try signing in instead or use the password reset option if you forgot your password.' 
        })
      }
      
      // Handle password policy violations
      if (errorMessage.includes('password') || 
          errorMessage.includes('weak password') ||
          errorMessage.includes('password policy') ||
          errorCode === 'weak_password') {
        console.warn('[Signup API] ⚠️  Password validation failed for user:', email)
        const passwordError = responseData.error_description || responseData.msg || responseData.message
        return res.status(400).json({ 
          error: passwordError || 'Password does not meet security requirements. Please use a stronger password.'
        })
      }
      
      // Handle email validation errors
      if (errorMessage.includes('email') || 
          errorMessage.includes('invalid email') ||
          errorMessage.includes('email format') ||
          errorCode === 'invalid_email') {
        console.warn('[Signup API] ⚠️  Email validation failed:', email)
        return res.status(400).json({ 
          error: 'Invalid email address. Please check your email format and try again.'
        })
      }

      // Handle rate limiting errors
      if (errorMessage.includes('rate limit') || 
          errorMessage.includes('too many requests') ||
          gotrueResponse.status === 429) {
        console.warn('[Signup API] ⚠️  Rate limit exceeded for:', email)
        return res.status(429).json({ 
          error: 'Too many signup attempts. Please wait a few minutes before trying again.'
        })
      }

      // Handle captcha errors
      if (errorMessage.includes('captcha') || 
          errorMessage.includes('verification') ||
          errorCode === 'captcha_failed') {
        console.warn('[Signup API] ⚠️  Captcha verification failed for:', email)
        return res.status(400).json({ 
          error: 'Captcha verification failed. Please complete the captcha and try again.'
        })
      }

      // Handle signup disabled errors
      if (errorMessage.includes('signup disabled') || 
          errorMessage.includes('registration disabled') ||
          errorCode === 'signup_disabled') {
        console.warn('[Signup API] ⚠️  Signup disabled')
        return res.status(403).json({ 
          error: 'User registration is currently disabled. Please contact the administrator.'
        })
      }

      // For other 4xx client errors, return the GoTrue error message
      if (gotrueResponse.status >= 400 && gotrueResponse.status < 500) {
        console.warn('[Signup API] ⚠️  Client error from GoTrue:', gotrueResponse.status, errorMessage)
        return res.status(gotrueResponse.status).json({ 
          error: responseData.error_description || responseData.msg || responseData.message || 'Invalid request. Please check your input and try again.' 
        })
      }
      
      // For 5xx server errors, return a generic server error message
      console.error('[Signup API] ❌ Server error from GoTrue:', gotrueResponse.status, errorMessage)
      return res.status(503).json({ 
        error: 'Authentication service is temporarily unavailable. Please try again in a few moments.' 
      })
    }

    const totalTime = Date.now() - startTime
    
    console.log('[Signup API] ✅ User signup successful')
    console.log('[Signup API] User ID:', responseData.user?.id)
    console.log('[Signup API] User email:', responseData.user?.email)
    console.log('[Signup API] Total request time:', `${totalTime}ms`)
    console.log('[Signup API] GoTrue request time:', `${requestTime}ms`)
    
    // Log successful request
    logSuccessfulRequest(
      'Signup API',
      {
        url: signupUrl,
        method: 'POST',
        status: gotrueResponse.status,
        responseTime: requestTime,
        success: true,
        context: {
          userId: responseData.user?.id,
          email: responseData.user?.email,
          configSource: serverConfig.source,
          networkType: serverConfig.networkType,
          environment: envInfo.environment,
          totalTime
        }
      }
    )

    // Return success response in the format expected by the client
    return res.status(200).json({
      user: responseData.user,
      session: responseData.session,
      message: 'User created successfully. Please check your email to confirm your account.',
    })

  } catch (error: any) {
    const totalTime = Date.now() - startTime
    
    // Get GoTrue configuration for error reporting
    let gotrueUrl = 'unknown'
    let configSource = 'unknown'
    let networkType = 'unknown'
    try {
      const serverConfig = getServerSideGoTrueConfig()
      gotrueUrl = serverConfig.internalUrl
      configSource = serverConfig.source
      networkType = serverConfig.networkType || 'unknown'
    } catch (configError) {
      console.error('[Signup API] ❌ Failed to get GoTrue config for error reporting:', configError)
    }
    
    // Enhanced error logging for requirement 3.2: Specific error reasons and attempted URL
    console.error('[Signup API] ❌ Unexpected error during signup')
    console.error('[Signup API] === EXCEPTION ANALYSIS ===')
    console.error('[Signup API] Error type:', error.constructor.name)
    console.error('[Signup API] Error message:', error.message)
    console.error('[Signup API] Error code:', error.code)
    console.error('[Signup API] Error stack:', error.stack)
    console.error('[Signup API] Attempted URL:', gotrueUrl)
    console.error('[Signup API] Config source:', configSource)
    console.error('[Signup API] Network type:', networkType)
    console.error('[Signup API] Total time before error:', `${totalTime}ms`)
    console.error('[Signup API] Exception timestamp:', new Date().toISOString())
    
    // Enhanced network error analysis for requirement 3.5: Troubleshooting suggestions
    console.error('[Signup API] 🔍 Exception Root Cause Analysis:')
    if (error.cause) {
      console.error('[Signup API]   Underlying cause:', error.cause)
    }
    
    // Analyze error properties for network issues
    const errorProps = Object.getOwnPropertyNames(error)
    if (errorProps.length > 0) {
      console.error('[Signup API]   Error properties:', errorProps.reduce((acc, prop) => {
        acc[prop] = error[prop]
        return acc
      }, {} as Record<string, any>))
    }
    
    // Environment context for troubleshooting
    console.error('[Signup API] 🌍 Environment Context:')
    console.error('[Signup API]   NODE_ENV:', process.env.NODE_ENV || 'NOT SET')
    console.error('[Signup API]   Container hostname:', process.env.HOSTNAME || 'NOT SET')
    console.error('[Signup API]   Docker container flag:', process.env.DOCKER_CONTAINER || 'NOT SET')
    console.error('[Signup API]   Platform mode:', process.env.NEXT_PUBLIC_IS_PLATFORM || 'NOT SET')
    
    console.error('[Signup API] ================================')
    console.error('[Signup API] Full error object:', error)
    
    // Enhanced connection error detection with specific error types
    const isConnectionRefused = 
      error.message?.includes('ECONNREFUSED') || 
      error.code === 'ECONNREFUSED'
    
    const isTimeout = 
      error.message?.includes('ETIMEDOUT') || 
      error.message?.includes('timeout') ||
      error.code === 'ETIMEDOUT'
    
    const isNotFound = 
      error.message?.includes('ENOTFOUND') || 
      error.code === 'ENOTFOUND'
    
    const isNetworkError = 
      error.message?.includes('fetch failed') ||
      error.message?.includes('network') ||
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTREACHABLE'
    
    const isConnectionError = isConnectionRefused || isTimeout || isNotFound || isNetworkError
    
    // Log failed request for debugging
    logFailedRequest(
      'Signup API',
      {
        url: gotrueUrl,
        method: 'POST',
        responseTime: totalTime,
        success: false,
        error: error.message,
        context: {
          errorType: error.constructor.name,
          errorCode: error.code,
          configSource,
          environment: envInfo.environment,
          isConnectionError
        }
      },
      isConnectionError ? [
        'Check if GoTrue service is running: docker-compose ps',
        'Verify network connectivity between containers',
        'Check Kong gateway configuration and health',
        'Verify internal DNS resolution (kong:8000 should resolve)',
        'Check container network configuration',
        'Review Docker Compose network settings',
        'Verify firewall rules are not blocking container communication'
      ] : [
        'Check GoTrue service logs for detailed error information',
        'Verify SUPABASE_ANON_KEY is correctly configured',
        'Check request payload format and validation',
        'Review GoTrue configuration and settings',
        'Verify database connectivity from GoTrue service'
      ]
    )
    
    if (isConnectionError) {
      console.error('[Signup API] 🔌 Network connection error detected')
      console.error('[Signup API] This indicates GoTrue service is not reachable')
      console.error('[Signup API] Check container networking and service health')
      
      // Provide specific error messages based on error type
      if (isConnectionRefused) {
        console.error('[Signup API] Connection refused - GoTrue service may not be running')
        return res.status(503).json({ 
          error: 'Authentication service is not responding. Please ensure all services are running and try again in a few moments.' 
        })
      }
      
      if (isTimeout) {
        console.error('[Signup API] Connection timeout - GoTrue service may be overloaded')
        return res.status(503).json({ 
          error: 'Authentication service is taking too long to respond. Please try again in a few moments.' 
        })
      }
      
      if (isNotFound) {
        console.error('[Signup API] Host not found - DNS or network configuration issue')
        return res.status(503).json({ 
          error: 'Authentication service cannot be reached. Please check your network configuration and try again.' 
        })
      }
      
      // Generic network error
      console.error('[Signup API] Generic network error')
      return res.status(503).json({ 
        error: 'Network error occurred while connecting to authentication service. Please try again in a few moments.' 
      })
    }
    
    // For non-connection errors, return a generic error
    console.error('[Signup API] 💥 Non-connection error occurred')
    console.error('[Signup API] This may indicate a configuration or validation issue')
    
    return res.status(500).json({ 
      error: 'An unexpected error occurred during signup. Please try again or contact support if the problem persists.' 
    })
  }
}
