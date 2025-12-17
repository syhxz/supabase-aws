/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { 
  generateConnectionString, 
  generateConnectionStringWithFallback,
  generateDisplayConnectionString, 
  generateDisplayConnectionStringWithFallback,
  parseConnectionString,
  parseConnectionStringWithFallback,
  generateProjectConnectionString,
  generateProjectConnectionStringWithVisibility,
  validateConnectionStringFormat
} from './connection-string'

describe('generateConnectionString', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should generate connection string with database name', () => {
    const result = generateConnectionString({
      databaseName: 'mydb',
    })

    expect(result).toContain('mydb')
    expect(result).toMatch(/^postgresql:\/\//)
  })

  it('should use read-write user by default', () => {
    const result = generateConnectionString({
      databaseName: 'mydb',
    })

    expect(result).toContain('supabase_admin')
  })

  it('should use read-only user when specified', () => {
    const result = generateConnectionString({
      databaseName: 'mydb',
      readOnly: true,
    })

    expect(result).toContain('supabase_read_only_user')
  })

  it('should use default host and port', () => {
    const result = generateConnectionString({
      databaseName: 'mydb',
    })

    expect(result).toContain('@db:5432')
  })

  it('should allow overriding host', () => {
    const result = generateConnectionString({
      databaseName: 'mydb',
      host: 'localhost',
    })

    expect(result).toContain('@localhost:')
  })

  it('should allow overriding port', () => {
    const result = generateConnectionString({
      databaseName: 'mydb',
      port: 5433,
    })

    expect(result).toContain(':5433/')
  })

  it('should allow overriding user', () => {
    const result = generateConnectionString({
      databaseName: 'mydb',
      user: 'custom_user',
    })

    expect(result).toContain('custom_user:')
  })

  it('should allow overriding password', () => {
    const result = generateConnectionString({
      databaseName: 'mydb',
      password: 'custom_password',
    })

    expect(result).toContain(':custom_password@')
  })

  it('should generate complete connection string', () => {
    const result = generateConnectionString({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      user: 'testuser',
      password: 'testpass',
    })

    expect(result).toBe('postgresql://testuser:testpass@localhost:5432/test_db')
  })

  it('should use environment variables when useEnvironmentDefaults is true', () => {
    // Test with explicit values since environment variables are loaded at import time
    const result = generateConnectionString({
      databaseName: 'test_db',
      host: 'env-host',
      port: 5433,
      user: 'env-user',
      password: 'env-password',
      useEnvironmentDefaults: true,
    })

    expect(result).toBe('postgresql://env-user:env-password@env-host:5433/test_db')
  })

  it('should throw error when required parameters are missing and useEnvironmentDefaults is false', () => {
    expect(() => {
      generateConnectionString({
        databaseName: 'test_db',
        useEnvironmentDefaults: false,
      })
    }).toThrow('Missing required connection parameters: host, port, user, password')
  })

  it('should validate port number', () => {
    expect(() => {
      generateConnectionString({
        databaseName: 'test_db',
        host: 'localhost',
        port: 'invalid',
        user: 'testuser',
        password: 'testpass',
      })
    }).toThrow('Invalid connection parameters: Port must be a valid number between 1 and 65535')
  })

  it('should validate empty host', () => {
    expect(() => {
      generateConnectionString({
        databaseName: 'test_db',
        host: '',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
        useEnvironmentDefaults: false,
      })
    }).toThrow('Invalid connection parameters: Host cannot be empty')
  })

  it('should validate empty database name', () => {
    expect(() => {
      generateConnectionString({
        databaseName: '',
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
      })
    }).toThrow('Invalid connection parameters: Database name cannot be empty')
  })

  it('should handle missing environment variables gracefully', () => {
    expect(() => {
      generateConnectionString({
        databaseName: 'test_db',
        useEnvironmentDefaults: false,
        host: undefined,
        port: undefined,
        user: undefined,
        password: undefined,
      })
    }).toThrow('Missing required connection parameters')
  })

  it('should mask password when maskPassword is true', () => {
    const result = generateConnectionString({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      user: 'testuser',
      password: 'secret123',
      maskPassword: true,
    })

    expect(result).toBe('postgresql://testuser:[YOUR_PASSWORD]@localhost:5432/test_db')
    expect(result).not.toContain('secret123')
  })

  it('should show real password when maskPassword is false', () => {
    const result = generateConnectionString({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      user: 'testuser',
      password: 'secret123',
      maskPassword: false,
    })

    expect(result).toBe('postgresql://testuser:secret123@localhost:5432/test_db')
  })

  it('should default to showing real password when maskPassword is not specified', () => {
    const result = generateConnectionString({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      user: 'testuser',
      password: 'secret123',
    })

    expect(result).toBe('postgresql://testuser:secret123@localhost:5432/test_db')
  })

  it('should format username correctly for read-only connections', () => {
    const result = generateConnectionString({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      user: 'read_only_user',
      password: 'secret123',
      readOnly: true,
    })

    expect(result).toBe('postgresql://read_only_user:secret123@localhost:5432/test_db')
  })

  it('should handle usernames with hyphens and underscores', () => {
    const result = generateConnectionString({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      user: 'user-with_mixed-chars',
      password: 'secret123',
    })

    expect(result).toBe('postgresql://user-with_mixed-chars:secret123@localhost:5432/test_db')
  })

  it('should throw error for invalid username format', () => {
    expect(() => {
      generateConnectionString({
        databaseName: 'test_db',
        host: 'localhost',
        port: 5432,
        user: 'invalid@user',
        password: 'secret123',
      })
    }).toThrow('Invalid username format')
  })

  it('should use appropriate default username based on readOnly flag', () => {
    // Test read-write default
    const readWriteResult = generateConnectionString({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      password: 'secret123',
      readOnly: false,
    })
    expect(readWriteResult).toContain('supabase_admin')

    // Test read-only default
    const readOnlyResult = generateConnectionString({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      password: 'secret123',
      readOnly: true,
    })
    expect(readOnlyResult).toContain('supabase_read_only_user')
  })
})

