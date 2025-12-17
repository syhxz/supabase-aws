# Service Isolation UI Integration

This document describes how the Studio UI has been updated to support project-level service isolation.

## Overview

All service-related pages (Auth, Storage, Functions, Logs) now ensure that:
1. Project ref is always included in service calls
2. Data is properly isolated by project
3. Users only see data for the currently selected project

## Implementation

### Project Context Hook

A new `useProjectContext()` hook has been created to ensure consistent project context across all pages:

```typescript
import { useProjectContext } from 'lib/hooks/useProjectContext'

function MyComponent() {
  const { projectRef, connectionString, isReady } = useProjectContext()
  
  // Use projectRef and connectionString in your queries
}
```

### Updated Pages

#### 1. Auth Pages (`/project/[ref]/auth/*`)

**Changes:**
- All auth queries now explicitly use `projectRef` from URL params
- User lists display only users from the current project's auth schema
- User operations (create, delete, update) are scoped to the current project

**Key Files:**
- `pages/project/[ref]/auth/users.tsx` - User management page
- `components/interfaces/Auth/Users/UsersV2.tsx` - User list component
- `data/auth/users-infinite-query.ts` - User data fetching

**Verification:**
```bash
# Test that users are isolated by project
./test-user-isolation.sh
```

#### 2. Storage Pages (`/project/[ref]/storage/*`)

**Changes:**
- All storage queries include `projectRef` parameter
- Bucket lists show only buckets from the current project's storage schema
- File operations are scoped to the current project's storage directory

**Key Files:**
- `pages/project/[ref]/storage/files/index.tsx` - Storage files page
- `components/interfaces/Storage/FilesBuckets/index.tsx` - Buckets component

**Verification:**
```bash
# Test that storage is isolated by project
./verify-service-isolation.sh storage
```

#### 3. Functions Pages (`/project/[ref]/functions/*`)

**Changes:**
- Function lists display only functions from the current project
- Function deployments are scoped to project-specific directories
- Environment variables are isolated by project

**Key Files:**
- `pages/project/[ref]/functions/index.tsx` - Functions list page
- `pages/project/[ref]/functions/[functionSlug]/index.tsx` - Function details page

**Verification:**
```bash
# Test that functions are isolated by project
./verify-service-isolation.sh functions
```

#### 4. Logs Pages (`/project/[ref]/logs/*`)

**Changes:**
- Log queries filter by `projectRef`
- Log displays show only logs from the current project
- Log exports include only current project's logs

**Key Files:**
- `pages/project/[ref]/logs/index.tsx` - Logs overview page
- `pages/project/[ref]/logs/auth-logs.tsx` - Auth logs page
- `pages/project/[ref]/logs/storage-logs.tsx` - Storage logs page
- `pages/project/[ref]/logs/edge-functions-logs.tsx` - Functions logs page

**Verification:**
```bash
# Test that logs are isolated by project
./verify-service-isolation.sh logs
```

## Data Flow

### Before (Shared Services)
```
UI Component
  ↓
Data Hook
  ↓
API Endpoint
  ↓
Shared Service (all projects mixed)
```

### After (Isolated Services)
```
UI Component
  ↓
useProjectContext() → projectRef
  ↓
Data Hook (with projectRef)
  ↓
API Endpoint (validates projectRef)
  ↓
Service Adapter (routes to project-specific database)
  ↓
Project Database (isolated data)
```

## Service Adapters

The following service adapters ensure proper isolation:

1. **AuthServiceAdapter** - Routes auth operations to project-specific auth schema
2. **StorageServiceAdapter** - Routes storage operations to project-specific storage schema
3. **FunctionsServiceAdapter** - Routes function operations to project-specific directories
4. **LogsServiceAdapter** - Routes log operations to project-specific log files

## Testing

### Manual Testing

1. **Create two projects:**
   ```bash
   # Create Project A
   curl -X POST http://localhost:8082/api/platform/projects/create \
     -H "Content-Type: application/json" \
     -d '{"name": "Project A", "organization_id": "..."}'
   
   # Create Project B
   curl -X POST http://localhost:8082/api/platform/projects/create \
     -H "Content-Type: application/json" \
     -d '{"name": "Project B", "organization_id": "..."}'
   ```

2. **Add users to each project:**
   - Navigate to Project A → Auth → Users
   - Add a user (e.g., user-a@example.com)
   - Navigate to Project B → Auth → Users
   - Add a user (e.g., user-b@example.com)

3. **Verify isolation:**
   - In Project A, you should only see user-a@example.com
   - In Project B, you should only see user-b@example.com
   - Users should not appear in both projects

### Automated Testing

Run the verification script:
```bash
./verify-service-isolation.sh
```

This will test:
- Auth isolation
- Storage isolation
- Functions isolation
- Logs isolation
- Realtime isolation

## Security Considerations

1. **Project Ownership Validation:**
   - All API endpoints validate that the user owns the project
   - Unauthorized access attempts are logged and rejected

2. **Connection String Security:**
   - Connection strings are never exposed to the client
   - All database operations go through server-side API endpoints

3. **Data Isolation:**
   - Each project has its own database schemas
   - Cross-project queries are prevented at the database level
   - File paths include project identifiers to prevent cross-project access

## Troubleshooting

### Users from other projects are visible

**Cause:** The query is not properly filtering by projectRef

**Solution:**
1. Check that `useProjectContext()` is being used
2. Verify that `projectRef` is being passed to the data hook
3. Check the API endpoint to ensure it's using the correct database connection

### Storage buckets are mixed between projects

**Cause:** The storage query is not scoping to the project's storage schema

**Solution:**
1. Verify that the StorageServiceAdapter is being used
2. Check that bucket queries include the projectRef parameter
3. Ensure the storage schema is properly initialized for the project

### Functions from other projects are visible

**Cause:** Function listing is not filtering by project directory

**Solution:**
1. Verify that the FunctionsServiceAdapter is being used
2. Check that function paths include the project identifier
3. Ensure functions are deployed to project-specific directories

## Migration Notes

### Existing Projects

For projects created before service isolation was implemented:

1. Run the migration script:
   ```bash
   ./scripts/migrate-to-isolated-services.sh
   ```

2. This will:
   - Create project-specific schemas
   - Migrate existing data to project databases
   - Update service configurations
   - Verify data integrity

3. Verify the migration:
   ```bash
   ./verify-service-isolation.sh
   ```

### Backward Compatibility

The implementation maintains backward compatibility:
- Studio users (developers) continue to use the shared auth system
- Project users (application users) use project-specific auth
- Existing API endpoints continue to work
- No breaking changes to the UI

## Related Documentation

- [Service Isolation Design](../../.kiro/specs/project-level-service-isolation/design.md)
- [Service Isolation Requirements](../../.kiro/specs/project-level-service-isolation/requirements.md)
- [Service Router Documentation](../lib/service-router/README.md)
- [Auth Service Adapter](../lib/auth-service/README.md)
- [Storage Service Adapter](../lib/storage-service/README.md)
