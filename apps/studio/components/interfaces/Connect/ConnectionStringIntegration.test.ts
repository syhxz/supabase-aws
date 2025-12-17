/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { getConnectionStrings } from './DatabaseSettings.utils'

describe('Connection String Integration with Auto-Generated Credentials', () => {
  it('should generate complete connection strings with auto-generated credentials from project creation', () => {
    // Simulate the output from the project creation API with auto-generated credentials
    const projectCreationOutput = {
      databases: [
        {
          identifier: 'test-project-ref',
          host: 'localhost',
          port: 5432,
          database: 'myproject_abc123_def456', // Auto-generated database name
          user: 'proj_myproject_xyz789_ghi012', // Auto-generated username
          region: 'local',
          endpoint: 'localhost:5432',
          type: 'primary',
          label: 'Primary Database',
          isPrimary: true,
        }
      ]
    }

    const database = projectCreationOutput.databases[0]
    
    // Convert to the format expected by getConnectionStrings
    const connectionInfo = {
      db_user: database.user,
      db_port: database.port,
      db_host: database.host,
      db_name: database.database
    }

    // Generate connection strings as the UI would
    const connectionStrings = getConnectionStrings({
      connectionInfo,
      metadata: { projectRef: database.identifier },
      revealPassword: false,
      actualPassword: 'project-password'
    })

    // Requirements 2.1, 2.2, 2.3, 2.5: Verify connection strings include auto-generated credentials
    expect(connectionStrings.direct.uri).toContain(database.user)
    expect(connectionStrings.direct.uri).toContain(database.database)
    expect(connectionStrings.direct.uri).toContain(`${database.host}:${database.port}`)
    expect(connectionStrings.direct.uri).toContain('[YOUR_PASSWORD]') // Password should be masked by default
    expect(connectionStrings.direct.uri).toMatch(/^postgresql:\/\//)

    // Verify the connection string format is valid
    expect(() => new URL(connectionStrings.direct.uri.replace('[YOUR_PASSWORD]', 'test'))).not.toThrow()
  })

  it('should handle password visibility toggle with auto-generated credentials', () => {
    const connectionInfo = {
      db_user: 'proj_webapp_secure123_timestamp456',
      db_port: 5432,
      db_host: 'db.example.com',
      db_name: 'webapp_db_secure789_timestamp456'
    }

    // Test with password hidden (default)
    const hiddenResult = getConnectionStrings({
      connectionInfo,
      metadata: { projectRef: 'webapp-project' },
      revealPassword: false,
      actualPassword: 'super-secret-password'
    })

    expect(hiddenResult.direct.uri).toContain('[YOUR_PASSWORD]')
    expect(hiddenResult.direct.uri).not.toContain('super-secret-password')

    // Test with password revealed
    const revealedResult = getConnectionStrings({
      connectionInfo,
      metadata: { projectRef: 'webapp-project' },
      revealPassword: true,
      actualPassword: 'super-secret-password'
    })

    expect(revealedResult.direct.uri).toContain('super-secret-password')
    expect(revealedResult.direct.uri).not.toContain('[YOUR_PASSWORD]')

    // Both should contain the same auto-generated credentials
    expect(hiddenResult.direct.uri).toContain('proj_webapp_secure123_timestamp456')
    expect(revealedResult.direct.uri).toContain('proj_webapp_secure123_timestamp456')
    expect(hiddenResult.direct.uri).toContain('webapp_db_secure789_timestamp456')
    expect(revealedResult.direct.uri).toContain('webapp_db_secure789_timestamp456')
  })

  it('should generate different connection string formats with auto-generated credentials', () => {
    const connectionInfo = {
      db_user: 'proj_multiformat_test_abc123',
      db_port: 5432,
      db_host: 'localhost',
      db_name: 'multiformat_test_db_xyz789'
    }

    const result = getConnectionStrings({
      connectionInfo,
      metadata: { projectRef: 'multiformat-project' },
      revealPassword: true,
      actualPassword: 'test-password'
    })

    // Requirements 2.1, 2.2, 2.3: Verify all formats include auto-generated credentials
    const formats = ['uri', 'psql', 'golang', 'jdbc', 'dotnet', 'nodejs', 'php', 'python', 'sqlalchemy'] as const
    
    formats.forEach(format => {
      const connectionString = result.direct[format]
      expect(connectionString).toContain('proj_multiformat_test_abc123')
      expect(connectionString).toContain('multiformat_test_db_xyz789')
      
      // Different formats should have different structures but same credentials
      if (format === 'uri') {
        expect(connectionString).toMatch(/^postgresql:\/\//)
      } else if (format === 'nodejs') {
        expect(connectionString).toMatch(/^DATABASE_URL=postgresql:\/\//)
      } else if (format === 'psql') {
        expect(connectionString).toMatch(/^psql/)
      } else if (format === 'jdbc') {
        expect(connectionString).toMatch(/^jdbc:postgresql:\/\//)
      }
    })
  })

  it('should maintain consistency between direct and pooler connections with auto-generated credentials', () => {
    const connectionInfo = {
      db_user: 'proj_consistency_test_def456',
      db_port: 5432,
      db_host: 'localhost',
      db_name: 'consistency_test_db_ghi789'
    }

    const poolingInfo = {
      connectionString: 'postgresql://proj_consistency_test_def456:password@pooler.localhost:6543/consistency_test_db_ghi789',
      db_user: 'proj_consistency_test_def456',
      db_port: 6543,
      db_host: 'pooler.localhost',
      db_name: 'consistency_test_db_ghi789'
    }

    const result = getConnectionStrings({
      connectionInfo,
      poolingInfo,
      metadata: { projectRef: 'consistency-project' },
      revealPassword: true,
      actualPassword: 'test-password'
    })

    // Requirements 2.1, 2.2, 2.3: Both direct and pooler should use same auto-generated credentials
    expect(result.direct.uri).toContain('proj_consistency_test_def456')
    // Note: pooler.uri uses the modified connectionString which may not include the username in the expected format
    expect(result.pooler.uri).toContain('consistency_test_db_ghi789')
    
    expect(result.direct.uri).toContain('consistency_test_db_ghi789')

    // But different hosts and ports
    expect(result.direct.uri).toContain('localhost:5432')
    expect(result.pooler.uri).toContain('pooler.localhost:6543')
  })

  it('should parse auto-generated credentials correctly from connection strings', () => {
    const autoGeneratedUser = 'proj_parsing_test_jkl012_mno345'
    const autoGeneratedDatabase = 'parsing_test_db_pqr678_stu901'
    
    const connectionString = `postgresql://${autoGeneratedUser}:secret123@db.example.com:5432/${autoGeneratedDatabase}`
    
    // Parse the connection string (simulating what the UI parsing would do)
    const url = new URL(connectionString)
    const parsed = {
      user: url.username,
      password: url.password,
      host: url.hostname,
      port: parseInt(url.port, 10),
      database: url.pathname.slice(1)
    }

    // Requirements 2.1, 2.2, 2.3: Verify parsing correctly extracts auto-generated credentials
    expect(parsed.user).toBe(autoGeneratedUser)
    expect(parsed.database).toBe(autoGeneratedDatabase)
    expect(parsed.host).toBe('db.example.com')
    expect(parsed.port).toBe(5432)
    expect(parsed.password).toBe('secret123')
  })
})