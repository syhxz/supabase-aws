import { useMutation, useQueryClient } from '@tanstack/react-query'
import { handleError } from 'data/fetchers'
import type { ResponseError } from 'types'
import { databaseKeys } from './keys'
import { PoolingCacheInvalidation } from './pooling-cache-invalidation'

export interface ConfigurationBackupInfo {
  timestamp: number
  date: string
  backupPath?: string
  hasEnvFile: boolean
  configPreview: {
    poolSize: number
    maxClientConnections: number
    tenantId: string
    port: number
  }
}

export interface RollbackVariables {
  ref: string
  timestamp: number
}

export interface CleanupVariables {
  ref: string
  keepCount?: number
}

export async function rollbackSupavisorConfig({
  ref,
  timestamp
}: RollbackVariables) {
  const response = await fetch(`/api/platform/projects/${ref}/supavisor-config-management`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'rollback',
      timestamp
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    handleError(error)
  }

  const result = await response.json()
  return result.data
}

export async function cleanupSupavisorBackups({
  ref,
  keepCount = 10
}: CleanupVariables) {
  const response = await fetch(`/api/platform/projects/${ref}/supavisor-config-management`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'cleanup',
      keepCount
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    handleError(error)
  }

  const result = await response.json()
  return result.data
}

export async function getSupavisorBackups(ref: string): Promise<ConfigurationBackupInfo[]> {
  const response = await fetch(`/api/platform/projects/${ref}/supavisor-config-management?action=backups`, {
    method: 'GET',
  })

  if (!response.ok) {
    const error = await response.json()
    handleError(error)
  }

  const result = await response.json()
  return result.data
}

export type RollbackData = Awaited<ReturnType<typeof rollbackSupavisorConfig>>
export type RollbackError = ResponseError

export type CleanupData = Awaited<ReturnType<typeof cleanupSupavisorBackups>>
export type CleanupError = ResponseError

export const useSupavisorConfigRollbackMutation = ({
  onSuccess,
  onError,
  ...options
}: any = {}) => {
  const queryClient = useQueryClient()

  return useMutation<RollbackData, RollbackError, RollbackVariables>({
    mutationFn: rollbackSupavisorConfig,
    async onSuccess(data, variables, context) {
      const { ref } = variables

      // Invalidate all Supavisor-related queries after rollback
      await PoolingCacheInvalidation.invalidateConfiguration(queryClient, ref, 'supavisor')
      await PoolingCacheInvalidation.invalidateStatistics(queryClient, ref, 'supavisor')
      await PoolingCacheInvalidation.invalidateHealth(queryClient, ref, 'supavisor')

      // Also invalidate backup list
      queryClient.invalidateQueries({
        queryKey: databaseKeys.supavisorBackups(ref)
      })

      await onSuccess?.(data, variables, context)
    },
    async onError(data, variables, context) {
      if (onError === undefined) {
        console.error(`Failed to rollback Supavisor configuration: ${data.message}`)
      } else {
        onError(data, variables, context)
      }
    },
    ...options,
  })
}

export const useSupavisorBackupCleanupMutation = ({
  onSuccess,
  onError,
  ...options
}: any = {}) => {
  const queryClient = useQueryClient()

  return useMutation<CleanupData, CleanupError, CleanupVariables>({
    mutationFn: cleanupSupavisorBackups,
    async onSuccess(data, variables, context) {
      const { ref } = variables

      // Invalidate backup list after cleanup
      queryClient.invalidateQueries({
        queryKey: databaseKeys.supavisorBackups(ref)
      })

      await onSuccess?.(data, variables, context)
    },
    async onError(data, variables, context) {
      if (onError === undefined) {
        console.error(`Failed to cleanup Supavisor backups: ${data.message}`)
      } else {
        onError(data, variables, context)
      }
    },
    ...options,
  })
}