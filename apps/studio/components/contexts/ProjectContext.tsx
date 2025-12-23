import { createContext, useContext, ReactNode } from 'react'
import { useParams } from 'common'
import { useSelectedProjectQuery } from 'hooks/misc/useSelectedProject'

interface ProjectContextValue {
  projectRef: string | null
  project: any | null
  isLoading: boolean
  error: Error | null
}

const ProjectContext = createContext<ProjectContextValue>({
  projectRef: null,
  project: null,
  isLoading: false,
  error: null,
})

interface ProjectProviderProps {
  children: ReactNode
}

/**
 * Project context provider that ensures all child components have access to current project data
 * This enables automatic project isolation for all data operations
 * Requirements: 2.1, 2.3, 2.5
 */
export function ProjectProvider({ children }: ProjectProviderProps) {
  const { ref: projectRef } = useParams()
  const { data: project, isLoading, error } = useSelectedProjectQuery()

  const value: ProjectContextValue = {
    projectRef: projectRef || null,
    project: project || null,
    isLoading,
    error: error as Error | null,
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}

/**
 * Hook to access current project context
 * Ensures components always have access to the current project for data isolation
 */
export function useProjectContext() {
  const context = useContext(ProjectContext)
  
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider')
  }
  
  return context
}

/**
 * Hook to get current project ref with validation
 * Throws error if no project context is available
 */
export function useRequiredProjectRef() {
  const { projectRef } = useProjectContext()
  
  if (!projectRef) {
    throw new Error('Project reference is required but not available in current context')
  }
  
  return projectRef
}