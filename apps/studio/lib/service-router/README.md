# Service Router

The Service Router provides project-level service isolation for Supabase Studio. It ensures that each project has completely isolated database connections, configurations, and access controls.

## Overview

The Service Router consists of four main components:

1. **ConnectionPoolManager** - Manages per-project database connection pools
2. **ProjectConfigStorage** - Stores and caches project configurations
3. **AccessValidator** - Validates user access and enforces rate limits
4. **ServiceRouter** - Main orchestrator that ties everything together

## Architecture

```
ServiceRouter
├── ConnectionPoolManager (manages connection pools)
├── ProjectConfigStorage (caches project configs)
└── AccessValidator (validates access & rate limits)
```

## Usage

### Basic Setup

```typescript
import { getServiceRouter } from '@/lib/service-router'

const router = getServiceRouter()
```

### Registering a Project

```typescript
import { ProjectConfig } from '@/lib/service-router'

const config: ProjectConfig = {
  projectRef: 'my-project',
  databaseName: 'my_project_db',
  connectionString: 'postgresql://user:pass@localhost:5432/my_project_db',
  ownerUserId: 'user-123',
  createdAt: new Date(),
  updatedAt: new Date(),
}

await router.registerProject(config)
```

### Executing Queries

```typescript
// Simple query
const result = await router.query(
  'my-project',
  'SELECT * FROM users WHERE id = $1',
  ['user-id']
)

// Using a client
const client = await router.getClient('my-project')
try {
  const result = await client.query('SELECT * FROM users')
  console.log(result.rows)
} finally {
  client.release()
}

// Using withClient helper
await router.withClient('my-project', async (client) => {
  const result = await client.query('SELECT * FROM users')
  return result.rows
})

// Using transactions
await router.withTransaction('my-project', async (client) => {
  await client.query('INSERT INTO users (name) VALUES ($1)', ['Alice'])
  await client.query('INSERT INTO logs (action) VALUES ($1)', ['user_created'])
  // Automatically commits on success, rolls back on error
})
```

### Access Validation

```typescript
import { NextApiRequest } from 'next'

// In an API route
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const projectRef = req.query.ref as string
  
  // Validate access
  const validation = await router.validateRequest(req, projectRef)
  
  if (!validation.allowed) {
    return res.status(403).json({ error: validation.reason })
  }
  
  // User has access, proceed with operation
  const userId = validation.userId
  // ... your code here
}

// Using the middleware helper
import { withProjectAccess } from '@/lib/service-router'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const projectRef = req.query.ref as string
  
  const result = await withProjectAccess(req, projectRef, async (userId) => {
    // This code only runs if user has access
    return await router.query(projectRef, 'SELECT * FROM users')
  })
  
  if (result.error) {
    return res.status(result.status).json({ error: result.error })
  }
  
  return res.json(result)
}
```

### Connection Pool Management

```typescript
// Get pool statistics
const stats = router.getPoolStats('my-project')
console.log(`Total connections: ${stats?.totalCount}`)
console.log(`Idle connections: ${stats?.idleCount}`)
console.log(`Waiting requests: ${stats?.waitingCount}`)

// Get stats for all projects
const allStats = router.getAllPoolStats()
for (const [projectRef, stats] of allStats) {
  console.log(`${projectRef}: ${stats.totalCount} connections`)
}

// Health check
const isHealthy = await router.healthCheck('my-project')
if (!isHealthy) {
  console.error('Database connection is unhealthy')
}

// Close a specific pool
await router.closePool('my-project')

// Close all pools (useful for graceful shutdown)
await router.closeAllPools()
```

### Cache Management

```typescript
// Invalidate cache for a specific project
router.invalidateCache('my-project')

// Invalidate all caches
router.invalidateAllCaches()

// Check if project is registered
const isRegistered = await router.isProjectRegistered('my-project')

// Get project configuration
const config = await router.getProjectConfig('my-project')
```

### Rate Limiting

```typescript
// Get rate limit stats
const rateLimitStats = router.getRateLimitStats('my-project')
if (rateLimitStats) {
  console.log(`Requests: ${rateLimitStats.count}`)
  console.log(`Resets at: ${new Date(rateLimitStats.resetAt)}`)
}

// Reset rate limit (useful for testing or admin operations)
router.resetRateLimit('my-project')
```

