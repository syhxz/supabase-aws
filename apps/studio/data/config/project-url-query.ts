import { useQuery } from '@tanstack/react-query'

import { useProjectSettingsV2Query } from './project-settings-v2-query'
import type { UseCustomQueryOptions } from 'types'
import { configKeys } from './keys'
import { fetchGet } from 'data/fetchers'

export type ProjectUrlVariables = { projectRef?: string }

export interface ProjectUrlData {
  projectUrl: string
  protocol: string
  host: string
  apiVersion: string
}

export async function getProjectUrl({ projectRef }: ProjectUrlVariables): Promise<ProjectUrlData> {
  if (!projectRef) throw new Error('projectRef is required')

  // Use fetchGet to include proper authentication headers
  const response = await fetchGet(`/api/v1/projects/${projectRef}/url`)
  
  if (response instanceof Error) {
    throw response
  }

  return response
}

type ProjectUrlError = Error

export const useProjectUrlQuery = <TData = ProjectUrlData>(
  { projectRef }: ProjectUrlVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<ProjectUrlData, ProjectUrlError, TData> = {}
) => {
  // Fallback to using project settings if the dedicated endpoint is not available
  const { data: settings } = useProjectSettingsV2Query({ projectRef }, { enabled })

  return useQuery<ProjectUrlData, ProjectUrlError, TData>({
    queryKey: configKeys.projectUrl(projectRef),
    queryFn: async () => {
      try {
        return await getProjectUrl({ projectRef })
      } catch (error) {
        // Fallback to constructing URL from settings
        if (settings?.app_config) {
          const protocol = settings.app_config.protocol ?? 'https'
          const endpoint = settings.app_config.endpoint
          
          if (endpoint) {
            const projectUrl = `${protocol}://${endpoint}/rest/v1`
            return {
              projectUrl,
              protocol,
              host: endpoint,
              apiVersion: 'v1'
            }
          }
        }
        throw new Error('Unable to determine project URL')
      }
    },
    enabled: enabled && typeof projectRef !== 'undefined',
    ...options,
  })
}