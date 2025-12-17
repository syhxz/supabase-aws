import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'
import { findAllProjects, findProjectsByOwnerUserId, generateDisplayConnectionString } from 'lib/api/self-hosted'
import { getCurrentUserId, isUserIsolationEnabled } from 'lib/api/auth-helpers'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}



const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('[Projects API] ========== REQUEST START ==========')
  console.log('[Projects API] Method:', req.method)
  console.log('[Projects API] URL:', req.url)
  
  const { limit = '100', offset = '0' } = req.query
  
  const limitNum = parseInt(limit as string)
  const offsetNum = parseInt(offset as string)
  
  // Check if user isolation is enabled
  const userIsolation = isUserIsolationEnabled()
  console.log('[Projects API] User isolation enabled:', userIsolation)
  console.log('[Projects API] Authorization header:', req.headers.authorization ? 'Present' : 'Missing')
  
  let result
  
  if (userIsolation) {
    // Get current user ID
    console.log('[Projects API] Getting current user ID...')
    const userId = await getCurrentUserId(req)
    console.log('[Projects API] Current user ID result:', userId)
    
    if (!userId) {
      // No valid session - return empty list
      console.warn('[Projects API] No valid user session found - returning empty list')
      return res.status(200).json({
        projects: [],
        pagination: {
          count: 0,
          limit: limitNum,
          offset: offsetNum,
        },
      })
    }
    
    console.log('[Projects API] Fetching projects for user:', userId)
    
    // Get projects for this user only
    result = await findProjectsByOwnerUserId(userId)
    console.log('[Projects API] Query result:', { 
      error: result.error?.message, 
      dataLength: result.data?.length,
      data: result.data 
    })
  } else {
    // No user isolation - get all projects
    console.log('[Projects API] User isolation disabled - fetching all projects')
    result = await findAllProjects()
    console.log('[Projects API] Query result:', { 
      error: result.error?.message, 
      dataLength: result.data?.length,
      data: result.data 
    })
  }
  
  let allProjects: any[] = []
  
  if (result.error) {
    // If there's an error reading the store, log it and return empty list
    console.error('[Projects API] Failed to read project store:', result.error.message)
    // Return empty list - no default project fallback
    allProjects = []
  } else if (result.data && result.data.length > 0) {
    // Map project metadata to the expected API format
    allProjects = result.data.map((project) => ({
      id: project.id,
      ref: project.ref,
      name: project.name,
      database_name: project.database_name,
      organization_id: project.organization_id,
      owner_user_id: project.owner_user_id,
      cloud_provider: 'localhost',
      status: project.status,
      region: project.region,
      inserted_at: project.inserted_at,
      connectionString: generateDisplayConnectionString({
        databaseName: project.database_name,
        user: project.database_user,
        password: project.database_password_hash,
        readOnly: false,
      }),
      databases: [
        {
          identifier: project.ref,
          infra_compute_size: 'micro',
        },
      ],
    }))
  } else {
    // No projects in store - return empty array
    console.log('[Projects API] No projects found - returning empty list')
    allProjects = []
  }
  
  // Apply pagination
  const paginatedProjects = allProjects.slice(offsetNum, offsetNum + limitNum)
  
  const response = {
    projects: paginatedProjects,
    pagination: {
      count: allProjects.length,
      limit: limitNum,
      offset: offsetNum,
    },
  }
  
  return res.status(200).json(response)
}
