/**
 * GoTrue Environment-Specific Troubleshooting Guidance
 * 
 * Provides context-aware troubleshooting steps and actionable error messages
 * for common GoTrue authentication issues across different environments.
 * 
 * Requirements: 2.2, 2.5
 */

import type { Environment } from 'common/environment-detection'
import type { GoTrueErrorType, ClassifiedError } from './gotrue-error-classification'

/**
 * Troubleshooting context information
 */
export interface TroubleshootingContext {
  /** Environment where the error occurred */
  environment: Environment
  /** Error type classification */
  errorType: GoTrueErrorType
  /** HTTP status code if available */
  statusCode?: number
  /** URL that failed */
  url: string
  /** Whether this is a health check operation */
  isHealthCheck?: boolean
  /** Whether authentication was attempted */
  hasAuthentication?: boolean
  /** Browser/client information */
  userAgent?: string
  /** Additional context metadata */
  metadata?: Record<string, unknown>
}

/**
 * Troubleshooting guidance with priority levels
 */
export interface TroubleshootingGuidance {
  /** Primary steps to try first */
  primarySteps: string[]
  /** Secondary steps if primary steps don't work */
  secondarySteps: string[]
  /** Advanced steps for technical users */
  advancedSteps: string[]
  /** Environment-specific guidance */
  environmentSteps: string[]
  /** Prevention tips to avoid future issues */
  preventionTips: string[]
  /** Links to relevant documentation */
  documentationLinks: string[]
  /** Escalation path if all steps fail */
  escalationPath: string[]
}

/**
 * Environment detection patterns
 */
const ENVIRONMENT_PATTERNS = {
  development: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'dev.',
    'development',
    ':3000',
    ':8000',
    ':54321'
  ],
  staging: [
    'staging',
    'stg',
    'test',
    'qa',
    'preview'
  ],
  production: [
    // Production is the default if no other patterns match
  ]
}

/**
 * Gets comprehensive troubleshooting guidance for a GoTrue error
 */
export function getTroubleshootingGuidance(
  error: ClassifiedError,
  context: Partial<TroubleshootingContext> = {}
): TroubleshootingGuidance {
  const fullContext: TroubleshootingContext = {
    environment: context.environment || detectEnvironmentFromUrl(context.url || error.context.url),
    errorType: error.type,
    statusCode: context.statusCode || error.context.statusCode,
    url: context.url || error.context.url,
    isHealthCheck: context.isHealthCheck || error.context.metadata?.healthCheck === true,
    hasAuthentication: context.hasAuthentication,
    userAgent: context.userAgent,
    metadata: context.metadata,
  }

  return {
    primarySteps: getPrimarySteps(fullContext),
    secondarySteps: getSecondarySteps(fullContext),
    advancedSteps: getAdvancedSteps(fullContext),
    environmentSteps: getEnvironmentSpecificSteps(fullContext),
    preventionTips: getPreventionTips(fullContext),
    documentationLinks: getDocumentationLinks(fullContext),
    escalationPath: getEscalationPath(fullContext),
  }
}

/**
 * Gets primary troubleshooting steps (most likely to resolve the issue)
 */
