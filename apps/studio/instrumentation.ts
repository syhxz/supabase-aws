import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
    
    // Initialize ServiceRouter with existing projects
    try {
      const { initializeServiceRouter } = await import('./lib/service-router/init')
      const result = await initializeServiceRouter()
      console.log('[Instrumentation] ServiceRouter initialization complete:', {
        totalProjects: result.totalProjects,
        successful: result.successfulRegistrations,
        failed: result.failedRegistrations,
      })
    } catch (error) {
      console.error('[Instrumentation] Failed to initialize ServiceRouter:', error)
      // Don't throw - allow app to start even if initialization fails
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