describe('generateDisplayConnectionString', () => {
  it('should always mask password for display', () => {
    const result = generateDisplayConnectionString({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      user: 'testuser',
      password: 'secret123',
    })

    expect(result).toBe('postgresql://testuser:[YOUR_PASSWORD]@localhost:5432/test_db')
    expect(result).not.toContain('secret123')
  })

  it('should work with environment defaults', () => {
    const result = generateDisplayConnectionString({
      databaseName: 'test_db',
    })

    expect(result).toContain('[YOUR_PASSWORD]')
    // Check that the actual password value is not exposed (the default password is 'postgres')
    const parts = result.split(':')
    const passwordPart = parts[2]?.split('@')[0]
    expect(passwordPart).toBe('[YOUR_PASSWORD]')
  })
})

describe('generateProjectConnectionString', () => {
  it('should generate both masked and actual connection strings', () => {
    const result = generateProjectConnectionString({
      projectUser: 'project_user_123',
      projectPassword: 'project_secret',
      projectDatabase: 'project_db_123',
      host: 'localhost',
      port: 5432,
      databaseName: 'project_db_123', // Required by base interface
    })

    expect(result.masked).toBe('postgresql://project_user_123:[YOUR_PASSWORD]@localhost:5432/project_db_123')
    expect(result.actual).toBe('postgresql://project_user_123:project_secret@localhost:5432/project_db_123')
  })

  it('should use environment defaults for host and port', () => {
    const result = generateProjectConnectionString({
      projectUser: 'project_user_123',
      projectPassword: 'project_secret',
      projectDatabase: 'project_db_123',
      databaseName: 'project_db_123',
    })

    expect(result.masked).toContain('@db:5432')
    expect(result.actual).toContain('@db:5432')
  })

  it('should validate project user format', () => {
    expect(() => {
      generateProjectConnectionString({
        projectUser: 'invalid@user',
        projectPassword: 'secret',
        projectDatabase: 'mydb',
        host: 'localhost',
        port: 5432,
        databaseName: 'mydb',
      })
    }).toThrow('Invalid project username format')
  })

  it('should validate required project parameters', () => {
    expect(() => {
      generateProjectConnectionString({
        projectUser: '',
        projectPassword: 'secret',
        projectDatabase: 'mydb',
        host: 'localhost',
        port: 5432,
        databaseName: 'mydb',
      })
    }).toThrow('Project user cannot be empty')
  })

  it('should handle missing host/port gracefully', () => {
    expect(() => {
      generateProjectConnectionString({
        projectUser: 'project_user',
        projectPassword: 'secret',
        projectDatabase: 'mydb',
        useEnvironmentDefaults: false,
        databaseName: 'mydb',
      })
    }).toThrow('Missing required connection parameters: host, port')
  })
})

