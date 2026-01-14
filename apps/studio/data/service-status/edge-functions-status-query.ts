import { useQuery } from '@tanstack/react-query'

import type { ResponseError, UseCustomQueryOptions } from 'types'
import { serviceStatusKeys } from './keys'
import { discoverEdgeFunctionsService } from '../../lib/service-discovery'
import { IS_PLATFORM } from '../../lib/constants'

export type EdgeFunctionServiceStatusVariables = {
  projectRef?: string
}

export async function getEdgeFunctionServiceStatus(signal?: AbortSignal) {
  try {
    let healthUrl: string

    if (IS_PLATFORM) {
      // For platform environments, use the hardcoded platform URL
      healthUrl = 'https://obuldanrptloktxcffvn.supabase.co/functions/v1/health-check'
    } else {
      // For self-hosted environments, use service discovery
      const edgeFunctionsService = await discoverEdgeFunctionsService()
      if (!edgeFunctionsService.healthy) {
        return { healthy: false, error: edgeFunctionsService.error }
      }
      healthUrl = `${edgeFunctionsService.url}/health`
    }

    const res = await fetch(healthUrl, {
      method: 'GET',
      signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Supabase-Studio-HealthCheck',
      },
    })

    if (!res.ok) {
      return { healthy: false, error: `HTTP ${res.status}: ${res.statusText}` }
    }

    const response = await res.json()
    return { healthy: true, ...response }
  } catch (err) {
    return { 
      healthy: false, 
      error: err instanceof Error ? err.message : 'Unknown error'
    }
  }
}

export type EdgeFunctionServiceStatusData = Awaited<ReturnType<typeof getEdgeFunctionServiceStatus>>
export type EdgeFunctionServiceStatusError = ResponseError

export const useEdgeFunctionServiceStatusQuery = <TData = EdgeFunctionServiceStatusData>(
  { projectRef }: EdgeFunctionServiceStatusVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<
    EdgeFunctionServiceStatusData,
    EdgeFunctionServiceStatusError,
    TData
  > = {}
) =>
  useQuery<EdgeFunctionServiceStatusData, EdgeFunctionServiceStatusError, TData>({
    queryKey: serviceStatusKeys.edgeFunctions(projectRef),
    queryFn: ({ signal }) => getEdgeFunctionServiceStatus(signal),
    enabled: enabled && typeof projectRef !== 'undefined',
    ...options,
  })
