import { NextApiRequest, NextApiResponse } from 'next'
import { getCurrentUserId } from './auth-helpers'
import { 
  ProjectManagementError, 
  ErrorFactory, 
  handleApiError, 
  createErrorContext,
  withErrorHandling 
} from './error-handling'

/**
 * Project isolation context extracted from request
 */
export interface ProjectIsolationContext {
  projectRef: string
  projectId: number
  userId: string
}

/**
 * Query with project filtering applied
 */
export interface IsolatedQuery {
  baseQuery: string
  projectFilter: string
  params: any[]
}

/**
 * Data validation result
 */
export interface DataOwnershipResult {
  isValid: boolean
  reason?: string
}

/**
 * Project isolation middleware for ensuring multi-tenant data isolation
 * 
 * This middleware provides:
 * - Project context extraction from requests
 * - Automatic project_id filtering for database queries
 * - Data ownership validation
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
export class ProjectIsolationMiddleware {
  /**
   * Extract project context from API request
   * 
   * @param req - Next.js API request object
   * @returns Project context including ref, ID, and user ID
   * @throws ProjectManagementError if project context cannot be extracted
   */
  async extractProjectContext(req: NextApiRequest): Promise<ProjectIsolationContext> {
    const errorContext = createErrorContext('extractProjectContext', {
      endpoint: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] as string || req.connection.remoteAddress
    })

    return withErrorHandling(
      async () => {
        // Extract project ref from URL path or query parameters
        const projectRef = this.extractProjectRef(req)
        if (!projectRef) {
          throw ErrorFactory.routing.invalidProjectRef('', errorContext)
        }

        // Get authenticated user ID
        const userId = await getCurrentUserId(req)
        if (!userId) {
          throw ErrorFactory.auth.notAuthenticated(errorContext)
        }

        // Get project ID from project ref
        const projectId = await this.getProjectIdFromRef(projectRef)
        if (!projectId) {
          throw ErrorFactory.projectDeletion.projectNotFound(projectRef, errorContext)
        }

        return {
          projectRef,
          projectId,
          userId
        }
      },
      errorContext,
      (cause) => ErrorFactory.dataIsolation.isolationFailed('extractProjectContext', cause, errorContext)
    )
  }

  /**
   * Add project filtering conditions to SQL query
   * 
   * @param query - Base SQL query
   * @param projectId - Project ID to filter by
   * @returns Query with project filtering applied
   */
  addProjectFilter(query: string, projectId: number): IsolatedQuery {
    // Normalize query by removing extra whitespace
    const normalizedQuery = query.trim().replace(/\s+/g, ' ')
    
    // Check if query already has WHERE clause
    const hasWhere = /\bWHERE\b/i.test(normalizedQuery)
    
    // Count existing parameters to determine parameter number
    const paramCount = (normalizedQuery.match(/\$\d+/g) || []).length
    const paramNumber = paramCount + 1
    
    // Add project filter condition
    const projectFilter = hasWhere 
      ? ` AND project_id = $${paramNumber}`
      : ` WHERE project_id = $${paramNumber}`
    
    return {
      baseQuery: normalizedQuery,
      projectFilter: projectFilter,
      params: [projectId]
    }
  }

  /**
   * Validate that data belongs to the specified project
   * 
   * @param data - Data object or array to validate
   * @param projectId - Expected project ID
   * @returns Validation result
   * @throws ProjectManagementError if validation fails
   */
  validateDataOwnership(data: any, projectId: number): DataOwnershipResult {
    try {
      if (!data) {
        return { isValid: true } // Empty data is valid
      }

      // Validate project ID
      if (!projectId || typeof projectId !== 'number' || projectId <= 0) {
        throw ErrorFactory.dataIsolation.invalidProjectId(projectId)
      }

      // Handle array of data objects
      if (Array.isArray(data)) {
        for (const item of data) {
          const result = this.validateSingleDataItem(item, projectId)
          if (!result.isValid) {
            throw ErrorFactory.dataIsolation.ownershipViolation(
              result.reason || 'Data ownership validation failed',
              createErrorContext('validateDataOwnership', { projectId })
            )
          }
        }
        return { isValid: true }
      }

      // Handle single data object
      const result = this.validateSingleDataItem(data, projectId)
      if (!result.isValid) {
        throw ErrorFactory.dataIsolation.ownershipViolation(
          result.reason || 'Data ownership validation failed',
          createErrorContext('validateDataOwnership', { projectId })
        )
      }

      return result
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        throw error
      }
      
      throw ErrorFactory.dataIsolation.isolationFailed(
        'validateDataOwnership',
        error as Error,
        createErrorContext('validateDataOwnership', { projectId })
      )
    }
  }

  /**
   * Validate a single data item's project ownership
   * 
   * @param item - Data item to validate
   * @param projectId - Expected project ID
   * @returns Validation result
   */
  private validateSingleDataItem(item: any, projectId: number): DataOwnershipResult {
    if (!item || typeof item !== 'object') {
      return { isValid: true } // Non-object data is considered valid
    }

    // Check if item has project_id field
    if ('project_id' in item) {
      if (item.project_id !== projectId) {
        return {
          isValid: false,
          reason: `Data belongs to project ${item.project_id}, expected ${projectId}`
        }
      }
    }

    return { isValid: true }
  }

  /**
   * Extract project reference from request URL or query parameters
   * 
   * @param req - Next.js API request object
   * @returns Project reference string or null if not found
   */
  private extractProjectRef(req: NextApiRequest): string | null {
    // Try to extract from URL path (e.g., /api/projects/[ref]/monitoring)
    const urlParts = req.url?.split('/') || []
    const projectIndex = urlParts.findIndex(part => part === 'projects')
    
    if (projectIndex !== -1 && projectIndex + 1 < urlParts.length) {
      const ref = urlParts[projectIndex + 1]
      // Remove query parameters if present
      return ref.split('?')[0]
    }

    // Try to extract from query parameters
    if (req.query.ref && typeof req.query.ref === 'string') {
      return req.query.ref
    }

    // Try alternative query parameter names
    if (req.query.projectRef && typeof req.query.projectRef === 'string') {
      return req.query.projectRef
    }

    if (req.query.project_ref && typeof req.query.project_ref === 'string') {
      return req.query.project_ref
    }

    return null
  }

  /**
   * Get project ID from project reference
   * 
   * @param projectRef - Project reference string
   * @returns Project ID or null if not found
   * @throws ProjectManagementError if project lookup fails
   */
  private async getProjectIdFromRef(projectRef: string): Promise<number | null> {
    const errorContext = createErrorContext('getProjectIdFromRef', { projectRef })

    return withErrorHandling(
      async () => {
        // Validate project ref format
        if (!projectRef || typeof projectRef !== 'string' || projectRef.trim().length === 0) {
          throw ErrorFactory.routing.invalidProjectRef(projectRef, errorContext)
        }

        // This would typically query the database
        // For now, we'll use a simple implementation that assumes the project exists
        // In a real implementation, this would query the studio_projects table
        
        // Mock implementation - in real code this would be a database query
        // SELECT id FROM studio_projects WHERE ref = $1
        
        // For testing purposes, we'll return a mock project ID
        // This should be replaced with actual database query
        const mockProjectId = this.generateMockProjectId(projectRef)
        
        if (!mockProjectId) {
          throw ErrorFactory.projectDeletion.projectNotFound(projectRef, errorContext)
        }
        
        return mockProjectId
      },
      errorContext,
      (cause) => ErrorFactory.dataIsolation.isolationFailed('getProjectIdFromRef', cause, errorContext)
    )
  }

  /**
   * Generate a mock project ID for testing purposes
   * This should be replaced with actual database query in production
   * 
   * @param projectRef - Project reference
   * @returns Mock project ID
   */
  private generateMockProjectId(projectRef: string): number {
    // Simple hash function to generate consistent mock IDs
    let hash = 0
    for (let i = 0; i < projectRef.length; i++) {
      const char = projectRef.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash) % 10000 + 1 // Return positive ID between 1-10000
  }
}

