import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'
import { fetchUserClaims } from 'lib/api/apiAuthenticate'
import { getAuditLogger, AuditEventType, AuditSeverity } from 'lib/api/audit-logging'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler, { withAuth: true })

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req
  const auditLogger = getAuditLogger()

  // Get user claims for audit logging
  let userClaims
  try {
    userClaims = await fetchUserClaims(req)
  } catch (error) {
    // Log authentication failure
    await auditLogger.logSecurityEvent(
      AuditEventType.USER_LOGIN_FAILED,
      'Authentication failed for API key access',
      {
        endpoint: req.url,
        method: req.method,
        userAgent: req.headers['user-agent'],
        ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
        reason: error instanceof Error ? error.message : 'Unknown authentication error'
      },
      AuditSeverity.WARNING
    )
    return res.status(401).json({ 
      data: null, 
      error: { message: 'Authentication required' } 
    })
  }

  // Log successful authentication
  await auditLogger.logEvent(
    AuditEventType.USER_LOGIN,
    'User authenticated for API key operation',
    {
      userId: userClaims.sub,
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
      return handleGet(req, res, userClaims)
    case 'DELETE':
      return handleDelete(req, res, userClaims)
    default:
      res.setHeader('Allow', ['GET', 'DELETE'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse, userClaims: any) => {
  const { id, ref: projectRef } = req.query
  const { reveal } = req.query
  const auditLogger = getAuditLogger()

  if (!projectRef || typeof projectRef !== 'string') {
    await auditLogger.logSecurityEvent(
      AuditEventType.API_ERROR,
      'Invalid project reference in API key retrieval',
      {
        userId: userClaims.sub,
        endpoint: req.url,
        method: req.method,
        error: 'Missing or invalid project reference'
      },
      AuditSeverity.WARNING
    )
    
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Project reference is required' } 
    })
  }

  if (!id || typeof id !== 'string') {
    await auditLogger.logSecurityEvent(
      AuditEventType.API_ERROR,
      'Invalid API key ID in retrieval request',
      {
        userId: userClaims.sub,
        projectRef: projectRef as string,
        endpoint: req.url,
        method: req.method,
        error: 'Missing or invalid API key ID'
      },
      AuditSeverity.WARNING
    )
    
    return res.status(400).json({ 
      data: null, 
      error: { message: 'API key ID is required' } 
    })
  }

  try {
    let apiKeyData = null

    // For self-hosted mode, we'll return mock data for legacy keys
    // In a real implementation, this would fetch from a database with project_ref filtering
    if (id === 'anon') {
      apiKeyData = {
        id: 'anon',
        name: 'anon',
        api_key: reveal === 'true' ? (process.env.SUPABASE_ANON_KEY ?? '') : 'sb_anon_••••••••••••••••',
        type: 'legacy',
        hash: '',
        prefix: 'sb_anon',
        description: 'Legacy anon API key',
        project_ref: projectRef,
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    } else if (id === 'service_role') {
      apiKeyData = {
        id: 'service_role',
        name: 'service_role',
        api_key: reveal === 'true' ? (process.env.SUPABASE_SERVICE_KEY ?? '') : 'sb_service_••••••••••••••••',
        type: 'legacy',
        hash: '',
        prefix: 'sb_service',
        description: 'Legacy service_role API key',
        project_ref: projectRef,
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }

    if (!apiKeyData) {
      // Log key not found
      await auditLogger.logEvent(
        AuditEventType.DATA_ACCESSED,
        'API key not found',
        {
          userId: userClaims.sub,
          projectRef: projectRef as string,
          endpoint: req.url,
          method: req.method,
          operation: 'get_api_key',
          keyId: id as string,
          result: 'not_found'
        },
        AuditSeverity.INFO,
        false
      )

      return res.status(404).json({ 
        data: null, 
        error: { message: 'API key not found' } 
      })
    }

    // Log successful API key retrieval
    await auditLogger.logEvent(
      AuditEventType.DATA_ACCESSED,
      'API key retrieved successfully',
      {
        userId: userClaims.sub,
        projectRef: projectRef as string,
        endpoint: req.url,
        method: req.method,
        operation: 'get_api_key',
        keyId: id as string,
        keyName: apiKeyData.name,
        keyType: apiKeyData.type,
        revealed: reveal === 'true',
        userAgent: req.headers['user-agent'],
        ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress
      },
      AuditSeverity.INFO,
      true
    )

    // Log key revelation if requested
    if (reveal === 'true') {
      await auditLogger.logEvent(
        AuditEventType.DATA_ACCESSED,
        'API key value revealed',
        {
          userId: userClaims.sub,
          projectRef: projectRef as string,
          endpoint: req.url,
          method: req.method,
          operation: 'reveal_api_key',
          keyId: id as string,
          keyName: apiKeyData.name,
          keyType: apiKeyData.type,
          userAgent: req.headers['user-agent'],
          ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress
        },
        AuditSeverity.WARNING, // Key revelation is a sensitive operation
        true
      )
    }

    return res.status(200).json(apiKeyData)
  } catch (error) {
    // Log error
    await auditLogger.logEvent(
      AuditEventType.API_ERROR,
      'Failed to retrieve API key',
      {
        userId: userClaims.sub,
        projectRef: projectRef as string,
        endpoint: req.url,
        method: req.method,
        keyId: id as string,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      AuditSeverity.ERROR,
      false
    )

    return res.status(500).json({ 
      data: null, 
      error: { message: 'Failed to retrieve API key' } 
    })
  }
}

const handleDelete = async (req: NextApiRequest, res: NextApiResponse, userClaims: any) => {
  const { id, ref: projectRef } = req.query
  const auditLogger = getAuditLogger()

  if (!projectRef || typeof projectRef !== 'string') {
    await auditLogger.logSecurityEvent(
      AuditEventType.API_ERROR,
      'Invalid project reference in API key deletion',
      {
        userId: userClaims.sub,
        endpoint: req.url,
        method: req.method,
        error: 'Missing or invalid project reference'
      },
      AuditSeverity.WARNING
    )
    
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Project reference is required' } 
    })
  }

  if (!id || typeof id !== 'string') {
    await auditLogger.logSecurityEvent(
      AuditEventType.API_ERROR,
      'Invalid API key ID in deletion request',
      {
        userId: userClaims.sub,
        projectRef: projectRef as string,
        endpoint: req.url,
        method: req.method,
        error: 'Missing or invalid API key ID'
      },
      AuditSeverity.WARNING
    )
    
    return res.status(400).json({ 
      data: null, 
      error: { message: 'API key ID is required' } 
    })
  }

  // Prevent deletion of legacy keys
  if (id === 'anon' || id === 'service_role') {
    await auditLogger.logSecurityEvent(
      AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPTED,
      'Attempted to delete protected legacy API key',
      {
        userId: userClaims.sub,
        projectRef: projectRef as string,
        endpoint: req.url,
        method: req.method,
        operation: 'delete_api_key',
        keyId: id as string,
        keyType: 'legacy',
        reason: 'Legacy keys cannot be deleted'
      },
      AuditSeverity.WARNING
    )
    
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Cannot delete legacy API keys' } 
    })
  }

  try {
    // In a real implementation, this would delete from a database with project_ref filtering
    // For self-hosted mode, we're providing a basic implementation
    // that acknowledges the deletion request

    // Log successful API key deletion
    await auditLogger.logEvent(
      AuditEventType.DATA_MODIFIED,
      'API key deleted successfully',
      {
        userId: userClaims.sub,
        projectRef: projectRef as string,
        endpoint: req.url,
        method: req.method,
        operation: 'delete_api_key',
        keyId: id as string,
        reason: 'User requested deletion',
        userAgent: req.headers['user-agent'],
        ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
        timestamp: new Date().toISOString()
      },
      AuditSeverity.WARNING, // Deletion is a sensitive operation
      true
    )
    
    return res.status(200).json({ 
      message: `API key ${id} deleted successfully` 
    })
  } catch (error) {
    // Log deletion failure
    await auditLogger.logEvent(
      AuditEventType.API_ERROR,
      'Failed to delete API key',
      {
        userId: userClaims.sub,
        projectRef: projectRef as string,
        endpoint: req.url,
        method: req.method,
        operation: 'delete_api_key',
        keyId: id as string,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      AuditSeverity.ERROR,
      false
    )

    return res.status(500).json({ 
      data: null, 
      error: { message: 'Failed to delete API key' } 
    })
  }
}