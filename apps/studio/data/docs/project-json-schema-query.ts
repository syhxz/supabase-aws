import { useQuery } from '@tanstack/react-query'

import { handleError } from 'data/fetchers'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { docsKeys } from './keys'

export type ProjectJsonSchemaVariables = {
  projectRef?: string
}

type ProjectJsonSchemaMethod = {
  tags: string[]
  summary: string
  responses: {
    [key: string]: any
  }
  parameters: { [key: string]: string }[]
}

export type ProjectJsonSchemaDefinitions = {
  [key: string]: {
    type: string
    description: string
    required: string[]
    properties: {
      [key: string]: {
        type: string
        format: string
        description?: string
        enum?: string[]
      }
    }
  }
}

export type ProjectJsonSchemaPaths = {
  [key: string]: {
    get?: ProjectJsonSchemaMethod
    post?: ProjectJsonSchemaMethod
    patch?: ProjectJsonSchemaMethod
    delete?: ProjectJsonSchemaMethod
  }
}

export type ProjectJsonSchemaResponse = {
  basePath: string
  consumes: string[]
  definitions: ProjectJsonSchemaDefinitions
  externalDocs: { description: string; url: string }
  host: string
  info: {
    title: string
    description: string
    version: string
  }
  parameters: {
    [key: string]: {
      default?: string
      description: string
      in: string
      name: string
      required: boolean
      type?: string
      schema?: { [key: string]: string }
    }
  }
  paths: ProjectJsonSchemaPaths
  produces: string[]
  schemes: string[]
  swagger: string
}

export async function getProjectJsonSchema(
  { projectRef }: ProjectJsonSchemaVariables,
  signal?: AbortSignal
) {
  if (!projectRef) throw new Error('projectRef is required')

  // In self-hosted mode, use the custom OpenAPI schema generator endpoint
  // This bypasses PostgREST's db-root-spec feature which has issues in self-hosted environments
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
    
    // The custom endpoint returns { data: openApiSchema, tables: [], functions: [] }
    // We need to return just the OpenAPI schema data
    return result.data as unknown as ProjectJsonSchemaResponse
  } catch (error) {
    handleError(error)
    throw error
  }
}

export type ProjectJsonSchemaData = Awaited<ReturnType<typeof getProjectJsonSchema>>
export type ProjectJsonSchemaError = ResponseError

export const useProjectJsonSchemaQuery = <TData = ProjectJsonSchemaData>(
  { projectRef }: ProjectJsonSchemaVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<ProjectJsonSchemaData, ProjectJsonSchemaError, TData> = {}
) =>
  useQuery<ProjectJsonSchemaData, ProjectJsonSchemaError, TData>({
    queryKey: docsKeys.jsonSchema(projectRef),
    queryFn: ({ signal }) => getProjectJsonSchema({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined',
    ...options,
  })
