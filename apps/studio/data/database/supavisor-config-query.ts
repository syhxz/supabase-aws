import { useQuery } from '@tanstack/react-query'

import { handleError } from 'data/fetchers'
import { IS_PLATFORM } from 'lib/constants'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { databaseKeys } from './keys'

export type SupavisorConfigVariables = {
  projectRef?: string
}

export async function getSupavisorConfig(
  { projectRef }: SupavisorConfigVariables,
  signal?: AbortSignal
) {
  if (!projectRef) throw new Error('projectRef is required')

  const response = await fetch(`/api/platform/projects/${projectRef}/supavisor-config`, {
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

export type SupavisorConfigData = Awaited<ReturnType<typeof getSupavisorConfig>>
export type SupavisorConfigError = ResponseError

export const useSupavisorConfigQuery = <TData = SupavisorConfigData>(
  { projectRef }: SupavisorConfigVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<SupavisorConfigData, SupavisorConfigError, TData> = {}
) =>
  useQuery<SupavisorConfigData, SupavisorConfigError, TData>({
    queryKey: databaseKeys.supavisorConfig(projectRef),
    queryFn: ({ signal }) => getSupavisorConfig({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined' && !IS_PLATFORM,
    ...options,
  })