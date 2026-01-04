import { useQuery } from '@tanstack/react-query'
import { useParams } from 'common'
import { useProjectContext } from '../../components/contexts/ProjectContext'

export interface MonitoringData {
  id: number
  project_id: number
  metric_name: string
  metric_value: number
  metadata?: Record<string, any>
  timestamp: Date
  created_at: Date
}

export interface MonitoringDataFilters {
  limit?: number
  offset?: number
  search?: string
  startDate?: Date
  endDate?: Date
}

/**
 * Hook to fetch monitoring data for the current project with automatic project isolation
 * Requirements: 2.1, 2.2
 */
export function useMonitoringData(filters?: MonitoringDataFilters) {
  const { ref: projectRef } = useParams()
  const { projectRef: contextProjectRef } = useProjectContext()
  
  // Use context project ref if available, fallback to params
  const isolatedProjectRef = contextProjectRef || projectRef

  return useQuery({
    queryKey: ['projects', isolatedProjectRef, 'monitoring', filters],
    queryFn: async ({ signal }) => {
      if (!isolatedProjectRef) {
        throw new Error('Project reference is required')
      }

      const queryParams = new URLSearchParams()
      
      if (filters?.limit) queryParams.set('limit', filters.limit.toString())
      if (filters?.offset) queryParams.set('offset', filters.offset.toString())
      if (filters?.search) queryParams.set('search', filters.search)
      if (filters?.startDate) queryParams.set('startDate', filters.startDate.toISOString())
      if (filters?.endDate) queryParams.set('endDate', filters.endDate.toISOString())

      const url = `/api/platform/projects/${isolatedProjectRef}/monitoring?${queryParams.toString()}`
      const response = await fetch(url, { signal })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch monitoring data')
      }

      return response.json() as Promise<{ data: MonitoringData[], meta: any }>
    },
    enabled: !!isolatedProjectRef,
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to create new monitoring data for the current project
 * Requirements: 2.1, 2.2
 */
export function useCreateMonitoringData() {
  const { ref: projectRef } = useParams()
  const { projectRef: contextProjectRef } = useProjectContext()
  
  // Use context project ref if available, fallback to params
  const isolatedProjectRef = contextProjectRef || projectRef

  return async (data: Omit<MonitoringData, 'id' | 'project_id' | 'created_at'>) => {
    if (!isolatedProjectRef) {
      throw new Error('Project reference is required')
    }

    const response = await fetch(`/api/platform/projects/${isolatedProjectRef}/monitoring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create monitoring data')
    }

    return response.json()
  }
}