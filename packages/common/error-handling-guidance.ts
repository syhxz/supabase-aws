/**
 * Error Handling and User Guidance Module
 * 
 * Provides comprehensive error handling and user guidance for environment detection
 * and configuration issues. Implements Requirements 4.1, 4.2, 4.3, 4.4, 4.5.
 */

import { Environment, EnvironmentInfo } from './environment-detection'

/**
 * Configuration error types
 */
export type ConfigurationErrorType = 
  | 'missing-environment-variables'
  | 'production-localhost-mismatch'
  | 'development-production-mismatch'
  | 'invalid-url-format'
  | 'fallback-configuration-used'
  | 'environment-variable-conflict'
  | 'docker-build-variable-missing'
  | 'network-configuration-error'

/**
 * Error severity levels
 */
export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info'

/**
 * Configuration error details
 */
export interface ConfigurationError {
  /** Error type identifier */
  type: ConfigurationErrorType
  /** Error severity level */
  severity: ErrorSeverity
  /** Human-readable error message */
  message: string
  /** Detailed description of the issue */
  description: string
  /** Specific recommendations to fix the issue */
  recommendations: string[]
  /** Example configurations or commands */
  examples: {
    environmentVariables?: Record<string, string>
    dockerCommands?: string[]
    configurationFiles?: Record<string, string>
  }
  /** Related environment variables */
  relatedVariables: string[]
  /** Affected components */
  affectedComponents: string[]
}

/**
 * User guidance context
 */
export interface UserGuidanceContext {
  /** Current environment */
  environment: Environment
  /** Whether running in Docker */
  isDocker: boolean
  /** Whether this is build-time or runtime */
  isBuildTime: boolean
  /** Available environment variables */
  availableVariables: string[]
  /** Missing critical variables */
  missingVariables: string[]
  /** Current URLs being used */
  currentUrls: {
    supabaseUrl?: string
    gotrueUrl?: string
    apiUrl?: string
  }
}

/**
 * Generates fallback recommendation logging
 * Requirement 4.1: Log specific recommendations for fixing configuration when fallbacks are used
 */
export function generateFallbackRecommendations(
  fallbackType: 'build-time' | 'cached' | 'emergency-defaults',
  context: UserGuidanceContext
): ConfigurationError {
  const baseError: Partial<ConfigurationError> = {
    type: 'fallback-configuration-used',
    severity: 'warning',
    relatedVariables: ['ENVIRONMENT', 'NODE_ENV', 'SUPABASE_PUBLIC_URL', 'API_EXTERNAL_URL'],
    affectedComponents: ['Environment Detection', 'URL Resolution', 'Client Configuration'],
  }

  switch (fallbackType) {
    case 'build-time':
      return {
        ...baseError,
        message: 'Using build-time configuration fallback',
        description: 'Runtime configuration failed, falling back to build-time environment variables. This may result in outdated or incorrect configuration.',
        recommendations: [
          'Check network connectivity to configuration endpoints',
          'Verify that runtime configuration API is accessible',
          'Ensure environment variables are properly set at runtime',
          'Check server logs for configuration loading errors',
          'Consider setting explicit ENVIRONMENT variable for clarity',
        ],
        examples: {
          environmentVariables: {
            'ENVIRONMENT': context.environment,
            'SUPABASE_PUBLIC_URL': context.environment === 'production' 
              ? 'https://your-project.supabase.co' 
              : 'http://127.0.0.1:54321',
            'API_EXTERNAL_URL': context.environment === 'production'
              ? 'https://api.yourcompany.com'
              : 'http://127.0.0.1:8000',
          },
          dockerCommands: [
            'docker run -e ENVIRONMENT=production -e SUPABASE_PUBLIC_URL=https://your-project.supabase.co your-image',
            'docker-compose up -d  # Ensure environment variables are set in docker-compose.yml',
          ],
        },
      } as ConfigurationError

    case 'cached':
      return {
        ...baseError,
        message: 'Using cached configuration from previous session',
        description: 'Current configuration could not be loaded, using cached values from a previous successful session. This configuration may be outdated.',
        recommendations: [
          'Refresh the page to attempt loading fresh configuration',
          'Check network connectivity',
          'Clear browser cache if problems persist',
          'Verify configuration server is running and accessible',
          'Check for any network proxy or firewall issues',
        ],
        examples: {
          environmentVariables: {
            'NEXT_PUBLIC_SUPABASE_URL': 'https://your-project.supabase.co',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'your-anon-key',
          },
        },
      } as ConfigurationError

    case 'emergency-defaults':
      return {
        ...baseError,
        severity: 'critical',
        message: 'Using emergency default configuration',
        description: 'All configuration sources failed, using hardcoded emergency defaults. This will only work for local development and will fail in production.',
        recommendations: [
          'IMMEDIATE ACTION REQUIRED: Set proper environment variables',
          'For local development: Ensure docker-compose services are running',
          'For production: Contact system administrator immediately',
          'Verify network connectivity and service availability',
          'Check server logs for detailed error information',
        ],
        examples: {
          environmentVariables: {
            'ENVIRONMENT': 'development',
            'SUPABASE_PUBLIC_URL': 'http://127.0.0.1:54321',
            'API_EXTERNAL_URL': 'http://127.0.0.1:8000',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'your-anon-key',
          },
          dockerCommands: [
            'docker-compose up -d  # Start local Supabase services',
            'docker ps  # Verify services are running',
            'docker logs supabase-kong  # Check service logs',
          ],
        },
      } as ConfigurationError

    default:
      return {
        ...baseError,
        message: 'Unknown fallback configuration used',
        description: 'An unrecognized fallback configuration was used.',
        recommendations: ['Contact support for assistance'],
        examples: {},
      } as ConfigurationError
  }
}

