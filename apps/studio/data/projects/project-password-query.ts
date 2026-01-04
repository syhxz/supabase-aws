import { useQuery } from '@tanstack/react-query'
import { get, handleError } from 'data/fetchers'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { projectKeys } from './keys'

type ProjectPasswordVariables = { ref?: string }

export interface ProjectPasswordResponse {
  password: string | null
}

export async function getProjectPassword(
  { ref }: ProjectPasswordVariables,
  signal?: AbortSignal
) {
  if (!ref) throw new Error('Project ref is required')

  const { data, error } = await get('/platform/projects/{ref}/password', {
    params: { path: { ref } },
    signal,
  })

  if (error) handleError(error)
  return data as ProjectPasswordResponse
}

export type ProjectPasswordData = Awaited<ReturnType<typeof getProjectPassword>>
export type ProjectPasswordError = ResponseError

export const useProjectPasswordQuery = <TData = ProjectPasswordData>(
  { ref }: ProjectPasswordVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<ProjectPasswordData, ProjectPasswordError, TData> = {}
) =>
  useQuery<ProjectPasswordData, ProjectPasswordError, TData>({
    queryKey: [...projectKeys.detail(ref), 'password'],
    queryFn: ({ signal }) => getProjectPassword({ ref }, signal),
    enabled: enabled && typeof ref !== 'undefined',
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  })