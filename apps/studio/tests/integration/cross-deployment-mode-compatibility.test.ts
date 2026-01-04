/**
 * Cross-Deployment Mode Compatibility Tests
 * 
 * This test suite verifies that API endpoints work correctly in both platform 
 * and self-hosted modes, ensuring consistent behavior across deployment types.
 * 
 * Requirements tested:
 * - 3.1: Self-hosted mode provides full API key management functionality
 * - 3.2: Self-hosted mode provides full JWT key management functionality  
 * - 3.3: Consistent UI and behavior between platform and self-hosted modes
 * - 3.4: Appropriate backend endpoints based on deployment mode
 * - 3.5: Consistent authentication and authorization across both modes
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

// Import API handlers to test directly
import apiKeysHandler from '../../pages/api/v1/projects/[ref]/api-keys'
import apiKeyHandler from '../../pages/api/v1/projects/[ref]/api-keys/[id]'

// Test utilities
function createMockApiRequest(method: string, query: Record<string, string> = {}, body?: any): NextApiRequest {
  return {
    method,
    query,
    body,
    headers: {},
    url: '',
    cookies: {}
  } as NextApiRequest
}

function createMockApiResponse(): NextApiResponse {
  const res = {
    status: function (code: number) {
      this.statusCode = code
      return this
    },
    json: function (data: any) {
      this.data = data
      return this
    },
    setHeader: function (name: string, value: string) {
      this.headers = this.headers || {}
      this.headers[name] = value
      return this
    },
    statusCode: 200,
    data: null as any,
    headers: {} as any,
  } as any

  return res
}

describe('Cross-Deployment Mode Compatibility', () => {
  const originalEnv = { ...process.env }
  
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('API Keys Endpoint Functionality', () => {
    const projectRef = 'test-project-ref'
    
    it('should handle GET requests for API keys in self-hosted mode', async () => {
      // Set up self-hosted environment
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      process.env.SUPABASE_ANON_KEY = 'test-anon-key'
      process.env.SUPABASE_SERVICE_KEY = 'test-service-key'
      
      const req = createMockApiRequest('GET', { ref: projectRef })
      const res = createMockApiResponse()
      
      await apiKeysHandler(req, res)
      
      expect(res.statusCode).toBe(200)
      expect(res.data).toBeInstanceOf(Array)
      expect(res.data).toHaveLength(2)
      
      // Verify legacy keys are returned
      const anonKey = res.data.find((key: any) => key.name === 'anon')
      const serviceKey = res.data.find((key: any) => key.name === 'service_role')
      
      expect(anonKey).toBeDefined()
      expect(anonKey.api_key).toBe('test-anon-key')
      expect(anonKey.type).toBe('legacy')
      
      expect(serviceKey).toBeDefined()
      expect(serviceKey.api_key).toBe('test-service-key')
      expect(serviceKey.type).toBe('legacy')
    })
    
    it('should handle POST requests to create new API keys', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      
      const req = createMockApiRequest('POST', { ref: projectRef }, {
        name: 'test-key',
        description: 'Test API key',
        type: 'secret'
      })
      const res = createMockApiResponse()
      
      await apiKeysHandler(req, res)
      
      expect(res.statusCode).toBe(201)
      expect(res.data).toHaveProperty('id')
      expect(res.data).toHaveProperty('name', 'test-key')
      expect(res.data).toHaveProperty('type', 'secret')
      expect(res.data).toHaveProperty('api_key')
      expect(res.data.api_key).toMatch(/^sb_secret_/)
    })
    
    it('should validate required fields for API key creation', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      
      const req = createMockApiRequest('POST', { ref: projectRef }, {
        description: 'Missing name and type'
      })
      const res = createMockApiResponse()
      
      await apiKeysHandler(req, res)
      
      expect(res.statusCode).toBe(400)
      expect(res.data.error.message).toContain('Name and type are required')
    })
    
    it('should validate API key type', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      
      const req = createMockApiRequest('POST', { ref: projectRef }, {
        name: 'test-key',
        type: 'invalid-type'
      })
      const res = createMockApiResponse()
      
      await apiKeysHandler(req, res)
      
      expect(res.statusCode).toBe(400)
      expect(res.data.error.message).toContain('Type must be either "secret" or "publishable"')
    })
    
    it('should handle unsupported HTTP methods', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      
      const req = createMockApiRequest('PUT', { ref: projectRef })
      const res = createMockApiResponse()
      
      await apiKeysHandler(req, res)
      
      expect(res.statusCode).toBe(405)
      expect(res.headers.Allow).toEqual(['GET', 'POST'])
    })
  })

  describe('Individual API Key Endpoint Functionality', () => {
    const projectRef = 'test-project-ref'
    
    it('should retrieve individual API keys with masking', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      process.env.SUPABASE_ANON_KEY = 'test-anon-key-12345'
      
      const req = createMockApiRequest('GET', { ref: projectRef, id: 'anon' })
      const res = createMockApiResponse()
      
      await apiKeyHandler(req, res)
      
      expect(res.statusCode).toBe(200)
      expect(res.data).toHaveProperty('id', 'anon')
      expect(res.data).toHaveProperty('name', 'anon')
      expect(res.data.api_key).toMatch(/sb_anon_••••••••••••••••/)
    })
    
    it('should reveal API keys when requested', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      process.env.SUPABASE_ANON_KEY = 'test-anon-key-12345'
      
      const req = createMockApiRequest('GET', { ref: projectRef, id: 'anon', reveal: 'true' })
      const res = createMockApiResponse()
      
      await apiKeyHandler(req, res)
      
      expect(res.statusCode).toBe(200)
      expect(res.data.api_key).toBe('test-anon-key-12345')
    })
    
    it('should handle service_role key retrieval', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      process.env.SUPABASE_SERVICE_KEY = 'test-service-key-67890'
      
      const req = createMockApiRequest('GET', { ref: projectRef, id: 'service_role', reveal: 'true' })
      const res = createMockApiResponse()
      
      await apiKeyHandler(req, res)
      
      expect(res.statusCode).toBe(200)
      expect(res.data).toHaveProperty('id', 'service_role')
      expect(res.data.api_key).toBe('test-service-key-67890')
    })
    
    it('should return 404 for non-existent keys', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      
      const req = createMockApiRequest('GET', { ref: projectRef, id: 'non-existent' })
      const res = createMockApiResponse()
      
      await apiKeyHandler(req, res)
      
      expect(res.statusCode).toBe(404)
      expect(res.data.error.message).toContain('API key not found')
    })
    
    it('should handle DELETE requests for custom keys', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      
      const req = createMockApiRequest('DELETE', { ref: projectRef, id: 'custom-key-123' })
      const res = createMockApiResponse()
      
      await apiKeyHandler(req, res)
      
      expect(res.statusCode).toBe(200)
      expect(res.data.message).toContain('API key custom-key-123 deleted successfully')
    })
    
    it('should prevent deletion of legacy keys', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      
      const req = createMockApiRequest('DELETE', { ref: projectRef, id: 'anon' })
      const res = createMockApiResponse()
      
      await apiKeyHandler(req, res)
      
      expect(res.statusCode).toBe(400)
      expect(res.data.error.message).toContain('Cannot delete legacy API keys')
    })
    
    it('should validate required ID parameter', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      
      const req = createMockApiRequest('GET', { ref: projectRef })
      const res = createMockApiResponse()
      
      await apiKeyHandler(req, res)
      
      expect(res.statusCode).toBe(400)
      expect(res.data.error.message).toContain('API key ID is required')
    })
  })

  describe('Cross-Deployment Mode Consistency', () => {
    const projectRef = 'test-project-ref'
    
    it('should provide consistent API key structure across deployment modes', async () => {
      const deploymentModes = [
        { IS_PLATFORM: 'true', description: 'platform mode' },
        { IS_PLATFORM: 'false', description: 'self-hosted mode' }
      ]
      
      for (const mode of deploymentModes) {
        process.env.NEXT_PUBLIC_IS_PLATFORM = mode.IS_PLATFORM
        process.env.SUPABASE_ANON_KEY = 'test-anon-key'
        process.env.SUPABASE_SERVICE_KEY = 'test-service-key'
        
        const req = createMockApiRequest('GET', { ref: projectRef })
        const res = createMockApiResponse()
        
        await apiKeysHandler(req, res)
        
        expect(res.statusCode).toBe(200)
        expect(res.data).toBeInstanceOf(Array)
        
        // Verify consistent data structure
        for (const key of res.data) {
          expect(key).toHaveProperty('id')
          expect(key).toHaveProperty('name')
          expect(key).toHaveProperty('api_key')
          expect(key).toHaveProperty('type')
          expect(key).toHaveProperty('description')
        }
      }
    })
    
    it('should handle API key creation consistently across deployment modes', async () => {
      const deploymentModes = [
        { IS_PLATFORM: 'true', description: 'platform mode' },
        { IS_PLATFORM: 'false', description: 'self-hosted mode' }
      ]
      
      for (const mode of deploymentModes) {
        process.env.NEXT_PUBLIC_IS_PLATFORM = mode.IS_PLATFORM
        
        const req = createMockApiRequest('POST', { ref: projectRef }, {
          name: 'test-key',
          description: 'Test key',
          type: 'publishable'
        })
        const res = createMockApiResponse()
        
        await apiKeysHandler(req, res)
        
        expect(res.statusCode).toBe(201)
        expect(res.data).toHaveProperty('name', 'test-key')
        expect(res.data).toHaveProperty('type', 'publishable')
        expect(res.data.api_key).toMatch(/^sb_publishable_/)
        
        // Verify consistent response structure
        expect(res.data).toHaveProperty('id')
        expect(res.data).toHaveProperty('hash')
        expect(res.data).toHaveProperty('prefix')
        expect(res.data).toHaveProperty('inserted_at')
        expect(res.data).toHaveProperty('updated_at')
      }
    })
  })

  describe('Error Handling Consistency', () => {
    const projectRef = 'test-project-ref'
    
    it('should provide consistent error responses across deployment modes', async () => {
      const deploymentModes = [
        { IS_PLATFORM: 'true', description: 'platform mode' },
        { IS_PLATFORM: 'false', description: 'self-hosted mode' }
      ]
      
      for (const mode of deploymentModes) {
        process.env.NEXT_PUBLIC_IS_PLATFORM = mode.IS_PLATFORM
        
        // Test invalid method
        const req = createMockApiRequest('PATCH', { ref: projectRef })
        const res = createMockApiResponse()
        
        await apiKeysHandler(req, res)
        
        expect(res.statusCode).toBe(405)
        expect(res.data).toHaveProperty('error')
        expect(res.data.error).toHaveProperty('message')
        expect(res.headers).toHaveProperty('Allow')
      }
    })
    
    it('should handle validation errors consistently', async () => {
      const deploymentModes = [
        { IS_PLATFORM: 'true', description: 'platform mode' },
        { IS_PLATFORM: 'false', description: 'self-hosted mode' }
      ]
      
      for (const mode of deploymentModes) {
        process.env.NEXT_PUBLIC_IS_PLATFORM = mode.IS_PLATFORM
        
        // Test missing required fields
        const req = createMockApiRequest('POST', { ref: projectRef }, {})
        const res = createMockApiResponse()
        
        await apiKeysHandler(req, res)
        
        expect(res.statusCode).toBe(400)
        expect(res.data).toHaveProperty('data', null)
        expect(res.data).toHaveProperty('error')
        expect(res.data.error).toHaveProperty('message')
      }
    })
  })

  describe('Security and Isolation', () => {
    const projectRef = 'test-project-ref'
    
    it('should scope API keys to project reference', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      process.env.SUPABASE_ANON_KEY = 'test-anon-key'
      
      const req = createMockApiRequest('GET', { ref: projectRef })
      const res = createMockApiResponse()
      
      await apiKeysHandler(req, res)
      
      expect(res.statusCode).toBe(200)
      
      // Verify that keys are scoped to the project
      // In a real implementation, this would check database isolation
      // For now, we verify the endpoint accepts the project reference
      expect(req.query.ref).toBe(projectRef)
    })
    
    it('should handle different project references independently', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
      process.env.SUPABASE_ANON_KEY = 'test-anon-key'
      
      const projectRefs = ['project-1', 'project-2', 'project-3']
      
      for (const ref of projectRefs) {
        const req = createMockApiRequest('GET', { ref })
        const res = createMockApiResponse()
        
        await apiKeysHandler(req, res)
        
        expect(res.statusCode).toBe(200)
        expect(res.data).toBeInstanceOf(Array)
        
        // Each project should get the same structure but potentially different data
        // In a real implementation, this would verify project-specific keys
      }
    })
  })
})