function getPrimarySteps(context: TroubleshootingContext): string[] {
  const steps: string[] = []

  switch (context.errorType) {
    case 'NETWORK_ERROR':
    case 'CONNECTION_REFUSED':
      steps.push('Check your internet connection')
      steps.push('Try refreshing the page')
      if (context.environment === 'development') {
        steps.push('Verify local services are running: docker-compose ps')
        steps.push('Check if GoTrue port (54321) is accessible')
      } else {
        steps.push('Verify the service URL is correct')
        steps.push('Check if the service is currently available')
      }
      break

    case 'TIMEOUT':
      steps.push('Wait a moment and try again')
      steps.push('Check your internet connection speed')
      if (context.environment === 'development') {
        steps.push('Check if local services are overloaded')
        steps.push('Restart docker-compose services if needed')
      } else {
        steps.push('Check service status page if available')
      }
      break

    case 'AUTHENTICATION_ERROR':
      if (context.isHealthCheck) {
        steps.push('Health checks should not require authentication')
        steps.push('Check if the health endpoint is properly configured')
        if (context.environment === 'development') {
          steps.push('Verify Kong Gateway routing configuration')
          steps.push('Check if /auth/v1/health bypasses authentication')
        }
      } else {
        steps.push('Verify your credentials are correct')
        steps.push('Check if your session has expired')
        steps.push('Try logging out and logging back in')
      }
      break

    case 'AUTHORIZATION_ERROR':
      steps.push('Verify you have permission to access this resource')
      steps.push('Check if your account is active')
      steps.push('Contact your administrator for access')
      break

    case 'SERVICE_UNAVAILABLE':
      steps.push('Wait a few minutes and try again')
      steps.push('Check service status if available')
      if (context.environment === 'development') {
        steps.push('Restart local services: docker-compose restart')
      }
      break

    case 'CONFIGURATION_ERROR':
      if (context.environment === 'development') {
        steps.push('Check your .env file configuration')
        steps.push('Verify GOTRUE_* environment variables')
        steps.push('Ensure docker-compose.yml is correct')
      } else {
        steps.push('Contact your administrator')
        steps.push('Verify environment configuration')
      }
      break

    case 'RATE_LIMITED':
      steps.push('Wait a few minutes before trying again')
      steps.push('Reduce the frequency of requests')
      break

    default:
      steps.push('Try refreshing the page')
      steps.push('Wait a moment and try again')
      steps.push('Check browser console for additional details')
  }

  return steps
}

/**
 * Gets secondary troubleshooting steps
 */
function getSecondarySteps(context: TroubleshootingContext): string[] {
  const steps: string[] = []

  switch (context.errorType) {
    case 'NETWORK_ERROR':
    case 'CONNECTION_REFUSED':
      steps.push('Clear browser cache and cookies')
      steps.push('Try using a different browser or incognito mode')
      steps.push('Check firewall settings')
      if (context.environment === 'development') {
        steps.push('Check Docker Desktop is running')
        steps.push('Verify port forwarding is working')
        steps.push('Check for port conflicts with other services')
      } else {
        steps.push('Try accessing from a different network')
        steps.push('Check VPN settings if applicable')
      }
      break

    case 'TIMEOUT':
      steps.push('Try using a different network connection')
      steps.push('Disable browser extensions temporarily')
      if (context.environment === 'development') {
        steps.push('Increase Docker memory allocation')
        steps.push('Check system resource usage')
      }
      break

    case 'AUTHENTICATION_ERROR':
      steps.push('Clear browser cookies for this site')
      steps.push('Check browser developer tools for errors')
      if (context.environment === 'development') {
        steps.push('Verify API key configuration in .env')
        steps.push('Check Kong Gateway logs: docker-compose logs kong')
        steps.push('Verify GoTrue configuration: docker-compose logs gotrue')
      }
      break

    case 'SERVICE_UNAVAILABLE':
      steps.push('Check if maintenance is scheduled')
      steps.push('Try accessing different parts of the application')
      if (context.environment === 'development') {
        steps.push('Check Docker container health: docker-compose ps')
        steps.push('Review service logs for errors')
      }
      break

    case 'CONFIGURATION_ERROR':
      steps.push('Compare with working configuration examples')
      steps.push('Validate configuration syntax')
      if (context.environment === 'development') {
        steps.push('Reset to default configuration and test')
        steps.push('Check for typos in environment variables')
      }
      break
  }

  return steps
}

/**
 * Gets advanced troubleshooting steps for technical users
 */
