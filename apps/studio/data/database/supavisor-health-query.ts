import { useQuery } from '@tanstack/react-query'

import { handleError } from 'data/fetchers'
import { IS_PLATFORM } from 'lib/constants'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { databaseKeys } from './keys'

export type SupavisorHealthVariables = {
  projectRef?: string
}

export async function getSupavisorHealth(
  { projectRef }: SupavisorHealthVariables,
  signal?: AbortSignal
) {
  if (!projectRef) throw new Error('projectRef is required')

  const response = await fetch(`/api/platform/projects/${projectRef}/supavisor-health`, {
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

export type SupavisorHealthData = Awaited<ReturnType<typeof getSupavisorHealth>>
export type SupavisorHealthError = ResponseError

export const useSupavisorHealthQuery = <TData = SupavisorHealthData>(
  { projectRef }: SupavisorHealthVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<SupavisorHealthData, SupavisorHealthError, TData> = {}
) =>
  useQuery<SupavisorHealthData, SupavisorHealthError, TData>({
    queryKey: databaseKeys.supavisorHealth(projectRef),
    queryFn: ({ signal }) => getSupavisorHealth({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined' && !IS_PLATFORM,
    refetchInterval: 60000, // Refresh health status every minute
    ...options,
  })