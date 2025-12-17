import { useQuery } from '@tanstack/react-query'

import { handleError } from 'data/fetchers'
import { IS_PLATFORM } from 'lib/constants'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { databaseKeys } from './keys'

export type SupavisorStatsVariables = {
  projectRef?: string
}

export async function getSupavisorStats(
  { projectRef }: SupavisorStatsVariables,
  signal?: AbortSignal
) {
  if (!projectRef) throw new Error('projectRef is required')

  const response = await fetch(`/api/platform/projects/${projectRef}/supavisor-stats`, {
    method: 'GET',
    signal,
  })

  if (!response.ok) {
    const error = await response.json()
    handleError(error)
  }

  const result = await response.json()
  return result.data
}

export type SupavisorStatsData = Awaited<ReturnType<typeof getSupavisorStats>>
export type SupavisorStatsError = ResponseError

export const useSupavisorStatsQuery = <TData = SupavisorStatsData>(
  { projectRef }: SupavisorStatsVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<SupavisorStatsData, SupavisorStatsError, TData> = {}
) =>
  useQuery<SupavisorStatsData, SupavisorStatsError, TData>({
    queryKey: databaseKeys.supavisorStats(projectRef),
    queryFn: ({ signal }) => getSupavisorStats({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined' && !IS_PLATFORM,
    refetchInterval: 30000, // Refresh stats every 30 seconds
    ...options,
  })