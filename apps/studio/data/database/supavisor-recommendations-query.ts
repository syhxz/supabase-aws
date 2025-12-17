import { useQuery } from '@tanstack/react-query'

import { handleError } from 'data/fetchers'
import { IS_PLATFORM } from 'lib/constants'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { databaseKeys } from './keys'

export type SupavisorRecommendationsVariables = {
  projectRef?: string
  computeSize?: string
}

export async function getSupavisorRecommendations(
  { projectRef, computeSize }: SupavisorRecommendationsVariables,
  signal?: AbortSignal
) {
  if (!projectRef) throw new Error('projectRef is required')
  if (!computeSize) throw new Error('computeSize is required')

  const response = await fetch(
    `/api/platform/projects/${projectRef}/supavisor-recommendations?computeSize=${encodeURIComponent(computeSize)}`, 
    {
      method: 'GET',
      signal,
    }
  )

  if (!response.ok) {
    const error = await response.json()
    handleError(error)
  }

  const result = await response.json()
  return result.data
}

export type SupavisorRecommendationsData = Awaited<ReturnType<typeof getSupavisorRecommendations>>
export type SupavisorRecommendationsError = ResponseError

export const useSupavisorRecommendationsQuery = <TData = SupavisorRecommendationsData>(
  { projectRef, computeSize }: SupavisorRecommendationsVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<SupavisorRecommendationsData, SupavisorRecommendationsError, TData> = {}
) =>
  useQuery<SupavisorRecommendationsData, SupavisorRecommendationsError, TData>({
    queryKey: [...databaseKeys.supavisorConfig(projectRef), 'recommendations', computeSize],
    queryFn: ({ signal }) => getSupavisorRecommendations({ projectRef, computeSize }, signal),
    enabled: enabled && typeof projectRef !== 'undefined' && typeof computeSize !== 'undefined' && !IS_PLATFORM,
    staleTime: 5 * 60 * 1000, // Recommendations are stable for 5 minutes
    cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    ...options,
  })