/**
 * End-to-end integration tests for remote database configuration
 * 
 * Task 10: Test with remote database configuration - Complete workflow validation
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 * 
 * This test suite validates the complete workflow from environment setup
 * through UI display for remote database configurations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateConnectionString } from './api/self-hosted/connection-string'
import { getEnvironmentConnectionInfo, validateEnvironmentSetup } from './environment-integration-utils'
import { getConnectionStrings, constructConnStringSyntax } from '../components/interfaces/Connect/DatabaseSettings.utils'
import { getDatabaseTypeLabel } from './database-type-identifier'

describe('Remote Database Configuration End-to-End', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('Complete Remote Database Setup Workflow', () => {
    it('should handle complete AWS RDS PostgreSQL setup', async () => {
      // Simulate AWS RDS environment configuration
      const awsConfig = {
        POSTGRES_HOST: 'myapp-prod.cluster-abc123.us-east-1.rds.amazonaws.com',
        POSTGRES_PORT: 5432,
        POSTGRES_DB: 'myapp_production',
        POSTGRES_USER_READ_WRITE: 'myapp_admin',
        POSTGRES_USER_READ_ONLY: 'myapp_readonly',
        POSTGRES_PASSWORD: 'secure_aws_password_123',
        ENVIRONMENT: 'production'
      }

      // Set up environment
      Object.assign(process.env, awsConfig)

      // Step 1: Validate environment setup
      const validation = validateEnvironmentSetup()
      expect(validation.isValid).toBe(true)
      expect(validation.environment).toBe('production')

      // Step 2: Generate connection information
      const connectionInfo = getEnvironmentConnectionInfo('myapp-prod', 'myapp_production', false)
      
      // Requirement 1.2: Use correct host address from environment configuration
      expect(connectionInfo.host).toBe('myapp-prod.cluster-abc123.us-east-1.rds.amazonaws.com')
      // Requirement 1.3: Show actual port number from environment configuration
      expect(connectionInfo.port).toBe(5432)
      // Requirement 1.4: Display correct database name for the project
      expect(connectionInfo.database).toBe('myapp_production')
      expect(connectionInfo.user).toBe('myapp_admin')

      // Step 3: Generate connection strings for UI
      const connectionStrings = getConnectionStrings({
        connectionInfo: {
          db_user: connectionInfo.user,
          db_port: connectionInfo.port,
          db_host: connectionInfo.host,
          db_name: connectionInfo.database,
        },
        metadata: { projectRef: 'myapp-prod' }
      })

      // Verify all connection string formats contain actual values
      expect(connectionStrings.direct.uri).toContain('myapp-prod.cluster-abc123.us-east-1.rds.amazonaws.com')
      expect(connectionStrings.direct.uri).toContain('5432')
      expect(connectionStrings.direct.uri).toContain('myapp_production')
      expect(connectionStrings.direct.uri).toContain('myapp_admin')

      // Step 4: Verify database type identification
      // Requirement 1.1: Display "Primary Database" as connection source type
      const databaseLabel = getDatabaseTypeLabel('myapp-prod', 'myapp-prod', [])
      expect(databaseLabel).toBe('Primary Database')

      // Step 5: Test connection string construction for UI display
      const syntax = constructConnStringSyntax('postgresql://user:pass@host:5432/db', {
        selectedTab: 'uri',
        usePoolerConnection: false,
        ref: 'myapp-prod',
        cloudProvider: 'aws',
        region: 'us-east-1',
        tld: 'co',
        portNumber: '5432',
        actualConnectionInfo: {
          user: connectionInfo.user,
          password: '[YOUR_PASSWORD]',
          host: connectionInfo.host,
          port: connectionInfo.port.toString(),
          database: connectionInfo.database
        }
      })

      const syntaxString = syntax.map(part => part.value).join('')
      
      // Requirement 1.5: Replace placeholders with actual configuration values
      expect(syntaxString).not.toContain('[user]')
      expect(syntaxString).not.toContain('[host]')
      expect(syntaxString).not.toContain('[db-name]')
      expect(syntaxString).toContain('myapp_admin')
      expect(syntaxString).toContain('myapp-prod.cluster-abc123.us-east-1.rds.amazonaws.com')
    })

    it('should handle complete Google Cloud SQL setup', async () => {
      // Simulate Google Cloud SQL environment configuration
      const gcpConfig = {
        POSTGRES_HOST: '10.1.2.3',
        POSTGRES_PORT: 5432,
        POSTGRES_DB: 'myapp_gcp_prod',
        POSTGRES_USER_READ_WRITE: 'gcp_admin',
        POSTGRES_USER_READ_ONLY: 'gcp_readonly',
        POSTGRES_PASSWORD: 'secure_gcp_password_456',
        ENVIRONMENT: 'production'
      }

      // Set up environment
      Object.assign(process.env, gcpConfig)

      // Complete workflow validation
      const validation = validateEnvironmentSetup()
      expect(validation.isValid).toBe(true)

      const connectionInfo = getEnvironmentConnectionInfo('myapp-gcp', 'myapp_gcp_prod', false)
      expect(connectionInfo.host).toBe('10.1.2.3')
      expect(connectionInfo.database).toBe('myapp_gcp_prod')
      expect(connectionInfo.user).toBe('gcp_admin')

      // Test read-only connection
      const readOnlyInfo = getEnvironmentConnectionInfo('myapp-gcp', 'myapp_gcp_prod', true)
      expect(readOnlyInfo.user).toBe('gcp_readonly')

      // Verify connection string generation
      const connectionString = generateConnectionString({
        databaseName: connectionInfo.database,
        useEnvironmentDefaults: true,
        maskPassword: true
      })

      expect(connectionString).toContain('10.1.2.3')
      expect(connectionString).toContain('myapp_gcp_prod')
      expect(connectionString).toContain('[YOUR_PASSWORD]')
    })

    it('should handle environment configuration changes reactively', async () => {
      // Initial configuration
      const initialConfig = {
        POSTGRES_HOST: 'initial-db.example.com',
        POSTGRES_PORT: 5432,
        POSTGRES_DB: 'initial_db',
        POSTGRES_USER_READ_WRITE: 'initial_user',
        POSTGRES_PASSWORD: 'initial_pass'
      }

      // Set up initial environment
      Object.assign(process.env, initialConfig)

      // Get initial connection info
      const initialInfo = getEnvironmentConnectionInfo('test-project', 'initial_db', false)
      expect(initialInfo.host).toBe('initial-db.example.com')

      // Update environment configuration
      const updatedConfig = {
        POSTGRES_HOST: 'updated-db.example.com',
        POSTGRES_PORT: 5433,
        POSTGRES_DB: 'updated_db',
        POSTGRES_USER_READ_WRITE: 'updated_user',
        POSTGRES_PASSWORD: 'updated_pass'
      }

      Object.assign(process.env, updatedConfig)

      // Get updated connection info
      const updatedInfo = getEnvironmentConnectionInfo('test-project', 'updated_db', false)
      expect(updatedInfo.host).toBe('updated-db.example.com')
      expect(updatedInfo.port).toBe(5433)
      expect(updatedInfo.database).toBe('updated_db')
    })
  })
})