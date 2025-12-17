/**
 * ServiceRouter Initialization
 * 
 * Loads all existing projects and registers them with the ServiceRouter
 * This ensures that projects created before the isolation fix can still be accessed
 */

import { getServiceRouter } from './index'
import { findAllProjects, generateConnectionString } from '../api/self-hosted'
import { 
  shouldRunDatabaseDiscovery, 
  createProjectsForDiscoveredDatabases 
} from './database-discovery'

/**
 * Result of ServiceRouter initialization
 */
export interface InitializationResult {
  totalProjects: number
  successfulRegistrations: number
  failedRegistrations: number
  errors: Array<{ projectRef: string; error: Error }>
}

/**
 * Initialize ServiceRouter with all existing projects
 * Returns detailed results about the initialization process
 */
export async function initializeServiceRouter(): Promise<InitializationResult> {
  console.log('[ServiceRouter Init] Starting ServiceRouter initialization...')
  
  const result: InitializationResult = {
    totalProjects: 0,
    successfulRegistrations: 0,
    failedRegistrations: 0,
    errors: [],
  }
  
  try {
    const serviceRouter = getServiceRouter()
    
    // Get all projects from the project store
    const projectsResult = await findAllProjects()
    
    if (projectsResult.error) {
      console.error('[ServiceRouter Init] Failed to load projects:', projectsResult.error)
      throw projectsResult.error
    }
    
    let projects = projectsResult.data || []
    
    // Check if project store is empty and database discovery is enabled
    if (projects.length === 0) {
      const discoveryEnabled = shouldRunDatabaseDiscovery()
      
      if (discoveryEnabled) {
        console.log('[ServiceRouter Init] No projects found and database discovery is enabled, running discovery...')
        const createdCount = await createProjectsForDiscoveredDatabases()
        
        if (createdCount > 0) {
          console.log(`[ServiceRouter Init] Database discovery created ${createdCount} projects, reloading...`)
          // Reload projects after discovery
          const reloadResult = await findAllProjects()
          if (!reloadResult.error) {
            projects = reloadResult.data || []
          }
        } else {
          console.log('[ServiceRouter Init] Database discovery did not create any projects')
        }
      } else {
        console.log('[ServiceRouter Init] No projects found and database discovery is disabled')
      }
    }
    
    result.totalProjects = projects.length
    
    if (projects.length === 0) {
      console.log('[ServiceRouter Init] No existing projects to register')
      return result
    }
    
    console.log(`[ServiceRouter Init] Found ${projects.length} projects to register`)
    
    // Register each project - continue even if some fail
    for (const project of projects) {
      try {
        const connectionString = generateConnectionString({
          databaseName: project.database_name,
          readOnly: false,
        })
        
        await serviceRouter.registerProject({
          projectRef: project.ref,
          databaseName: project.database_name,
          connectionString,
          ownerUserId: project.owner_user_id || 'system',
          createdAt: project.inserted_at ? new Date(project.inserted_at) : new Date(),
          updatedAt: project.updated_at ? new Date(project.updated_at) : new Date(),
        })
        
        result.successfulRegistrations++
        console.log(`[ServiceRouter Init] ✓ Successfully registered project: ${project.ref} (database: ${project.database_name})`)
      } catch (error) {
        result.failedRegistrations++
        const errorObj = error instanceof Error ? error : new Error(String(error))
        result.errors.push({ projectRef: project.ref, error: errorObj })
        console.error(`[ServiceRouter Init] ✗ Failed to register project ${project.ref}:`, error)
      }
    }
    
    // Log final summary
    console.log(`[ServiceRouter Init] Initialization complete: ${result.successfulRegistrations} succeeded, ${result.failedRegistrations} failed out of ${result.totalProjects} total projects`)
    
    if (result.errors.length > 0) {
      console.error(`[ServiceRouter Init] Failed registrations:`, result.errors.map(e => `${e.projectRef}: ${e.error.message}`).join(', '))
    }
    
    return result
  } catch (error) {
    console.error('[ServiceRouter Init] Critical error during initialization:', error)
    throw error
  }
}
