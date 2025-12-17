/**
 * Project Creation API Endpoint
 * 
 * POST /api/platform/projects/create
 * 
 * Creates a new project with an isolated PostgreSQL database.
 * The database is created using a template database and project metadata is persisted.
 * 
 * Features:
 * - Validates project name and database name
 * - Auto-generates database name if not provided
 * - Creates database from template
 * - Generates unique project reference
 * - Saves project metadata
 * - Implements rollback on failure
 * - Returns comprehensive error messages
 */

import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import {
  createDatabaseWithRetry,
  getTemplateDatabaseName,
  DatabaseError,
  DatabaseErrorCode,
  saveProject,
  generateConnectionString,
  generateDisplayConnectionString,
  deleteDatabase,
  ProjectStoreError,
  ProjectStoreErrorCode,
  createProjectUser,
  deleteProjectUser,
  validatePassword,
  DatabaseUserError,
  DatabaseUserErrorCode,
} from 'lib/api/self-hosted'
import {
  generateDatabaseNameWithCollisionDetection,
  generateUsernameWithCollisionDetection,
  CredentialGenerationError,
  CredentialGenerationErrorCode,
} from 'lib/api/self-hosted/enhanced-credential-generation'
import {
  generateCredentialWithFallbackSupport,
  DEFAULT_FALLBACK_CONFIG,
} from 'lib/api/self-hosted/credential-generation-fallback'
import {
  formatCredentialGenerationError,
} from 'lib/api/self-hosted/credential-generation-error-messages'
import { getCurrentUserId, isUserIsolationEnabled } from 'lib/api/auth-helpers'
import { ProjectInitializationService } from 'lib/project-initialization/ProjectInitializationService'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

/**
 * Request body interface for project creation
 * Note: database_name and database_user are no longer accepted - always auto-generated
 */
interface CreateProjectRequest {
  name: string
  organization_id?: number
  database_password?: string
  db_pass?: string // Support both formats for compatibility
  region?: string
}

/**
 * Generates a unique project reference identifier
 * Format: lowercase alphanumeric string with timestamp
 */