function getAdvancedSteps(context: TroubleshootingContext): string[] {
  const steps: string[] = []

  if (context.environment === 'development') {
    steps.push('Check Docker logs: docker-compose logs --tail=50')
    steps.push('Verify network connectivity: docker network ls')
    steps.push('Test direct service access: curl http://localhost:54321/health')
    
    switch (context.errorType) {
      case 'NETWORK_ERROR':
      case 'CONNECTION_REFUSED':
        steps.push('Check port binding: netstat -tulpn | grep :54321')
        steps.push('Verify Docker network configuration')
        steps.push('Test Kong Gateway: curl http://localhost:8000/auth/v1/health')
        break

      case 'AUTHENTICATION_ERROR':
        steps.push('Check Kong routing configuration in kong.yml')
        steps.push('Verify API key plugin configuration')
        steps.push('Test without Kong: curl http://localhost:54321/health')
        break

      case 'CONFIGURATION_ERROR':
        steps.push('Validate environment variables: docker-compose config')
        steps.push('Check GoTrue startup logs for configuration errors')
        steps.push('Verify database connection from GoTrue')
        break
    }
  } else {
    steps.push('Check network connectivity: ping <service-domain>')
    steps.push('Test DNS resolution: nslookup <service-domain>')
    steps.push('Verify SSL certificate: openssl s_client -connect <domain>:443')
    
    switch (context.errorType) {
      case 'NETWORK_ERROR':
        steps.push('Check load balancer configuration')
        steps.push('Verify firewall rules')
        steps.push('Test from different geographic locations')
        break

      case 'AUTHENTICATION_ERROR':
        steps.push('Check API gateway configuration')
        steps.push('Verify authentication service deployment')
        steps.push('Review authentication service logs')
        break
    }
  }

  return steps
}

/**
 * Gets environment-specific troubleshooting steps
 */
function getEnvironmentSpecificSteps(context: TroubleshootingContext): string[] {
  const steps: string[] = []

  switch (context.environment) {
    case 'development':
      steps.push('Development Environment Specific:')
      steps.push('• Ensure Docker Desktop is running and has sufficient resources')
      steps.push('• Check that no other services are using ports 8000 or 54321')
      steps.push('• Verify .env file exists and contains required variables')
      steps.push('• Run: docker-compose pull to ensure latest images')
      steps.push('• Try: docker-compose down && docker-compose up -d')
      
      if (context.errorType === 'AUTHENTICATION_ERROR' && context.isHealthCheck) {
        steps.push('• Health check authentication issues:')
        steps.push('  - Check Kong configuration allows unauthenticated health checks')
        steps.push('  - Verify /auth/v1/health route bypasses key-auth plugin')
        steps.push('  - Test: curl -v http://localhost:8000/auth/v1/health')
      }
      break

    case 'staging':
      steps.push('Staging Environment Specific:')
      steps.push('• Verify staging deployment is complete and healthy')
      steps.push('• Check staging environment variables are set correctly')
      steps.push('• Ensure staging database is accessible')
      steps.push('• Verify staging SSL certificates are valid')
      steps.push('• Check staging service discovery configuration')
      break

    case 'production':
      steps.push('Production Environment Specific:')
      steps.push('• Check production monitoring dashboards')
      steps.push('• Verify all production services are healthy')
      steps.push('• Check CDN and load balancer status')
      steps.push('• Verify SSL certificates are not expired')
      steps.push('• Check production database connectivity')
      steps.push('• Review production logs for errors')
      
      if (context.statusCode && context.statusCode >= 500) {
        steps.push('• Server Error in Production:')
        steps.push('  - This requires immediate attention')
        steps.push('  - Check server resource utilization')
        steps.push('  - Review application logs for stack traces')
        steps.push('  - Consider scaling up resources if needed')
      }
      break
  }

  return steps
}

/**
 * Gets prevention tips to avoid future issues
 */
