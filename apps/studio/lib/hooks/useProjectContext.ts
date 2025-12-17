/**
 * Project Context Hook
 * 
 * Ensures that all service calls include the project_ref parameter
 * for proper service isolation as per the project-level-service-isolation spec.
 */

import { useParams } from 'common'
import { useSelectedProjectQuery } from 'hooks/misc/useSelectedProject'

export interface ProjectContext {
  projectRef: string
  connectionString?: string
  isReady: boolean
}

/**
 * Hook to get the current project context for service isolation
 * 
 * This hook ensures that:
 * 1. Project ref is available from URL params
 * 2. Connection string is available for database operations
 * 3. All service calls can be properly isolated by project
 * 
 * @returns ProjectContext with projectRef, connectionString, and ready state
 */
export function useProjectContext(): ProjectContext {
  const { ref: projectRef } = useParams()
  const { data: project } = useSelectedProjectQuery()

  return {
    projectRef: projectRef ?? '',
    connectionString: project?.connectionString,
    isReady: Boolean(projectRef && project?.connectionString),
  }
}

/**
 * Hook to ensure project context is available before rendering
 * Throws an error if project context is not available
 */
export function useRequiredProjectContext(): Required<Omit<ProjectContext, 'isReady'>> {
  const context = useProjectContext()
  
  if (!context.projectRef) {
    throw new Error('Project ref is required but not available')
  }
  
  if (!context.connectionString) {
    throw new Error('Project connection string is required but not available')
  }
  
  return {
    projectRef: context.projectRef,
    connectionString: context.connectionString,
  }
}
