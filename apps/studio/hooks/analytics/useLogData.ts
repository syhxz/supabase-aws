import { useQuery } from '@tanstack/react-query'
import { useParams } from 'common'

export interface LogData {
  id: number
  project_id: number
  log_level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  metadata?: Record<string, any>
  timestamp: Date
}

export interface LogDataFilters {
  limit?: number
  offset?: number
  search?: string
  startDate?: Date
  endDate?: Date
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
}

/**
 * Hook to fetch log data for the current project with automatic project isolation
 * Requirements: 2.5, 2.6
 */
export function useLogData(filters?: LogDataFilters) {
  const { ref: projectRef } = useParams()

  return useQuery({
    queryKey: ['projects', projectRef, 'logs', filters],
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
      if (filters?.logLevel) queryParams.set('logLevel', filters.logLevel)

      const url = `/api/platform/projects/${projectRef}/logs?${queryParams.toString()}`
      const response = await fetch(url, { signal })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch log data')
      }

      return response.json() as Promise<{ data: LogData[], meta: any }>
    },
    enabled: !!projectRef,
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to create new log data for the current project
 * Requirements: 2.5, 2.6
 */
export function useCreateLogData() {
  const { ref: projectRef } = useParams()

  return async (data: Omit<LogData, 'id' | 'project_id'>) => {
    if (!projectRef) {
      throw new Error('Project reference is required')
    }

    const response = await fetch(`/api/platform/projects/${projectRef}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create log data')
    }

    return response.json()
  }
}