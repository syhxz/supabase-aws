import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import { SupavisorConfigPersistence } from 'lib/api/self-hosted/supavisor-config-persistence'
import { SupavisorErrorHandler } from 'lib/api/self-hosted/supavisor-error-handler'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref: projectRef, action } = req.query
    
    if (!projectRef || typeof projectRef !== 'string') {
      return res.status(400).json({ 
        data: null, 
        error: { message: 'Project reference is required' } 
      })
    }

    const persistence = new SupavisorConfigPersistence()

    switch (action) {
      case 'backups':
        const backups = await persistence.listBackups()
        return res.status(200).json({ 
          data: backups.map(backup => ({
            timestamp: backup.timestamp,
            date: new Date(backup.timestamp).toISOString(),
            backupPath: backup.backupPath,
            hasEnvFile: !!backup.originalEnvFile,
            configPreview: {
              poolSize: backup.originalConfig.POOLER_DEFAULT_POOL_SIZE,
              maxClientConnections: backup.originalConfig.POOLER_MAX_CLIENT_CONN,
              tenantId: backup.originalConfig.POOLER_TENANT_ID,
              port: backup.originalConfig.POOLER_PROXY_PORT_TRANSACTION
            }
          }))
        })

      default:
        return res.status(400).json({ 
          data: null, 
          error: { message: 'Invalid action. Supported actions: backups' } 
        })
    }
  } catch (error) {
    const supavisorError = SupavisorErrorHandler.analyzeError(error)
    
    let statusCode = 500
    switch (supavisorError.type) {
      case 'missing-config':
        statusCode = 422
        break
      case 'service-unavailable':
        statusCode = 503
        break
      case 'configuration-invalid':
        statusCode = 400
        break
      case 'permission-denied':
        statusCode = 403
        break
      default:
        statusCode = 500
    }
    
    return res.status(statusCode).json({ 
      data: null, 
      error: { 
        message: SupavisorErrorHandler.getUserFriendlyMessage(supavisorError),
        type: supavisorError.type,
        suggestions: supavisorError.suggestions,
        details: supavisorError.details
      } 
    })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref: projectRef } = req.query
    const { action, ...actionData } = req.body
    
    if (!projectRef || typeof projectRef !== 'string') {
      return res.status(400).json({ 
        data: null, 
        error: { message: 'Project reference is required' } 
      })
    }

    if (!action) {
      return res.status(400).json({ 
        data: null, 
        error: { message: 'Action is required in request body' } 
      })
    }

    const persistence = new SupavisorConfigPersistence()

    switch (action) {
      case 'rollback':
        const { timestamp } = actionData
        
        if (!timestamp || typeof timestamp !== 'number') {
          return res.status(400).json({ 
            data: null, 
            error: { message: 'Backup timestamp is required for rollback' } 
          })
        }

        // Find the backup by timestamp
        const backups = await persistence.listBackups()
        const targetBackup = backups.find(b => b.timestamp === timestamp)
        
        if (!targetBackup) {
          return res.status(404).json({ 
            data: null, 
            error: { message: 'Backup not found with the specified timestamp' } 
          })
        }

        // Perform rollback
        await persistence.rollbackConfiguration(targetBackup)
        
        return res.status(200).json({ 
          data: { 
            success: true,
            message: 'Configuration rolled back successfully',
            rolledBackTo: {
              timestamp: targetBackup.timestamp,
              date: new Date(targetBackup.timestamp).toISOString()
            }
          }
        })

      case 'cleanup':
        const { keepCount = 10 } = actionData
        
        if (typeof keepCount !== 'number' || keepCount < 1) {
          return res.status(400).json({ 
            data: null, 
            error: { message: 'keepCount must be a positive number' } 
          })
        }

        await persistence.cleanupOldBackups(keepCount)
        
        return res.status(200).json({ 
          data: { 
            success: true,
            message: `Old backups cleaned up, keeping ${keepCount} most recent backups`
          }
        })

      default:
        return res.status(400).json({ 
          data: null, 
          error: { message: 'Invalid action. Supported actions: rollback, cleanup' } 
        })
    }
  } catch (error) {
    const supavisorError = SupavisorErrorHandler.analyzeError(error)
    
    let statusCode = 500
    switch (supavisorError.type) {
      case 'missing-config':
        statusCode = 422
        break
      case 'service-unavailable':
        statusCode = 503
        break
      case 'configuration-invalid':
        statusCode = 400
        break
      case 'permission-denied':
        statusCode = 403
        break
      default:
        statusCode = 500
    }
    
    return res.status(statusCode).json({ 
      data: null, 
      error: { 
        message: SupavisorErrorHandler.getUserFriendlyMessage(supavisorError),
        type: supavisorError.type,
        suggestions: supavisorError.suggestions,
        details: supavisorError.details,
        recoverable: SupavisorErrorHandler.isRecoverable(supavisorError)
      } 
    })
  }
}