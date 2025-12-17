/**
 * Database Display Utilities
 * 
 * Utilities for displaying database information in UI components,
 * including proper database type labels and connection string formatting.
 */

import { createDatabaseTypeIdentifier, getDatabaseTypeLabel } from './database-type-identifier'
import type { Database } from 'data/read-replicas/replicas-query'

/**
 * Gets the display label for a database based on its type
 * Ensures primary databases always show "Primary Database" label
 */
export function getDatabaseDisplayLabel(
  projectRef: string, 
  databaseId: string, 
  databases: Database[] = []
): string {
  // Enhanced logic to ensure primary databases are correctly labeled
  if (!projectRef || !databaseId) {
    return 'Primary Database' // Default for invalid inputs
  }
  
  // If database ID matches project ref, it's definitely primary
  if (databaseId === projectRef) {
    return 'Primary Database'
  }
  
  // Use the enhanced type identification
  const label = getDatabaseTypeLabel(projectRef, databaseId, databases)
  
  // Additional safety check for primary databases
  if (label === 'Primary Database') {
    return 'Primary Database'
  }
  
  // For remote databases, check if this should be considered primary
  const identifier = createDatabaseTypeIdentifier(databases)
  const isPrimary = identifier.isPrimaryDatabase(projectRef, databaseId)
  
  return isPrimary ? 'Primary Database' : label
}

/**
 * Determines if a database should be displayed as primary
 */
export function isDatabasePrimary(
  projectRef: string, 
  databaseId: string, 
  databases: Database[] = []
): boolean {
  const identifier = createDatabaseTypeIdentifier(databases)
  return identifier.isPrimaryDatabase(projectRef, databaseId)
}

/**
 * Gets database connection information for display
 */
export function getDatabaseDisplayInfo(
  projectRef: string, 
  databaseId: string, 
  databases: Database[] = []
) {
  const identifier = createDatabaseTypeIdentifier(databases)
  const connectionInfo = identifier.getDatabaseConnectionInfo(projectRef, databaseId)
  const type = identifier.identifyDatabaseType(projectRef, databaseId)
  const label = getDatabaseTypeLabel(projectRef, databaseId, databases)
  
  return {
    type,
    label,
    isPrimary: type === 'primary',
    connectionInfo,
    displayName: `${label} (${databaseId})`
  }
}

/**
 * Formats database information for UI display
 */
export function formatDatabaseForDisplay(
  database: Database,
  projectRef: string,
  databases: Database[] = []
) {
  const displayInfo = getDatabaseDisplayInfo(projectRef, database.identifier || '', databases)
  
  return {
    ...database,
    ...displayInfo,
    formattedName: `${displayInfo.label} - ${database.identifier}`,
    isAccessible: displayInfo.isPrimary || database.status === 'ACTIVE_HEALTHY'
  }
}

/**
 * Gets all databases formatted for display
 */
export function formatDatabasesForDisplay(
  databases: Database[],
  projectRef: string
) {
  return databases.map(database => formatDatabaseForDisplay(database, projectRef, databases))
}

/**
 * Filters databases to show only primary databases
 */
export function getPrimaryDatabases(
  databases: Database[],
  projectRef: string
): Database[] {
  return databases.filter(database => 
    isDatabasePrimary(projectRef, database.identifier || '', databases)
  )
}

/**
 * Filters databases to show only replica databases
 */
export function getReplicaDatabases(
  databases: Database[],
  projectRef: string
): Database[] {
  return databases.filter(database => 
    !isDatabasePrimary(projectRef, database.identifier || '', databases)
  )
}