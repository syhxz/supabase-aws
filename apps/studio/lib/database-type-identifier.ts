/**
 * Database Type Identification Service
 * 
 * Provides logic to distinguish primary from replica databases and identify
 * database types based on project configuration and environment settings.
 */

import type { components } from 'data/api'

export type Database = components['schemas']['DatabaseDetailResponse']

export interface DatabaseConnectionInfo {
  host: string
  port: number
  database: string
  user: string
  password: string
  isReadOnly: boolean
  isPrimary: boolean
}

export interface DatabaseTypeIdentifier {
  identifyDatabaseType(projectRef: string, databaseId: string): 'primary' | 'replica'
  isPrimaryDatabase(projectRef: string, databaseId: string): boolean
  getDatabaseConnectionInfo(projectRef: string, databaseId: string): DatabaseConnectionInfo | null
}

/**
 * Enhanced database type identification logic
 * 
 * This service provides methods to correctly identify primary vs replica databases
 * based on project configuration, environment settings, and database metadata.
 */
export class EnhancedDatabaseTypeIdentifier implements DatabaseTypeIdentifier {
  private databases: Database[] = []

  constructor(databases: Database[] = []) {
    this.databases = databases
  }

  /**
   * Updates the internal database list
   */
  updateDatabases(databases: Database[]): void {
    this.databases = databases
  }

  /**
   * Identifies whether a database is primary or replica
   * 
   * Enhanced logic for remote database environments:
   * 1. If database identifier matches project ref, it's the primary database
   * 2. If database has explicit replica metadata, it's a replica
   * 3. For remote databases, check environment configuration and instance metadata
   * 4. Default to primary for single database configurations
   * 5. Enhanced primary detection for production environments
   */
  identifyDatabaseType(projectRef: string, databaseId: string): 'primary' | 'replica' {
    if (!projectRef || !databaseId) {
      return 'primary' // Default to primary for invalid inputs
    }

    // Find the specific database
    const database = this.databases.find(db => db.identifier === databaseId)
    
    if (!database) {
      // If database not found but databaseId matches projectRef, assume primary
      return databaseId === projectRef ? 'primary' : 'replica'
    }

    // Primary identification logic:
    // 1. Database identifier matches project reference (most reliable indicator)
    if (database.identifier === projectRef) {
      return 'primary'
    }

    // 2. Check for explicit replica indicators in database metadata
    if (this.hasReplicaIndicators(database)) {
      return 'replica'
    }

    // 3. For remote databases, enhanced primary detection
    if (this.isRemoteDatabase(database)) {
      // Check if this is the main database instance
      if (this.isMainDatabaseInstance(database, projectRef)) {
        return 'primary'
      }
      
      // Additional check: if this is the only non-replica database, it's primary
      const nonReplicaDatabases = this.databases.filter(db => !this.hasReplicaIndicators(db))
      if (nonReplicaDatabases.length === 1 && nonReplicaDatabases[0].identifier === databaseId) {
        return 'primary'
      }
    }

    // 4. If only one database exists, it's likely the primary
    if (this.databases.length === 1) {
      return 'primary'
    }

    // 5. Enhanced check: if no other database matches project ref, this might be primary
    const projectRefDatabase = this.databases.find(db => db.identifier === projectRef)
    if (!projectRefDatabase && this.databases.length > 0) {
      // If no database matches project ref exactly, the first non-replica database is likely primary
      const sortedDatabases = this.databases
        .filter(db => !this.hasReplicaIndicators(db))
        .sort((a, b) => (a.inserted_at || '').localeCompare(b.inserted_at || ''))
      
      if (sortedDatabases.length > 0 && sortedDatabases[0].identifier === databaseId) {
        return 'primary'
      }
    }

    // 6. Default to replica for unidentified databases in multi-database setups
    return 'replica'
  }

  /**
   * Checks if a database is the primary database
   */
  isPrimaryDatabase(projectRef: string, databaseId: string): boolean {
    return this.identifyDatabaseType(projectRef, databaseId) === 'primary'
  }

