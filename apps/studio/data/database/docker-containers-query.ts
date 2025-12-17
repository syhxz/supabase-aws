import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { handleError } from 'data/fetchers'
import { IS_PLATFORM } from 'lib/constants'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import type { ContainerStatus, HealthCheckResult } from 'lib/api/self-hosted/docker-container-service'
import { databaseKeys } from './keys'
import { PoolingCacheInvalidation } from './pooling-cache-invalidation'

export type DockerContainersVariables = {
  projectRef?: string
  container?: string
  action?: 'logs' | 'health'
  lines?: number
}

export async function getDockerContainers(
  { projectRef, container, action, lines }: DockerContainersVariables,
  signal?: AbortSignal
) {
  if (!projectRef) throw new Error('projectRef is required')

  let url = `/api/platform/projects/${projectRef}/docker-containers`
  const params = new URLSearchParams()
  
  if (container) params.append('container', container)
  if (action) params.append('action', action)
  if (lines) params.append('lines', lines.toString())
  
  if (params.toString()) {
    url += `?${params.toString()}`
  }

  const response = await fetch(url, {
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

export type DockerContainersData = Awaited<ReturnType<typeof getDockerContainers>>
export type DockerContainersError = ResponseError

export const useDockerContainersQuery = <TData = DockerContainersData>(
  { projectRef, container, action, lines }: DockerContainersVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<DockerContainersData, DockerContainersError, TData> = {}
) =>
  useQuery<DockerContainersData, DockerContainersError, TData>({
    queryKey: databaseKeys.dockerContainers(projectRef, container, action),
    queryFn: ({ signal }) => getDockerContainers({ projectRef, container, action, lines }, signal),
    enabled: enabled && typeof projectRef !== 'undefined' && !IS_PLATFORM,
    refetchInterval: action === 'health' ? 30000 : false, // Auto-refresh health checks
    ...options,
  })

// Container action mutation
export type ContainerActionVariables = {
  projectRef: string
  container: string
  action: 'start' | 'stop' | 'restart'
}

export async function performContainerAction({
  projectRef,
  container,
  action,
}: ContainerActionVariables) {
  const response = await fetch(`/api/platform/projects/${projectRef}/docker-containers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ container, action }),
  })

  if (!response.ok) {
    const error = await response.json()
    handleError(error)
  }

  const result = await response.json()
  return result.data
}

export type ContainerActionData = Awaited<ReturnType<typeof performContainerAction>>
export type ContainerActionError = ResponseError

export const useContainerActionMutation = ({
  onSuccess,
  onError,
  ...options
}: any = {}) => {
  const queryClient = useQueryClient()

  return useMutation<ContainerActionData, ContainerActionError, ContainerActionVariables>({
    mutationFn: performContainerAction,
    async onSuccess(data, variables) {
      const { projectRef, container } = variables
      
      // Use centralized cache invalidation for container status updates
      await PoolingCacheInvalidation.invalidateContainerStatus(queryClient, projectRef, container)

      await onSuccess?.(data, variables)
    },
    async onError(data, variables, context) {
      await onError?.(data, variables, context)
    },
    ...options,
  })
}

// Specific hooks for common use cases
export const useSupavisorContainerQuery = (
  projectRef?: string,
  options?: UseCustomQueryOptions<ContainerStatus, DockerContainersError>
) =>
  useDockerContainersQuery(
    { projectRef, container: 'supavisor' },
    {
      enabled: !!projectRef && !IS_PLATFORM,
      select: (data) => data as ContainerStatus,
      ...options,
    }
  )

export const useContainerHealthQuery = (
  projectRef?: string,
  container?: string,
  options?: UseCustomQueryOptions<{ container: string; health: HealthCheckResult }, DockerContainersError>
) =>
  useDockerContainersQuery(
    { projectRef, container, action: 'health' },
    {
      enabled: !!projectRef && !!container && !IS_PLATFORM,
      select: (data) => data as { container: string; health: HealthCheckResult },
      ...options,
    }
  )

export const useContainerLogsQuery = (
  projectRef?: string,
  container?: string,
  lines: number = 100,
  options?: UseCustomQueryOptions<{ container: string; logs: string[] }, DockerContainersError>
) =>
  useDockerContainersQuery(
    { projectRef, container, action: 'logs', lines },
    {
      enabled: !!projectRef && !!container && !IS_PLATFORM,
      select: (data) => data as { container: string; logs: string[] },
      refetchInterval: false, // Don't auto-refresh logs
      ...options,
    }
  )