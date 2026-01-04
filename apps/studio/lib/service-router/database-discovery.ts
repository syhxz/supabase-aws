/**
 * Database Discovery Service
 * 
 * Automatically discovers existing databases and creates project configurations
 * This is a temporary solution until we migrate to PostgreSQL-based project storage
 */

import { executeQuery } from '../api/self-hosted/query'
import { saveProject, findAllProjects } from '../api/self-hosted'
import { generateConnectionString } from '../api/self-hosted/connection-string'

/**
 * Discovers all user databases (excluding system databases)
 */
export async function discoverDatabases(): Promise<string[]> {
  console.log('[Database Discovery] Scanning for existing databases...')
  
  try {
    const result = await executeQuery({
      query: `
        SELECT datname 
        FROM pg_database 
        WHERE datname NOT IN ('postgres', 'template0', 'template1')
        AND datistemplate = false
        ORDER BY datname
      `,
    })

    if (result.error) {
      console.error('[Database Discovery] Failed to query databases:', result.error)
      return []
    }

    const databases = result.data?.map((row: any) => row.datname) || []
    console.log(`[Database Discovery] Found ${databases.length} user databases:`, databases)
    
    return databases
  } catch (error) {
    console.error('[Database Discovery] Error discovering databases:', error)
    return []
  }
}

/**
 * Creates project configurations for discovered databases
 * Only creates configs for databases that don't already have a project
 */
export async function createProjectsForDiscoveredDatabases(): Promise<number> {
  console.log('[Database Discovery] Creating project configurations...')
  
  try {
    // Get existing projects
    const existingResult = await findAllProjects()
    if (existingResult.error) {
      console.error('[Database Discovery] Failed to load existing projects:', existingResult.error)
      return 0
    }

    const existingProjects = existingResult.data || []
    // Create a Set for O(1) lookup performance when filtering
    const existingDatabaseNames = new Set(existingProjects.map(p => p.database_name))
    
    console.log(`[Database Discovery] Found ${existingProjects.length} existing project configs`)

    // Discover databases
    const databases = await discoverDatabases()
    
    // Log all discovered databases
    console.log(`[Database Discovery] Discovered ${databases.length} total databases:`, databases)
    
    // Filter out databases that already have projects
    // This ensures we only create projects for NEW databases (Requirement 5.3)
    const newDatabases = databases.filter(db => !existingDatabaseNames.has(db))
    const alreadyConfiguredDatabases = databases.filter(db => existingDatabaseNames.has(db))
    
    if (alreadyConfiguredDatabases.length > 0) {
      console.log(`[Database Discovery] ${alreadyConfiguredDatabases.length} databases already have projects:`, alreadyConfiguredDatabases)
    }
    
    if (newDatabases.length === 0) {
      console.log('[Database Discovery] All databases already have project configurations')
      return 0
    }

    console.log(`[Database Discovery] Creating configs for ${newDatabases.length} new databases:`, newDatabases)

    // Create project configs for new databases
    let createdCount = 0
    const createdProjects: Array<{ ref: string; databaseName: string }> = []
    
    for (const databaseName of newDatabases) {
      try {
        // Generate a unique ref
        // Use "default" for the postgres database, otherwise generate a unique ref
        let ref: string
        if (databaseName === 'postgres') {
          ref = 'default'
        } else {
          const randomStr = Math.random().toString(36).substring(2, 10)
          ref = `${databaseName.replace(/_/g, '-')}-${randomStr}`
        }

        const connectionString = generateConnectionString({
          databaseName,
          readOnly: false,
        })

        const result = await saveProject({
          ref,
          name: databaseName,
          database_name: databaseName,
          organization_id: 1, // Default organization
          status: 'ACTIVE_HEALTHY',
          region: 'localhost',
          connection_string: connectionString,
          inserted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        if (result.error) {
          console.error(`[Database Discovery] Failed to create project for ${databaseName}:`, result.error)
        } else {
          console.log(`[Database Discovery] ✓ Created project: ref=${ref}, database=${databaseName}`)
          createdCount++
          createdProjects.push({ ref, databaseName })
        }
      } catch (error) {
        console.error(`[Database Discovery] Error creating project for ${databaseName}:`, error)
      }
    }

    // Log summary
    console.log(`[Database Discovery] ========== Discovery Summary ==========`)
    console.log(`[Database Discovery] Total databases discovered: ${databases.length}`)
    console.log(`[Database Discovery] Databases with existing projects: ${alreadyConfiguredDatabases.length}`)
    console.log(`[Database Discovery] New databases found: ${newDatabases.length}`)
    console.log(`[Database Discovery] Projects created: ${createdCount}`)
    if (createdProjects.length > 0) {
      console.log(`[Database Discovery] Created projects:`, createdProjects.map(p => `${p.ref} (${p.databaseName})`).join(', '))
    }
    console.log(`[Database Discovery] =====================================`)
    
    return createdCount
  } catch (error) {
    console.error('[Database Discovery] Error in createProjectsForDiscoveredDatabases:', error)
    return 0
  }
}

/**
 * Checks if database discovery should run
 * Discovery runs if:
 * 1. ENABLE_DATABASE_DISCOVERY env var is set to 'true', OR
 * 2. No projects exist in the project store
 */
export function shouldRunDatabaseDiscovery(): boolean {
  // Check environment variable
  if (process.env.ENABLE_DATABASE_DISCOVERY === 'true') {
    return true
  }

  // Discovery is disabled by default for now
  // In the future, we might enable it automatically when no projects exist
  return false
}
