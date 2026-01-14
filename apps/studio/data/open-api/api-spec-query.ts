import { useQuery } from '@tanstack/react-query'

import { handleError } from 'data/fetchers'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { openApiKeys } from './keys'

export type OpenAPISpecVariables = {
  projectRef?: string
}

export type OpenAPISpecResponse = {
  data: any
  tables: any[]
  functions: any[]
}

export async function getOpenAPISpec({ projectRef }: OpenAPISpecVariables, signal?: AbortSignal) {
  if (!projectRef) throw new Error('projectRef is required')

  // In self-hosted mode, use the custom OpenAPI schema generator endpoint
  // This bypasses PostgREST's db-root-spec feature which has issues
  try {
    const response = await fetch(`/api/openapi-schema`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal,
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI schema: ${response.status} ${response.statusText}`)
    }
    
    const result = await response.json()
    return result
  } catch (error) {
    handleError(error)
    throw error
  }
}

export type OpenAPISpecData = Awaited<OpenAPISpecResponse>
export type OpenAPISpecError = ResponseError

export const useOpenAPISpecQuery = <TData = OpenAPISpecData>(
  { projectRef }: OpenAPISpecVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<OpenAPISpecData, OpenAPISpecError, TData> = {}
) =>
  useQuery<OpenAPISpecData, OpenAPISpecError, TData>({
    queryKey: openApiKeys.apiSpec(projectRef),
    queryFn: ({ signal }) => getOpenAPISpec({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined',
    ...options,
  })