/**
 * Generates production-localhost mismatch error logging
 * Requirement 4.2: Log critical errors and provide specific environment variable recommendations
 */
export function generateProductionLocalhostError(
  localhostUrls: string[],
  context: UserGuidanceContext
): ConfigurationError {
  return {
    type: 'production-localhost-mismatch',
    severity: 'critical',
    message: 'CRITICAL: Production environment detected with localhost URLs',
    description: `Production environment is configured but the following URLs contain localhost patterns: ${localhostUrls.join(', ')}. This will cause complete application failure in production as localhost URLs are not accessible from external networks.`,
    recommendations: [
      '🚨 IMMEDIATE ACTION REQUIRED - Production deployment will fail',
      'Set SUPABASE_PUBLIC_URL to your production Supabase URL',
      'Set API_EXTERNAL_URL to your production API gateway URL',
      'Set NEXT_PUBLIC_SUPABASE_URL for frontend client configuration',
      'Verify all URLs are accessible from your production network',
      'Test configuration in staging environment before production deployment',
      'Never use localhost, 127.0.0.1, or 0.0.0.0 in production',
    ],
    examples: {
      environmentVariables: {
        'ENVIRONMENT': 'production',
        'SUPABASE_PUBLIC_URL': 'https://your-project.supabase.co',
        'API_EXTERNAL_URL': 'https://api.yourcompany.com',
        'NEXT_PUBLIC_SUPABASE_URL': 'https://your-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'your-production-anon-key',
      },
      dockerCommands: [
        'docker run -e ENVIRONMENT=production -e SUPABASE_PUBLIC_URL=https://your-project.supabase.co your-image',
        'kubectl set env deployment/your-app SUPABASE_PUBLIC_URL=https://your-project.supabase.co',
      ],
      configurationFiles: {
        'docker-compose.prod.yml': `
services:
  app:
    environment:
      - ENVIRONMENT=production
      - SUPABASE_PUBLIC_URL=https://your-project.supabase.co
      - API_EXTERNAL_URL=https://api.yourcompany.com
      - NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co`,
        '.env.production': `
ENVIRONMENT=production
SUPABASE_PUBLIC_URL=https://your-project.supabase.co
API_EXTERNAL_URL=https://api.yourcompany.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key`,
      },
    },
    relatedVariables: ['SUPABASE_PUBLIC_URL', 'API_EXTERNAL_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'ENVIRONMENT'],
    affectedComponents: ['Frontend Clients', 'API Gateway', 'Authentication', 'Database Access'],
  }
}

/**
 * Generates development-production mismatch warnings
 * Requirement 4.3: Log warnings about potential misconfigurations
 */
export function generateDevelopmentProductionMismatch(
  detectedEnvironment: Environment,
  expectedEnvironment: Environment,
  context: UserGuidanceContext
): ConfigurationError {
  return {
    type: 'development-production-mismatch',
    severity: 'warning',
    message: `Environment mismatch: detected ${detectedEnvironment} but expected ${expectedEnvironment}`,
    description: `The system detected ${detectedEnvironment} environment but the deployment context suggests ${expectedEnvironment}. This may indicate configuration issues or intentional remote service usage.`,
    recommendations: [
      `Set ENVIRONMENT=${expectedEnvironment} for explicit control`,
      'Verify that environment variables match your deployment context',
      'Check if you are intentionally connecting to remote services',
      'Ensure consistent environment configuration across all services',
      'Review URL patterns and environment variable values',
    ],
    examples: {
      environmentVariables: {
        'ENVIRONMENT': expectedEnvironment,
        'NODE_ENV': expectedEnvironment === 'production' ? 'production' : 'development',
        'SUPABASE_PUBLIC_URL': expectedEnvironment === 'production' 
          ? 'https://your-project.supabase.co'
          : 'http://127.0.0.1:54321',
      },
    },
    relatedVariables: ['ENVIRONMENT', 'NODE_ENV', 'SUPABASE_PUBLIC_URL'],
    affectedComponents: ['Environment Detection', 'URL Resolution'],
  }
}

/**
 * Generates configuration validation errors with helpful examples
 * Requirement 4.4: Provide specific examples of correct environment variable values
 */
export function generateConfigurationValidationError(
  missingVariables: string[],
  invalidUrls: string[],
  context: UserGuidanceContext
): ConfigurationError {
  const isProduction = context.environment === 'production'
  const isDevelopment = context.environment === 'development'

  return {
    type: 'missing-environment-variables',
    severity: isProduction ? 'critical' : 'warning',
    message: `Missing or invalid configuration variables: ${[...missingVariables, ...invalidUrls.map(url => `invalid URL: ${url}`)].join(', ')}`,
    description: `The following configuration issues were detected: ${missingVariables.length} missing variables and ${invalidUrls.length} invalid URLs. This will prevent proper application functionality.`,
    recommendations: [
      'Set all required environment variables for your environment',
      'Verify URL formats are correct (must be valid HTTP/HTTPS URLs)',
      'Ensure URLs are appropriate for your deployment environment',
      'Test configuration before deploying to production',
      'Use environment-specific configuration files',
    ],
    examples: {
      environmentVariables: isProduction ? {
        // Production examples
        'ENVIRONMENT': 'production',
        'NODE_ENV': 'production',
        'SUPABASE_PUBLIC_URL': 'https://your-project.supabase.co',
        'API_EXTERNAL_URL': 'https://api.yourcompany.com',
        'NEXT_PUBLIC_SUPABASE_URL': 'https://your-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        'NEXT_PUBLIC_GOTRUE_URL': 'https://your-project.supabase.co/auth/v1',
      } : isDevelopment ? {
        // Development examples
        'ENVIRONMENT': 'development',
        'NODE_ENV': 'development',
        'SUPABASE_PUBLIC_URL': 'http://127.0.0.1:54321',
        'API_EXTERNAL_URL': 'http://127.0.0.1:8000',
        'NEXT_PUBLIC_SUPABASE_URL': 'http://127.0.0.1:54321',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        'NEXT_PUBLIC_GOTRUE_URL': 'http://127.0.0.1:54321/auth/v1',
      } : {
        // Staging examples
        'ENVIRONMENT': 'staging',
        'NODE_ENV': 'production',
        'SUPABASE_PUBLIC_URL': 'https://staging-project.supabase.co',
        'API_EXTERNAL_URL': 'https://staging-api.yourcompany.com',
        'NEXT_PUBLIC_SUPABASE_URL': 'https://staging-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
      dockerCommands: isProduction ? [
        '# Production Docker deployment',
        'docker run -e ENVIRONMENT=production \\',
        '  -e SUPABASE_PUBLIC_URL=https://your-project.supabase.co \\',
        '  -e API_EXTERNAL_URL=https://api.yourcompany.com \\',
        '  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \\',
        '  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \\',
        '  your-image:latest',
      ] : [
        '# Development Docker setup',
        'docker-compose up -d  # Starts local Supabase services',
        'export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321',
        'export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key',
        'npm run dev',
      ],
      configurationFiles: {
        '.env.example': isProduction ? `
# Production Environment Configuration
ENVIRONMENT=production
NODE_ENV=production

# Supabase Configuration
SUPABASE_PUBLIC_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key

# API Configuration
API_EXTERNAL_URL=https://api.yourcompany.com
NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1

# Platform Configuration
NEXT_PUBLIC_IS_PLATFORM=false
NEXT_PUBLIC_REQUIRE_LOGIN=true` : `
# Development Environment Configuration
ENVIRONMENT=development
NODE_ENV=development

# Local Supabase Configuration
SUPABASE_PUBLIC_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-development-anon-key

# Local API Configuration
API_EXTERNAL_URL=http://127.0.0.1:8000
NEXT_PUBLIC_GOTRUE_URL=http://127.0.0.1:54321/auth/v1

# Development Configuration
NEXT_PUBLIC_IS_PLATFORM=false
NEXT_PUBLIC_REQUIRE_LOGIN=false`,
      },
    },
    relatedVariables: missingVariables,
    affectedComponents: ['Environment Detection', 'Client Configuration', 'Authentication', 'API Access'],
  }
}

/**
 * Generates URL validation failure recommendations
 * Requirement 4.5: Provide specific recommendations for fixing URLs
 */
export function generateUrlValidationError(
  invalidUrls: { url: string; error: string }[],
  context: UserGuidanceContext
): ConfigurationError {
  return {
    type: 'invalid-url-format',
    severity: 'error',
    message: `Invalid URL format detected in ${invalidUrls.length} URLs`,
    description: `The following URLs have invalid formats or are inappropriate for the ${context.environment} environment: ${invalidUrls.map(u => `${u.url} (${u.error})`).join(', ')}`,
    recommendations: [
      'Ensure all URLs use valid HTTP or HTTPS protocols',
      'Verify URLs are accessible from your deployment environment',
      'Use appropriate URLs for your environment (localhost for dev, domains for prod)',
      'Test URL connectivity before deployment',
      'Follow URL format: protocol://hostname:port/path',
    ],
    examples: {
      environmentVariables: {
        'Valid Production URLs': 'https://your-project.supabase.co',
        'Valid Development URLs': 'http://127.0.0.1:54321',
        'Valid Staging URLs': 'https://staging.your-project.supabase.co',
      },
      dockerCommands: [
        '# Test URL connectivity',
        'curl -f https://your-project.supabase.co/rest/v1/',
        'curl -f http://127.0.0.1:54321/rest/v1/',
      ],
    },
    relatedVariables: ['SUPABASE_PUBLIC_URL', 'API_EXTERNAL_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
    affectedComponents: ['URL Validation', 'Network Connectivity', 'Client Configuration'],
  }
}

/**
 * Generates Docker build variable missing error
 */
export function generateDockerBuildVariableError(
  missingVariables: string[],
  context: UserGuidanceContext
): ConfigurationError {
  return {
    type: 'docker-build-variable-missing',
    severity: 'error',
    message: `Environment variables not available during Docker build: ${missingVariables.join(', ')}`,
    description: 'Critical environment variables are not available during the Docker build process. This will cause incorrect environment detection and configuration.',
    recommendations: [
      'Add ARG declarations in your Dockerfile for build-time variables',
      'Pass variables during docker build using --build-arg',
      'Ensure docker-compose.yml passes environment variables correctly',
      'Use multi-stage builds to separate build-time and runtime configuration',
      'Consider using .env files for consistent variable management',
    ],
    examples: {
      configurationFiles: {
        'Dockerfile': `
# Add ARG declarations for build-time variables
ARG ENVIRONMENT
ARG NODE_ENV
ARG SUPABASE_PUBLIC_URL

# Set as environment variables
ENV ENVIRONMENT=\${ENVIRONMENT}
ENV NODE_ENV=\${NODE_ENV}
ENV SUPABASE_PUBLIC_URL=\${SUPABASE_PUBLIC_URL}

# Your application code
COPY . .
RUN npm run build`,
        'docker-compose.yml': `
services:
  app:
    build:
      context: .
      args:
        - ENVIRONMENT=\${ENVIRONMENT}
        - NODE_ENV=\${NODE_ENV}
        - SUPABASE_PUBLIC_URL=\${SUPABASE_PUBLIC_URL}
    environment:
      - ENVIRONMENT=\${ENVIRONMENT}
      - SUPABASE_PUBLIC_URL=\${SUPABASE_PUBLIC_URL}`,
      },
      dockerCommands: [
        '# Build with environment variables',
        'docker build --build-arg ENVIRONMENT=production \\',
        '  --build-arg SUPABASE_PUBLIC_URL=https://your-project.supabase.co \\',
        '  -t your-app .',
        '',
        '# Using docker-compose',
        'docker-compose build --build-arg ENVIRONMENT=production',
      ],
    },
    relatedVariables: missingVariables,
    affectedComponents: ['Docker Build', 'Environment Detection', 'Build-time Configuration'],
  }
}

/**
 * Logs comprehensive error information with user guidance
 */
export function logConfigurationError(
  error: ConfigurationError,
  context: UserGuidanceContext,
  prefix: string = 'Configuration Error'
): void {
  const severityIcon = {
    critical: '🚨',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  }[error.severity]

  console.log(`[${prefix}] ${severityIcon} ${error.severity.toUpperCase()}: ${error.message}`)
  console.log(`[${prefix}] Description: ${error.description}`)
  
  if (error.affectedComponents.length > 0) {
    console.log(`[${prefix}] Affected Components: ${error.affectedComponents.join(', ')}`)
  }

  if (error.relatedVariables.length > 0) {
    console.log(`[${prefix}] Related Variables: ${error.relatedVariables.join(', ')}`)
  }

  console.log(`[${prefix}] === RECOMMENDATIONS ===`)
  error.recommendations.forEach((rec, index) => {
    console.log(`[${prefix}]   ${index + 1}. ${rec}`)
  })

  if (Object.keys(error.examples).length > 0) {
    console.log(`[${prefix}] === EXAMPLES ===`)
    
    if (error.examples.environmentVariables) {
      console.log(`[${prefix}] Environment Variables:`)
      Object.entries(error.examples.environmentVariables).forEach(([key, value]) => {
        console.log(`[${prefix}]   ${key}=${value}`)
      })
    }

    if (error.examples.dockerCommands) {
      console.log(`[${prefix}] Docker Commands:`)
      error.examples.dockerCommands.forEach(cmd => {
        console.log(`[${prefix}]   ${cmd}`)
      })
    }

    if (error.examples.configurationFiles) {
      console.log(`[${prefix}] Configuration Files:`)
      Object.entries(error.examples.configurationFiles).forEach(([filename, content]) => {
        console.log(`[${prefix}]   ${filename}:${content}`)
      })
    }
  }

  console.log(`[${prefix}] =======================================`)
}

/**
 * Analyzes environment info and generates appropriate error guidance
 */
export function analyzeEnvironmentForErrors(
  envInfo: EnvironmentInfo,
  urls: { supabaseUrl?: string; gotrueUrl?: string; apiUrl?: string }
): ConfigurationError[] {
  const errors: ConfigurationError[] = []
  
  const context: UserGuidanceContext = {
    environment: envInfo.environment,
    isDocker: envInfo.detectionPhase.dockerBuild || false,
    isBuildTime: envInfo.detectionPhase.isBuildTime,
    availableVariables: envInfo.environmentVariables.filter(v => v.available).map(v => v.name),
    missingVariables: envInfo.missingVariables,
    currentUrls: urls,
  }

  // Check for production-localhost mismatch
  if (envInfo.environment === 'production') {
    const localhostUrls = Object.values(urls).filter(url => 
      url && (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0'))
    )
    
    if (localhostUrls.length > 0) {
      errors.push(generateProductionLocalhostError(localhostUrls, context))
    }
  }

  // Check for missing critical variables
  if (envInfo.missingVariables.length > 0) {
    const invalidUrls = Object.entries(urls)
      .filter(([_, url]) => {
        if (!url) return false
        try {
          new URL(url)
          return false
        } catch {
          return true
        }
      })
      .map(([key, url]) => ({ url: url!, error: 'Invalid URL format' }))

    errors.push(generateConfigurationValidationError(
      envInfo.missingVariables,
      invalidUrls.map(u => u.url),
      context
    ))
  }

  // Check for Docker build variable issues
  if (envInfo.detectionPhase.dockerBuild && envInfo.missingVariables.length > 0) {
    const criticalBuildVars = envInfo.missingVariables.filter(v => 
      ['ENVIRONMENT', 'NODE_ENV', 'SUPABASE_PUBLIC_URL'].includes(v)
    )
    
    if (criticalBuildVars.length > 0) {
      errors.push(generateDockerBuildVariableError(criticalBuildVars, context))
    }
  }

  // Check for fallback usage
  if (envInfo.detectionMethod === 'default') {
    errors.push(generateFallbackRecommendations('emergency-defaults', context))
  }

  return errors
}

/**
 * Provides environment-specific troubleshooting guide
 */
export function generateTroubleshootingGuide(environment: Environment): {
  title: string
  commonIssues: string[]
  diagnosticCommands: string[]
  quickFixes: string[]
  preventionTips: string[]
} {
  const guides = {
    production: {
      title: 'Production Environment Troubleshooting',
      commonIssues: [
        'Localhost URLs in production configuration',
        'Missing or incorrect environment variables',
        'Network connectivity issues to external services',
        'SSL/TLS certificate problems',
        'Incorrect API keys or authentication tokens',
      ],
      diagnosticCommands: [
        'curl -f $SUPABASE_PUBLIC_URL/rest/v1/',
        'nslookup your-project.supabase.co',
        'docker logs your-container-name',
        'kubectl logs deployment/your-app',
        'env | grep -E "(SUPABASE|API|ENVIRONMENT)"',
      ],
      quickFixes: [
        'Set ENVIRONMENT=production explicitly',
        'Update SUPABASE_PUBLIC_URL to production URL',
        'Verify API_EXTERNAL_URL points to production gateway',
        'Check NEXT_PUBLIC_SUPABASE_URL for frontend clients',
        'Ensure all URLs use HTTPS in production',
      ],
      preventionTips: [
        'Use environment-specific configuration files',
        'Test configuration in staging before production',
        'Implement configuration validation in CI/CD',
        'Use infrastructure as code for consistent deployments',
        'Monitor configuration drift with alerts',
      ],
    },
    development: {
      title: 'Development Environment Troubleshooting',
      commonIssues: [
        'Local Supabase services not running',
        'Port conflicts (54321, 8000 already in use)',
        'Docker containers not started',
        'Environment variables not loaded',
        'Network connectivity to localhost services',
      ],
      diagnosticCommands: [
        'docker-compose ps',
        'curl -f http://127.0.0.1:54321/rest/v1/',
        'netstat -tulpn | grep -E "(54321|8000)"',
        'docker logs supabase-kong',
        'npm run dev -- --verbose',
      ],
      quickFixes: [
        'Run docker-compose up -d to start services',
        'Check if ports 54321 and 8000 are available',
        'Set NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321',
        'Verify .env.local file exists and is loaded',
        'Restart Docker containers if they are unhealthy',
      ],
      preventionTips: [
        'Use docker-compose for consistent local environment',
        'Document local setup requirements clearly',
        'Use .env.example files for configuration templates',
        'Implement health checks for local services',
        'Use development-specific configuration validation',
      ],
    },
    staging: {
      title: 'Staging Environment Troubleshooting',
      commonIssues: [
        'Staging URLs not configured correctly',
        'Mixed production and development configuration',
        'SSL certificate issues with staging domains',
        'Database connection problems',
        'Authentication service misconfigurations',
      ],
      diagnosticCommands: [
        'curl -f $SUPABASE_PUBLIC_URL/rest/v1/',
        'dig staging.your-project.supabase.co',
        'openssl s_client -connect staging.your-project.supabase.co:443',
        'kubectl get pods -n staging',
        'docker-compose -f docker-compose.staging.yml ps',
      ],
      quickFixes: [
        'Set ENVIRONMENT=staging explicitly',
        'Update URLs to use staging subdomains',
        'Verify staging SSL certificates are valid',
        'Check staging database connectivity',
        'Ensure staging API keys are configured',
      ],
      preventionTips: [
        'Mirror production configuration in staging',
        'Use staging-specific subdomains consistently',
        'Implement automated staging deployments',
        'Test staging configuration regularly',
        'Use staging for production deployment validation',
      ],
    },
  }

  return guides[environment]
}