describe('generateProjectConnectionStringWithVisibility', () => {
  it('should return masked connection string by default', () => {
    const result = generateProjectConnectionStringWithVisibility({
      projectUser: 'project_user_123',
      projectPassword: 'project_secret',
      projectDatabase: 'project_db_123',
      host: 'localhost',
      port: 5432,
      databaseName: 'project_db_123',
    })

    expect(result).toBe('postgresql://project_user_123:[YOUR_PASSWORD]@localhost:5432/project_db_123')
  })

  it('should return actual connection string when revealPassword is true', () => {
    const result = generateProjectConnectionStringWithVisibility({
      projectUser: 'project_user_123',
      projectPassword: 'project_secret',
      projectDatabase: 'project_db_123',
      host: 'localhost',
      port: 5432,
      revealPassword: true,
      databaseName: 'project_db_123',
    })

    expect(result).toBe('postgresql://project_user_123:project_secret@localhost:5432/project_db_123')
  })
})

describe('validateConnectionStringFormat', () => {
  it('should validate correct connection string', () => {
    const result = validateConnectionStringFormat(
      'postgresql://user:pass@localhost:5432/mydb'
    )

    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.components).toEqual({
      user: 'user',
      password: 'pass',
      host: 'localhost',
      port: 5432,
      database: 'mydb',
    })
  })

  it('should validate connection string with masked password', () => {
    const result = validateConnectionStringFormat(
      'postgresql://user:[YOUR_PASSWORD]@localhost:5432/mydb'
    )

    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('should reject invalid protocol', () => {
    const result = validateConnectionStringFormat(
      'mysql://user:pass@localhost:5432/mydb'
    )

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Connection string must use postgresql:// or postgres:// protocol')
  })

  it('should reject missing username', () => {
    const result = validateConnectionStringFormat(
      'postgresql://:pass@localhost:5432/mydb'
    )

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Connection string must include a username')
  })

  it('should reject invalid username format', () => {
    const result = validateConnectionStringFormat(
      'postgresql://123invalid:pass@localhost:5432/mydb'
    )

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Invalid username format in connection string: 123invalid')
  })

  it('should reject missing database', () => {
    const result = validateConnectionStringFormat(
      'postgresql://user:pass@localhost:5432/'
    )

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Connection string must include a database name')
  })

  it('should handle empty connection string', () => {
    const result = validateConnectionStringFormat('')

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Connection string cannot be empty')
  })
})

describe('generateConnectionStringWithFallback', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should use project credentials when available', async () => {
    const result = await generateConnectionStringWithFallback({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      projectRef: 'test-project',
      projectCredentials: {
        user: 'project_user',
        passwordHash: 'project_password'
      }
    })

    expect(result.connectionString).toBe('postgresql://project_user:project_password@localhost:5432/test_db')
    expect(result.usedFallback).toBe(false)
    expect(result.fallbackReason).toBeUndefined()
  })

  it('should use fallback credentials when project credentials are missing', async () => {
    const result = await generateConnectionStringWithFallback({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      projectRef: 'test-project',
      projectCredentials: {
        user: null,
        passwordHash: null
      }
    })

    expect(result.connectionString).toContain('supabase_admin')
    expect(result.usedFallback).toBe(true)
    expect(result.fallbackReason).toBe('Both user and password missing from project credentials')
    expect(result.fallbackType).toBe('both')
  })

  it('should use fallback user when only user is missing', async () => {
    const result = await generateConnectionStringWithFallback({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      projectRef: 'test-project',
      projectCredentials: {
        user: null,
        passwordHash: 'project_password'
      }
    })

    expect(result.connectionString).toBe('postgresql://supabase_admin:project_password@localhost:5432/test_db')
    expect(result.usedFallback).toBe(true)
    expect(result.fallbackReason).toBe('User missing from project credentials')
    expect(result.fallbackType).toBe('user')
  })

  it('should use fallback password when only password is missing', async () => {
    const result = await generateConnectionStringWithFallback({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      projectRef: 'test-project',
      projectCredentials: {
        user: 'project_user',
        passwordHash: null
      }
    })

    expect(result.connectionString).toBe('postgresql://project_user:postgres@localhost:5432/test_db')
    expect(result.usedFallback).toBe(true)
    expect(result.fallbackReason).toBe('Password missing from project credentials')
    expect(result.fallbackType).toBe('password')
  })

  it('should work without project credentials when allowFallback is false', async () => {
    const result = await generateConnectionStringWithFallback({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      user: 'custom_user',
      password: 'custom_password',
      allowFallback: false
    })

    expect(result.connectionString).toBe('postgresql://custom_user:custom_password@localhost:5432/test_db')
    expect(result.usedFallback).toBe(false)
  })

  it('should mask password when requested', async () => {
    const result = await generateConnectionStringWithFallback({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      projectRef: 'test-project',
      projectCredentials: {
        user: 'project_user',
        passwordHash: 'project_password'
      },
      maskPassword: true
    })

    expect(result.connectionString).toBe('postgresql://project_user:[YOUR_PASSWORD]@localhost:5432/test_db')
    expect(result.usedFallback).toBe(false)
  })
})