  /**
   * Gets comprehensive database connection information
   */
  getDatabaseConnectionInfo(projectRef: string, databaseId: string): DatabaseConnectionInfo | null {
    const database = this.databases.find(db => db.identifier === databaseId)
    
    if (!database) {
      return null
    }

    const isPrimary = this.isPrimaryDatabase(projectRef, databaseId)
    
    return {
      host: this.extractHost(database),
      port: this.extractPort(database),
      database: this.extractDatabaseName(database, projectRef),
      user: this.extractUser(database, isPrimary),
      password: '[YOUR_PASSWORD]', // Always masked for security
      isReadOnly: !isPrimary,
      isPrimary: isPrimary,
    }
  }

  /**
   * Checks if database has replica-specific indicators
   */
  private hasReplicaIndicators(database: Database): boolean {
    // Check for replica-specific metadata or naming patterns
    const identifier = database.identifier?.toLowerCase() || ''
    const region = database.region?.toLowerCase() || ''
    
    // Common replica indicators
    const replicaPatterns = [
      'replica',
      'read-only',
      'readonly',
      'slave',
      'secondary'
    ]
    
    return replicaPatterns.some(pattern => 
      identifier.includes(pattern) || region.includes(pattern)
    )
  }

  /**
   * Determines if this is a remote database (not local Docker)
   */
  private isRemoteDatabase(database: Database): boolean {
    const host = this.extractHost(database)
    
    // Local Docker indicators
    const localPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      'db', // Docker service name
      'postgres' // Docker service name
    ]
    
    return !localPatterns.some(pattern => host.includes(pattern))
  }

  /**
   * Checks if this database is the main instance for the project
   */
  private isMainDatabaseInstance(database: Database, projectRef: string): boolean {
    // For remote databases, the main instance typically:
    // 1. Has the same identifier as project ref
    // 2. Is in the primary region
    // 3. Has write capabilities
    
    if (database.identifier === projectRef) {
      return true
    }
    
    // Check if this is marked as the primary region/instance
    const region = database.region?.toLowerCase() || ''
    const primaryRegionPatterns = ['primary', 'main', 'us-east-1', 'us-west-2']
    
    return primaryRegionPatterns.some(pattern => region.includes(pattern))
  }

  /**
   * Extracts host from database configuration
   */
  private extractHost(database: Database): string {
    // Try to extract from various possible fields using correct property names
    // Treat empty strings as missing values
    return (database.db_host && database.db_host.trim() !== '') ? database.db_host :
           process.env.POSTGRES_HOST || 
           'db'
  }

  /**
   * Extracts port from database configuration
   */
  private extractPort(database: Database): number {
    // Treat 0 or invalid ports as missing values
    const dbPort = database.db_port && database.db_port > 0 ? database.db_port : null
    const port = dbPort || parseInt(process.env.POSTGRES_PORT || '5432', 10)
    
    return isNaN(port) ? 5432 : port
  }

  /**
   * Extracts database name from configuration
   */
  private extractDatabaseName(database: Database, projectRef: string): string {
    // Treat empty strings as missing values
    return (database.db_name && database.db_name.trim() !== '') ? database.db_name :
           projectRef || 
           process.env.POSTGRES_DB || 
           'postgres'
  }

  /**
   * Extracts appropriate user based on database type
   */
  private extractUser(database: Database, isPrimary: boolean): string {
    // Treat empty strings as missing values
    if (database.db_user && database.db_user.trim() !== '') {
      return database.db_user
    }
    
    // Use environment variables based on database type
    if (isPrimary) {
      return process.env.POSTGRES_USER_READ_WRITE || 'supabase_admin'
    } else {
      return process.env.POSTGRES_USER_READ_ONLY || 'supabase_read_only_user'
    }
  }
}

/**
 * Creates a new database type identifier instance
 */
export function createDatabaseTypeIdentifier(databases: Database[] = []): EnhancedDatabaseTypeIdentifier {
  return new EnhancedDatabaseTypeIdentifier(databases)
}

/**
 * Utility function to identify if a database is primary based on simple criteria
 */
export function isSimplePrimaryDatabase(projectRef: string, databaseId: string): boolean {
  return databaseId === projectRef
}

/**
 * Utility function to get database type label for UI display
 */
export function getDatabaseTypeLabel(projectRef: string, databaseId: string, databases: Database[] = []): string {
  const identifier = createDatabaseTypeIdentifier(databases)
  const type = identifier.identifyDatabaseType(projectRef, databaseId)
  
  return type === 'primary' ? 'Primary Database' : 'Read Replica'
}