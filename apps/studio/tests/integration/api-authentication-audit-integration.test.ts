import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextApiRequest, NextApiResponse } from 'next'
import { createMocks } from 'node-mocks-http'
import { getAuditLogger, resetAuditLogger, AuditEventType, AuditSeverity } from 'lib/api/audit-logging'

// Mock the API endpoints
vi.mock('pages/api/v1/projects/[ref]/api-keys', async () => {
  const actual = await vi.importActual('pages/api/v1/projects/[ref]/api-keys')
  return {
    ...actual,
    default: vi.fn(),
  }
})

vi.mock('pages/api/v1/projects/[ref]/api-keys/[id]', async () => {
  const actual = await vi.importActual('pages/api/v1/projects/[ref]/api-keys/[id]')
  return {
    ...actual,
    default: vi.fn(),
  }
})

// Mock authentication
vi.mock('lib/api/apiAuthenticate', () => ({
  apiAuthenticate: vi.fn(),
  fetchUserClaims: vi.fn(),
}))

// Mock API wrapper
vi.mock('lib/api/apiWrapper', () => ({
  default: vi.fn(),
}))

describe('API Authentication and Audit Integration Tests', () => {
  let auditLogger: ReturnType<typeof getAuditLogger>

  beforeEach(() => {
    vi.clearAllMocks()
    resetAuditLogger()
    auditLogger = getAuditLogger()
  })

  afterEach(() => {
    resetAuditLogger()
  })

  describe('API Key Endpoint Authentication and Audit Integration', () => {
    it('should authenticate and audit API key listing operations', async () => {
      const { apiAuthenticate } = await import('lib/api/apiAuthenticate')
      const apiWrapper = (await import('lib/api/apiWrapper')).default
      const apiKeysHandler = (await import('pages/api/v1/projects/[ref]/api-keys')).default

      // Mock successful authentication
      const mockUser = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'authenticated'
      }
      vi.mocked(apiAuthenticate).mockResolvedValue(mockUser)

      // Mock API wrapper to handle authentication and call handler
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler, options) => {
        if (options?.withAuth) {
          const authResult = await apiAuthenticate(req, res)
          if ('error' in authResult) {
            await auditLogger.logSecurityEvent(
              AuditEventType.USER_LOGIN_FAILED,
              'Authentication failed for API key access',
              {
                endpoint: req.url,
                method: req.method,
                reason: authResult.error.message
              },
              AuditSeverity.WARNING
            )
            return res.status(401).json({
              error: { message: `Unauthorized: ${authResult.error.message}` }
            })
          }

          // Log successful authentication
          await auditLogger.logEvent(
            AuditEventType.USER_LOGIN,
            'User authenticated for API key access',
            {
              userId: authResult.sub,
              endpoint: req.url,
              method: req.method
            },
            AuditSeverity.INFO,
            true
          )
        }
        return handler(req, res)
      })

      // Mock the API keys handler
      vi.mocked(apiKeysHandler).mockImplementation(async (req, res) => {
        // Log the API operation
        await auditLogger.logEvent(
          AuditEventType.DATA_ACCESSED,
          'API keys listed',
          {
            userId: 'user-123',
            projectRef: req.query.ref as string,
            endpoint: req.url,
            method: req.method,
            operation: 'list_api_keys'
          },
          AuditSeverity.INFO,
          true
        )

        res.status(200).json([
          {
            id: 'anon',
            name: 'anon',
            api_key: 'test-anon-key',
            type: 'legacy'
          }
        ])
      })

      // Create request
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/v1/projects/test-project/api-keys',
        query: { ref: 'test-project' },
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      // Execute the request through the wrapper
      await apiWrapper(req, res, apiKeysHandler, { withAuth: true })

      // Verify authentication was called
      expect(apiAuthenticate).toHaveBeenCalledWith(req, res)

      // Verify response
      expect(res.statusCode).toBe(200)

      // Verify audit logs
      const logs = await auditLogger.queryLogs({ limit: 10 })
      expect(logs).toHaveLength(2)

      const authLog = logs.find(log => log.eventType === AuditEventType.USER_LOGIN)
      const operationLog = logs.find(log => log.eventType === AuditEventType.DATA_ACCESSED)

      expect(authLog).toBeDefined()
      expect(authLog!.success).toBe(true)
      expect(authLog!.metadata.userId).toBe('user-123')

      expect(operationLog).toBeDefined()
      expect(operationLog!.success).toBe(true)
      expect(operationLog!.metadata.operation).toBe('list_api_keys')
    })

    it('should handle authentication failure and audit the attempt', async () => {
      const { apiAuthenticate } = await import('lib/api/apiAuthenticate')
      const apiWrapper = (await import('lib/api/apiWrapper')).default
      const apiKeysHandler = (await import('pages/api/v1/projects/[ref]/api-keys')).default

      // Mock authentication failure
      vi.mocked(apiAuthenticate).mockResolvedValue({
        error: new Error('Invalid token')
      })

      // Mock API wrapper to handle authentication failure
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler, options) => {
        if (options?.withAuth) {
          const authResult = await apiAuthenticate(req, res)
          if ('error' in authResult) {
            await auditLogger.logSecurityEvent(
              AuditEventType.USER_LOGIN_FAILED,
              'Authentication failed for API key access',
              {
                endpoint: req.url,
                method: req.method,
                reason: authResult.error.message
              },
              AuditSeverity.WARNING
            )
            return res.status(401).json({
              error: { message: `Unauthorized: ${authResult.error.message}` }
            })
          }
        }
        return handler(req, res)
      })

      // Create request with invalid token
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/v1/projects/test-project/api-keys',
        query: { ref: 'test-project' },
        headers: {
          authorization: 'Bearer invalid-token',
        },
      })

      // Execute the request
      await apiWrapper(req, res, apiKeysHandler, { withAuth: true })

      // Verify authentication was called
      expect(apiAuthenticate).toHaveBeenCalledWith(req, res)

      // Verify unauthorized response
      expect(res.statusCode).toBe(401)

      // Verify audit log for failed authentication
      const logs = await auditLogger.queryLogs({ limit: 10 })
      expect(logs).toHaveLength(1)

      const failureLog = logs[0]
      expect(failureLog.eventType).toBe(AuditEventType.USER_LOGIN_FAILED)
      expect(failureLog.success).toBe(false)
      expect(failureLog.severity).toBe(AuditSeverity.WARNING)
      expect(failureLog.metadata.reason).toBe('Invalid token')
    })

    it('should audit API key creation with full context', async () => {
      const { apiAuthenticate } = await import('lib/api/apiAuthenticate')
      const apiWrapper = (await import('lib/api/apiWrapper')).default
      const apiKeysHandler = (await import('pages/api/v1/projects/[ref]/api-keys')).default

      // Mock successful authentication
      const mockUser = {
        sub: 'user-456',
        email: 'admin@example.com',
        role: 'authenticated'
      }
      vi.mocked(apiAuthenticate).mockResolvedValue(mockUser)

      // Mock API wrapper
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler, options) => {
        if (options?.withAuth) {
          const authResult = await apiAuthenticate(req, res)
          if ('error' in authResult) {
            return res.status(401).json({
              error: { message: `Unauthorized: ${authResult.error.message}` }
            })
          }

          await auditLogger.logEvent(
            AuditEventType.USER_LOGIN,
            'User authenticated for API key creation',
            {
              userId: authResult.sub,
              endpoint: req.url,
              method: req.method
            },
            AuditSeverity.INFO,
            true
          )
        }
        return handler(req, res)
      })

      // Mock the API keys handler for POST (create)
      vi.mocked(apiKeysHandler).mockImplementation(async (req, res) => {
        if (req.method === 'POST') {
          const { name, type, description } = req.body

          // Log the creation operation with comprehensive metadata
          await auditLogger.logEvent(
            AuditEventType.DATA_MODIFIED,
            'API key created',
            {
              userId: 'user-456',
              projectRef: req.query.ref as string,
              endpoint: req.url,
              method: req.method,
              operation: 'create_api_key',
              keyName: name,
              keyType: type,
              keyDescription: description,
              userAgent: req.headers['user-agent'],
              ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress
            },
            AuditSeverity.INFO,
            true
          )

          res.status(201).json({
            id: 'new-key-123',
            name,
            type,
            description,
            api_key: 'sb_secret_generated_key',
            created_at: new Date().toISOString()
          })
        }
      })

      // Create POST request for API key creation
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/v1/projects/production-project/api-keys',
        query: { ref: 'production-project' },
        headers: {
          authorization: 'Bearer valid-admin-token',
          'user-agent': 'Mozilla/5.0 (Admin Browser)',
          'x-forwarded-for': '10.0.0.100'
        },
        body: {
          name: 'Production API Key',
          type: 'secret',
          description: 'Key for production environment'
        }
      })

      // Execute the request
      await apiWrapper(req, res, apiKeysHandler, { withAuth: true })

      // Verify successful creation
      expect(res.statusCode).toBe(201)

      // Verify comprehensive audit logging
      const logs = await auditLogger.queryLogs({ limit: 10 })
      expect(logs).toHaveLength(2)

      const creationLog = logs.find(log => log.eventType === AuditEventType.DATA_MODIFIED)
      expect(creationLog).toBeDefined()
      expect(creationLog!.success).toBe(true)
      expect(creationLog!.metadata.operation).toBe('create_api_key')
      expect(creationLog!.metadata.keyName).toBe('Production API Key')
      expect(creationLog!.metadata.keyType).toBe('secret')
      expect(creationLog!.metadata.keyDescription).toBe('Key for production environment')
      expect(creationLog!.metadata.userAgent).toBe('Mozilla/5.0 (Admin Browser)')
      expect(creationLog!.metadata.ipAddress).toBe('10.0.0.100')
      expect(creationLog!.metadata.projectRef).toBe('production-project')
    })

    it('should audit API key deletion operations', async () => {
      const { apiAuthenticate } = await import('lib/api/apiAuthenticate')
      const apiWrapper = (await import('lib/api/apiWrapper')).default
      const apiKeyByIdHandler = (await import('pages/api/v1/projects/[ref]/api-keys/[id]')).default

      // Mock successful authentication
      const mockUser = {
        sub: 'user-789',
        email: 'manager@example.com',
        role: 'authenticated'
      }
      vi.mocked(apiAuthenticate).mockResolvedValue(mockUser)

      // Mock API wrapper
      vi.mocked(apiWrapper).mockImplementation(async (req, res, handler, options) => {
        if (options?.withAuth) {
          const authResult = await apiAuthenticate(req, res)
          if ('error' in authResult) {
            return res.status(401).json({
              error: { message: `Unauthorized: ${authResult.error.message}` }
            })
          }
        }
        return handler(req, res)
      })

      // Mock the API key by ID handler for DELETE
      vi.mocked(apiKeyByIdHandler).mockImplementation(async (req, res) => {
        if (req.method === 'DELETE') {
          const keyId = req.query.id as string

          // Log the deletion operation
          await auditLogger.logEvent(
            AuditEventType.DATA_MODIFIED,
            'API key deleted',
            {
              userId: 'user-789',
              projectRef: req.query.ref as string,
              endpoint: req.url,
              method: req.method,
              operation: 'delete_api_key',
              keyId,
              reason: 'User requested deletion'
            },
            AuditSeverity.WARNING, // Deletion is a sensitive operation
            true
          )

          res.status(200).json({ message: 'API key deleted successfully' })
        }
      })

      // Create DELETE request
      const { req, res } = createMocks({
        method: 'DELETE',
        url: '/api/v1/projects/test-project/api-keys/key-to-delete',
        query: { 
          ref: 'test-project',
          id: 'key-to-delete'
        },
        headers: {
          authorization: 'Bearer valid-manager-token',
        },
      })

      // Execute the request
      await apiWrapper(req, res, apiKeyByIdHandler, { withAuth: true })

      // Verify successful deletion
      expect(res.statusCode).toBe(200)

      // Verify audit logging
      const logs = await auditLogger.queryLogs({ 
        eventTypes: [AuditEventType.DATA_MODIFIED],
        limit: 10 
      })
      expect(logs).toHaveLength(1)

      const deletionLog = logs[0]
      expect(deletionLog.eventType).toBe(AuditEventType.DATA_MODIFIED)
      expect(deletionLog.success).toBe(true)
      expect(deletionLog.severity).toBe(AuditSeverity.WARNING)
      expect(deletionLog.metadata.operation).toBe('delete_api_key')
      expect(deletionLog.metadata.keyId).toBe('key-to-delete')
      expect(deletionLog.metadata.userId).toBe('user-789')
    })
  })

  describe('JWT Key Endpoint Authentication and Audit Integration', () => {
    it('should audit JWT key generation operations', async () => {
      // Mock JWT key endpoint (would be similar to API keys)
      const mockJwtHandler = vi.fn().mockImplementation(async (req, res) => {
        if (req.method === 'POST') {
          // Log JWT key generation
          await auditLogger.logEvent(
            AuditEventType.DATA_MODIFIED,
            'JWT signing key generated',
            {
              userId: 'user-jwt-admin',
              projectRef: req.query.ref as string,
              endpoint: req.url,
              method: req.method,
              operation: 'generate_jwt_key',
              algorithm: 'RS256',
              keyPurpose: 'token_signing'
            },
            AuditSeverity.INFO,
            true
          )

          res.status(201).json({
            id: 'jwt-key-123',
            algorithm: 'RS256',
            created_at: new Date().toISOString(),
            status: 'active'
          })
        }
      })

      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/v1/projects/jwt-project/jwt-keys',
        query: { ref: 'jwt-project' },
        headers: {
          authorization: 'Bearer valid-jwt-admin-token',
        },
        body: {
          algorithm: 'RS256'
        }
      })

      await mockJwtHandler(req, res)

      expect(res.statusCode).toBe(201)

      const logs = await auditLogger.queryLogs({ limit: 10 })
      expect(logs).toHaveLength(1)

      const jwtLog = logs[0]
      expect(jwtLog.eventType).toBe(AuditEventType.DATA_MODIFIED)
      expect(jwtLog.metadata.operation).toBe('generate_jwt_key')
      expect(jwtLog.metadata.algorithm).toBe('RS256')
    })
  })

  describe('Cross-Operation Audit Trail', () => {
    it('should maintain consistent audit trail across multiple key operations', async () => {
      const sessionId = 'session-multi-ops-123'
      const userId = 'user-multi-ops'
      const projectRef = 'multi-ops-project'

      // Simulate a sequence of operations in a user session
      const operations = [
        { type: AuditEventType.USER_LOGIN, operation: 'login' },
        { type: AuditEventType.DATA_ACCESSED, operation: 'list_api_keys' },
        { type: AuditEventType.DATA_MODIFIED, operation: 'create_api_key' },
        { type: AuditEventType.DATA_ACCESSED, operation: 'list_jwt_keys' },
        { type: AuditEventType.DATA_MODIFIED, operation: 'rotate_jwt_key' },
        { type: AuditEventType.DATA_MODIFIED, operation: 'delete_api_key' },
        { type: AuditEventType.USER_LOGOUT, operation: 'logout' }
      ]

      for (const [index, op] of operations.entries()) {
        await auditLogger.logEvent(
          op.type,
          `User performed ${op.operation}`,
          {
            userId,
            projectRef,
            sessionId,
            operation: op.operation,
            sequenceNumber: index + 1,
            timestamp: new Date(Date.now() + index * 1000).toISOString()
          },
          AuditSeverity.INFO,
          true
        )
      }

      // Verify complete audit trail
      const sessionLogs = await auditLogger.queryLogs({ 
        userId,
        limit: 10 
      })

      expect(sessionLogs).toHaveLength(7)
      
      // Verify all logs have the same session ID
      expect(sessionLogs.every(log => log.metadata.sessionId === sessionId)).toBe(true)
      
      // Verify sequence integrity
      const sequences = sessionLogs
        .map(log => log.metadata.sequenceNumber)
        .sort((a, b) => a - b)
      expect(sequences).toEqual([1, 2, 3, 4, 5, 6, 7])

      // Verify operation types are correct
      const operationTypes = sessionLogs.map(log => log.metadata.operation)
      expect(operationTypes).toContain('login')
      expect(operationTypes).toContain('create_api_key')
      expect(operationTypes).toContain('rotate_jwt_key')
      expect(operationTypes).toContain('logout')
    })
  })
})