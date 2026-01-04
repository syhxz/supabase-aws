/**
 * Environment Configuration Display Component
 * 
 * Demonstrates reactive UI updates when configuration changes
 * Requirements: 3.3, 3.4
 */

import React, { useState, useEffect } from 'react'
import { Button } from 'ui'
import { useEnvironmentConfig, useConnectionString, useAllConnectionStrings } from '../../../hooks/useEnvironmentConfig'
import type { ConnectionConfigOptions } from '../../../lib/environment-config-handler'

interface EnvironmentConfigDisplayProps {
  projectRef: string
  databaseId: string
  readOnly?: boolean
}

/**
 * Component that displays environment configuration and connection strings
 * with reactive updates when configuration changes
 * 
 * Requirement 3.4: Reactive UI updates when configuration changes
 */
export function EnvironmentConfigDisplay({ 
  projectRef, 
  databaseId, 
  readOnly = false 
}: EnvironmentConfigDisplayProps) {
  const {
    config,
    isLoading,
    error,
    updateConfig,
    validateConfig,
    reloadFromEnvironment
  } = useEnvironmentConfig()

  const connectionOptions: ConnectionConfigOptions = {
    projectRef,
    databaseId,
    readOnly,
    maskPassword: true
  }

  const connectionString = useConnectionString(connectionOptions)
  const allConnectionStrings = useAllConnectionStrings(connectionOptions)

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; errors: string[] } | null>(null)

  // Validate configuration on mount and when config changes
  useEffect(() => {
    const result = validateConfig()
    setValidationResult(result)
  }, [config, validateConfig])

  const handleConfigUpdate = (key: keyof typeof config, value: string | number) => {
    updateConfig({ [key]: value })
  }

  const handleReloadConfig = () => {
    reloadFromEnvironment()
  }

  const handleValidateConfig = () => {
    const result = validateConfig()
    setValidationResult(result)
  }

  return (
    <div className="space-y-6">
      {/* Environment Status */}
      <div className="bg-surface-100 border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Environment Configuration</h3>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              config.ENVIRONMENT === 'production' 
                ? 'bg-red-100 text-red-800' 
                : config.ENVIRONMENT === 'staging'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-green-100 text-green-800'
            }`}>
              {config.ENVIRONMENT.toUpperCase()}
            </span>
            <Button
              type="default"
              size="tiny"
              onClick={handleReloadConfig}
              loading={isLoading}
            >
              Reload
            </Button>
          </div>
        </div>

        {/* Configuration Status */}
        {validationResult && (
          <div className={`mb-4 p-3 rounded ${
            validationResult.isValid 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                validationResult.isValid ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className={`text-sm font-medium ${
                validationResult.isValid ? 'text-green-800' : 'text-red-800'
              }`}>
                Configuration {validationResult.isValid ? 'Valid' : 'Invalid'}
              </span>
            </div>
            {!validationResult.isValid && validationResult.errors.length > 0 && (
              <ul className="mt-2 text-sm text-red-700">
                {validationResult.errors.map((error, index) => (
                  <li key={index} className="ml-4">• {error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Basic Configuration */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-foreground-light mb-1">
              Host
            </label>
            <input
              type="text"
              value={config.POSTGRES_HOST}
              onChange={(e) => handleConfigUpdate('POSTGRES_HOST', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded text-sm"
              placeholder="localhost"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-light mb-1">
              Port
            </label>
            <input
              type="number"
              value={config.POSTGRES_PORT}
              onChange={(e) => handleConfigUpdate('POSTGRES_PORT', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-border rounded text-sm"
              placeholder="5432"
            />
          </div>
        </div>

        {/* Advanced Configuration */}
        <div className="mb-4">
          <Button
            type="default"
            size="tiny"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
          </Button>
        </div>

        {showAdvanced && (
          <div className="space-y-4 p-4 bg-surface-200 rounded">
            <div>
              <label className="block text-sm font-medium text-foreground-light mb-1">
                Database Name
              </label>
              <input
                type="text"
                value={config.POSTGRES_DB}
                onChange={(e) => handleConfigUpdate('POSTGRES_DB', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded text-sm"
                placeholder="postgres"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-light mb-1">
                Read-Write User
              </label>
              <input
                type="text"
                value={config.POSTGRES_USER_READ_WRITE}
                onChange={(e) => handleConfigUpdate('POSTGRES_USER_READ_WRITE', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded text-sm"
                placeholder="supabase_admin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-light mb-1">
                Read-Only User
              </label>
              <input
                type="text"
                value={config.POSTGRES_USER_READ_ONLY}
                onChange={(e) => handleConfigUpdate('POSTGRES_USER_READ_ONLY', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded text-sm"
                placeholder="supabase_read_only_user"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-light mb-1">
                Environment
              </label>
              <select
                value={config.ENVIRONMENT}
                onChange={(e) => handleConfigUpdate('ENVIRONMENT', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded text-sm"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Connection String Display */}
      <div className="bg-surface-100 border border-border rounded-lg p-4">
        <h3 className="text-lg font-medium mb-4">Connection Strings</h3>
        
        {/* Primary Connection String */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground-light mb-2">
            PostgreSQL Connection String
          </label>
          <div className="bg-surface-200 p-3 rounded font-mono text-sm break-all">
            {connectionString}
          </div>
        </div>

        {/* All Connection Formats */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground-light mb-1">
              psql Command
            </label>
            <div className="bg-surface-200 p-2 rounded font-mono text-xs break-all">
              {allConnectionStrings.psql}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground-light mb-1">
              JDBC URL
            </label>
            <div className="bg-surface-200 p-2 rounded font-mono text-xs break-all">
              {allConnectionStrings.jdbc}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground-light mb-1">
              .NET Connection String
            </label>
            <div className="bg-surface-200 p-2 rounded font-mono text-xs break-all">
              {allConnectionStrings.dotnet}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground-light mb-1">
              Node.js Environment Variable
            </label>
            <div className="bg-surface-200 p-2 rounded font-mono text-xs break-all">
              {allConnectionStrings.nodejs}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-2">
        <Button
          type="default"
          onClick={handleValidateConfig}
        >
          Validate Configuration
        </Button>
        <Button
          type="default"
          onClick={handleReloadConfig}
          loading={isLoading}
        >
          Reload from Environment
        </Button>
      </div>
    </div>
  )
}

export default EnvironmentConfigDisplay