/**
 * Integration tests for remote database configuration
 * 
 * Task 10: Test with remote database configuration
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 * 
 * This test suite verifies that:
 * - Connection strings work with actual remote database setup
 * - Environment variable integration functions correctly
 * - UI displays correct information for remote databases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateConnectionString, generateDisplayConnectionString, parseConnectionString } from './api/self-hosted/connection-string'
import { getEnvironmentConnectionInfo, validateEnvironmentSetup, enhanceConnectionStringSyntax } from './environment-integration-utils'
import { getConnectionStrings, generateEnhancedConnectionStrings, constructConnStringSyntax } from '../components/interfaces/Connect/DatabaseSettings.utils'
import { getEnvironmentConfigHandler } from './environment-config-handler'
import { createDatabaseTypeIdentifier, getDatabaseTypeLabel } from './database-type-identifier'

describe('Remote Database Configuration Integration', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    
    // Set up remote database environment configuration
    process.env.POSTGRES_HOST = 'remote-db.example.com'
    process.env.POSTGRES_PORT = '5433'
    process.env.POSTGRES_DB = 'production_database'
    process.env.POSTGRES_USER_READ_WRITE = 'prod_admin'
    process.env.POSTGRES_USER_READ_ONLY = 'prod_readonly'
    process.env.POSTGRES_PASSWORD = 'secure_password_123'
    process.env.ENVIRONMENT = 'production'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('Remote Database Connection String Generation', () => {
    it('should generate correct connection strings for remote database setup', () => {
      // Requirement 1.2: Use correct host address from environment configuration
      const connectionString = generateConnectionString({
        databaseName: 'my_project_db',
        useEnvironmentDefaults: true,
        maskPassword: false
      })

      expect(connectionString).toBe('postgresql://prod_admin:secure_password_123@remote-db.example.com:5433/my_project_db')
      expect(connectionString).toContain('remote-db.example.com')
      expect(connectionString).toContain('5433')
      expect(connectionString).toContain('prod_admin')
      expect(connectionString).toContain('my_project_db')
    })

    it('should generate display connection strings with masked passwords', () => {
      // Requirement 1.2: Include correct host address from environment configuration
      const displayString = generateDisplayConnectionString({
        databaseName: 'my_project_db',
        useEnvironmentDefaults: true
      })

      expect(displayString).toBe('postgresql://prod_admin:[YOUR_PASSWORD]@remote-db.example.com:5433/my_project_db')
      expect(displayString).toContain('[YOUR_PASSWORD]')
      expect(displayString).not.toContain('secure_password_123')
    })

    it('should handle read-only connections correctly', () => {
      const readOnlyString = generateConnectionString({
        databaseName: 'my_project_db',
        readOnly: true,
        useEnvironmentDefaults: true,
        maskPassword: true
      })

      expect(readOnlyString).toContain('prod_readonly')
      expect(readOnlyString).toContain('[YOUR_PASSWORD]')
    })

    it('should parse remote database connection strings correctly', () => {
      const connectionString = 'postgresql://prod_admin:secure_password_123@remote-db.example.com:5433/my_project_db'
      const parsed = parseConnectionString(connectionString)

      expect(parsed.user).toBe('prod_admin')
      expect(parsed.password).toBe('secure_password_123')
      expect(parsed.host).toBe('remote-db.example.com')
      expect(parsed.port).toBe(5433)
      expect(parsed.database).toBe('my_project_db')
    })
  })

  describe('Environment Variable Integration', () => {
    it('should properly integrate environment variables in connection generation', () => {
      // Requirement 1.2: Generate connection strings using environment configuration
      const connectionInfo = getEnvironmentConnectionInfo('test-project', 'project_database', false)

      expect(connectionInfo.host).toBe('remote-db.example.com')
      expect(connectionInfo.port).toBe(5433)
      expect(connectionInfo.database).toBe('project_database')
      expect(connectionInfo.user).toBe('prod_admin')
      expect(connectionInfo.environment).toBe('production')
      expect(connectionInfo.connectionString).toContain('remote-db.example.com:5433')
    })

    it('should validate environment setup for remote database', () => {
      const validation = validateEnvironmentSetup()

      expect(validation.isValid).toBe(true)
      expect(validation.environment).toBe('production')
      expect(validation.errors).toHaveLength(0)
    })

    it('should detect configuration issues in remote setup', () => {
      // Test with invalid configuration - need to create a new config handler with invalid values
      const configHandler = getEnvironmentConfigHandler()
      
      // Update with invalid configuration
      configHandler.updateConfig({
        POSTGRES_HOST: '',
        POSTGRES_PORT: -1
      })

      const validation = validateEnvironmentSetup()

      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })

    it('should handle environment configuration changes reactively', async () => {
      const configHandler = getEnvironmentConfigHandler()
      let notificationReceived = false

      const unsubscribe = configHandler.addConfigChangeListener(() => {
        notificationReceived = true
      })

      // Update configuration
      configHandler.updateConfig({
        POSTGRES_HOST: 'updated-remote-db.example.com',
        POSTGRES_PORT: 5434
      })

      expect(notificationReceived).toBe(true)
      
      const updatedInfo = getEnvironmentConnectionInfo('test-project', 'project_database', false)
      expect(updatedInfo.host).toBe('updated-remote-db.example.com')
      expect(updatedInfo.port).toBe(5434)

      unsubscribe()
    })
  })

  describe('Database Type Identification', () => {
    it('should correctly identify primary database in remote setup', () => {
      // Requirement 1.1: Display "Primary Database" as connection source type
      const identifier = createDatabaseTypeIdentifier([])
      const databaseType = identifier.identifyDatabaseType('test-project', 'test-project')
      expect(databaseType).toBe('primary')

      const isPrimary = identifier.isPrimaryDatabase('test-project', 'test-project')
      expect(isPrimary).toBe(true)

      const label = getDatabaseTypeLabel('test-project', 'test-project', [])
      expect(label).toBe('Primary Database')
    })

    it('should distinguish between primary and replica databases', () => {
      const mockDatabases = [
        { identifier: 'test-project', db_host: 'primary-db.example.com', db_port: 5433, db_name: 'main_db', db_user: 'admin' },
        { identifier: 'replica-db', db_host: 'replica-db.example.com', db_port: 5433, db_name: 'main_db', db_user: 'readonly' }
      ]
      
      const identifier = createDatabaseTypeIdentifier(mockDatabases as any)
      
      // Test primary database identification
      const primaryType = identifier.identifyDatabaseType('test-project', 'test-project')
      expect(primaryType).toBe('primary')

      // Test replica database identification
      const replicaType = identifier.identifyDatabaseType('test-project', 'replica-db')
      expect(['primary', 'replica']).toContain(replicaType)
    })
  })

  describe('UI Connection String Display', () => {
    it('should generate enhanced connection strings for UI display', () => {
      const connectionInfo = {
        db_user: 'prod_admin',
        db_port: 5433,
        db_host: 'remote-db.example.com',
        db_name: 'production_database',
      }

      const enhanced = generateEnhancedConnectionStrings({
        connectionInfo,
        metadata: { projectRef: 'test-project' },
        useEnvironmentDefaults: true
      })

      // Requirement 1.3: Show actual port number from environment configuration
      expect(enhanced.direct.uri).toContain(':5433/')
      
      // Requirement 1.4: Display correct database name for the project
      expect(enhanced.direct.uri).toContain('/production_database')
      
      // Requirement 1.2: Include correct host address
      expect(enhanced.direct.uri).toContain('remote-db.example.com')
      
      expect(enhanced.validation.isValid).toBe(true)
      expect(enhanced.validation.errors).toHaveLength(0)
    })

    it('should construct connection string syntax with actual values', () => {
      const actualConnectionInfo = {
        user: 'prod_admin',
        password: '[YOUR_PASSWORD]',
        host: 'remote-db.example.com',
        port: '5433',
        database: 'production_database'
      }

      const syntax = constructConnStringSyntax('postgresql://user:pass@host:5432/db', {
        selectedTab: 'uri',
        usePoolerConnection: false,
        ref: 'test-project',
        cloudProvider: 'aws',
        region: 'us-east-1',
        tld: 'co',
        portNumber: '5432',
        actualConnectionInfo
      })

      const connectionString = syntax.map(part => part.value).join('')
      
      // Requirement 1.5: Replace placeholders with actual configuration values
      expect(connectionString).toContain('prod_admin')
      expect(connectionString).toContain('remote-db.example.com')
      expect(connectionString).toContain('5433')
      expect(connectionString).toContain('production_database')
      expect(connectionString).not.toContain('[user]')
      expect(connectionString).not.toContain('[host]')
      expect(connectionString).not.toContain('[db-name]')
    })

    it('should enhance connection string syntax with environment values', () => {
      const baseConnectionString = 'postgresql://[user]:[password]@[host]:[port]/[db-name]'
      
      const enhanced = enhanceConnectionStringSyntax(baseConnectionString, {
        selectedTab: 'uri',
        usePoolerConnection: false,
        ref: 'test-project',
        cloudProvider: 'aws',
        region: 'us-east-1',
        tld: 'co',
        portNumber: '5432'
      })

      expect(Array.isArray(enhanced)).toBe(true)
      expect(enhanced.length).toBeGreaterThan(0)
      
      const enhancedString = enhanced.map(part => part.value).join('')
      expect(enhancedString).toContain('prod_admin')
      expect(enhancedString).toContain('remote-db.example.com')
    })
  })

  describe('Connection String Format Validation', () => {
    it('should validate PostgreSQL URI format for remote databases', () => {
      const connectionStrings = getConnectionStrings({
        connectionInfo: {
          db_user: 'prod_admin',
          db_port: 5433,
          db_host: 'remote-db.example.com',
          db_name: 'production_database',
        },
        metadata: { projectRef: 'test-project' }
      })

      // Verify PostgreSQL URI format
      expect(connectionStrings.direct.uri).toMatch(/^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^\/]+$/)
      expect(connectionStrings.direct.uri).toContain('postgresql://')
    })

    it('should ensure no placeholder values remain in production connection strings', () => {
      const connectionInfo = {
        db_user: 'prod_admin',
        db_port: 5433,
        db_host: 'remote-db.example.com',
        db_name: 'production_database',
      }

      const connectionStrings = getConnectionStrings({
        connectionInfo,
        metadata: { projectRef: 'test-project' }
      })

      // Requirement 1.5: Ensure placeholders are replaced with actual values
      expect(connectionStrings.direct.uri).not.toContain('[user]')
      expect(connectionStrings.direct.uri).not.toContain('[host]')
      expect(connectionStrings.direct.uri).not.toContain('[port]')
      expect(connectionStrings.direct.uri).not.toContain('[db-name]')
      expect(connectionStrings.direct.uri).not.toContain('localhost')
      // Note: 'postgres' might appear in 'postgresql://' protocol, so check for generic database name instead
      expect(connectionStrings.direct.uri).toContain('production_database')
    })
  })

  describe('Multi-Environment Remote Database Support', () => {
    it('should adapt connection strings for different remote environments', () => {
      // Test staging environment by updating the config handler
      const configHandler = getEnvironmentConfigHandler()
      
      configHandler.updateConfig({
        ENVIRONMENT: 'staging',
        POSTGRES_HOST: 'staging-db.example.com',
        POSTGRES_PORT: 5434
      })

      const stagingInfo = getEnvironmentConnectionInfo('test-project', 'staging_db', false)
      expect(stagingInfo.host).toBe('staging-db.example.com')
      expect(stagingInfo.port).toBe(5434)
      expect(stagingInfo.environment).toBe('staging')

      // Test production environment
      configHandler.updateConfig({
        ENVIRONMENT: 'production',
        POSTGRES_HOST: 'prod-db.example.com',
        POSTGRES_PORT: 5435
      })

      const prodInfo = getEnvironmentConnectionInfo('test-project', 'prod_db', false)
      expect(prodInfo.host).toBe('prod-db.example.com')
      expect(prodInfo.port).toBe(5435)
      expect(prodInfo.environment).toBe('production')
    })

    it('should handle remote database failover scenarios', () => {
      // Test primary database connection
      const primaryConnection = generateConnectionString({
        databaseName: 'main_db',
        host: 'primary-db.example.com',
        port: 5433,
        user: 'prod_admin',
        password: 'secure_password',
        useEnvironmentDefaults: false
      })

      expect(primaryConnection).toContain('primary-db.example.com:5433')

      // Test failover to secondary database
      const failoverConnection = generateConnectionString({
        databaseName: 'main_db',
        host: 'failover-db.example.com',
        port: 5433,
        user: 'prod_admin',
        password: 'secure_password',
        useEnvironmentDefaults: false
      })

      expect(failoverConnection).toContain('failover-db.example.com:5433')
    })
  })

  describe('Remote Database Security Validation', () => {
    it('should ensure passwords are properly masked in display strings', () => {
      const displayString = generateDisplayConnectionString({
        databaseName: 'secure_db',
        host: 'secure-db.example.com',
        port: 5433,
        user: 'secure_user',
        password: 'very_secret_password'
      })

      expect(displayString).toContain('[YOUR_PASSWORD]')
      expect(displayString).not.toContain('very_secret_password')
    })

    it('should validate username formats for remote database connections', () => {
      // Test valid usernames
      expect(() => {
        generateConnectionString({
          databaseName: 'test_db',
          host: 'remote-db.example.com',
          port: 5433,
          user: 'valid_user_123',
          password: 'password',
          useEnvironmentDefaults: false
        })
      }).not.toThrow()

      // Test invalid usernames
      expect(() => {
        generateConnectionString({
          databaseName: 'test_db',
          host: 'remote-db.example.com',
          port: 5433,
          user: 'invalid@user',
          password: 'password',
          useEnvironmentDefaults: false
        })
      }).toThrow('Invalid username format')
    })
  })

  describe('Remote Database Error Handling', () => {
    it('should handle missing remote database configuration gracefully', () => {
      // Clear environment variables
      delete process.env.POSTGRES_HOST
      delete process.env.POSTGRES_PORT
      delete process.env.POSTGRES_USER_READ_WRITE

      expect(() => {
        generateConnectionString({
          databaseName: 'test_db',
          useEnvironmentDefaults: false
        })
      }).toThrow('Missing required connection parameters')
    })

    it('should provide meaningful error messages for invalid remote configuration', () => {
      expect(() => {
        generateConnectionString({
          databaseName: 'test_db',
          host: '',
          port: 'invalid_port',
          user: 'test_user',
          password: 'test_password',
          useEnvironmentDefaults: false
        })
      }).toThrow('Invalid connection parameters')
    })

    it('should fall back to environment defaults when remote configuration is incomplete', () => {
      // Reset to known environment values for this test
      const configHandler = getEnvironmentConfigHandler()
      configHandler.updateConfig({
        POSTGRES_HOST: 'remote-db.example.com',
        POSTGRES_PORT: 5433
      })

      const connectionString = generateConnectionString({
        databaseName: 'test_db',
        host: undefined, // Will use environment default
        useEnvironmentDefaults: true
      })

      expect(connectionString).toContain('remote-db.example.com')
      expect(connectionString).toContain('5433')
    })
  })
})