function getPreventionTips(context: TroubleshootingContext): string[] {
  const tips: string[] = []

  switch (context.errorType) {
    case 'NETWORK_ERROR':
    case 'CONNECTION_REFUSED':
      tips.push('Set up monitoring for service availability')
      tips.push('Implement health checks with proper alerting')
      if (context.environment === 'development') {
        tips.push('Use docker-compose health checks')
        tips.push('Set up automatic service restart on failure')
      } else {
        tips.push('Implement redundancy and failover')
        tips.push('Use load balancers with health checks')
      }
      break

    case 'TIMEOUT':
      tips.push('Configure appropriate timeout values')
      tips.push('Implement request retry logic with backoff')
      tips.push('Monitor response times and set up alerts')
      break

    case 'AUTHENTICATION_ERROR':
      tips.push('Implement proper session management')
      tips.push('Set up authentication monitoring')
      if (context.isHealthCheck) {
        tips.push('Ensure health endpoints never require authentication')
        tips.push('Document health check endpoint configuration')
      }
      break

    case 'CONFIGURATION_ERROR':
      tips.push('Use configuration validation on startup')
      tips.push('Implement configuration change monitoring')
      tips.push('Use infrastructure as code for consistent deployments')
      if (context.environment === 'development') {
        tips.push('Use .env.example files to document required variables')
        tips.push('Add configuration validation to docker-compose setup')
      }
      break

    case 'RATE_LIMITED':
      tips.push('Implement client-side rate limiting')
      tips.push('Use exponential backoff for retries')
      tips.push('Monitor API usage patterns')
      break
  }

  return tips
}

/**
 * Gets relevant documentation links
 */
function getDocumentationLinks(context: TroubleshootingContext): string[] {
  const links: string[] = []

  // General Supabase documentation
  links.push('Supabase Auth Documentation: https://supabase.com/docs/guides/auth')
  links.push('GoTrue Configuration: https://supabase.com/docs/reference/auth')

  if (context.environment === 'development') {
    links.push('Local Development Setup: https://supabase.com/docs/guides/local-development')
    links.push('Docker Compose Configuration: https://supabase.com/docs/guides/self-hosting/docker')
  }

  switch (context.errorType) {
    case 'AUTHENTICATION_ERROR':
      links.push('Authentication Troubleshooting: https://supabase.com/docs/guides/auth/troubleshooting')
      if (context.isHealthCheck) {
        links.push('Health Check Configuration: https://supabase.com/docs/guides/self-hosting/monitoring')
      }
      break

    case 'CONFIGURATION_ERROR':
      links.push('Environment Variables: https://supabase.com/docs/guides/self-hosting/environment-variables')
      links.push('Configuration Reference: https://supabase.com/docs/reference/self-hosting-auth/config')
      break

    case 'NETWORK_ERROR':
      if (context.environment === 'development') {
        links.push('Local Development Networking: https://supabase.com/docs/guides/local-development/networking')
      } else {
        links.push('Production Deployment: https://supabase.com/docs/guides/self-hosting/production')
      }
      break
  }

  return links
}

/**
 * Gets escalation path if all troubleshooting steps fail
 */
function getEscalationPath(context: TroubleshootingContext): string[] {
  const path: string[] = []

  if (context.environment === 'development') {
    path.push('If all steps fail in development:')
    path.push('1. Reset your local environment completely')
    path.push('2. Run: docker-compose down -v && docker-compose up -d')
    path.push('3. Check for system-specific issues (Windows/Mac/Linux)')
    path.push('4. Consult team documentation or setup guides')
    path.push('5. Ask for help from team members or community')
  } else {
    path.push('If all steps fail in production/staging:')
    path.push('1. Contact your system administrator immediately')
    path.push('2. Check incident response procedures')
    path.push('3. Review monitoring and alerting systems')
    path.push('4. Consider activating disaster recovery procedures')
    path.push('5. Document the incident for post-mortem analysis')
  }

  // Error-specific escalation
  switch (context.errorType) {
    case 'AUTHENTICATION_ERROR':
      if (context.isHealthCheck) {
        path.push('Health check authentication errors may indicate:')
        path.push('• Misconfigured API gateway or proxy')
        path.push('• Incorrect routing rules')
        path.push('• Service deployment issues')
      }
      break

    case 'SERVICE_UNAVAILABLE':
      path.push('Service unavailability may require:')
      path.push('• Immediate incident response')
      path.push('• Service restart or failover')
      path.push('• Infrastructure scaling')
      break

    case 'CONFIGURATION_ERROR':
      path.push('Configuration errors may require:')
      path.push('• Emergency configuration rollback')
      path.push('• Infrastructure team involvement')
      path.push('• Service redeployment')
      break
  }

  return path
}