## Configuration

### Connection Pool Configuration

Default configuration:
- Max connections per project: 10
- Idle timeout: 5 minutes
- Connection timeout: 30 seconds

You can customize these when registering a project:

```typescript
import { ProjectPoolConfig } from '@/lib/service-router'

const poolConfig: ProjectPoolConfig = {
  projectRef: 'my-project',
  databaseName: 'my_project_db',
  connectionString: 'postgresql://...',
  maxConnections: 20,
  idleTimeoutMillis: 10 * 60 * 1000, // 10 minutes
  connectionTimeoutMillis: 60 * 1000, // 60 seconds
}
```

### Cache Configuration

Default configuration:
- TTL: 5 minutes
- Cleanup interval: 1 minute

### Rate Limit Configuration

Default configuration:
- Max requests: 100 per minute
- Window: 60 seconds

Custom rate limits:

```typescript
const validation = await router.validateRequest(req, projectRef)

// Or use AccessValidator directly for custom limits
import { getAccessValidator } from '@/lib/service-router'

const validator = getAccessValidator()
const result = validator.checkRateLimit('my-project', {
  maxRequests: 1000,
  windowMs: 60 * 1000, // 1 minute
})
```

## Error Handling

```typescript
try {
  await router.query('my-project', 'SELECT * FROM users')
} catch (error) {
  if (error.message.includes('Project not registered')) {
    // Handle unregistered project
  } else if (error.code === 'ECONNREFUSED') {
    // Handle connection error
  } else {
    // Handle other errors
  }
}
```

## Best Practices

1. **Always release clients**: Use `withClient` or manually release clients to avoid connection leaks
2. **Use transactions**: Use `withTransaction` for operations that need atomicity
3. **Monitor pool stats**: Regularly check pool statistics to identify connection issues
4. **Implement health checks**: Use `healthCheck()` in your monitoring system
5. **Handle rate limits**: Implement proper error handling for rate limit errors
6. **Cache invalidation**: Invalidate cache when project configuration changes
7. **Graceful shutdown**: Call `closeAllPools()` during application shutdown

## Testing

```typescript
import { ServiceRouter } from '@/lib/service-router/ServiceRouter'

describe('My API', () => {
  let router: ServiceRouter

  beforeEach(() => {
    router = new ServiceRouter()
  })

  afterEach(async () => {
    await router.closeAllPools()
  })

  it('should handle project operations', async () => {
    // Your tests here
  })
})
```

## Security Considerations

1. **Access validation**: Always validate user access before executing queries
2. **Rate limiting**: Enforce rate limits to prevent abuse
3. **Connection strings**: Never expose connection strings to clients
4. **SQL injection**: Use parameterized queries to prevent SQL injection
5. **Audit logging**: Log all cross-project access attempts

## Performance Tips

1. **Connection pooling**: Reuse connections instead of creating new ones
2. **Cache configuration**: Adjust TTL based on your update frequency
3. **Pool size**: Set appropriate max connections based on your workload
4. **Idle timeout**: Close idle connections to free resources
5. **Query optimization**: Use indexes and optimize queries for better performance

## Troubleshooting

### Connection pool exhausted

```typescript
const stats = router.getPoolStats('my-project')
if (stats && stats.waitingCount > 0) {
  console.warn('Connection pool exhausted, consider increasing max connections')
}
```

### High memory usage

```typescript
// Close idle pools
const allStats = router.getAllPoolStats()
for (const [projectRef, stats] of allStats) {
  if (stats.idleCount === stats.totalCount) {
    await router.closePool(projectRef)
  }
}
```

### Rate limit issues

```typescript
const stats = router.getRateLimitStats('my-project')
if (stats && stats.count > 80) {
  console.warn('Approaching rate limit')
}
```

## Related Documentation

- [Project Initialization Service](../project-initialization/README.md)
- [Requirements Document](../../../../.kiro/specs/project-level-service-isolation/requirements.md)
- [Design Document](../../../../.kiro/specs/project-level-service-isolation/design.md)
