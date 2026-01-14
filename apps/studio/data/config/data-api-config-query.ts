import { useQuery } from '@tanstack/react-query'

import { get, handleError } from 'data/fetchers'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { configKeys } from './keys'

export type DataApiConfigVariables = {
  projectRef?: string
}

export interface DataApiConfigResponse {
  projectUrl: string
  enableDataApi: boolean
  exposedSchemas: string[]
  extraSearchPath: string[]
  maxRows: number
  poolSize: number | null
  lastUpdated: string
}

export async function getDataApiConfig(
  { projectRef }: DataApiConfigVariables,
  signal?: AbortSignal
) {
  if (!projectRef) throw new Error('projectRef is required')

  const { data, error } = await get('/v1/projects/{ref}/config/data-api', {
    params: { path: { ref: projectRef } },
    signal,
  })
  if (error) handleError(error)
  return data as DataApiConfigResponse
}

export type DataApiConfigData = Awaited<ReturnType<typeof getDataApiConfig>>
export type DataApiConfigError = ResponseError

export const useDataApiConfigQuery = <TData = DataApiConfigData>(
  { projectRef }: DataApiConfigVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<DataApiConfigData, DataApiConfigError, TData> = {}
) =>
  useQuery<DataApiConfigData, DataApiConfigError, TData>({
    queryKey: configKeys.dataApiConfig(projectRef),
    queryFn: ({ signal }) => getDataApiConfig({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined',
    ...options,
  })