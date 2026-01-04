import { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes } from 'crypto'

import { components } from 'api-types'
import { withSecureApiKeyAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { fetchUserClaims } from 'lib/api/apiAuthenticate'
import { getAuditLogger, AuditEventType, AuditSeverity } from 'lib/api/audit-logging'
import { createApiKeysDataAccess } from 'lib/api/api-keys-data-access'

type ProjectAppConfig = components['schemas']['ProjectSettingsResponse']['app_config'] & {
  protocol?: string
}
export type ProjectSettings = components['schemas']['ProjectSettingsResponse'] & {
  app_config?: ProjectAppConfig
}

export default withSecureApiKeyAccess(handler)

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req
  const auditLogger = getAuditLogger()

  // The security middleware has already validated user authentication and project access
  // We can use the context directly without re-authenticating
  const { userId, projectRef, projectId } = context

  // Log successful authentication (already handled by security middleware)
  await auditLogger.logEvent(
    AuditEventType.USER_LOGIN,
    'User authenticated for API key access',
    {
      userId: userId,
      endpoint: req.url,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress
    },
    AuditSeverity.INFO,
    true
  )

  switch (method) {
    case 'GET':
      return handleGetAll(req, res, context)
    case 'POST':
      return handleCreate(req, res, context)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) => {
  const { projectRef, projectId, userId } = context
  const auditLogger = getAuditLogger()

  try {
    // Create data access layer with automatic project filtering
    const apiKeysDA = createApiKeysDataAccess(context)

    // Get all keys for this project - automatically filtered by project_id
    const keys = await apiKeysDA.getAllKeys({ revealKey: true })

    // Log successful API key listing
    await auditLogger.logEvent(
      AuditEventType.DATA_ACCESSED,
      'API keys listed successfully',
      {
        userId: userId,
        projectRef: projectRef,
        projectId: projectId,
        endpoint: req.url,
        method: req.method,
        operation: 'list_api_keys',
        keyCount: keys.length,
        userAgent: req.headers['user-agent'],
        ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress
      },
      AuditSeverity.INFO,
      true
    )

    return res.status(200).json(keys)
  } catch (error) {
    // Log error
    await auditLogger.logEvent(
      AuditEventType.API_ERROR,
      'Failed to list API keys',
      {
        userId: userId,
        projectRef: projectRef,
        projectId: projectId,
        endpoint: req.url,
        method: req.method,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      AuditSeverity.ERROR,
      false
    )

    return res.status(500).json({ 
      data: null, 
      error: { message: 'Failed to retrieve API keys' } 
    })
  }
}

const handleCreate = async (req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) => {
  const { projectRef, projectId, userId } = context
  const { name, description, type } = req.body
  const auditLogger = getAuditLogger()

  if (!name || !type) {
    await auditLogger.logSecurityEvent(
      AuditEventType.API_ERROR,
      'Invalid API key creation request',
      {
        userId: userId,
        projectRef: projectRef,
        projectId: projectId,
        endpoint: req.url,
        method: req.method,
        error: 'Missing required fields: name or type',
        providedName: name,
        providedType: type
      },
      AuditSeverity.WARNING
    )
    
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Name and type are required' } 
    })
  }

  if (type !== 'secret' && type !== 'publishable') {
    await auditLogger.logSecurityEvent(
      AuditEventType.API_ERROR,
      'Invalid API key type in creation request',
      {
        userId: userId,
        projectRef: projectRef,
        projectId: projectId,
        endpoint: req.url,
        method: req.method,
        error: 'Invalid key type',
        providedType: type
      },
      AuditSeverity.WARNING
    )
    
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Type must be either "secret" or "publishable"' } 
    })
  }

  try {
    // Generate a secure API key
    const keyLength = type === 'secret' ? 64 : 32
    const apiKey = `sb_${type}_${randomBytes(keyLength).toString('hex')}`
    const hash = randomBytes(16).toString('hex')
    const prefix = apiKey.substring(0, 12)
    const id = randomBytes(8).toString('hex')

    // Create data access layer with automatic project association
    const apiKeysDA = createApiKeysDataAccess(context)

    // Create the key - automatically associates with project_id and created_by_user_id
    const newApiKey = await apiKeysDA.createKey({
      id,
      name,
      type,
      api_key: apiKey,
      hash,
      prefix,
      description: description || null,
      secret_jwt_template: type === 'secret' ? { role: 'service_role' } : null,
    })

    // Log successful API key creation with comprehensive metadata
    await auditLogger.logEvent(
      AuditEventType.DATA_MODIFIED,
      'API key created successfully',
      {
        userId: userId,
        projectRef: projectRef,
        projectId: projectId,
        endpoint: req.url,
        method: req.method,
        operation: 'create_api_key',
        keyId: id,
        keyName: name,
        keyType: type,
        keyDescription: description,
        keyPrefix: prefix,
        userAgent: req.headers['user-agent'],
        ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
        timestamp: new Date().toISOString()
      },
      AuditSeverity.INFO,
      true
    )

    return res.status(201).json(newApiKey)
  } catch (error) {
    // Log creation failure
    await auditLogger.logEvent(
      AuditEventType.API_ERROR,
      'Failed to create API key',
      {
        userId: userId,
        projectRef: projectRef,
        projectId: projectId,
        endpoint: req.url,
        method: req.method,
        operation: 'create_api_key',
        keyName: name,
        keyType: type,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      AuditSeverity.ERROR,
      false
    )

    return res.status(500).json({ 
      data: null, 
      error: { message: 'Failed to create API key' } 
    })
  }
}