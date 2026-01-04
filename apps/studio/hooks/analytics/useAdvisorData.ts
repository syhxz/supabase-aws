import { useQuery } from '@tanstack/react-query'
import { useParams } from 'common'

export interface AdvisorData {
  id: number
  project_id: number
  advisor_type: string
  recommendation: string
  severity: 'info' | 'warning' | 'critical'
  metadata?: Record<string, any>
  created_at: Date
  resolved_at?: Date
}

export interface AdvisorDataFilters {
  limit?: number
  offset?: number
  search?: string
  startDate?: Date
  endDate?: Date
  severity?: 'info' | 'warning' | 'critical'
  advisor_type?: string
}

/**
 * Hook to fetch advisor data for the current project with automatic project isolation
 * Requirements: 2.3, 2.4
 */
export function useAdvisorData(filters?: AdvisorDataFilters) {
  const { ref: projectRef } = useParams()

  return useQuery({
    queryKey: ['projects', projectRef, 'advisor', filters],
    queryFn: async ({ signal }) => {
      if (!projectRef) {
        throw new Error('Project reference is required')
      }

      const queryParams = new URLSearchParams()
      
      if (filters?.limit) queryParams.set('limit', filters.limit.toString())
      if (filters?.offset) queryParams.set('offset', filters.offset.toString())
      if (filters?.search) queryParams.set('search', filters.search)
      if (filters?.startDate) queryParams.set('startDate', filters.startDate.toISOString())
      if (filters?.endDate) queryParams.set('endDate', filters.endDate.toISOString())
      if (filters?.severity) queryParams.set('severity', filters.severity)
      if (filters?.advisor_type) queryParams.set('advisor_type', filters.advisor_type)

      const url = `/api/platform/projects/${projectRef}/advisor?${queryParams.toString()}`
      const response = await fetch(url, { signal })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch advisor data')
      }

      return response.json() as Promise<{ data: AdvisorData[], meta: any }>
    },
    enabled: !!projectRef,
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to create new advisor data for the current project
 * Requirements: 2.3, 2.4
 */
export function useCreateAdvisorData() {
  const { ref: projectRef } = useParams()

  return async (data: Omit<AdvisorData, 'id' | 'project_id' | 'created_at'>) => {
    if (!projectRef) {
      throw new Error('Project reference is required')
    }

    const response = await fetch(`/api/platform/projects/${projectRef}/advisor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create advisor data')
    }

    return response.json()
  }
}

/**
 * Hook to resolve advisor recommendations
 * Requirements: 2.3, 2.4
 */
export function useResolveAdvisorData() {
  const { ref: projectRef } = useParams()

  return async (id: number, resolved_at?: Date) => {
    if (!projectRef) {
      throw new Error('Project reference is required')
    }

    const response = await fetch(`/api/platform/projects/${projectRef}/advisor`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        id, 
        resolved_at: resolved_at || new Date() 
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to resolve advisor data')
    }

    return response.json()
  }
}