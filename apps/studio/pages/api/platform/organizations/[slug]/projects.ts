import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'
import { DEFAULT_PROJECT } from 'lib/constants/api'
import { findAllProjects, generateDisplayConnectionString, generateConnectionString, parseConnectionString } from 'lib/api/self-hosted'
import { getCurrentUserId } from 'lib/api/auth-helpers'

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
  const { slug, limit = '96', offset = '0' } = req.query
  
  const limitNum = parseInt(limit as string)
  const offsetNum = parseInt(offset as string)
  
  // Extract user ID from JWT token for user isolation
  const userId = await getCurrentUserId(req)
  
  console.log('[Org Projects API] User isolation enabled:', !!userId)
  console.log('[Org Projects API] Authorization header:', req.headers.authorization ? 'Present' : 'Missing')
  
  if (userId) {
    console.log('[Org Projects API] Fetching projects for user:', userId)
  }
  
  // Read all projects from the project store
  const result = await findAllProjects()
  
  let allProjects: any[] = []
  
  if (result.error) {
    // If there's an error reading the store (e.g., file doesn't exist yet),
    // return empty array when user isolation is enabled
    console.warn('Failed to read project store:', result.error.message)
    if (userId) {
      // User isolation enabled - return empty array for new users
      allProjects = []
    } else {
      // No user isolation - return default project for backward compatibility
      // Generate connection string for default project using environment values
      const defaultDatabaseName = process.env.POSTGRES_DB || 'postgres'
      const defaultDisplayConnectionString = generateDisplayConnectionString({
        databaseName: defaultDatabaseName,
        readOnly: false,
        useEnvironmentDefaults: true,
      })

      // Generate actual connection string to extract accurate values
      const defaultActualConnectionString = generateConnectionString({
        databaseName: defaultDatabaseName,
        readOnly: false,
        useEnvironmentDefaults: true,
      })
      const defaultParsedConnection = parseConnectionString(defaultActualConnectionString)

      allProjects = [
        {
          ...DEFAULT_PROJECT,
          database_name: defaultDatabaseName,
          organization_id: 1,
          connectionString: defaultDisplayConnectionString,
          databases: [
            {
              identifier: DEFAULT_PROJECT.ref,
              infra_compute_size: 'micro',
              host: defaultParsedConnection.host || process.env.POSTGRES_HOST || 'localhost',
              port: defaultParsedConnection.port || parseInt(process.env.POSTGRES_PORT || '5432', 10),
              database: defaultParsedConnection.database || defaultDatabaseName,
              user: defaultParsedConnection.user || process.env.POSTGRES_USER_READ_WRITE || 'postgres',
              region: 'local',
              endpoint: `${defaultParsedConnection.host || process.env.POSTGRES_HOST || 'localhost'}:${defaultParsedConnection.port || parseInt(process.env.POSTGRES_PORT || '5432', 10)}`,
              type: 'primary',
              label: 'Primary Database',
              isPrimary: true,
            },
          ],
        },
      ]
    }
  } else if (result.data && result.data.length > 0) {
    // Map project metadata to the expected API format
    let projectsData = result.data
    
    console.log('[Org Projects API] Total projects in store:', projectsData.length)
    console.log('[Org Projects API] Projects with owner_user_id:', projectsData.filter(p => p.owner_user_id).length)
    console.log('[Org Projects API] Projects without owner_user_id (legacy):', projectsData.filter(p => !p.owner_user_id).length)
    
    // Filter by user ID if user isolation is enabled
    if (userId) {
      // Only show projects that belong to this user
      projectsData = projectsData.filter((project) => project.owner_user_id === userId)
      console.log('[Org Projects API] Found', projectsData.length, 'projects for user', userId)
    } else {
      // No user authentication - only show projects without owner_user_id (legacy projects)
      // This maintains backward compatibility for unauthenticated access
      projectsData = projectsData.filter((project) => !project.owner_user_id)
      console.log('[Org Projects API] No user auth - showing', projectsData.length, 'legacy projects')
    }
    
    allProjects = projectsData.map((project) => {
      // Generate display connection string with environment values
      const displayConnectionString = generateDisplayConnectionString({
        databaseName: project.database_name,
        readOnly: false,
        useEnvironmentDefaults: true,
      })

      // Generate actual connection string to extract accurate values
      const actualConnectionString = generateConnectionString({
        databaseName: project.database_name,
        readOnly: false,
        useEnvironmentDefaults: true,
      })
      const parsedConnection = parseConnectionString(actualConnectionString)

      return {
        id: project.id,
        ref: project.ref,
        name: project.name,
        database_name: project.database_name,
        database_user: project.database_user || parsedConnection.user || process.env.POSTGRES_USER_READ_WRITE || 'postgres',
        organization_id: project.organization_id,
        cloud_provider: 'localhost',
        status: project.status,
        region: project.region,
        inserted_at: project.inserted_at,
        connectionString: displayConnectionString,
        databases: [
          {
            identifier: project.ref,
            infra_compute_size: 'micro',
            host: parsedConnection.host || process.env.POSTGRES_HOST || 'localhost',
            port: parsedConnection.port || parseInt(process.env.POSTGRES_PORT || '5432', 10),
            database: project.database_name,
            user: project.database_user || parsedConnection.user || process.env.POSTGRES_USER_READ_WRITE || 'postgres',
            region: project.region || 'local',
            endpoint: `${parsedConnection.host || process.env.POSTGRES_HOST || 'localhost'}:${parsedConnection.port || parseInt(process.env.POSTGRES_PORT || '5432', 10)}`,
            type: 'primary',
            label: 'Primary Database',
            isPrimary: true,
          },
        ],
      }
    })
  } else {
    // No projects in store
    if (userId) {
      // User isolation enabled - return empty array
      allProjects = []
    } else {
      // No user isolation - return default project for backward compatibility
      // Generate connection string for default project using environment values
      const defaultDatabaseName = process.env.POSTGRES_DB || 'postgres'
      const defaultDisplayConnectionString = generateDisplayConnectionString({
        databaseName: defaultDatabaseName,
        readOnly: false,
        useEnvironmentDefaults: true,
      })

      // Generate actual connection string to extract accurate values
      const defaultActualConnectionString = generateConnectionString({
        databaseName: defaultDatabaseName,
        readOnly: false,
        useEnvironmentDefaults: true,
      })
      const defaultParsedConnection = parseConnectionString(defaultActualConnectionString)

      allProjects = [
        {
          ...DEFAULT_PROJECT,
          database_name: defaultDatabaseName,
          organization_id: 1,
          connectionString: defaultDisplayConnectionString,
          databases: [
            {
              identifier: DEFAULT_PROJECT.ref,
              infra_compute_size: 'micro',
              host: defaultParsedConnection.host || process.env.POSTGRES_HOST || 'localhost',
              port: defaultParsedConnection.port || parseInt(process.env.POSTGRES_PORT || '5432', 10),
              database: defaultParsedConnection.database || defaultDatabaseName,
              user: defaultParsedConnection.user || process.env.POSTGRES_USER_READ_WRITE || 'postgres',
              region: 'local',
              endpoint: `${defaultParsedConnection.host || process.env.POSTGRES_HOST || 'localhost'}:${defaultParsedConnection.port || parseInt(process.env.POSTGRES_PORT || '5432', 10)}`,
              type: 'primary',
              label: 'Primary Database',
              isPrimary: true,
            },
          ],
        },
      ]
    }
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