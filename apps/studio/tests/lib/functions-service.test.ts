/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  FunctionsServiceAdapter,
  getFunctionsServiceAdapter,
  resetFunctionsServiceAdapter,
} from '../../lib/functions-service'
import * as fs from 'fs/promises'
import * as path from 'path'

describe('FunctionsServiceAdapter', () => {
  let adapter: FunctionsServiceAdapter
  const testProjectRef = 'test-project-functions'
  const testBasePath = '/tmp/test-functions'

  beforeEach(() => {
    // Set test base path
    process.env.FUNCTIONS_BASE_PATH = testBasePath
    resetFunctionsServiceAdapter()
    adapter = getFunctionsServiceAdapter()
  })

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(testBasePath, { recursive: true, force: true })
    } catch (error) {
      // Ignore errors
    }
    resetFunctionsServiceAdapter()
  })

  describe('createProjectDirectories', () => {
    it('should create project directory', async () => {
      await adapter.createProjectDirectories(testProjectRef)

      const projectPath = path.join(testBasePath, testProjectRef)
      const stats = await fs.stat(projectPath)
      expect(stats.isDirectory()).toBe(true)
    })

    it('should not fail if directory already exists', async () => {
      await adapter.createProjectDirectories(testProjectRef)
      await adapter.createProjectDirectories(testProjectRef)

      const projectPath = path.join(testBasePath, testProjectRef)
      const stats = await fs.stat(projectPath)
      expect(stats.isDirectory()).toBe(true)
    })
  })

  describe('deployFunction', () => {
    beforeEach(async () => {
      await adapter.createProjectDirectories(testProjectRef)
    })

    it('should deploy a new function', async () => {
      const functionCode = `
        export default async function handler(req) {
          return new Response('Hello World!', {
            headers: { 'Content-Type': 'text/plain' }
          })
        }
      `

      const metadata = await adapter.deployFunction(
        testProjectRef,
        'hello-world',
        functionCode,
        { entrypoint: 'handler', version: '1.0.0' }
      )

      expect(metadata.name).toBe('hello-world')
      expect(metadata.project_ref).toBe(testProjectRef)
      expect(metadata.version).toBe('1.0.0')
      expect(metadata.status).toBe('active')
    })

    it('should reject invalid function names', async () => {
      const functionCode = 'export default async function handler(req) { return "test" }'

      await expect(
        adapter.deployFunction(testProjectRef, 'Invalid Name', functionCode)
      ).rejects.toThrow('Function name must start and end with alphanumeric characters')
    })

    it('should reject empty function code', async () => {
      await expect(
        adapter.deployFunction(testProjectRef, 'test-function', '')
      ).rejects.toThrow('Function code is required')
    })

    it('should update existing function', async () => {
      const functionCode1 = 'export default async function handler(req) { return "v1" }'
      const functionCode2 = 'export default async function handler(req) { return "v2" }'

      const metadata1 = await adapter.deployFunction(
        testProjectRef,
        'test-function',
        functionCode1,
        { version: '1.0.0' }
      )

      const metadata2 = await adapter.deployFunction(
        testProjectRef,
        'test-function',
        functionCode2,
        { version: '2.0.0' }
      )

      expect(metadata2.id).toBe(metadata1.id)
      expect(metadata2.version).toBe('2.0.0')
      expect(metadata2.created_at).toBe(metadata1.created_at)
      expect(metadata2.updated_at).not.toBe(metadata1.updated_at)
    })
  })

  describe('listFunctions', () => {
    beforeEach(async () => {
      await adapter.createProjectDirectories(testProjectRef)
    })

    it('should return empty array for project with no functions', async () => {
      const functions = await adapter.listFunctions(testProjectRef)
      expect(functions).toEqual([])
    })

    it('should list all functions in a project', async () => {
      const functionCode = 'export default async function handler(req) { return "test" }'

      await adapter.deployFunction(testProjectRef, 'function-a', functionCode)
      await adapter.deployFunction(testProjectRef, 'function-b', functionCode)
      await adapter.deployFunction(testProjectRef, 'function-c', functionCode)

      const functions = await adapter.listFunctions(testProjectRef)

      expect(functions).toHaveLength(3)
      expect(functions.map((f) => f.name).sort()).toEqual([
        'function-a',
        'function-b',
        'function-c',
      ])
    })
  })

  describe('deleteFunction', () => {
    beforeEach(async () => {
      await adapter.createProjectDirectories(testProjectRef)
    })

    it('should delete a function', async () => {
      const functionCode = 'export default async function handler(req) { return "test" }'

      await adapter.deployFunction(testProjectRef, 'test-function', functionCode)

      let functions = await adapter.listFunctions(testProjectRef)
      expect(functions).toHaveLength(1)

      await adapter.deleteFunction(testProjectRef, 'test-function')

      functions = await adapter.listFunctions(testProjectRef)
      expect(functions).toHaveLength(0)
    })

    it('should throw error if function does not exist', async () => {
      await expect(
        adapter.deleteFunction(testProjectRef, 'non-existent')
      ).rejects.toThrow("Function 'non-existent' not found")
    })
  })

  describe('setEnvVar', () => {
    beforeEach(async () => {
      await adapter.createProjectDirectories(testProjectRef)
      const functionCode = 'export default async function handler(req) { return "test" }'
      await adapter.deployFunction(testProjectRef, 'test-function', functionCode)
    })

    it('should set an environment variable', async () => {
      await adapter.setEnvVar(testProjectRef, 'test-function', 'API_KEY', 'secret-key')

      const value = await adapter.getEnvVar(testProjectRef, 'test-function', 'API_KEY')
      expect(value).toBe('secret-key')
    })

    it('should reject invalid environment variable keys', async () => {
      await expect(
        adapter.setEnvVar(testProjectRef, 'test-function', 'invalid-key', 'value')
      ).rejects.toThrow('Environment variable key must contain only uppercase letters')
    })

    it('should update existing environment variable', async () => {
      await adapter.setEnvVar(testProjectRef, 'test-function', 'API_KEY', 'old-value')
      await adapter.setEnvVar(testProjectRef, 'test-function', 'API_KEY', 'new-value')

      const value = await adapter.getEnvVar(testProjectRef, 'test-function', 'API_KEY')
      expect(value).toBe('new-value')
    })
  })

  describe('listEnvVars', () => {
    beforeEach(async () => {
      await adapter.createProjectDirectories(testProjectRef)
      const functionCode = 'export default async function handler(req) { return "test" }'
      await adapter.deployFunction(testProjectRef, 'test-function', functionCode)
    })

    it('should return empty object for function with no env vars', async () => {
      const envVars = await adapter.listEnvVars(testProjectRef, 'test-function')
      expect(envVars).toEqual({})
    })

    it('should list all environment variables', async () => {
      await adapter.setEnvVar(testProjectRef, 'test-function', 'API_KEY', 'key1')
      await adapter.setEnvVar(testProjectRef, 'test-function', 'DATABASE_URL', 'postgres://...')
      await adapter.setEnvVar(testProjectRef, 'test-function', 'DEBUG', 'true')

      const envVars = await adapter.listEnvVars(testProjectRef, 'test-function')

      expect(envVars).toEqual({
        API_KEY: 'key1',
        DATABASE_URL: 'postgres://...',
        DEBUG: 'true',
      })
    })
  })

  describe('deleteEnvVar', () => {
    beforeEach(async () => {
      await adapter.createProjectDirectories(testProjectRef)
      const functionCode = 'export default async function handler(req) { return "test" }'
      await adapter.deployFunction(testProjectRef, 'test-function', functionCode)
    })

    it('should delete an environment variable', async () => {
      await adapter.setEnvVar(testProjectRef, 'test-function', 'API_KEY', 'secret')
      await adapter.setEnvVar(testProjectRef, 'test-function', 'DEBUG', 'true')

      await adapter.deleteEnvVar(testProjectRef, 'test-function', 'API_KEY')

      const envVars = await adapter.listEnvVars(testProjectRef, 'test-function')
      expect(envVars).toEqual({ DEBUG: 'true' })
    })

    it('should throw error if env var does not exist', async () => {
      await expect(
        adapter.deleteEnvVar(testProjectRef, 'test-function', 'NON_EXISTENT')
      ).rejects.toThrow("Environment variable 'NON_EXISTENT' not found")
    })
  })

  describe('getFunctionCode', () => {
    beforeEach(async () => {
      await adapter.createProjectDirectories(testProjectRef)
    })

    it('should retrieve function code', async () => {
      const functionCode = 'export default async function handler(req) { return "test" }'

      await adapter.deployFunction(testProjectRef, 'test-function', functionCode)

      const retrievedCode = await adapter.getFunctionCode(testProjectRef, 'test-function')
      expect(retrievedCode).toBe(functionCode)
    })

    it('should throw error if function does not exist', async () => {
      await expect(
        adapter.getFunctionCode(testProjectRef, 'non-existent')
      ).rejects.toThrow("Function 'non-existent' not found")
    })
  })

  describe('functionExists', () => {
    beforeEach(async () => {
      await adapter.createProjectDirectories(testProjectRef)
    })

    it('should return true for existing function', async () => {
      const functionCode = 'export default async function handler(req) { return "test" }'
      await adapter.deployFunction(testProjectRef, 'test-function', functionCode)

      const exists = await adapter.functionExists(testProjectRef, 'test-function')
      expect(exists).toBe(true)
    })

    it('should return false for non-existent function', async () => {
      const exists = await adapter.functionExists(testProjectRef, 'non-existent')
      expect(exists).toBe(false)
    })
  })
})
