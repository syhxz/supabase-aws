import { initializeDatabasesOnStartup } from '../database-initialization/DatabaseInitializationService'

/**
 * Startup Hooks
 * 
 * This module contains functions that run during application startup
 * to ensure the system is properly initialized.
 */

let initializationPromise: Promise<void> | null = null

/**
 * Run all startup initialization tasks
 * This function is idempotent and can be called multiple times safely
 */
export async function runStartupHooks(): Promise<void> {
  // Ensure initialization only runs once
  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = performInitialization()
  return initializationPromise
}

/**
 * Perform the actual initialization tasks
 */
async function performInitialization(): Promise<void> {
  console.log('[Startup] Running startup hooks...')
  
  try {
    // Initialize databases and schemas
    await initializeDatabasesOnStartup()
    
    console.log('[Startup] ✓ All startup hooks completed successfully')
  } catch (error) {
    console.error('[Startup] ✗ Startup hooks failed:', error)
    
    // Don't throw the error - allow the application to start even if initialization fails
    // This prevents the app from crashing if there are temporary database issues
    console.warn('[Startup] Application will continue despite initialization failure')
  }
}

/**
 * Reset initialization state (useful for testing)
 */
export function resetStartupHooks(): void {
  initializationPromise = null
}