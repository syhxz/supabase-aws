/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { getConnectionStrings, generateEnhancedConnectionStrings, constructConnStringSyntax, validateAndFormatUsername, getUsernameForPermissionLevel, validateConnectionStringFormat, validateParameterSubstitution } from './DatabaseSettings.utils'

describe('DatabaseSettings.utils', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getConnectionStrings', () => {
    it('should generate connection strings with proper parameter substitution', () => {
      // Set up environment variables
      process.env.POSTGRES_HOST = 'test-host'
      process.env.POSTGRES_PORT = '5433'
      process.env.POSTGRES_USER_READ_WRITE = 'test-user'
      process.env.POSTGRES_DB = 'test-db'

      const connectionInfo = {
        db_user: 'actual-user',
        db_port: 5432,
        db_host: 'actual-host',
        db_name: 'actual-db',
      }

      const result = getConnectionStrings({
        connectionInfo,
        metadata: { projectRef: 'test-ref' },
      })

      // Check that actual values are used instead of placeholders
      expect(result.direct.uri).toContain('actual-user')
      expect(result.direct.uri).toContain('actual-host')
      expect(result.direct.uri).toContain('5432')
      expect(result.direct.uri).toContain('actual-db')
      expect(result.direct.uri).toMatch(/^postgresql:\/\//)
    })

    it('should fall back to environment variables when connection info is missing', () => {
      // Set up environment variables
      process.env.POSTGRES_HOST = 'env-host'
      process.env.POSTGRES_PORT = '5433'
      process.env.POSTGRES_USER_READ_WRITE = 'env-user'
      process.env.POSTGRES_DB = 'env-db'

      const connectionInfo = {
        db_user: '',
        db_port: 0,
        db_host: '',
        db_name: '',
      }

      const result = getConnectionStrings({
        connectionInfo,
        metadata: { projectRef: 'test-ref' },
      })

      // Check that environment values are used as fallback
      expect(result.direct.uri).toContain('env-user')
      expect(result.direct.uri).toContain('env-host')
      expect(result.direct.uri).toContain('5433')
      expect(result.direct.uri).toContain('env-db')
    })

    it('should handle port number correctly', () => {
      const connectionInfo = {
        db_user: 'test-user',
        db_port: 5433,
        db_host: 'test-host',
        db_name: 'test-db',
      }

      const result = getConnectionStrings({
        connectionInfo,
        metadata: { projectRef: 'test-ref' },
      })

      // Port should be displayed correctly
      expect(result.direct.uri).toContain(':5433/')
      expect(result.direct.psql).toContain('5433')
    })

    it('should handle database name correctly', () => {
      const connectionInfo = {
        db_user: 'test-user',
        db_port: 5432,
        db_host: 'test-host',
        db_name: 'my-project-db',
      }

      const result = getConnectionStrings({
        connectionInfo,
        metadata: { projectRef: 'test-ref' },
      })

      // Database name should be displayed correctly
      expect(result.direct.uri).toContain('/my-project-db')
      expect(result.direct.psql).toContain('my-project-db')
    })
  })

  describe('generateEnhancedConnectionStrings', () => {
    it('should replace placeholders with environment values when useEnvironmentDefaults is true', () => {
      // Set up environment variables
      process.env.POSTGRES_HOST = 'env-host'
      process.env.POSTGRES_PORT = '5433'
      process.env.POSTGRES_USER_READ_WRITE = 'env-user'
      process.env.POSTGRES_DB = 'env-db'

      const connectionInfo = {
        db_user: 'test-user',
        db_port: 5432,
        db_host: 'test-host',
        db_name: 'test-db',
      }

      const result = generateEnhancedConnectionStrings({
        connectionInfo,
        metadata: { projectRef: 'test-ref' },
        useEnvironmentDefaults: true,
      })

      // Should use actual connection info, not environment defaults
      expect(result.direct.uri).toContain('test-user')
      expect(result.direct.uri).toContain('test-host')
      expect(result.direct.uri).toContain('5432')
      expect(result.direct.uri).toContain('test-db')
      expect(result.validation).toBeDefined()
      expect(result.validation.isValid).toBe(true)
    })

    it('should not replace placeholders when useEnvironmentDefaults is false', () => {
      const connectionInfo = {
        db_user: 'test-user',
        db_port: 5432,
        db_host: 'test-host',
        db_name: 'test-db',
      }

      const result = generateEnhancedConnectionStrings({
        connectionInfo,
        metadata: { projectRef: 'test-ref' },
        useEnvironmentDefaults: false,
      })

      // Should use the base connection strings without enhancement
      expect(result.direct.uri).toContain('test-user')
      expect(result.direct.uri).toContain('test-host')
      expect(result.validation).toBeDefined()
      expect(result.validation.isValid).toBe(true)
    })

    it('should provide validation results', () => {
      const connectionInfo = {
        db_user: 'valid_user',
        db_port: 5432,
        db_host: 'valid-host',
        db_name: 'valid_db',
      }

      const result = generateEnhancedConnectionStrings({
        connectionInfo,
        metadata: { projectRef: 'test-ref' },
        useEnvironmentDefaults: true,
      })

      expect(result.validation).toBeDefined()
      expect(result.validation.isValid).toBe(true)
      expect(result.validation.errors).toEqual([])
    })
  })

  describe('constructConnStringSyntax', () => {
    it('should use actual connection info when provided', () => {
      const actualConnectionInfo = {
        user: 'actual-user',
        password: '[YOUR_PASSWORD]',
        host: 'actual-host',
        port: '5433',
        database: 'actual-db',
      }

      const result = constructConnStringSyntax('postgresql://user:pass@host:5432/db', {
        selectedTab: 'uri',
        usePoolerConnection: false,
        ref: 'test-ref',
        cloudProvider: 'aws',
        region: 'us-east-1',
        tld: 'co',
        portNumber: '5432',
        actualConnectionInfo,
      })

      // Should use actual values
      const uriString = result.map(part => part.value).join('')
      expect(uriString).toContain('actual-user')
      expect(uriString).toContain('actual-host')
      expect(uriString).toContain('5433')
      expect(uriString).toContain('actual-db')
    })

    it('should fall back to placeholders when actual connection info is not provided', () => {
      const result = constructConnStringSyntax('postgresql://user:pass@host:5432/db', {
        selectedTab: 'uri',
        usePoolerConnection: false,
        ref: 'test-ref',
        cloudProvider: 'aws',
        region: 'us-east-1',
        tld: 'co',
        portNumber: '5432',
      })

      // Should use placeholders
      const uriString = result.map(part => part.value).join('')
      expect(uriString).toContain('[user]')
      expect(uriString).toContain('[password]')
      expect(uriString).toContain('[db-name]')
    })
  })

  describe('validateAndFormatUsername', () => {
    it('should validate and format valid usernames', () => {
      expect(validateAndFormatUsername('valid_user')).toBe('valid_user')
      expect(validateAndFormatUsername('user-with-hyphens')).toBe('user-with-hyphens')
      expect(validateAndFormatUsername('_underscore_start')).toBe('_underscore_start')
      expect(validateAndFormatUsername('user123')).toBe('user123')
    })

    it('should trim whitespace from usernames', () => {
      expect(validateAndFormatUsername('  spaced_user  ')).toBe('spaced_user')
    })

    it('should throw error for empty usernames', () => {
      expect(() => validateAndFormatUsername('')).toThrow('Username cannot be empty')
      expect(() => validateAndFormatUsername('   ')).toThrow('Username cannot be empty')
    })

    it('should throw error for invalid username formats', () => {
      expect(() => validateAndFormatUsername('123invalid')).toThrow('Invalid username format')
      expect(() => validateAndFormatUsername('user@domain')).toThrow('Invalid username format')
      expect(() => validateAndFormatUsername('user.name')).toThrow('Invalid username format')
    })

    it('should warn for read-only connections with non-read-only usernames', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Set up environment variable for read-only user
      process.env.POSTGRES_USER_READ_ONLY = 'read_only_user'
      
      const result = validateAndFormatUsername('regular_user', true)
      
      expect(result).toBe('regular_user')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Consider using read_only_user for read-only access')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('getUsernameForPermissionLevel', () => {
    it('should return custom user when provided', () => {
      const result = getUsernameForPermissionLevel(false, 'custom_user')
      expect(result).toBe('custom_user')
    })

    it('should return read-write user for write permissions', () => {
      process.env.POSTGRES_USER_READ_WRITE = 'write_user'
      const result = getUsernameForPermissionLevel(false)
      expect(result).toBe('write_user')
    })

    it('should return read-only user for read permissions', () => {
      process.env.POSTGRES_USER_READ_ONLY = 'readonly_user'
      const result = getUsernameForPermissionLevel(true)
      expect(result).toBe('readonly_user')
    })

    it('should fall back to defaults when environment variables are not set', () => {
      // Clear environment variables
      delete process.env.POSTGRES_USER_READ_WRITE
      delete process.env.POSTGRES_USER_READ_ONLY
      
      expect(getUsernameForPermissionLevel(false)).toBe('supabase_admin')
      expect(getUsernameForPermissionLevel(true)).toBe('supabase_read_only_user')
    })

    it('should validate custom usernames', () => {
      expect(() => getUsernameForPermissionLevel(false, 'invalid@user')).toThrow('Invalid username format')
    })
  })

  describe('validateConnectionStringFormat', () => {
    it('should validate correct PostgreSQL URI format', () => {
      const validUri = 'postgresql://user:password@host:5432/database'
      expect(validateConnectionStringFormat(validUri)).toBe(true)
    })

    it('should reject invalid formats', () => {
      expect(validateConnectionStringFormat('mysql://user:pass@host:3306/db')).toBe(false)
      expect(validateConnectionStringFormat('postgresql://user@host:5432/db')).toBe(false) // missing password
      expect(validateConnectionStringFormat('postgresql://user:pass@host/db')).toBe(false) // missing port
      expect(validateConnectionStringFormat('user:pass@host:5432/db')).toBe(false) // missing protocol
    })
  })

  describe('validateParameterSubstitution', () => {
    it('should pass when no placeholders remain', () => {
      const connectionString = 'postgresql://actual_user:password@actual-host:5433/actual_db'
      expect(validateParameterSubstitution(connectionString)).toBe(true)
    })

    it('should fail when placeholders remain', () => {
      expect(validateParameterSubstitution('postgresql://[user]:password@host:5432/db')).toBe(false)
      expect(validateParameterSubstitution('postgresql://user:password@[host]:5432/db')).toBe(false)
      expect(validateParameterSubstitution('postgresql://user:password@host:[port]/db')).toBe(false)
      expect(validateParameterSubstitution('postgresql://user:password@host:5432/[database]')).toBe(false)
    })

    it('should fail when generic values are used', () => {
      expect(validateParameterSubstitution('postgresql://user:password@localhost:5432/postgres')).toBe(false)
    })
  })
})