/**
 * Detects environment from URL patterns
 */
function detectEnvironmentFromUrl(url: string): Environment {
  const lowerUrl = url.toLowerCase()

  // Check development patterns
  for (const pattern of ENVIRONMENT_PATTERNS.development) {
    if (lowerUrl.includes(pattern)) {
      return 'development'
    }
  }

  // Check staging patterns
  for (const pattern of ENVIRONMENT_PATTERNS.staging) {
    if (lowerUrl.includes(pattern)) {
      return 'staging'
    }
  }

  // Default to production
  return 'production'
}

/**
 * Formats troubleshooting guidance for display
 */
export function formatTroubleshootingGuidance(
  guidance: TroubleshootingGuidance,
  includeAdvanced: boolean = false
): string {
  const sections: string[] = []

  if (guidance.primarySteps.length > 0) {
    sections.push('🔧 Try These Steps First:')
    guidance.primarySteps.forEach((step, index) => {
      sections.push(`${index + 1}. ${step}`)
    })
    sections.push('')
  }

  if (guidance.secondarySteps.length > 0) {
    sections.push('🔍 If That Doesn\'t Work:')
    guidance.secondarySteps.forEach((step, index) => {
      sections.push(`${index + 1}. ${step}`)
    })
    sections.push('')
  }

  if (guidance.environmentSteps.length > 0) {
    sections.push('🌍 Environment-Specific Steps:')
    guidance.environmentSteps.forEach(step => {
      sections.push(step)
    })
    sections.push('')
  }

  if (includeAdvanced && guidance.advancedSteps.length > 0) {
    sections.push('⚙️ Advanced Troubleshooting:')
    guidance.advancedSteps.forEach((step, index) => {
      sections.push(`${index + 1}. ${step}`)
    })
    sections.push('')
  }

  if (guidance.preventionTips.length > 0) {
    sections.push('💡 Prevention Tips:')
    guidance.preventionTips.forEach((tip, index) => {
      sections.push(`${index + 1}. ${tip}`)
    })
    sections.push('')
  }

  if (guidance.documentationLinks.length > 0) {
    sections.push('📚 Helpful Documentation:')
    guidance.documentationLinks.forEach(link => {
      sections.push(`• ${link}`)
    })
    sections.push('')
  }

  if (guidance.escalationPath.length > 0) {
    sections.push('🚨 If Nothing Works:')
    guidance.escalationPath.forEach(step => {
      sections.push(step)
    })
  }

  return sections.join('\n')
}

/**
 * Gets actionable error message with context
 */
export function getActionableErrorMessage(
  error: ClassifiedError,
  context: Partial<TroubleshootingContext> = {}
): string {
  const guidance = getTroubleshootingGuidance(error, context)
  
  let message = error.message

  // Add immediate action if available
  if (guidance.primarySteps.length > 0) {
    message += `\n\nImmediate action: ${guidance.primarySteps[0]}`
  }

  // Add environment-specific context
  const env = context.environment || detectEnvironmentFromUrl(context.url || error.context.url)
  if (env === 'development') {
    message += '\n\nThis appears to be a development environment issue.'
  } else if (env === 'production') {
    message += '\n\nThis is a production environment issue that may require immediate attention.'
  }

  return message
}