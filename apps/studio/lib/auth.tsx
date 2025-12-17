import { useQueryClient } from '@tanstack/react-query'
import { PropsWithChildren, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
  AuthProvider as AuthProviderInternal,
  clearLocalStorage,
  gotrueClient,
  posthogClient,
  useAuthError,
} from 'common'
import { performEnvironmentCheck } from 'common/environment-detection'
import { validateFrontendClientUrls, logFrontendClientInitialization } from 'common/frontend-client-validation'
import { useAiAssistantStateSnapshot } from 'state/ai-assistant-state'
import { GOTRUE_ERRORS, IS_PLATFORM } from './constants'
import { checkGoTrueHealthWithRetry, getGoTrueErrorMessage } from './gotrue-health'
import { validateCurrentFrontendConfig, logFrontendSetupInfo } from './frontend-client-helpers'
import { validateConfiguration, quickHealthCheck } from './configuration-validation-service'

const AuthErrorToaster = ({ children }: PropsWithChildren) => {
  const error = useAuthError()

  useEffect(() => {
    if (error !== null) {
      // Check for unverified GitHub users after a GitHub sign in
      if (error.message === GOTRUE_ERRORS.UNVERIFIED_GITHUB_USER) {
        toast.error(
          'Please verify your email on GitHub first, then reach out to us at support@supabase.io to log into the dashboard'
        )
        return
      }

      toast.error(error.message)
    }
  }, [error])

  return children
}

