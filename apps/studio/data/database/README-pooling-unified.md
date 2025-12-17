# Unified Pooling Configuration Queries

This module provides environment-aware pooling configuration management that automatically detects whether to use PgBouncer (platform) or Supavisor (self-hosted) based on the `IS_PLATFORM` environment variable.

## Features

- **Automatic Environment Detection**: Automatically switches between PgBouncer and Supavisor based on deployment environment
- **Unified Interface**: Consistent API across both pooling services
- **Fallback Logic**: Graceful handling when services are unavailable
- **Type Safety**: Full TypeScript support with unified types
- **Caching**: Intelligent caching strategies optimized for each environment
- **Error Handling**: Comprehensive error handling with retry logic

## Usage

### Basic Configuration Query

```typescript
import { usePoolingConfigurationQuery } from 'data/database/pooling-unified'

function MyComponent() {
  const { data: config, isLoading, error } = usePoolingConfigurationQuery({
    projectRef: 'my-project'
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <p>Service: {config.poolingService}</p>
      <p>Pool Size: {config.poolSize}</p>
      <p>Max Connections: {config.maxClientConnections}</p>
      <p>Environment: {config.environment}</p>
    </div>
  )
}
```

### Statistics and Health Monitoring

```typescript
import { 
  usePoolingStatisticsQuery, 
  usePoolingHealthQuery 
} from 'data/database/pooling-unified'

function PoolingDashboard({ projectRef }: { projectRef: string }) {
  const { data: stats } = usePoolingStatisticsQuery({ projectRef })
  const { data: health } = usePoolingHealthQuery({ projectRef })

  return (
    <div>
      <div>Health: {health?.status}</div>
      <div>Active Connections: {stats?.activeConnections}</div>
      <div>Pool Utilization: {(stats?.poolUtilization || 0) * 100}%</div>
    </div>
  )
}
```

### Configuration Updates

```typescript
import { usePoolingConfigurationUpdateMutation } from 'data/database/pooling-unified'

function PoolingSettings({ projectRef }: { projectRef: string }) {
  const updateMutation = usePoolingConfigurationUpdateMutation({
    onSuccess: () => {
      toast.success('Configuration updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`)
    }
  })

  const handleUpdate = () => {
    updateMutation.mutate({
      projectRef,
      poolSize: 30,
      maxClientConnections: 250
    })
  }

  return (
    <button onClick={handleUpdate} disabled={updateMutation.isPending}>
      Update Pool Size
    </button>
  )
}
```

### Convenience Hook

```typescript
import { useUnifiedPoolingQueries } from 'data/database/pooling-unified'

function PoolingOverview({ projectRef }: { projectRef: string }) {
  const { 
    configuration, 
    statistics, 
    health, 
    isLoading, 
    isError 
  } = useUnifiedPoolingQueries(projectRef)

  if (isLoading) return <div>Loading pooling data...</div>
  if (isError) return <div>Failed to load pooling data</div>

  return (
    <div>
      <h3>{configuration.data?.poolingService} Configuration</h3>
      <p>Pool Size: {configuration.data?.poolSize}</p>
      <p>Health: {health.data?.status}</p>
      <p>Active Connections: {statistics.data?.activeConnections}</p>
    </div>
  )
}
```

## Environment Detection

The queries automatically detect the environment:

- **Platform Environment** (`IS_PLATFORM=true`): Uses PgBouncer APIs
- **Self-hosted Environment** (`IS_PLATFORM=false`): Uses Supavisor APIs

## Caching Strategy

- **Configuration**: 5-minute stale time, 10-minute cache time
- **Statistics**: 30-second refresh for self-hosted, no auto-refresh for platform
- **Health**: 1-minute refresh for self-hosted, no auto-refresh for platform

## Error Handling

The queries include comprehensive error handling:

- **404/403 errors**: No retry (configuration issues)
- **Network errors**: Up to 2 retries
- **Service unavailable**: Fallback to default values where appropriate

## Migration from Individual Queries

### Before (Platform-specific)
```typescript
import { usePgbouncerConfigQuery } from 'data/database/pgbouncer-config-query'
import { useSupavisorConfigQuery } from 'data/database/supavisor-config-query'

// Had to manually check environment and use appropriate query
const config = IS_PLATFORM 
  ? usePgbouncerConfigQuery({ projectRef })
  : useSupavisorConfigQuery({ projectRef })
```

### After (Unified)
```typescript
import { usePoolingConfigurationQuery } from 'data/database/pooling-unified'

// Automatically detects environment and uses appropriate service
const { data: config } = usePoolingConfigurationQuery({ projectRef })
```

## Types

All queries return unified types that work across both services:

```typescript
interface UnifiedPoolingConfig {
  poolingService: 'pgbouncer' | 'supavisor'
  poolSize: number
  maxClientConnections: number
  poolMode?: 'session' | 'transaction' | 'statement'
  isEnabled: boolean
  status?: 'running' | 'stopped' | 'error' | 'unknown'
  environment: 'platform' | 'self-hosted'
}
```

This ensures type safety and consistency regardless of the underlying pooling service.