describe('parseConnectionStringWithFallback', () => {
  it('should parse connection string with validation', () => {
    const result = parseConnectionStringWithFallback(
      'postgresql://user:pass@localhost:5432/mydb',
      { validateFormat: true }
    )

    expect(result.isValid).toBe(true)
    expect(result.user).toBe('user')
    expect(result.password).toBe('pass')
    expect(result.host).toBe('localhost')
    expect(result.port).toBe(5432)
    expect(result.database).toBe('mydb')
    expect(result.hasMaskedPassword).toBe(false)
  })

  it('should detect masked password', () => {
    const result = parseConnectionStringWithFallback(
      'postgresql://user:[YOUR_PASSWORD]@localhost:5432/mydb'
    )

    expect(result.hasMaskedPassword).toBe(true)
    expect(result.password).toBe('[YOUR_PASSWORD]')
  })

  it('should allow masked passwords when specified', () => {
    const result = parseConnectionStringWithFallback(
      'postgresql://user:[YOUR_PASSWORD]@localhost:5432/mydb',
      { validateFormat: true, allowMaskedPassword: true }
    )

    expect(result.isValid).toBe(true)
    expect(result.hasMaskedPassword).toBe(true)
  })

  it('should handle empty connection string', () => {
    const result = parseConnectionStringWithFallback('')

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Connection string cannot be empty')
  })

  it('should handle invalid connection string format', () => {
    const result = parseConnectionStringWithFallback('not a valid connection string')

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Invalid connection string format')
  })
})

describe('generateDisplayConnectionStringWithFallback', () => {
  it('should always mask password', async () => {
    const result = await generateDisplayConnectionStringWithFallback({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      projectRef: 'test-project',
      projectCredentials: {
        user: 'project_user',
        passwordHash: 'project_password'
      }
    })

    expect(result.connectionString).toBe('postgresql://project_user:[YOUR_PASSWORD]@localhost:5432/test_db')
    expect(result.usedFallback).toBe(false)
  })

  it('should mask password even with fallback credentials', async () => {
    const result = await generateDisplayConnectionStringWithFallback({
      databaseName: 'test_db',
      host: 'localhost',
      port: 5432,
      projectRef: 'test-project',
      projectCredentials: {
        user: null,
        passwordHash: null
      }
    })

    expect(result.connectionString).toContain('[YOUR_PASSWORD]')
    expect(result.usedFallback).toBe(true)
  })
})

describe('parseConnectionString', () => {
  it('should parse complete connection string', () => {
    const result = parseConnectionString(
      'postgresql://user:pass@localhost:5432/mydb'
    )

    expect(result).toEqual({
      user: 'user',
      password: 'pass',
      host: 'localhost',
      port: 5432,
      database: 'mydb',
    })
  })

  it('should parse connection string without port', () => {
    const result = parseConnectionString(
      'postgresql://user:pass@localhost/mydb'
    )

    expect(result).toEqual({
      user: 'user',
      password: 'pass',
      host: 'localhost',
      port: undefined,
      database: 'mydb',
    })
  })

  it('should parse connection string without password', () => {
    const result = parseConnectionString(
      'postgresql://user@localhost:5432/mydb'
    )

    expect(result).toEqual({
      user: 'user',
      password: undefined,
      host: 'localhost',
      port: 5432,
      database: 'mydb',
    })
  })

  it('should handle invalid connection string', () => {
    const result = parseConnectionString('not a valid connection string')

    expect(result).toEqual({})
  })

  it('should handle empty string', () => {
    const result = parseConnectionString('')

    expect(result).toEqual({})
  })

  it('should parse postgres:// protocol', () => {
    const result = parseConnectionString(
      'postgres://user:pass@localhost:5432/mydb'
    )

    expect(result).toEqual({
      user: 'user',
      password: 'pass',
      host: 'localhost',
      port: 5432,
      database: 'mydb',
    })
  })
})
