# Functions Service Adapter

The Functions Service Adapter provides project-isolated edge functions services for Supabase Studio.

## Overview

Each project has its own:
- Function directory structure
- Environment variables
- Function metadata
- Isolated execution context

## Directory Structure

```
/var/lib/functions/
  project-a/
    hello-world/
      index.ts
      metadata.json
      .env
    api-handler/
      index.ts
      metadata.json
      .env
  project-b/
    webhook-handler/
      index.ts
      metadata.json
      .env
```

## Usage

### Create Project Directories

```typescript
import { getFunctionsServiceAdapter } from './FunctionsServiceAdapter'

const adapter = getFunctionsServiceAdapter()

// Create directories for a new project
await adapter.createProjectDirectories('project-a')
```

### Deploy a Function

```typescript
const functionCode = `
export default async function handler(req: Request) {
  return new Response('Hello World!', {
    headers: { 'Content-Type': 'text/plain' }
  })
}
`

await adapter.deployFunction('project-a', 'hello-world', functionCode, {
  entrypoint: 'handler',
  version: '1.0.0'
})
```

### Invoke a Function

```typescript
const response = await adapter.invokeFunction('project-a', 'hello-world', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
  body: { message: 'test' }
})

console.log(response.status, response.body)
```

### Set Environment Variables

```typescript
await adapter.setEnvVar('project-a', 'hello-world', 'API_KEY', 'secret-key')
await adapter.setEnvVar('project-a', 'hello-world', 'DATABASE_URL', 'postgres://...')
```

### List Functions

```typescript
const functions = await adapter.listFunctions('project-a')
console.log(functions)
```

## Isolation Guarantees

1. **Code Isolation**: Function code is stored in project-specific directories
2. **Environment Variable Isolation**: Each function has its own .env file
3. **Execution Context Isolation**: Functions execute with project-specific database connections
4. **Metadata Isolation**: Function metadata is stored separately per project

## Security Considerations

- Function names are validated to prevent directory traversal attacks
- Environment variables are stored in project-specific files
- Functions cannot access other projects' code or environment variables
- All file operations are scoped to the project directory

## Configuration

Environment variables:
- `FUNCTIONS_BASE_PATH`: Base directory for function storage (default: `/var/lib/functions`)

## Testing

See `apps/studio/tests/lib/functions-service.test.ts` for unit tests.
