# Project-Level Service Isolation - Developer Guide

## Introduction

This guide provides technical details for developers working with or extending the project-level service isolation feature in Supabase Studio. It covers architecture, service integration, API reference, and testing strategies.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Service Integration Guide](#service-integration-guide)
3. [API Reference](#api-reference)
4. [Testing Guide](#testing-guide)
5. [Development Workflow](#development-workflow)
6. [Extending the System](#extending-the-system)

## Architecture Overview

### High-Level Architecture

The project-level service isolation system uses a **shared service + database isolation** strategy:

- **Shared**: Single instances of GoTrue, Storage, Realtime, etc.
- **Isolated**: Each project has its own database and schemas
- **Routing**: Service Router directs requests to the correct project database

### Key Components

```
┌─────────────────────────────────────────────────────────┐
│                     Studio UI Layer                      │
│  - Project Context Management                            │
│  - Service-specific UI Components                        │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   Service Router                         │
│  - Connection Pool Management                            │
│  - Project Configuration Storage                         │
│  - Access Validation                                     │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼──────┐ ┌───▼────────┐ ┌─▼──────────┐
│ Auth Service │ │  Storage   │ │  Realtime  │
│   Adapter    │ │  Adapter   │ │  Adapter   │
└───────┬──────┘ └───┬────────┘ └─┬──────────┘
        │            │              │
┌───────▼────────────▼──────────────▼───────────┐
│         Project-Specific Databases             │
│  - project_a: auth, storage, public schemas    │
│  - project_b: auth, storage, public schemas    │
└────────────────────────────────────────────────┘
```

### Two-Tier User System

Understanding the dual user system is critical:

#### Studio Users (Tier 1)
- **Database**: `postgres` (main Studio database)
- **Schema**: `auth.users`
- **Purpose**: Authenticate to Studio, manage projects
- **GoTrue Instance**: Shared Studio GoTrue
- **Connection**: `postgres://...@db:5432/postgres`

#### Project Users (Tier 2)
- **Database**: Per-project databases (`project_a`, `project_b`, etc.)
- **Schema**: `auth.users` in each project database
- **Purpose**: Application end users
- **GoTrue Instance**: Dynamically routed via Service Router
- **Connection**: `postgres://...@db:5432/{project_database}`

### Data Flow

#### Project Creation Flow

```typescript
// 1. User creates project via Studio UI
POST /api/platform/projects/create
  ↓
// 2. Create project database
CREATE DATABASE project_abc123
  ↓
// 3. Initialize schemas
ProjectInitializationService.initializeAuthSchema()
ProjectInitializationService.initializeStorageSchema()
ProjectInitializationService.initializeWebhooksSchema()
ProjectInitializationService.initializeAnalyticsSchema()
  ↓
// 4. Create directory structure
createProjectDirectories(projectRef)
  ↓
// 5. Register with Service Router
ServiceRouter.registerProject(projectRef, config)
  ↓
// 6. Return project info
```

#### Service Request Flow

```typescript
// 1. Client makes request with project_ref
GET /api/auth/users?project_ref=project_abc123
  ↓
// 2. Validate user owns project
validateProjectAccess(projectRef, userId)
  ↓
// 3. Get project database connection
connection = ServiceRouter.getConnection(projectRef)
  ↓
// 4. Execute query on project database
SELECT * FROM auth.users
  ↓
// 5. Return results
```

## Service Integration Guide

### 1. Service Router

The Service Router is the central component that manages database connections and routes requests.

#### Core Interface

```typescript
interface ServiceRouter {
  getConnection(projectRef: string): Promise<DatabaseConnection>
  registerProject(projectRef: string, config: ProjectConfig): void
  unregisterProject(projectRef: string): void
  validateProjectAccess(projectRef: string, userId: string): Promise<boolean>
}
```

#### Implementation Location

- **File**: `apps/studio/lib/service-router/ServiceRouter.ts`
- **Dependencies**: 
  - `ConnectionPoolManager.ts`
  - `ProjectConfigStorage.ts`

#### Usage Example

```typescript
import { ServiceRouter } from '@/lib/service-router'

const router = ServiceRouter.getInstance()

// Register a new project
router.registerProject('project-abc', {
  projectRef: 'project-abc',
  databaseName: 'project_abc123',
  connectionString: 'postgres://...',
  ownerUserId: 'user-123'
})

// Get connection for a project
const connection = await router.getConnection('project-abc')
const result = await connection.query('SELECT * FROM auth.users')
```

### 2. Auth Service Adapter

Provides isolated authentication for each project.

#### Interface

```typescript
interface AuthServiceAdapter {
  signUp(projectRef: string, email: string, password: string): Promise<User>
  signIn(projectRef: string, email: string, password: string): Promise<Session>
  signOut(projectRef: string, token: string): Promise<void>
  getUser(projectRef: string, token: string): Promise<User>
  listUsers(projectRef: string): Promise<User[]>
}
```

#### Implementation Location

- **File**: `apps/studio/lib/auth-service/AuthServiceAdapter.ts`

#### Key Features

- Dynamic database connection switching
- Project-specific user isolation
- JWT token validation with project context

#### Usage Example

```typescript
import { AuthServiceAdapter } from '@/lib/auth-service'

const authService = new AuthServiceAdapter()

// Sign up user in specific project
const user = await authService.signUp(
  'project-abc',
  'user@example.com',
  'password123'
)

// List users for a project
const users = await authService.listUsers('project-abc')
```

### 3. Storage Service Adapter

Provides isolated file storage for each project.

#### Interface

```typescript
interface StorageServiceAdapter {
  createBucket(projectRef: string, bucketName: string, options: BucketOptions): Promise<Bucket>
  uploadFile(projectRef: string, bucket: string, path: string, file: File): Promise<FileObject>
  downloadFile(projectRef: string, bucket: string, path: string): Promise<Blob>
  listBuckets(projectRef: string): Promise<Bucket[]>
  deleteBucket(projectRef: string, bucketName: string): Promise<void>
}
```

#### Implementation Location

- **File**: `apps/studio/lib/storage-service/StorageServiceAdapter.ts`

#### File Path Structure

```
/var/lib/storage/
  {project_ref}/
    {bucket_name}/
      {file_path}
```

#### Usage Example

```typescript
import { StorageServiceAdapter } from '@/lib/storage-service'

const storageService = new StorageServiceAdapter()

// Create bucket in specific project
await storageService.createBucket('project-abc', 'avatars', {
  public: true
})

// Upload file
await storageService.uploadFile(
  'project-abc',
  'avatars',
  'user-123.jpg',
  fileBlob
)
```

### 4. Realtime Service Adapter

Provides isolated real-time subscriptions for each project.

#### Interface

```typescript
interface RealtimeServiceAdapter {
  subscribe(projectRef: string, channel: string, callback: EventCallback): Subscription
  unsubscribe(projectRef: string, subscriptionId: string): void
  broadcast(projectRef: string, channel: string, event: Event): void
  getActiveChannels(projectRef: string): Promise<Channel[]>
}
```

#### Implementation Location

- **File**: `apps/studio/lib/realtime-service/RealtimeServiceAdapter.ts`

#### Channel Naming Convention

```
realtime:{project_ref}:{table_name}
realtime:{project_ref}:custom:{channel_name}
```

### 5. Functions Service Adapter

Provides isolated Edge Functions for each project.

#### Interface

```typescript
interface FunctionsServiceAdapter {
  deployFunction(projectRef: string, name: string, code: string): Promise<Function>
  invokeFunction(projectRef: string, name: string, payload: any): Promise<Response>
  listFunctions(projectRef: string): Promise<Function[]>
  deleteFunction(projectRef: string, name: string): Promise<void>
  setEnvVar(projectRef: string, key: string, value: string): Promise<void>
}
```

#### Implementation Location

- **File**: `apps/studio/lib/functions-service/FunctionsServiceAdapter.ts`

### 6. Webhook Service Adapter

Provides isolated webhook configuration for each project.

#### Interface

```typescript
interface WebhookServiceAdapter {
  createWebhook(projectRef: string, config: WebhookConfig): Promise<Webhook>
  triggerWebhook(projectRef: string, event: string, payload: any): Promise<void>
  listWebhooks(projectRef: string): Promise<Webhook[]>
  deleteWebhook(projectRef: string, webhookId: string): Promise<void>
}
```

#### Implementation Location

- **File**: `apps/studio/lib/webhook-service/WebhookServiceAdapter.ts`

### 7. Logs Service Adapter

Provides isolated logging for each project.

#### Interface

```typescript
interface LogsServiceAdapter {
  log(projectRef: string, level: LogLevel, message: string, metadata?: any): void
  query(projectRef: string, filters: LogFilters): Promise<LogEntry[]>
  export(projectRef: string, format: 'json' | 'csv', filters: LogFilters): Promise<Blob>
}
```

#### Implementation Location

- **File**: `apps/studio/lib/logs-service/LogsServiceAdapter.ts`

### 8. Analytics Service Adapter

Provides isolated analytics for each project.

#### Interface

```typescript
interface AnalyticsServiceAdapter {
  trackEvent(projectRef: string, event: AnalyticsEvent): void
  getMetrics(projectRef: string, metrics: string[], timeRange: TimeRange): Promise<MetricData[]>
  getDatabaseSize(projectRef: string): Promise<number>
}
```

#### Implementation Location

- **File**: `apps/studio/lib/analytics-service/AnalyticsServiceAdapter.ts`

## API Reference

### Project Creation API

**Endpoint**: `POST /api/platform/projects/create`

**Request Body**:
```typescript
{
  name: string
  organization_id: string
  database_password: string
  region?: string
}
```

**Response**:
```typescript
{
  id: string
  ref: string
  name: string
  organization_id: string
  database_name: string
  status: 'active' | 'initializing' | 'failed'
  created_at: string
}
```

### Auth API

**List Users**: `GET /api/auth/users?project_ref={ref}`

**Sign Up**: `POST /api/auth/signup`
```typescript
{
  project_ref: string
  email: string
  password: string
}
```

### Storage API

**List Buckets**: `GET /api/storage/buckets?project_ref={ref}`

**Create Bucket**: `POST /api/storage/buckets`
```typescript
{
  project_ref: string
  name: string
  public: boolean
}
```

### Webhooks API

**List Webhooks**: `GET /api/webhooks?project_ref={ref}`

**Create Webhook**: `POST /api/webhooks`
```typescript
{
  project_ref: string
  url: string
  events: string[]
  secret?: string
}
```

## Testing Guide

### Unit Testing

#### Testing Service Adapters

```typescript
import { AuthServiceAdapter } from '@/lib/auth-service'
import { describe, it, expect, beforeEach } from 'vitest'

describe('AuthServiceAdapter', () => {
  let authService: AuthServiceAdapter
  
  beforeEach(() => {
    authService = new AuthServiceAdapter()
  })
  
  it('should isolate users between projects', async () => {
    // Create user in project A
    await authService.signUp('project-a', 'user@a.com', 'pass')
    
    // List users in project B
    const usersB = await authService.listUsers('project-b')
    
    // User from project A should not appear
    expect(usersB).not.toContainEqual(
      expect.objectContaining({ email: 'user@a.com' })
    )
  })
})
```

#### Testing Service Router

```typescript
import { ServiceRouter } from '@/lib/service-router'
import { describe, it, expect } from 'vitest'

describe('ServiceRouter', () => {
  it('should return different connections for different projects', async () => {
    const router = ServiceRouter.getInstance()
    
    const connA = await router.getConnection('project-a')
    const connB = await router.getConnection('project-b')
    
    expect(connA).not.toBe(connB)
  })
})
```

### Property-Based Testing

We use **fast-check** for property-based testing with a minimum of 100 iterations per test.

#### Example: Auth Isolation Property

```typescript
import fc from 'fast-check'
import { describe, it } from 'vitest'
import { AuthServiceAdapter } from '@/lib/auth-service'

// Feature: project-level-service-isolation, Property 1: Auth Isolation
// Validates: Requirements 1.3, 1.4
describe('Property: Auth Isolation', () => {
  it('users in project A cannot authenticate to project B', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // projectRefA
        fc.string(), // projectRefB
        fc.emailAddress(),
        fc.string({ minLength: 8 }),
        async (projectA, projectB, email, password) => {
          fc.pre(projectA !== projectB) // Ensure different projects
          
          const authService = new AuthServiceAdapter()
          
          // Sign up in project A
          await authService.signUp(projectA, email, password)
          
          // Try to sign in to project B
          await expect(
            authService.signIn(projectB, email, password)
          ).rejects.toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### Integration Testing

#### End-to-End Project Creation Test

```typescript
import { describe, it, expect } from 'vitest'
import { ProjectInitializationService } from '@/lib/project-initialization'
import { ServiceRouter } from '@/lib/service-router'

describe('Project Creation Integration', () => {
  it('should create project with all services', async () => {
    const projectRef = 'test-project-' + Date.now()
    const initService = new ProjectInitializationService()
    
    // Create project
    const result = await initService.initializeProject(
      projectRef,
      `db_${projectRef}`
    )
    
    expect(result.success).toBe(true)
    expect(result.schemasCreated).toContain('auth')
    expect(result.schemasCreated).toContain('storage')
    
    // Verify service router has connection
    const router = ServiceRouter.getInstance()
    const connection = await router.getConnection(projectRef)
    expect(connection).toBeDefined()
    
    // Cleanup
    await initService.rollbackInitialization(projectRef)
  })
})
```

## Development Workflow

### Setting Up Development Environment

1. **Clone the repository**
```bash
git clone https://github.com/supabase/supabase
cd supabase
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Start local services**
```bash
cd docker
docker-compose up -d
```

4. **Run Studio in development mode**
```bash
cd apps/studio
pnpm dev
```

### Making Changes

1. **Create a feature branch**
```bash
git checkout -b feature/my-service-adapter
```

2. **Implement your changes**
   - Add service adapter in `apps/studio/lib/{service}-service/`
   - Add tests in `apps/studio/tests/lib/{service}-service.test.ts`
   - Update API routes if needed

3. **Run tests**
```bash
pnpm test
```

4. **Run type checking**
```bash
pnpm type-check
```

5. **Commit and push**
```bash
git add .
git commit -m "feat: add new service adapter"
git push origin feature/my-service-adapter
```

### Code Style Guidelines

- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public APIs
- Write tests for all new functionality
- Use async/await instead of promises
- Handle errors explicitly

## Extending the System

### Adding a New Service Adapter

1. **Create the adapter interface**

```typescript
// apps/studio/lib/my-service/types.ts
export interface MyServiceAdapter {
  doSomething(projectRef: string, params: Params): Promise<Result>
}
```

2. **Implement the adapter**

```typescript
// apps/studio/lib/my-service/MyServiceAdapter.ts
import { ServiceRouter } from '@/lib/service-router'

export class MyServiceAdapter implements MyServiceAdapter {
  private router: ServiceRouter
  
  constructor() {
    this.router = ServiceRouter.getInstance()
  }
  
  async doSomething(projectRef: string, params: Params): Promise<Result> {
    // Get project-specific connection
    const connection = await this.router.getConnection(projectRef)
    
    // Execute operation on project database
    const result = await connection.query(
      'SELECT * FROM my_schema.my_table WHERE ...'
    )
    
    return result
  }
}
```

3. **Add schema initialization**

```typescript
// apps/studio/lib/project-initialization/schemas/my-service.sql
CREATE SCHEMA IF NOT EXISTS my_service;

CREATE TABLE my_service.my_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_ref TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_my_table_project ON my_service.my_table(project_ref);
```

4. **Update ProjectInitializationService**

```typescript
async initializeMyServiceSchema(databaseName: string): Promise<void> {
  const sql = await fs.readFile('./schemas/my-service.sql', 'utf-8')
  await this.executeSQL(databaseName, sql)
}
```

5. **Add tests**

```typescript
// apps/studio/tests/lib/my-service.test.ts
describe('MyServiceAdapter', () => {
  it('should isolate data between projects', async () => {
    // Test implementation
  })
})
```

6. **Add API routes**

```typescript
// apps/studio/pages/api/my-service/index.ts
export default async function handler(req, res) {
  const { project_ref } = req.query
  
  // Validate access
  const hasAccess = await validateProjectAccess(project_ref, req.user.id)
  if (!hasAccess) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  
  // Use adapter
  const adapter = new MyServiceAdapter()
  const result = await adapter.doSomething(project_ref, req.body)
  
  return res.json(result)
}
```

### Best Practices for Extensions

1. **Always validate project access** before any operation
2. **Use the Service Router** for database connections
3. **Include project_ref** in all API calls
4. **Write property-based tests** for isolation guarantees
5. **Document your API** with TypeScript interfaces
6. **Handle errors gracefully** with proper error messages
7. **Log operations** for debugging and auditing

## Debugging

### Enable Debug Logging

```typescript
// Set environment variable
DEBUG=service-router,auth-service,storage-service

// Or in code
import debug from 'debug'
const log = debug('my-service')
log('Operation completed', { projectRef, result })
```

### Common Issues

#### Connection Pool Exhaustion

**Symptom**: "Too many connections" errors

**Solution**:
```typescript
// Adjust pool size in ServiceRouter
const pool = new Pool({
  max: 20, // Increase from default 10
  idleTimeoutMillis: 30000
})
```

#### Schema Not Found

**Symptom**: "relation does not exist" errors

**Solution**:
- Verify schema was created during project initialization
- Check `ProjectInitializationService` logs
- Manually verify: `\dn` in psql

#### Cross-Project Access

**Symptom**: Users seeing data from other projects

**Solution**:
- Verify `project_ref` is passed correctly
- Check Service Router is returning correct connection
- Add logging to trace the connection being used

## Performance Optimization

### Connection Pooling

```typescript
// Configure pool per project
const poolConfig = {
  max: 10,                    // Maximum connections
  min: 2,                     // Minimum connections
  idleTimeoutMillis: 300000,  // 5 minutes
  connectionTimeoutMillis: 5000
}
```

### Query Optimization

```typescript
// Use prepared statements
const result = await connection.query({
  text: 'SELECT * FROM auth.users WHERE email = $1',
  values: [email]
})

// Add appropriate indexes
CREATE INDEX idx_users_email ON auth.users(email);
```

### Caching

```typescript
// Cache project configurations
const configCache = new Map<string, ProjectConfig>()

async function getProjectConfig(projectRef: string): Promise<ProjectConfig> {
  if (configCache.has(projectRef)) {
    return configCache.get(projectRef)!
  }
  
  const config = await loadConfigFromDB(projectRef)
  configCache.set(projectRef, config)
  
  return config
}
```

## Security Considerations

### Input Validation

```typescript
// Always validate project_ref format
function validateProjectRef(ref: string): boolean {
  return /^[a-z0-9-]+$/.test(ref)
}

// Sanitize user input
import { escape } from 'pg'
const safeEmail = escape(userEmail)
```

### Access Control

```typescript
// Verify user owns project
async function validateProjectAccess(
  projectRef: string,
  userId: string
): Promise<boolean> {
  const project = await getProject(projectRef)
  return project.owner_user_id === userId
}
```

### Secrets Management

```typescript
// Never log sensitive data
log('User signed in', { 
  projectRef, 
  userId,
  // password: NEVER LOG THIS
})

// Use environment variables
const dbPassword = process.env.DB_PASSWORD
```

## Resources

- **Design Document**: `.kiro/specs/project-level-service-isolation/design.md`
- **Requirements**: `.kiro/specs/project-level-service-isolation/requirements.md`
- **User Guide**: `apps/studio/docs/USER-GUIDE.md`
- **Operations Guide**: `apps/studio/docs/OPERATIONS-GUIDE.md`

## Contributing

When contributing to the service isolation system:

1. Read the design document thoroughly
2. Understand the two-tier user system
3. Write tests for all new functionality
4. Ensure backward compatibility
5. Update documentation
6. Follow the code review process

## Support

For technical questions:
- Check existing documentation
- Review test files for examples
- Consult the design document
- Ask in the development channel

Happy coding! 🚀
