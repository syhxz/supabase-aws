import { useQuery } from '@tanstack/react-query'

import { get, handleError } from 'data/fetchers'
import { IS_PLATFORM } from 'lib/constants'
import { validateArray, isArray, ValidationResult } from 'lib/array-validation'
import { 
  validateProjectAddonsCompatibility, 
  logCompatibilityValidation,
  ModernProjectAddonsData 
} from 'lib/backward-compatibility-validation'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { subscriptionKeys } from './keys'

export type ProjectAddonsVariables = {
  projectRef?: string
}

// [Joshen] For any customer facing text - let's use "Add-on" hyphenated
// Will need to address consistency across the dashboard

/**
 * Validates and normalizes project addons data structure with backward compatibility
 * Ensures selected_addons is always an array to prevent array method errors
 * Handles both old and new data formats through migration logic
 */
function validateProjectAddonsData(data: any): ProjectAddonsData {
  // Use backward compatibility validation to handle various data formats
  const compatibilityResult = validateProjectAddonsCompatibility(data)
  
  // Log the validation result for debugging
  logCompatibilityValidation(compatibilityResult, 'Project Addons API Response')
  
  if (!compatibilityResult.isValid) {
    console.error('[Project Addons] Backward compatibility validation failed:', compatibilityResult.error)
    return {
      selected_addons: [],
      available_addons: [],
      ref: ''
    }
  }

  // If migration occurred, log the details
  if (compatibilityResult.migrated) {
    console.log('[Project Addons] Data migrated successfully:', {
      originalFormat: compatibilityResult.originalFormat,
      newFormat: 'modern',
      selectedAddonsCount: compatibilityResult.data.selected_addons.length
    })
  }

  return compatibilityResult.data
}

export async function getProjectAddons(
  { projectRef }: ProjectAddonsVariables,
  signal?: AbortSignal
) {
  if (!projectRef) throw new Error('projectRef is required')

  try {
    const { error, data } = await get(`/platform/projects/{ref}/billing/addons`, {
      params: { path: { ref: projectRef } },
      signal,
    })

    if (error) {
      console.error('[Project Addons] API error:', error)
      handleError(error)
    }

    // Validate and normalize the response data
    const validatedData = validateProjectAddonsData(data)
    
    return validatedData
  } catch (error) {
    console.error('[Project Addons] Failed to fetch project addons:', error)
    
    // For network errors or malformed responses, return a safe fallback
    if (error instanceof TypeError || error instanceof SyntaxError) {
      console.warn('[Project Addons] Returning fallback data due to malformed response')
      return {
        selected_addons: [],
        available_addons: [],
        ref: projectRef
      }
    }
    
    // Re-throw other errors (like authentication errors)
    throw error
  }
}

export type ProjectAddonsData = ModernProjectAddonsData
export type ProjectAddonsError = ResponseError

export const useProjectAddonsQuery = <TData = ProjectAddonsData>(
  { projectRef }: ProjectAddonsVariables,
  {
    enabled = true,
    retry = 3,
    retryDelay = (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options
  }: UseCustomQueryOptions<ProjectAddonsData, ProjectAddonsError, TData> = {}
) =>
  useQuery<ProjectAddonsData, ProjectAddonsError, TData>({
    queryKey: subscriptionKeys.addons(projectRef),
    queryFn: ({ signal }) => getProjectAddons({ projectRef }, signal),
    enabled: enabled && IS_PLATFORM && typeof projectRef !== 'undefined',
    staleTime: 60 * 60 * 1000,
    retry: (failureCount, error) => {
      // Don't retry on authentication errors or client errors (4xx)
      if (error && 'status' in error) {
        const status = (error as any).status
        if (status >= 400 && status < 500) {
          console.warn('[Project Addons] Not retrying client error:', status)
          return false
        }
      }
      
      // Retry on network errors and server errors (5xx)
      return failureCount < retry
    },
    retryDelay,
    onError: (error) => {
      console.error('[Project Addons] Query failed:', error)
      
      // Log additional context for debugging
      if (error && 'status' in error) {
        console.error('[Project Addons] HTTP Status:', (error as any).status)
      }
      
      if (error && 'message' in error) {
        console.error('[Project Addons] Error Message:', (error as any).message)
      }
    },
    ...options,
  })
