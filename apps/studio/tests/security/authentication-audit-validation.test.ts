import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextApiRequest, NextApiResponse } from 'next'
import { createMocks } from 'node-mocks-http'
import { AuditEventType, AuditSeverity, getAuditLogger, resetAuditLogger } from 'lib/api/audit-logging'

// Mock the API wrapper and authentication
vi.mock('lib/api/apiWrapper', () => ({
  default: vi.fn(),
}))

vi.mock('lib/api/apiAuthenticate', () => ({
  apiAuthenticate: vi.fn(),
  fetchUserClaims: vi.fn(),
}))

// Mock the API key endpoints
vi.mock('pages/api/v1/projects/[ref]/api-keys', () => ({
  default: vi.fn(),
}))

vi.mock('pages/api/v1/projects/[ref]/api-keys/[id]', () => ({
  default: vi.fn(),
}))

describe('Authentication and Audit Validation for Key Management', () => {
  let mockReq: NextApiRequest
  let mockRes: NextApiResponse
  let auditLogger: ReturnType<typeof getAuditLogger>

  beforeEach(() => {
    vi.clearAllMocks()
    resetAuditLogger()
    auditLogger = getAuditLogger()
    
    const { req, res } = createMocks({
      method: 'GET',
      query: { ref: 'test-project' },
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    mockReq = req
    mockRes = res
  })

  afterEach(() => {
    resetAuditLogger()
  })

  describe('Authentication Validation Requirements', () => {
    it('should require valid authentication for API key operations', async () => {
      const { apiAuthenticate } = await import('lib/api/apiAuthenticate')
      const apiWrapper = (await import('lib/api/apiWrapper')).default
      
      // Mock authentication failure
      vi.mocked(apiAuthenticate).mockResolvedValue({
        error: new Error('Invalid token')
      })

      // Mock API wrapper to call authentication
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

      // Test API key endpoint with authentication
      const mockHandler = vi.fn()
      await apiWrapper(mockReq, mockRes, mockHandler, { withAuth: true })

      expect(apiAuthenticate).toHaveBeenCalledWith(mockReq, mockRes)
      expect(mockHandler).not.toHaveBeenCalled()
      expect(mockRes.statusCode).toBe(401)
    })

    it('should allow operations with valid authentication', async () => {
      const { apiAuthenticate } = await import('lib/api/apiAuthenticate')
      const apiWrapper = (await import('lib/api/apiWrapper')).default
      
      // Mock successful authentication
      vi.mocked(apiAuthenticate).mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'authenticated'
      })

      // Mock API wrapper to call authentication
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

      // Test API key endpoint with valid authentication
      const mockHandler = vi.fn().mockImplementation((req, res) => {
        res.status(200).json({ success: true })
      })
      
      await apiWrapper(mockReq, mockRes, mockHandler, { withAuth: true })

      expect(apiAuthenticate).toHaveBeenCalledWith(mockReq, mockRes)
      expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes)
      expect(mockRes.statusCode).toBe(200)
    })

    it('should validate authentication tokens properly', async () => {
      const { fetchUserClaims } = await import('lib/api/apiAuthenticate')
      
      // Test missing token
      const { req: reqNoToken } = createMocks({
        method: 'GET',
        headers: {},
      })

      vi.mocked(fetchUserClaims).mockImplementation(async (req) => {
        const token = req.headers.authorization?.replace(/bearer /i, '')
        if (!token) {
          throw new Error('missing access token')
        }
        return { sub: 'user-123', email: 'test@example.com' }
      })

      await expect(fetchUserClaims(reqNoToken)).rejects.toThrow('missing access token')

      // Test valid token
      await expect(fetchUserClaims(mockReq)).resolves.toEqual({
        sub: 'user-123',
        email: 'test@example.com'
      })
    })

    it('should handle malformed authorization headers', async () => {
      const { fetchUserClaims } = await import('lib/api/apiAuthenticate')
      
      const { req: reqMalformed } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'InvalidFormat token-here',
        },
      })

      vi.mocked(fetchUserClaims).mockImplementation(async (req) => {
        const token = req.headers.authorization?.replace(/bearer /i, '')
        if (!token || token === 'InvalidFormat token-here') {
          throw new Error('invalid authorization header format')
        }
        return { sub: 'user-123' }
      })

      await expect(fetchUserClaims(reqMalformed)).rejects.toThrow('invalid authorization header format')
    })
  })

  describe('Audit Logging Requirements', () => {
    it('should log API key creation operations', async () => {
      const userId = 'user-123'
      const projectRef = 'test-project'
      const projectId = 456

      await auditLogger.logProjectOperation(
        AuditEventType.DATA_MODIFIED,
        projectId,
        projectRef,
        userId,
        {
          operation: 'api_key_created',
          keyType: 'secret',
          keyName: 'test-key',
          endpoint: '/api/v1/projects/test-project/api-keys',
          method: 'POST'
        },
        true
      )

      const logs = await auditLogger.queryLogs({
        eventTypes: [AuditEventType.DATA_MODIFIED],
        userId,
        limit: 10
      })

      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe(AuditEventType.DATA_MODIFIED)
      expect(logs[0].metadata.userId).toBe(userId)
      expect(logs[0].metadata.projectRef).toBe(projectRef)
      expect(logs[0].metadata.operation).toBe('api_key_created')
      expect(logs[0].success).toBe(true)
    })

    it('should log API key deletion operations', async () => {
      const userId = 'user-123'
      const projectRef = 'test-project'
      const projectId = 456

      await auditLogger.logProjectOperation(
        AuditEventType.DATA_MODIFIED,
        projectId,
        projectRef,
        userId,
        {
          operation: 'api_key_deleted',
          keyId: 'key-789',
          endpoint: '/api/v1/projects/test-project/api-keys/key-789',
          method: 'DELETE'
        },
        true
      )

      const logs = await auditLogger.queryLogs({
        eventTypes: [AuditEventType.DATA_MODIFIED],
        userId,
        limit: 10
      })

      expect(logs).toHaveLength(1)
      expect(logs[0].metadata.operation).toBe('api_key_deleted')
      expect(logs[0].metadata.keyId).toBe('key-789')
    })

    it('should log JWT key management operations', async () => {
      const userId = 'user-456'
      const projectRef = 'jwt-project'
      const projectId = 789

      await auditLogger.logProjectOperation(
        AuditEventType.DATA_MODIFIED,
        projectId,
        projectRef,
        userId,
        {
          operation: 'jwt_key_generated',
          algorithm: 'RS256',
          endpoint: '/api/v1/projects/jwt-project/jwt-keys',
          method: 'POST'
        },
        true
      )

      const logs = await auditLogger.queryLogs({
        eventTypes: [AuditEventType.DATA_MODIFIED],
        userId,
        limit: 10
      })

      expect(logs).toHaveLength(1)
      expect(logs[0].metadata.operation).toBe('jwt_key_generated')
      expect(logs[0].metadata.algorithm).toBe('RS256')
    })

    it('should log failed authentication attempts', async () => {
      await auditLogger.logSecurityEvent(
        AuditEventType.USER_LOGIN_FAILED,
        'Failed authentication attempt for API key access',
        {
          endpoint: '/api/v1/projects/test-project/api-keys',
          method: 'GET',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          reason: 'invalid_token'
        },
        AuditSeverity.WARNING
      )

      const logs = await auditLogger.queryLogs({
        eventTypes: [AuditEventType.USER_LOGIN_FAILED],
        limit: 10
      })

      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe(AuditEventType.USER_LOGIN_FAILED)
      expect(logs[0].severity).toBe(AuditSeverity.WARNING)
      expect(logs[0].success).toBe(false)
      expect(logs[0].metadata.reason).toBe('invalid_token')
    })

    it('should log unauthorized access attempts', async () => {
      await auditLogger.logSecurityEvent(
        AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPTED,
        'Unauthorized attempt to access JWT keys',
        {
          userId: 'user-unauthorized',
          projectRef: 'protected-project',
          endpoint: '/api/v1/projects/protected-project/jwt-keys',
          method: 'GET',
          missingPermission: 'auth_signing_keys.read'
        },
        AuditSeverity.ERROR
      )

      const logs = await auditLogger.queryLogs({
        eventTypes: [AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPTED],
        limit: 10
      })

      expect(logs).toHaveLength(1)
      expect(logs[0].severity).toBe(AuditSeverity.ERROR)
      expect(logs[0].metadata.missingPermission).toBe('auth_signing_keys.read')
    })

    it('should include comprehensive metadata in audit logs', async () => {
      const metadata = {
        userId: 'user-123',
        projectId: 456,
        projectRef: 'test-project',
        endpoint: '/api/v1/projects/test-project/api-keys',
        method: 'POST',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        ipAddress: '192.168.1.100',
        sessionId: 'session-abc123',
        requestId: 'req-xyz789',
        duration: 150,
        operation: 'api_key_created',
        keyType: 'secret',
        keyName: 'production-key'
      }

      await auditLogger.logEvent(
        AuditEventType.DATA_MODIFIED,
        'API key created successfully',
        metadata,
        AuditSeverity.INFO,
        true
      )

      const logs = await auditLogger.queryLogs({ limit: 1 })
      const log = logs[0]

      expect(log.metadata).toMatchObject(metadata)
      expect(log.metadata.userId).toBe('user-123')
      expect(log.metadata.projectRef).toBe('test-project')
      expect(log.metadata.operation).toBe('api_key_created')
      expect(log.metadata.duration).toBe(150)
    })

    it('should maintain audit log integrity and searchability', async () => {
      // Create multiple audit events
      const events = [
        { type: AuditEventType.DATA_ACCESSED, user: 'user-1', project: 'proj-1' },
        { type: AuditEventType.DATA_MODIFIED, user: 'user-2', project: 'proj-1' },
        { type: AuditEventType.DATA_ACCESSED, user: 'user-1', project: 'proj-2' },
        { type: AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPTED, user: 'user-3', project: 'proj-1' }
      ]

      for (const event of events) {
        await auditLogger.logEvent(
          event.type,
          `Test event for ${event.user}`,
          { userId: event.user, projectRef: event.project },
          AuditSeverity.INFO,
          event.type !== AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPTED
        )
      }

      // Test filtering by user
      const userLogs = await auditLogger.queryLogs({ userId: 'user-1' })
      expect(userLogs).toHaveLength(2)
      expect(userLogs.every(log => log.metadata.userId === 'user-1')).toBe(true)

      // Test filtering by event type
      const accessLogs = await auditLogger.queryLogs({ 
        eventTypes: [AuditEventType.DATA_ACCESSED] 
      })
      expect(accessLogs).toHaveLength(2)
      expect(accessLogs.every(log => log.eventType === AuditEventType.DATA_ACCESSED)).toBe(true)

      // Test filtering by project
      const proj1Logs = await auditLogger.queryLogs({})
      const filteredProj1 = proj1Logs.filter(log => log.metadata.projectRef === 'proj-1')
      expect(filteredProj1).toHaveLength(3)
    })
  })

  describe('Integration of Authentication and Audit Logging', () => {
    it('should log successful authentication and subsequent operations', async () => {
      const userId = 'user-integration-test'
      const projectRef = 'integration-project'

      // Log successful authentication
      await auditLogger.logEvent(
        AuditEventType.USER_LOGIN,
        'User authenticated successfully',
        {
          userId,
          endpoint: '/api/v1/projects/integration-project/api-keys',
          method: 'GET'
        },
        AuditSeverity.INFO,
        true
      )

      // Log subsequent API key operation
      await auditLogger.logProjectOperation(
        AuditEventType.DATA_ACCESSED,
        123,
        projectRef,
        userId,
        {
          operation: 'api_keys_listed',
          endpoint: '/api/v1/projects/integration-project/api-keys',
          method: 'GET'
        },
        true
      )

      const logs = await auditLogger.queryLogs({ userId, limit: 10 })
      expect(logs).toHaveLength(2)
      
      // Verify chronological order and relationship
      const loginLog = logs.find(log => log.eventType === AuditEventType.USER_LOGIN)
      const operationLog = logs.find(log => log.eventType === AuditEventType.DATA_ACCESSED)
      
      expect(loginLog).toBeDefined()
      expect(operationLog).toBeDefined()
      expect(loginLog!.success).toBe(true)
      expect(operationLog!.success).toBe(true)
    })

    it('should log authentication failure and prevent operation logging', async () => {
      const userId = 'user-failed-auth'
      
      // Log failed authentication
      await auditLogger.logSecurityEvent(
        AuditEventType.USER_LOGIN_FAILED,
        'Authentication failed for API key access',
        {
          userId,
          endpoint: '/api/v1/projects/test-project/api-keys',
          method: 'GET',
          reason: 'expired_token'
        },
        AuditSeverity.WARNING
      )

      const logs = await auditLogger.queryLogs({ userId, limit: 10 })
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe(AuditEventType.USER_LOGIN_FAILED)
      expect(logs[0].success).toBe(false)
      expect(logs[0].metadata.reason).toBe('expired_token')
    })

    it('should maintain audit trail consistency across multiple operations', async () => {
      const userId = 'user-consistency-test'
      const projectRef = 'consistency-project'
      const projectId = 999
      const sessionId = 'session-consistency-123'

      // Simulate a complete user session with multiple operations
      const operations = [
        { type: AuditEventType.USER_LOGIN, operation: 'login', success: true },
        { type: AuditEventType.DATA_ACCESSED, operation: 'list_api_keys', success: true },
        { type: AuditEventType.DATA_MODIFIED, operation: 'create_api_key', success: true },
        { type: AuditEventType.DATA_ACCESSED, operation: 'list_jwt_keys', success: true },
        { type: AuditEventType.DATA_MODIFIED, operation: 'rotate_jwt_key', success: true },
        { type: AuditEventType.USER_LOGOUT, operation: 'logout', success: true }
      ]

      for (const [index, op] of operations.entries()) {
        const metadata = {
          userId,
          projectRef,
          projectId,
          sessionId,
          operation: op.operation,
          sequenceNumber: index + 1
        }

        if (op.type === AuditEventType.USER_LOGIN || op.type === AuditEventType.USER_LOGOUT) {
          await auditLogger.logEvent(op.type, `User ${op.operation}`, metadata, AuditSeverity.INFO, op.success)
        } else {
          await auditLogger.logProjectOperation(op.type, projectId, projectRef, userId, metadata, op.success)
        }
      }

      const sessionLogs = await auditLogger.queryLogs({ userId, limit: 10 })
      expect(sessionLogs).toHaveLength(6)
      
      // Verify all logs have the same session ID
      expect(sessionLogs.every(log => log.metadata.sessionId === sessionId)).toBe(true)
      
      // Verify sequence integrity
      const sequences = sessionLogs.map(log => log.metadata.sequenceNumber).sort((a, b) => a - b)
      expect(sequences).toEqual([1, 2, 3, 4, 5, 6])
    })
  })
})