/**
 * Singleton instance of the middleware
 */
let middlewareInstance: ProjectIsolationMiddleware | null = null

/**
 * Get the singleton ProjectIsolationMiddleware instance
 * 
 * @returns ProjectIsolationMiddleware instance
 */
export function getProjectIsolationMiddleware(): ProjectIsolationMiddleware {
  if (!middlewareInstance) {
    middlewareInstance = new ProjectIsolationMiddleware()
  }
  return middlewareInstance
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetProjectIsolationMiddleware(): void {
  middlewareInstance = null
}

/**
 * Higher-order function to wrap API handlers with project isolation
 * 
 * @param handler - API handler function that receives project context
 * @returns Wrapped API handler with project isolation
 */
export function withProjectIsolation<T = any>(
  handler: (
    req: NextApiRequest,
    res: NextApiResponse,
    context: ProjectIsolationContext
  ) => Promise<T>
) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const errorContext = createErrorContext('withProjectIsolation', {
      endpoint: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] as string || req.connection.remoteAddress
    })

    try {
      const middleware = getProjectIsolationMiddleware()
      const context = await middleware.extractProjectContext(req)
      
      // Add project context to error context
      errorContext.projectId = context.projectId
      errorContext.projectRef = context.projectRef
      errorContext.userId = context.userId
      
      const result = await handler(req, res, context)
      
      // If handler returns data, validate it belongs to the project
      if (result && typeof result === 'object') {
        try {
          middleware.validateDataOwnership(result, context.projectId)
        } catch (validationError) {
          if (validationError instanceof ProjectManagementError) {
            return handleApiError(validationError, res, errorContext)
          }
          
          const error = ErrorFactory.dataIsolation.ownershipViolation(
            'Data validation failed',
            errorContext
          )
          return handleApiError(error, res, errorContext)
        }
      }
      
      // If result is not already sent by handler, send it
      if (result !== undefined && !res.headersSent) {
        res.status(200).json(result)
      }
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        return handleApiError(error, res, errorContext)
      }
      
      // Handle unexpected errors
      const managementError = ErrorFactory.generic.internalServerError(
        'Project isolation middleware',
        error as Error,
        errorContext
      )
      
      return handleApiError(managementError, res, errorContext)
    }
  }
}