function generateProjectRef(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${random}${timestamp}`
}

/**
 * Maps database error codes to HTTP status codes
 */
function getHttpStatusForDatabaseError(code: DatabaseErrorCode): number {
  switch (code) {
    case DatabaseErrorCode.DATABASE_ALREADY_EXISTS:
      return 409 // Conflict
    case DatabaseErrorCode.INVALID_DATABASE_NAME:
      return 400 // Bad Request
    case DatabaseErrorCode.TEMPLATE_NOT_FOUND:
      return 500 // Internal Server Error
    case DatabaseErrorCode.INSUFFICIENT_PERMISSIONS:
      return 403 // Forbidden
    case DatabaseErrorCode.DISK_SPACE_FULL:
      return 507 // Insufficient Storage
    case DatabaseErrorCode.CONNECTION_FAILED:
      return 503 // Service Unavailable
    default:
      return 500 // Internal Server Error
  }
}

/**
 * Maps project store error codes to HTTP status codes
 */
function getHttpStatusForProjectStoreError(code: ProjectStoreErrorCode): number {
  switch (code) {
    case ProjectStoreErrorCode.PROJECT_ALREADY_EXISTS:
      return 409 // Conflict
    case ProjectStoreErrorCode.INVALID_PROJECT_DATA:
      return 400 // Bad Request
    case ProjectStoreErrorCode.FILE_READ_ERROR:
    case ProjectStoreErrorCode.FILE_WRITE_ERROR:
    case ProjectStoreErrorCode.DIRECTORY_CREATE_ERROR:
      return 500 // Internal Server Error
    case ProjectStoreErrorCode.PROJECT_NOT_FOUND:
      return 404 // Not Found
    case ProjectStoreErrorCode.UNKNOWN_ERROR:
    default:
      return 500 // Internal Server Error
  }
}

/**
 * Maps database user error codes to HTTP status codes
 */
function getHttpStatusForDatabaseUserError(code: DatabaseUserErrorCode): number {
  switch (code) {
    case DatabaseUserErrorCode.USER_ALREADY_EXISTS:
      return 409 // Conflict
    case DatabaseUserErrorCode.INVALID_USERNAME:
    case DatabaseUserErrorCode.INVALID_PASSWORD:
      return 400 // Bad Request
    case DatabaseUserErrorCode.PERMISSION_DENIED:
      return 403 // Forbidden
    case DatabaseUserErrorCode.CONNECTION_FAILED:
      return 503 // Service Unavailable
    case DatabaseUserErrorCode.DATABASE_NOT_FOUND:
      return 404 // Not Found
    default:
      return 500 // Internal Server Error
  }
}

/**
 * Maps credential generation error codes to HTTP status codes
 */
function getHttpStatusForCredentialGenerationError(code: CredentialGenerationErrorCode): number {
  switch (code) {
    case CredentialGenerationErrorCode.INVALID_PROJECT_NAME:
      return 400 // Bad Request
    case CredentialGenerationErrorCode.RETRY_EXHAUSTED:
    case CredentialGenerationErrorCode.GENERATION_FAILED:
      return 500 // Internal Server Error
    case CredentialGenerationErrorCode.UNIQUENESS_CHECK_FAILED:
      return 503 // Service Unavailable
    default:
      return 500 // Internal Server Error
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ 
        error: { 
          message: `Method ${method} Not Allowed` 
        } 
      })
  }
}

/**
 * Handles POST request to create a new project
 */
const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('=== Project Creation Request ===')
  console.log('Request body:', JSON.stringify(req.body, null, 2))
  
  const body = req.body as CreateProjectRequest

  // Validate required fields
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return res.status(400).json({
      error: {
        message: 'Project name is required and must be a non-empty string',
        code: 'INVALID_PROJECT_NAME',
      },
    })
  }

  // Auto-generate database username using enhanced credential generation with fallback support
  let databaseUser: string
  let databasePassword: string
  let usernameUsedFallback = false
  let usernameStrategy: string | undefined

  try {
    const usernameResult = await generateCredentialWithFallbackSupport(
      body.name,
      'username',
      () => generateUsernameWithCollisionDetection(body.name),
      DEFAULT_FALLBACK_CONFIG
    )
    
    databaseUser = usernameResult.name
    usernameUsedFallback = usernameResult.usedFallback
    usernameStrategy = usernameResult.strategy
    
    if (usernameUsedFallback) {
      console.log(`✓ Auto-generated database username using fallback strategy (${usernameStrategy}):`, databaseUser)
    } else {
      console.log('✓ Auto-generated database username:', databaseUser)
    }
  } catch (error) {
    console.error('✗ Database username generation failed:', error)
    
    if (error instanceof CredentialGenerationError) {
      const formattedError = formatCredentialGenerationError(error.code, 1, error.details)
      const statusCode = getHttpStatusForCredentialGenerationError(error.code)
      
      return res.status(statusCode).json({
        error: {
          message: formattedError.message,
          code: error.code,
          details: {
            ...error.details,
            userAction: formattedError.userAction,
            suggestions: formattedError.suggestions,
            canRetry: formattedError.canRetry,
            severity: formattedError.severity,
          },
        },
      })
    }
    
    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to generate database username',
        code: 'USERNAME_GENERATION_FAILED',
        details: { 
          project_name: body.name,
          userAction: 'Please try creating your project again.',
          suggestions: ['Try using a different project name', 'Contact support if the problem persists'],
          canRetry: true,
        },
      },
    })
  }

  // Validate database password (support both db_pass and database_password)
  const passwordField = body.database_password || body.db_pass
  if (!passwordField || typeof passwordField !== 'string') {
    return res.status(400).json({
      error: {
        message: 'Database password is required and must be a non-empty string',
        code: 'INVALID_DATABASE_PASSWORD',
      },
    })
  }

  try {
    validatePassword(passwordField)
    databasePassword = passwordField
    console.log('✓ Database password validated')
  } catch (error) {
    console.error('✗ Database password validation failed:', error)
    if (error instanceof DatabaseUserError) {
      const statusCode = getHttpStatusForDatabaseUserError(error.code)
      return res.status(statusCode).json({
        error: {
          message: error.message,
          code: error.code,
        },
      })
    }
    return res.status(400).json({
      error: {
        message: error instanceof Error ? error.message : 'Invalid database password',
        code: 'INVALID_DATABASE_PASSWORD',
      },
    })
  }

  // Auto-generate database name using enhanced credential generation with fallback support
  let databaseName: string
  let databaseUsedFallback = false
  let databaseStrategy: string | undefined
  
  try {
    const databaseResult = await generateCredentialWithFallbackSupport(
      body.name,
      'database',
      () => generateDatabaseNameWithCollisionDetection(body.name),
      DEFAULT_FALLBACK_CONFIG
    )
    
    databaseName = databaseResult.name
    databaseUsedFallback = databaseResult.usedFallback
    databaseStrategy = databaseResult.strategy
    
    if (databaseUsedFallback) {
      console.log(`✓ Auto-generated database name using fallback strategy (${databaseStrategy}):`, databaseName)
    } else {
      console.log('✓ Auto-generated database name:', databaseName)
    }
  } catch (error) {
    console.error('✗ Database name generation failed:', error)
    
    if (error instanceof CredentialGenerationError) {
      const formattedError = formatCredentialGenerationError(error.code, 1, error.details)
      const statusCode = getHttpStatusForCredentialGenerationError(error.code)
      
      return res.status(statusCode).json({
        error: {
          message: formattedError.message,
          code: error.code,
          details: {
            ...error.details,
            userAction: formattedError.userAction,
            suggestions: formattedError.suggestions,
            canRetry: formattedError.canRetry,
            severity: formattedError.severity,
          },
        },
      })
    }
    
    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to generate database name',
        code: 'DATABASE_NAME_GENERATION_FAILED',
        details: { 
          project_name: body.name,
          userAction: 'Please try creating your project again.',
          suggestions: ['Try using a different project name', 'Contact support if the problem persists'],
          canRetry: true,
        },
      },
    })
  }

  // Generate project ref
  const projectRef = generateProjectRef()
  console.log('Generated project ref:', projectRef)

  // Get template database name
  const templateDatabaseName = getTemplateDatabaseName()
  console.log('Template database name:', templateDatabaseName)

  // Track if database was created for rollback purposes
  let databaseCreated = false
  let databaseUserCreated = false
  let schemasInitialized = false
  let directoriesCreated = false
  let initService: ProjectInitializationService | null = null

  try {
    console.log('Step 1: Creating database with retry logic...')
    // Step 1: Create the database with retry logic for template locks
    const createDbResult = await createDatabaseWithRetry({
      name: databaseName,
      template: templateDatabaseName,
    })
    
    console.log('Database creation result:', createDbResult.error ? 'ERROR' : 'SUCCESS')

    if (createDbResult.error) {
      const error = createDbResult.error as DatabaseError
      console.error('Database creation error:', {
        message: error.message,
        code: error.code,
        details: error.details,
      })
      const statusCode = getHttpStatusForDatabaseError(error.code)

      return res.status(statusCode).json({
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      })
    }

    databaseCreated = true

    // Step 1.2: Create project-specific database user
    console.log('Step 1.2: Creating project-specific database user...')
    
    const createUserResult = await createProjectUser({
      username: databaseUser,
      password: databasePassword,
      databaseName,
      projectRef,
    })

    if (createUserResult.error) {
      const error = createUserResult.error
      console.error('Database user creation error:', {
        message: error.message,
        code: error instanceof DatabaseUserError ? error.code : 'UNKNOWN_ERROR',
        details: error instanceof DatabaseUserError ? error.details : undefined,
      })

      // Rollback: Delete the created database
      await rollbackProjectCreation(databaseName, projectRef, null)

      if (createUserResult.error instanceof DatabaseUserError) {
        const statusCode = getHttpStatusForDatabaseUserError(createUserResult.error.code)
        return res.status(statusCode).json({
          error: {
            message: createUserResult.error.message,
            code: createUserResult.error.code,
            details: createUserResult.error.details,
          },
        })
      }

      return res.status(500).json({
        error: {
          message: createUserResult.error instanceof Error ? createUserResult.error.message : 'Failed to create database user',
          code: 'DATABASE_USER_CREATION_FAILED',
          details: { username: databaseUser },
        },
      })
    }

    databaseUserCreated = true
    console.log('✓ Database user created successfully:', databaseUser)

    // Step 1.5: Initialize project schemas
    console.log('Step 1.5: Initializing project schemas...')
    
    try {
      const connectionString = generateConnectionString({
        databaseName,
        readOnly: false,
      })
      
      initService = new ProjectInitializationService(connectionString)
      const initResult = await initService.initializeProject(projectRef, databaseName)
      
      if (initResult.success) {
        schemasInitialized = true
        console.log('✓ Project schemas initialized successfully:', initResult.schemasCreated)
      } else {
        console.error('✗ Schema initialization failed:', initResult.error)
        throw new Error(`Schema initialization failed: ${initResult.error}`)
      }
    } catch (schemaError) {
      console.error('✗ Schema initialization error:', schemaError)
      throw new Error(`Failed to initialize project schemas: ${schemaError instanceof Error ? schemaError.message : 'Unknown error'}`)
    }

    // Step 1.6: Create project directories
    console.log('Step 1.6: Creating project directories...')
    
    try {
      if (!initService) {
        const connectionString = generateConnectionString({
          databaseName,
          readOnly: false,
        })
        initService = new ProjectInitializationService(connectionString)
      }
      
      await initService.createProjectDirectories(projectRef)
      directoriesCreated = true
      console.log('✓ Project directories created successfully')
    } catch (dirError) {
      console.error('✗ Directory creation error:', dirError)
      // Directory creation failure is not critical, log but continue
      console.warn('⚠ Warning: Directory creation failed, but project creation will continue')
      directoriesCreated = false
    }

    // Step 2: Generate connection strings with project-specific user
    const connectionString = generateConnectionString({
      databaseName,
      user: databaseUser,
      password: databasePassword,
      readOnly: false,
      useEnvironmentDefaults: true,
    })

    // Step 3: Get current user ID if user isolation is enabled
    let ownerUserId: string | undefined
    if (isUserIsolationEnabled()) {
      ownerUserId = await getCurrentUserId(req) || undefined
      console.log('User isolation enabled, owner user ID:', ownerUserId)
      
      if (!ownerUserId) {
        // Rollback: Delete the created database user and database
        await rollbackProjectCreation(databaseName, projectRef, initService, databaseUserCreated ? databaseUser : undefined)
        
        return res.status(401).json({
          error: {
            message: 'Authentication required to create projects',
            code: 'AUTHENTICATION_REQUIRED',
          },
        })
      }
    }

    // Step 4: Save project metadata with database user information
    const projectMetadata = {
      ref: projectRef,
      name: body.name.trim(),
      database_name: databaseName,
      database_user: databaseUser,
      database_password_hash: databasePassword, // TODO: Hash the password for storage
      organization_id: body.organization_id || 1,
      owner_user_id: ownerUserId,
      status: 'ACTIVE_HEALTHY' as const,
      region: body.region || 'local',
      connection_string: connectionString,
      inserted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const saveResult = await saveProject(projectMetadata)

    if (saveResult.error) {
      // Rollback: Delete the created database user and database
      await rollbackProjectCreation(databaseName, projectRef, initService, databaseUserCreated ? databaseUser : undefined)

      const error = saveResult.error as ProjectStoreError
      const statusCode = getHttpStatusForProjectStoreError(error.code)

      return res.status(statusCode).json({
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      })
    }

    // Success: Register project configuration with ServiceRouter
    console.log('Step 5: Registering project with ServiceRouter...')
    const { getServiceRouter } = await import('lib/service-router')
    const serviceRouter = getServiceRouter()
    
    try {
      await serviceRouter.registerProject({
        projectRef,
        databaseName,
        connectionString,
        ownerUserId: ownerUserId || 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      console.log('✓ Project registered with ServiceRouter')
      
      // Configure services to use project-specific database user
      console.log('Step 5.1: Configuring services with project-specific database user...')
      const { getServiceConfigurationManager } = await import('lib/service-configuration')
      const serviceConfigManager = getServiceConfigurationManager()
      
      const configResult = await serviceConfigManager.configureProjectServices(projectRef)
      
      if (!configResult.success) {
        console.warn('⚠ Some services failed to configure:', configResult.errors)
        // Log authentication failures but don't fail project creation
        for (const error of configResult.errors) {
          console.error(`Service ${error.service} configuration failed: ${error.error}`)
        }
      } else {
        console.log('✓ All services configured with project-specific database user:', configResult.updatedServices)
      }
      
      // Verify registration succeeded
      console.log('Step 5.2: Verifying ServiceRouter registration...')
      const isRegistered = await serviceRouter.isProjectRegistered(projectRef)
      
      if (isRegistered) {
        console.log('✓ ServiceRouter registration verified successfully')
      } else {
        console.warn(
          `⚠ Warning: ServiceRouter registration verification failed for project "${projectRef}". ` +
          `Project was created successfully but may not be immediately accessible.`
        )
      }
    } catch (registrationError) {
      // Log error but don't fail project creation
      console.error(
        `✗ ServiceRouter registration failed for project "${projectRef}":`,
        registrationError instanceof Error ? registrationError.message : registrationError
      )
      console.error('Project details:', {
        projectRef,
        databaseName,
        ownerUserId: ownerUserId || 'system',
      })
      console.warn(
        `⚠ Warning: Project "${projectRef}" was created successfully but is not registered with ServiceRouter. ` +
        `Manual registration may be required.`
      )
    }

    // Close the initialization service
    if (initService) {
      await initService.close()
    }

    const project = saveResult.data!

    // Generate display connection string for API response (with masked password)
    const displayConnectionString = generateDisplayConnectionString({
      databaseName,
      user: databaseUser,
      password: databasePassword,
      readOnly: false,
      useEnvironmentDefaults: true,
    })

    // Generate actual connection string with project-specific user credentials
    const actualConnectionString = generateConnectionString({
      databaseName,
      user: databaseUser,
      password: databasePassword,
      readOnly: false,
      useEnvironmentDefaults: true,
    })

    // Parse the actual connection string to get accurate values
    const { parseConnectionString } = await import('lib/api/self-hosted')
    const parsedConnection = parseConnectionString(actualConnectionString)

    return res.status(201).json({
      id: project.id,
      ref: project.ref,
      name: project.name,
      database_name: project.database_name,
      organization_id: project.organization_id,
      connection_string: displayConnectionString,
      status: project.status,
      region: project.region,
      inserted_at: project.inserted_at,
      cloud_provider: 'localhost',
      databases: [
        {
          identifier: project.ref,
          infra_compute_size: 'micro',
          host: parsedConnection.host || process.env.POSTGRES_HOST || 'localhost',
          port: parsedConnection.port || parseInt(process.env.POSTGRES_PORT || '5432', 10),
          database: project.database_name,
          user: databaseUser,
          region: project.region || 'local',
          endpoint: `${parsedConnection.host || process.env.POSTGRES_HOST || 'localhost'}:${parsedConnection.port || parseInt(process.env.POSTGRES_PORT || '5432', 10)}`,
          type: 'primary',
          label: 'Primary Database',
          isPrimary: true,
        },
      ],
    })
  } catch (error) {
    // Rollback: Delete the created database user and database if they were created
    if (databaseCreated) {
      await rollbackProjectCreation(databaseName, projectRef, initService, databaseUserCreated ? databaseUser : undefined)
    }

    // Log the error for debugging
    console.error('=== Unexpected error during project creation ===')
    console.error('Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred while creating the project',
        code: 'UNKNOWN_ERROR',
        details: error instanceof Error ? { message: error.message } : undefined,
      },
    })
  } finally {
    // Always close the initialization service
    if (initService) {
      try {
        await initService.close()
      } catch (closeError) {
        console.error('Error closing initialization service:', closeError)
      }
    }
  }
}

/**
 * Attempts to rollback database creation by deleting the database
 * Logs errors but doesn't throw to avoid masking the original error
 */
async function rollbackDatabaseCreation(databaseName: string): Promise<void> {
  try {
    // Import terminateConnections dynamically to avoid circular dependencies
    const { terminateConnections } = await import('lib/api/self-hosted/database-manager')
    
    // First, terminate all connections to the database
    console.log(`Terminating connections to database "${databaseName}" before deletion...`)
    const terminateResult = await terminateConnections(databaseName)
    if (terminateResult.error) {
      console.warn(`Warning: Could not terminate connections:`, terminateResult.error.message)
    } else {
      console.log(`Terminated ${terminateResult.data} connections`)
    }
    
    // Wait a bit for connections to fully close
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Now try to delete the database
    const deleteResult = await deleteDatabase(databaseName)
    if (deleteResult.error) {
      console.error(
        `Failed to rollback database creation for "${databaseName}":`,
        deleteResult.error
      )
    } else {
      console.log(`Successfully rolled back database creation for "${databaseName}"`)
    }
  } catch (error) {
    console.error(
      `Unexpected error during database rollback for "${databaseName}":`,
      error
    )
  }
}

/**
 * Comprehensive rollback function that cleans up all project resources
 * Includes database user, database, schemas, and directories
 */
async function rollbackProjectCreation(
  databaseName: string,
  projectRef: string,
  initService: ProjectInitializationService | null,
  databaseUser?: string
): Promise<void> {
  console.log('=== Starting comprehensive project rollback ===')
  
  // Step 1: Close the initialization service connection pool
  if (initService) {
    try {
      await initService.close()
      console.log('✓ Closed initialization service connection pool')
    } catch (error) {
      console.error('✗ Failed to close connection pool:', error)
    }
    
    // Wait a bit for connections to fully close
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  // Step 2: Delete project directories
  if (initService) {
    try {
      await initService.deleteProjectDirectories(projectRef)
      console.log('✓ Deleted project directories')
    } catch (error) {
      console.error('✗ Failed to delete project directories:', error)
    }
  }

  // Step 3: Delete the database user if it was created
  if (databaseUser) {
    try {
      const deleteUserResult = await deleteProjectUser(databaseUser)
      if (deleteUserResult.error) {
        console.error(`✗ Failed to delete database user "${databaseUser}":`, deleteUserResult.error.message)
      } else {
        console.log(`✓ Deleted database user "${databaseUser}"`)
      }
    } catch (error) {
      console.error(`✗ Unexpected error deleting database user "${databaseUser}":`, error)
    }
  }

  // Step 4: Delete the database (which will cascade delete all schemas)
  await rollbackDatabaseCreation(databaseName)
  
  console.log('=== Project rollback complete ===')
}
