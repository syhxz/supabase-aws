import { useQuery } from '@tanstack/react-query'
import { PoolingServiceDetector, type PoolingServiceDetectionResult } from 'lib/api/self-hosted/pooling-service-detector'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { databaseKeys } from './keys'

export type PoolingServiceDetectionVariables = {
  projectRef?: string
}

export type PoolingServiceDetectionData = PoolingServiceDetectionResult
export type PoolingServiceDetectionError = ResponseError

/**
 * Gets pooling service detection results
 */
export async function getPoolingServiceDetection(
  { projectRef }: PoolingServiceDetectionVariables,
  signal?: AbortSignal
): Promise<PoolingServiceDetectionResult> {
  if (!projectRef) throw new Error('projectRef is required')

  return await PoolingServiceDetector.detectServices(projectRef)
}

/**
 * Hook for pooling service detection that automatically detects available
 * pooling services and their capabilities
 */
export const usePoolingServiceDetectionQuery = <TData = PoolingServiceDetectionData>(
  { projectRef }: PoolingServiceDetectionVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<PoolingServiceDetectionData, PoolingServiceDetectionError, TData> = {}
) =>
  useQuery<PoolingServiceDetectionData, PoolingServiceDetectionError, TData>({
    queryKey: databaseKeys.poolingServiceDetection(projectRef),
    queryFn: ({ signal }) => getPoolingServiceDetection({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: (failureCount, error) => {
      // Don't retry too aggressively for detection failures
      return failureCount < 1
    },
    ...options,
  })