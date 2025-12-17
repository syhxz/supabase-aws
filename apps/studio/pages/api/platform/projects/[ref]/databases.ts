import { NextApiRequest, NextApiResponse } from 'next'

import { paths } from 'api-types'
import apiWrapper from 'lib/api/apiWrapper'
import { PROJECT_REST_URL } from 'lib/constants/api'

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

type ResponseData =
  paths['/platform/projects/{ref}/databases']['get']['responses']['200']['content']['application/json']

/**
 * Maps project status to database status compatible with API response
 */
function mapProjectStatusToDatabaseStatus(projectStatus: any): 
  | 'ACTIVE_HEALTHY'
  | 'ACTIVE_UNHEALTHY'
  | 'COMING_UP'
  | 'GOING_DOWN'
  | 'INIT_FAILED'
  | 'REMOVED'
  | 'RESTORING'
  | 'UNKNOWN'
  | 'INIT_READ_REPLICA'
  | 'INIT_READ_REPLICA_FAILED'
  | 'RESTARTING'
  | 'RESIZING' {
  
  switch (projectStatus) {
    case 'ACTIVE_HEALTHY':
      return 'ACTIVE_HEALTHY'
    case 'INACTIVE':
      return 'UNKNOWN' // Map INACTIVE to UNKNOWN since INACTIVE is not supported in database status
    case 'COMING_UP':
      return 'COMING_UP'
    case 'UNKNOWN':
      return 'UNKNOWN'
    case 'REMOVED':
      return 'REMOVED'
    default:
      return 'UNKNOWN' // Default fallback for any unrecognized status
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse<ResponseData>) => {
  const { ref } = req.query
  
  if (typeof ref !== 'string') {
    return res.status(400).json({ 
      error: { message: 'Project ref is required' } 
    } as any)
  }

  try {
    // Import the project lookup function and enhanced connection string generation
    const { 
      findProjectByRef, 
      generateConnectionStringWithFallback, 
      parseConnectionStringWithFallback,
      getCredentialFallbackManager 
    } = await import('lib/api/self-hosted')
    
    // Get project information
    const result = await findProjectByRef(ref)
    
    if (result.error) {
      console.error('Error fetching project for databases API:', result.error)
      return res.status(500).json({ 
        error: { message: result.error.message || 'Failed to fetch project' } 
      } as any)
    }

    const project = result.data

    if (!project) {
      return res.status(404).json({ 
        error: { message: `Project not found: ${ref}` } 
      } as any)
    }

    // Get credential fallback manager for logging
    const fallbackManager = getCredentialFallbackManager()

    // Resolve project credentials and determine if fallback is needed
    const projectCredentials = fallbackManager.getProjectCredentials(
      ref,
      project.database_user,
      project.database_password_hash
    )

    // Generate connection string with fallback support for read-write access
    const connectionResult = await generateConnectionStringWithFallback({
      databaseName: project.database_name,
      projectRef: ref,
      projectCredentials: {
        user: project.database_user,
        passwordHash: project.database_password_hash
      },
      readOnly: false,
      useEnvironmentDefaults: true,
      allowFallback: true,
      logFallbackUsage: true,
      maskPassword: true, // Mask password for API response
    })

    // Generate read-only connection string with fallback support
    const readOnlyConnectionResult = await generateConnectionStringWithFallback({
      databaseName: project.database_name,
      projectRef: ref,
      projectCredentials: {
        user: project.database_user,
        passwordHash: project.database_password_hash
      },
      readOnly: true,
      useEnvironmentDefaults: true,
      allowFallback: true,
      logFallbackUsage: true,
      maskPassword: true, // Mask password for API response
    })

    // Parse the connection string to get accurate values for response
    const parsedConnection = parseConnectionStringWithFallback(
      connectionResult.connectionString,
      { validateFormat: true, allowMaskedPassword: true }
    )

    // Log fallback usage for monitoring purposes (Requirements 2.5)
    if (connectionResult.usedFallback) {
      console.log(`[Databases API] Using fallback credentials for project ${ref}: ${connectionResult.fallbackReason}`)
    }

    // Ensure all required fields are populated (Requirements 2.4)
    const dbHost = parsedConnection.host || process.env.POSTGRES_HOST || 'localhost'
    const dbPort = parsedConnection.port || parseInt(process.env.POSTGRES_PORT || '5432', 10)
    const dbUser = parsedConnection.user || process.env.POSTGRES_USER_READ_WRITE || 'postgres'

    return res.status(200).json([
      {
        cloud_provider: 'localhost' as any,
        connectionString: connectionResult.connectionString,
        connection_string_read_only: readOnlyConnectionResult.connectionString,
        db_host: dbHost,
        db_name: project.database_name, // Use actual project database name
        db_port: dbPort,
        db_user: dbUser,
        identifier: project.ref,
        inserted_at: project.inserted_at,
        region: project.region || 'local',
        restUrl: PROJECT_REST_URL,
        size: '',
        status: mapProjectStatusToDatabaseStatus(project.status),
      },
    ])
  } catch (error: any) {
    console.error('Error in databases API:', error)
    
    // Enhanced error handling for credential-related failures (Requirements 2.1)
    if (error.message?.includes('credential') || error.message?.includes('password') || error.message?.includes('user')) {
      console.error(`[Databases API] Credential-related error for project ${ref}:`, error.message)
      
      // Try to provide fallback response even when credential resolution fails
      try {
        const { getCredentialFallbackManager } = await import('lib/api/self-hosted')
        const fallbackManager = getCredentialFallbackManager()
        
        // Log the credential failure
        fallbackManager.logFallbackUsage(
          ref, 
          `Credential resolution failed: ${error.message}`, 
          'both'
        )
        
        return res.status(500).json({ 
          error: { 
            message: 'Failed to resolve database credentials. Please check project configuration.',
            details: error.message
          } 
        } as any)
      } catch (fallbackError) {
        // If even fallback logging fails, return original error
        return res.status(500).json({ 
          error: { message: error.message || 'Failed to fetch database information' } 
        } as any)
      }
    }
    
    return res.status(500).json({ 
      error: { message: error.message || 'Failed to fetch database information' } 
    } as any)
  }
}
