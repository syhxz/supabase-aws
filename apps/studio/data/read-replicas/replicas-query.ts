import { useQuery } from '@tanstack/react-query'

import type { components } from 'data/api'
import { get, handleError } from 'data/fetchers'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { replicaKeys } from './keys'
import { 
  createDatabaseTypeIdentifier, 
  getDatabaseTypeLabel,
  type DatabaseConnectionInfo 
} from 'lib/database-type-identifier'

export const MAX_REPLICAS_BELOW_XL = 2
export const MAX_REPLICAS_ABOVE_XL = 5

export type ReadReplicasVariables = {
  projectRef?: string
}

export type Database = components['schemas']['DatabaseDetailResponse']

export async function getReadReplicas({ projectRef }: ReadReplicasVariables, signal?: AbortSignal) {
  if (!projectRef) throw new Error('Project ref is required')

  const { data, error } = await get(`/platform/projects/{ref}/databases`, {
    params: { path: { ref: projectRef } },
    signal,
  })

  if (error) handleError(error)
  return data
}

export type ReadReplicasData = Awaited<ReturnType<typeof getReadReplicas>>
export type ReadReplicasError = ResponseError

export const useReadReplicasQuery = <TData = ReadReplicasData>(
  { projectRef }: ReadReplicasVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<ReadReplicasData, ReadReplicasError, TData> = {}
) => {
  return useQuery<ReadReplicasData, ReadReplicasError, TData>({
    queryKey: replicaKeys.list(projectRef),
    queryFn: ({ signal }) => getReadReplicas({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined',
    ...options,
  })
}

export const usePrimaryDatabase = ({ projectRef }: { projectRef?: string }) => {
  const {
    data: databases = [],
    error,
    isLoading,
    isError,
    isSuccess,
  } = useReadReplicasQuery({ projectRef })
  
  // Enhanced primary database identification
  const identifier = createDatabaseTypeIdentifier(databases)
  const primaryDatabase = databases.find((db) => 
    identifier.isPrimaryDatabase(projectRef || '', db.identifier || '')
  )
  
  return { database: primaryDatabase, error, isLoading, isError, isSuccess }
}

/**
 * Hook to get database type information for a specific database
 */
export const useDatabaseType = ({ 
  projectRef, 
  databaseId 
}: { 
  projectRef?: string
  databaseId?: string 
}) => {
  const { data: databases = [], isLoading } = useReadReplicasQuery({ projectRef })
  
  if (!projectRef || !databaseId || isLoading) {
    return {
      type: 'primary' as const,
      label: 'Primary Database',
      isPrimary: true,
      connectionInfo: null,
      isLoading
    }
  }
  
  const identifier = createDatabaseTypeIdentifier(databases)
  const type = identifier.identifyDatabaseType(projectRef, databaseId)
  const label = getDatabaseTypeLabel(projectRef, databaseId, databases)
  const isPrimary = type === 'primary'
  const connectionInfo = identifier.getDatabaseConnectionInfo(projectRef, databaseId)
  
  return {
    type,
    label,
    isPrimary,
    connectionInfo,
    isLoading: false
  }
}

/**
 * Hook to get all databases with their type information
 */
export const useDatabasesWithTypes = ({ projectRef }: { projectRef?: string }) => {
  const { data: databases = [], error, isLoading, isError, isSuccess } = useReadReplicasQuery({ projectRef })
  
  const databasesWithTypes = databases.map((database) => {
    const identifier = createDatabaseTypeIdentifier(databases)
    const type = identifier.identifyDatabaseType(projectRef || '', database.identifier || '')
    const label = getDatabaseTypeLabel(projectRef || '', database.identifier || '', databases)
    const connectionInfo = identifier.getDatabaseConnectionInfo(projectRef || '', database.identifier || '')
    
    return {
      ...database,
      type,
      label,
      isPrimary: type === 'primary',
      connectionInfo
    }
  })
  
  return {
    databases: databasesWithTypes,
    error,
    isLoading,
    isError,
    isSuccess
  }
}