export const AuthProvider = ({ children }: PropsWithChildren) => {
  // Read authentication configuration from runtime config or environment variables
  const [runtimeConfig, setRuntimeConfig] = useState<any>(null)
  const [healthCheckComplete, setHealthCheckComplete] = useState(false)

  // Get authentication configuration with runtime config priority
  const requireLogin = runtimeConfig?.requireLogin ?? (process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true')
  const isPlatform = runtimeConfig?.isPlatform ?? IS_PLATFORM
  const alwaysLoggedIn = !isPlatform && !requireLogin

  // Fetch runtime config on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetch('/api/runtime-config')
        .then(res => res.json())
        .then(config => {
          console.log('[Auth] Runtime configuration loaded:', {
            environment: config.environment,
            source: config.source,
            hasGoTrueUrl: !!config.gotrueUrl,
            hasAnonKey: !!config.anonKey,
          })
          
          // Perform comprehensive environment check with runtime URLs
          if (config.gotrueUrl || config.supabaseUrl || config.apiUrl) {
            console.log('[Auth] Performing environment validation with runtime URLs')
            const envInfo = performEnvironmentCheck({
              gotrueUrl: config.gotrueUrl,
              supabaseUrl: config.supabaseUrl,
              apiUrl: config.apiUrl,
            }, true)
            
            // Log environment-specific guidance
            console.log(`[Auth] Environment: ${envInfo.environment} (${envInfo.detectionMethod})`)
            console.log(`[Auth] Context: ${envInfo.context}`)
            
            // Enhanced frontend client URL validation (Requirements 3.1, 3.5)
            console.log('[Auth] Performing frontend client URL validation')
            const frontendValidation = validateFrontendClientUrls(
              config.supabaseUrl,
              config.gotrueUrl,
              envInfo.environment
            )
            
            // Log frontend client initialization details (Requirement 3.5)
            logFrontendClientInitialization({
              supabaseUrl: config.supabaseUrl,
              anonKey: config.anonKey || '',
              gotrueUrl: config.gotrueUrl,
            }, frontendValidation)
            
            // Critical error handling for production-localhost mismatches (Requirement 3.1)
            if (frontendValidation.detectedEnvironment === 'production' && 
                (config.gotrueUrl?.includes('localhost') || 
                 config.supabaseUrl?.includes('localhost') || 
                 config.apiUrl?.includes('localhost'))) {
              console.error('[Auth] 🚨 CRITICAL CONFIGURATION ERROR: Production environment detected but URLs contain localhost!')
              console.error('[Auth] Frontend clients will fail to connect in production.')
              console.error('[Auth] 💡 IMMEDIATE ACTION REQUIRED:')
              console.error('[Auth]   • Set NEXT_PUBLIC_SUPABASE_URL to your production Supabase URL')
              console.error('[Auth]   • Set SUPABASE_PUBLIC_URL to your production Supabase URL')
              console.error('[Auth]   • Verify all environment variables are properly configured')
              console.error('[Auth]   • Test client connectivity before deploying')
              
              // Show user-facing error for critical production issues
              toast.error('Production Configuration Error', {
                description: 'Frontend clients are configured with localhost URLs in production. This will prevent the application from working correctly.',
                duration: 15000,
                action: {
                  label: 'View Details',
                  onClick: () => {
                    console.log('[Auth] Frontend validation details:', frontendValidation)
                    logFrontendSetupInfo()
                  },
                },
              })
            }
            
            // Development environment guidance
            if (envInfo.environment === 'development' && 
                (!config.gotrueUrl?.includes('localhost') && 
                 !config.supabaseUrl?.includes('localhost') && 
                 !config.apiUrl?.includes('localhost'))) {
              console.warn('[Auth] Development environment detected but no localhost URLs found.')
              console.warn('[Auth] This may be intentional if connecting to remote development services.')
              console.warn('[Auth] 💡 If using local development:')
              console.warn('[Auth]   • Ensure docker-compose services are running')
              console.warn('[Auth]   • Verify NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321')
              console.warn('[Auth]   • Check that ports 54321 and 8000 are accessible')
            }
            
            // Perform comprehensive configuration validation with error handling and guidance
            console.log('[Auth] Performing comprehensive configuration validation')
            const configValidation = validateConfiguration({
              includeFrontend: true,
              includeDockerChecks: true,
              logResults: true,
              customUrls: {
                supabaseUrl: config.supabaseUrl,
                gotrueUrl: config.gotrueUrl,
                apiUrl: config.apiUrl,
              },
            })
            
            // Handle critical configuration errors
            if (configValidation.criticalErrors.length > 0) {
              console.error('[Auth] 🚨 CRITICAL CONFIGURATION ERRORS DETECTED')
              console.error('[Auth] Application may not function correctly')
              
              // Show user-facing error for critical issues
              toast.error('Critical Configuration Error', {
                description: `${configValidation.criticalErrors.length} critical configuration issues detected. Check console for details.`,
                duration: 20000,
                action: {
                  label: 'View Guide',
                  onClick: () => {
                    console.log('[Auth] Troubleshooting Guide:', configValidation.troubleshootingGuide)
                  },
                },
              })
            } else if (configValidation.warnings.length > 0) {
              console.warn(`[Auth] ⚠️ Configuration has ${configValidation.warnings.length} warnings`)
            } else {
              console.log('[Auth] ✅ Configuration validation passed')
            }
          }
          
          setRuntimeConfig(config)
        })
        .catch(error => {
          console.warn('[Auth] Failed to fetch runtime config, using build-time defaults:', error)
          
          // Perform comprehensive validation even with fallback config
          console.log('[Auth] Validating configuration with build-time defaults')
          const fallbackValidation = validateConfiguration({
            includeFrontend: true,
            includeDockerChecks: false, // Skip Docker checks for fallback
            logResults: true,
          })
          
          if (!fallbackValidation.isValid) {
            console.error('[Auth] Configuration validation failed with build-time defaults')
            console.error('[Auth] This may cause significant application issues')
            
            // Show user guidance for fallback configuration issues
            toast.error('Configuration Fallback Issues', {
              description: 'Using fallback configuration with issues. Check console for guidance.',
              duration: 15000,
            })
          }
          
          // Set fallback config based on build-time environment
          setRuntimeConfig({
            requireLogin: process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true',
            isPlatform: IS_PLATFORM,
            environment: IS_PLATFORM ? 'production' : 'development',
            source: 'fallback',
          })
        })
    }
  }, [])

  // Authentication mode configuration
  if (typeof window !== 'undefined') {
    // Authentication mode: {
    //   IS_PLATFORM: isPlatform,
    //   requireLogin,
      alwaysLoggedIn,
      mode: alwaysLoggedIn ? 'auto-login' : 'GoTrue authentication',
      runtimeConfigLoaded: !!runtimeConfig,
      environment: runtimeConfig?.environment || 'unknown',
      configSource: runtimeConfig?.source || 'not-loaded',
    })
  }

  // Perform GoTrue health check on mount when authentication is required
  useEffect(() => {
    if (requireLogin && !isPlatform) {
      const performHealthCheck = async () => {
        try {
          console.log('[Auth] Performing GoTrue health check for self-hosted environment')
          console.log('[Auth] Environment:', runtimeConfig?.environment || 'unknown')
          console.log('[Auth] Config source:', runtimeConfig?.source || 'build-time')
          
          // Use retry mechanism with exponential backoff
          const result = await checkGoTrueHealthWithRetry(undefined, 3, 1000)
          
          if (!result.available) {
            console.error('[Auth] GoTrue health check failed after retries:', result.error)
            
            // Provide environment-specific error guidance
            let errorGuidance = ''
            if (runtimeConfig?.environment === 'development') {
              errorGuidance = 'Make sure your local Supabase services are running (docker-compose up)'
            } else if (runtimeConfig?.environment === 'production') {
              errorGuidance = 'Check your production GoTrue service configuration and network connectivity'
            } else {
              errorGuidance = 'Verify your GoTrue service is running and accessible'
            }
            
            // Get user-friendly error message
            const userMessage = getGoTrueErrorMessage(result.error || '')
            
            toast.error(userMessage, {
              description: `${errorGuidance}. Technical details: ${result.error}`,
              duration: 10000,
              action: {
                label: 'Retry',
                onClick: () => {
                  window.location.reload()
                },
              },
            })
          } else {
            console.log('[Auth] ✓ GoTrue service is healthy', result)
            console.log('[Auth] Environment:', runtimeConfig?.environment || 'unknown')
          }
        } catch (error) {
          console.error('[Auth] Unexpected error during health check:', error)
          toast.error('Failed to check authentication service health', {
            description: error instanceof Error ? error.message : 'Unknown error',
            duration: 10000,
          })
        } finally {
          setHealthCheckComplete(true)
        }
      }

      performHealthCheck()
    } else {
      setHealthCheckComplete(true)
    }
  }, [requireLogin, isPlatform, runtimeConfig])

  return (
    <AuthProviderInternal alwaysLoggedIn={alwaysLoggedIn}>
      <AuthErrorToaster>{children}</AuthErrorToaster>
    </AuthProviderInternal>
  )
}

export function useSignOut() {
  const queryClient = useQueryClient()
  const { clearStorage: clearAssistantStorage } = useAiAssistantStateSnapshot()

  return useCallback(async () => {
    const result = await gotrueClient.signOut()
    posthogClient.reset()
    clearLocalStorage()
    // Clear Assistant IndexedDB
    await clearAssistantStorage()
    queryClient.clear()

    return result
  }, [queryClient, clearAssistantStorage])
}
