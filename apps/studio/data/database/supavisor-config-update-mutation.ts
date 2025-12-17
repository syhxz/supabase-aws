import { useMutation, useQueryClient } from '@tanstack/react-query'

import { handleError } from 'data/fetchers'
import type { ResponseError } from 'types'
import { databaseKeys } from './keys'
import { PoolingCacheInvalidation } from './pooling-cache-invalidation'

export type SupavisorConfigUpdateVariables = {
  ref: string
  poolSize?: number
  maxClientConnections?: number
  poolMode?: 'session' | 'transaction' | 'statement'
}

export async function updateSupavisorConfig({
  ref,
  ...updates
}: SupavisorConfigUpdateVariables) {
  const response = await fetch(`/api/platform/projects/${ref}/supavisor-config`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.json()
    handleError(error)
  }

  const result = await response.json()
  return result.data
}

export type SupavisorConfigUpdateData = Awaited<ReturnType<typeof updateSupavisorConfig>>
export type SupavisorConfigUpdateError = ResponseError

export const useSupavisorConfigurationUpdateMutation = ({
  onSuccess,
  onError,
  ...options
}: any = {}) => {
  const queryClient = useQueryClient()

  return useMutation<
    SupavisorConfigUpdateData,
    SupavisorConfigUpdateError,
    SupavisorConfigUpdateVariables
  >({
    mutationFn: updateSupavisorConfig,
    async onSuccess(data, variables, context) {
      const { ref } = variables

      // Use centralized cache invalidation for Supavisor configuration updates
      await PoolingCacheInvalidation.invalidateConfiguration(queryClient, ref, 'supavisor')

      await onSuccess?.(data, variables, context)
    },
    async onError(data, variables, context) {
      if (onError === undefined) {
        console.error(`Failed to update Supavisor configuration: ${data.message}`)
      } else {
        onError(data, variables, context)
      }
    },
    ...options,
  })
}