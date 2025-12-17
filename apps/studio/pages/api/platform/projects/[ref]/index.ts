import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'
import { DEFAULT_PROJECT, PROJECT_REST_URL } from 'lib/constants/api'
import { IS_PLATFORM } from 'lib/constants'
import {
  findProjectByRef,
  deleteProject,
  deleteDatabase,
} from 'lib/api/self-hosted'
import { getServiceRouter } from 'lib/service-router'
import { ProjectInitializationService } from 'lib/project-initialization/ProjectInitializationService'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'DELETE':
      return handleDelete(req, res)
    default:
      res.setHeader('Allow', ['GET', 'DELETE'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  // For self-hosted mode, get project from storage
  if (!IS_PLATFORM) {
    const { ref } = req.query
    
    if (typeof ref !== 'string') {
      return res.status(400).json({ 
        error: { message: 'Project ref is required' } 
      })
    }

    // Handle 'default' project like any other project
    // The 'default' project is a regular project with ref='default'
    console.log(`[Project API] Fetching project: ${ref}`)

    // Query specific project by ref
    try {
      const result = await findProjectByRef(ref)

      if (result.error) {
        console.error('Error fetching project:', result.error)
        return res.status(500).json({ 
          error: { message: result.error.message || 'Failed to fetch project' } 
        })
      }

      const project = result.data

      if (!project) {
        return res.status(404).json({ 
          error: { message: `Project not found: ${ref}` } 
        })
      }

      // Transform to match expected format
      const response = {
        id: project.id,
        ref: project.ref,
        name: project.name,
        organization_id: project.organization_id,
        cloud_provider: 'localhost',
        status: project.status,
        region: project.region,
        inserted_at: project.inserted_at,
        connectionString: '',
        restUrl: PROJECT_REST_URL,
        database_name: project.database_name,
        database_user: project.database_user, // Include database user information
        databases: [
          {
            identifier: project.ref,
            infra_compute_size: 'micro',
          },
        ],
      }

      return res.status(200).json(response)
    } catch (error: any) {
      console.error('Error fetching project:', error)
      return res.status(500).json({ 
        error: { message: error.message || 'Failed to fetch project' } 
      })
    }
  }

  // Platform specific endpoint
  const response = {
    ...DEFAULT_PROJECT,
    connectionString: '',
    restUrl: PROJECT_REST_URL,
  }

  return res.status(200).json(response)
}

const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  // For self-hosted mode, delete project from storage
  if (!IS_PLATFORM) {
    const { ref } = req.query
    
    if (typeof ref !== 'string') {
      return res.status(400).json({ 
        error: { message: 'Project ref is required' } 
      })
    }

    // Cannot delete 'default' project
    if (ref === 'default') {
      console.warn('[Project API] Attempt to delete default project - returning 400')
      return res.status(400).json({ 
        error: { 
          message: 'Cannot delete default project' 
        } 
      })
    }

    try {
      // Step 1: Find the project to get its details
      const projectResult = await findProjectByRef(ref)

      if (projectResult.error) {
        console.error('[Project Delete] Error fetching project:', projectResult.error)
        return res.status(500).json({ 
          error: { message: projectResult.error.message || 'Failed to fetch project' } 
        })
      }

      const project = projectResult.data

      if (!project) {
        return res.status(404).json({ 
          error: { message: `Project not found: ${ref}` } 
        })
      }

      console.log(`[Project Delete] Starting deletion for project: ${ref}`)

      // Step 2: Remove service configurations
      try {
        const { getServiceConfigurationManager } = await import('lib/service-configuration')
        const serviceConfigManager = getServiceConfigurationManager()
        
        await serviceConfigManager.removeProjectServiceConfig(ref)
        console.log(`[Project Delete] ✓ Removed service configurations: ${ref}`)
      } catch (error) {
        // Log error but don't fail the deletion
        console.error(`[Project Delete] Failed to remove service configurations (continuing):`, error)
      }

      // Step 3: Unregister from ServiceRouter
      try {
        const serviceRouter = getServiceRouter()
        const isRegistered = await serviceRouter.isProjectRegistered(ref)
        
        if (isRegistered) {
          await serviceRouter.unregisterProject(ref)
          console.log(`[Project Delete] ✓ Unregistered project from ServiceRouter: ${ref}`)
        } else {
          console.log(`[Project Delete] Project not registered in ServiceRouter: ${ref}`)
        }
      } catch (error) {
        // Log error but don't fail the deletion
        console.error(`[Project Delete] Failed to unregister from ServiceRouter (continuing):`, error)
      }

      // Step 4: Delete project directories
      try {
        const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER_READ_WRITE, POSTGRES_PASSWORD, POSTGRES_DATABASE } = await import('lib/api/self-hosted/constants')
        const connectionString = `postgresql://${POSTGRES_USER_READ_WRITE}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`
        const initService = new ProjectInitializationService(connectionString)
        
        await initService.deleteProjectDirectories(ref)
        console.log(`[Project Delete] ✓ Deleted project directories: ${ref}`)
      } catch (error) {
        // Log error but don't fail the deletion
        console.error(`[Project Delete] Failed to delete project directories (continuing):`, error)
      }

      // Step 5: Delete the database user (if exists)
      try {
        if (project.database_user) {
          const { deleteProjectUser } = await import('lib/api/self-hosted')
          const userDeleteResult = await deleteProjectUser(project.database_user)
          
          if (userDeleteResult.error) {
            console.error(`[Project Delete] Failed to delete database user (continuing):`, userDeleteResult.error)
          } else {
            console.log(`[Project Delete] ✓ Deleted database user: ${project.database_user}`)
          }
        }
      } catch (error) {
        // Log error but don't fail the deletion
        console.error(`[Project Delete] Failed to delete database user (continuing):`, error)
      }

      // Step 5: Delete the database
      try {
        const dbDeleteResult = await deleteDatabase(project.database_name)
        
        if (dbDeleteResult.error) {
          console.error(`[Project Delete] Failed to delete database (continuing):`, dbDeleteResult.error)
        } else {
          console.log(`[Project Delete] ✓ Deleted database: ${project.database_name}`)
        }
      } catch (error) {
        // Log error but don't fail the deletion
        console.error(`[Project Delete] Failed to delete database (continuing):`, error)
      }

      // Step 6: Delete project from store
      const deleteResult = await deleteProject(project.id)

      if (deleteResult.error) {
        console.error('[Project Delete] Error deleting project from store:', deleteResult.error)
        return res.status(500).json({ 
          error: { message: deleteResult.error.message || 'Failed to delete project' } 
        })
      }

      console.log(`[Project Delete] ✓ Successfully deleted project: ${ref}`)

      // Return the deleted project details
      return res.status(200).json({
        id: project.id,
        ref: project.ref,
        name: project.name,
        organization_id: project.organization_id,
        status: 'DELETED',
      })
    } catch (error: any) {
      console.error('[Project Delete] Unexpected error:', error)
      return res.status(500).json({ 
        error: { message: error.message || 'Failed to delete project' } 
      })
    }
  }

  // Platform mode - not supported
  return res.status(501).json({ 
    error: { message: 'Project deletion not supported in platform mode' } 
  })
}
