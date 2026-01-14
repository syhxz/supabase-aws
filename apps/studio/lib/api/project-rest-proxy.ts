import { NextApiRequest, NextApiResponse } from 'next'
import { ProjectIsolationContext } from './secure-api-wrapper'
import { DataApiConfigResponse } from './data-api-config-data-access'
import { createProjectPostgRESTEngine } from './project-postgrest-engine'

/**
 * Project-specific REST API proxy service
 * Uses our custom PostgREST engine to handle requests with project-specific database connections
 */
export class ProjectRestProxy {
  constructor(
    private context: ProjectIsolationContext,
    private config: DataApiConfigResponse
  ) {}

  /**
   * Proxy a REST API request using our PostgREST engine
   */
  async proxyRequest(req: NextApiRequest, res: NextApiResponse, targetPath: string): Promise<void> {
    try {
      // Extract table name from the target path
      const tableName = targetPath || 'feedback' // Default to feedback table for testing
      
      // Validate table name (basic security check)
      if (!this.isValidTableName(tableName)) {
        return res.status(400).json({
          code: 'PGRST103',
          message: 'Invalid table name',
          hint: 'Table name must contain only letters, numbers, and underscores'
        })
      }
      
      // Check if the table is in allowed schemas
      if (!this.isTableInAllowedSchemas(tableName)) {
        return res.status(403).json({
          code: 'PGRST301',
          message: 'Permission denied for schema',
          hint: 'The table is not in an exposed schema'
        })
      }
      
      // Create and use our PostgREST engine
      const postgrestEngine = createProjectPostgRESTEngine(this.context, this.config)
      await postgrestEngine.handleRequest(req, res, tableName)
      
    } catch (error) {
      console.error('Project REST proxy error:', error)
      
      res.status(500).json({
        code: 'PGRST000',
        message: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Validate table name for security
   */
  private isValidTableName(tableName: string): boolean {
    // Allow only alphanumeric characters, underscores, and dots (for schema.table)
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/
    return validPattern.test(tableName)
  }

  /**
   * Check if table is in allowed schemas
   */
  private isTableInAllowedSchemas(tableName: string): boolean {
    const allowedSchemas = this.config.exposedSchemas
    
    // If no schema specified in table name, assume public schema
    if (!tableName.includes('.')) {
      return allowedSchemas.includes('public')
    }
    
    // Extract schema from table name
    const [schema] = tableName.split('.')
    return allowedSchemas.includes(schema)
  }
}

/**
 * Factory function to create a project REST proxy
 */
export function createProjectRestProxy(
  context: ProjectIsolationContext,
  config: DataApiConfigResponse
): ProjectRestProxy {
  return new ProjectRestProxy(context, config)
}