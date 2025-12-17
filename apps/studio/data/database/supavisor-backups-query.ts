import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { databaseKeys } from './keys'
import { getSupavisorBackups, type ConfigurationBackupInfo } from './supavisor-config-management-mutations'
import type { ResponseError } from 'types'

export type SupavisorBackupsData = ConfigurationBackupInfo[]
export type SupavisorBackupsError = ResponseError

export const useSupavisorBackupsQuery = <TData = SupavisorBackupsData>(
  projectRef: string | undefined,
  {
    enabled = true,
    ...options
  }: UseQueryOptions<SupavisorBackupsData, SupavisorBackupsError, TData> = {}
) =>
  useQuery<SupavisorBackupsData, SupavisorBackupsError, TData>({
    queryKey: databaseKeys.supavisorBackups(projectRef),
    queryFn: () => {
      if (!projectRef) throw new Error('Project ref is required')
      return getSupavisorBackups(projectRef)
    },
    enabled: enabled && typeof projectRef !== 'undefined',
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  })