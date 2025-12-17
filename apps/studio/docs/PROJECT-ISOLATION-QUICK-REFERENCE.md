# Project Isolation Quick Reference

## For Developers Working on Studio UI

This is a quick reference guide for developers working on Studio UI features that need to respect project-level service isolation.

## The Golden Rule

**Always use `projectRef` from URL params when making service calls.**

## Quick Start

### 1. Get Project Context

```typescript
import { useParams } from 'common'

function MyComponent() {
  const { ref: projectRef } = useParams()
  
  // Now use projectRef in your queries
}
```

### 2. Use in Data Queries

```typescript
import { useMyQuery } from 'data/my-service/my-query'

function MyComponent() {
  const { ref: projectRef } = useParams()
  
  const { data, isLoading } = useMyQuery({
    projectRef,  // ✅ Always pass projectRef
    // ... other params
  })
}
```

### 3. Create New Data Queries

When creating a new data query, follow this pattern:

```typescript
// data/my-service/my-query.ts
import { useQuery } from '@tanstack/react-query'
import { get, handleError } from 'data/fetchers'

export type MyQueryVariables = { 
  projectRef?: string  // ✅ Always include projectRef
  // ... other params
}

export async function getMyData(
  { projectRef }: MyQueryVariables,
  signal?: AbortSignal
) {
  if (!projectRef) throw new Error('projectRef is required')  // ✅ Validate
  
  const { data, error } = await get('/platform/my-service/{ref}/data', {
    params: { path: { ref: projectRef } },  // ✅ Include in API call
    signal,
  })
  
  if (error) handleError(error)
  return data
}

export const useMyQuery = (
  { projectRef }: MyQueryVariables,
  options = {}
) => {
  return useQuery({
    queryKey: myKeys.list(projectRef),  // ✅ Scope cache by projectRef
    queryFn: ({ signal }) => getMyData({ projectRef }, signal),
    enabled: typeof projectRef !== 'undefined',  // ✅ Only enable when projectRef exists
    ...options,
  })
}
```

## Common Patterns

### Pattern 1: List Data for Current Project

```typescript
function MyListComponent() {
  const { ref: projectRef } = useParams()
  
  const { data: items, isLoading } = useMyItemsQuery({
    projectRef,
  })
  
  if (isLoading) return <Loading />
  
  return (
    <div>
      {items?.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  )
}
```

### Pattern 2: Create Data for Current Project

```typescript
function MyCreateComponent() {
  const { ref: projectRef } = useParams()
  
  const { mutate: createItem } = useCreateItemMutation()
  
  const handleCreate = (data) => {
    createItem({
      projectRef,  // ✅ Include projectRef
      ...data,
    })
  }
  
  return <CreateForm onSubmit={handleCreate} />
}
```

### Pattern 3: Update Data for Current Project

```typescript
function MyUpdateComponent({ itemId }) {
  const { ref: projectRef } = useParams()
  
  const { mutate: updateItem } = useUpdateItemMutation()
  
  const handleUpdate = (data) => {
    updateItem({
      projectRef,  // ✅ Include projectRef
      itemId,
      ...data,
    })
  }
  
  return <UpdateForm onSubmit={handleUpdate} />
}
```

### Pattern 4: Delete Data for Current Project

```typescript
function MyDeleteComponent({ itemId }) {
  const { ref: projectRef } = useParams()
  
  const { mutate: deleteItem } = useDeleteItemMutation()
  
  const handleDelete = () => {
    deleteItem({
      projectRef,  // ✅ Include projectRef
      itemId,
    })
  }
  
  return <DeleteButton onClick={handleDelete} />
}
```

## Checklist for New Features

When adding a new feature that interacts with project data:

- [ ] Does your component get `projectRef` from `useParams()`?
- [ ] Do all your data queries accept `projectRef` as a parameter?
- [ ] Do your queries validate that `projectRef` is provided?
- [ ] Are your cache keys scoped by `projectRef`?
- [ ] Are your API calls including `projectRef` in the request?
- [ ] Are your queries only enabled when `projectRef` is defined?

## Common Mistakes to Avoid

### ❌ Mistake 1: Not passing projectRef

```typescript
// ❌ BAD: Missing projectRef
const { data } = useMyQuery({
  // Missing projectRef!
})
```

```typescript
// ✅ GOOD: Include projectRef
const { ref: projectRef } = useParams()
const { data } = useMyQuery({
  projectRef,  // ✅
})
```

### ❌ Mistake 2: Not validating projectRef

```typescript
// ❌ BAD: No validation
export async function getMyData({ projectRef }) {
  const { data } = await get(`/api/data/${projectRef}`)  // Could be undefined!
  return data
}
```

```typescript
// ✅ GOOD: Validate projectRef
export async function getMyData({ projectRef }) {
  if (!projectRef) throw new Error('projectRef is required')  // ✅
  
  const { data } = await get(`/api/data/${projectRef}`)
  return data
}
```

### ❌ Mistake 3: Not scoping cache keys

```typescript
// ❌ BAD: Cache key not scoped by project
export const useMyQuery = ({ projectRef }) => {
  return useQuery({
    queryKey: ['myData'],  // ❌ Same key for all projects!
    queryFn: () => getMyData({ projectRef }),
  })
}
```

```typescript
// ✅ GOOD: Cache key scoped by project
export const useMyQuery = ({ projectRef }) => {
  return useQuery({
    queryKey: ['myData', projectRef],  // ✅ Different key per project
    queryFn: () => getMyData({ projectRef }),
  })
}
```

### ❌ Mistake 4: Enabling query without projectRef

```typescript
// ❌ BAD: Query runs even without projectRef
export const useMyQuery = ({ projectRef }) => {
  return useQuery({
    queryKey: ['myData', projectRef],
    queryFn: () => getMyData({ projectRef }),
    // ❌ No enabled check!
  })
}
```

```typescript
// ✅ GOOD: Only enable when projectRef exists
export const useMyQuery = ({ projectRef }) => {
  return useQuery({
    queryKey: ['myData', projectRef],
    queryFn: () => getMyData({ projectRef }),
    enabled: typeof projectRef !== 'undefined',  // ✅
  })
}
```

## Testing Your Feature

### Manual Test

1. Create two test projects (Project A and Project B)
2. Add data to Project A
3. Add different data to Project B
4. Navigate to Project A - verify you only see Project A's data
5. Navigate to Project B - verify you only see Project B's data

### Automated Test

```typescript
// Example test
describe('MyFeature', () => {
  it('should only show data for the current project', async () => {
    // Create two projects
    const projectA = await createTestProject('Project A')
    const projectB = await createTestProject('Project B')
    
    // Add data to each project
    await addDataToProject(projectA.ref, { name: 'Data A' })
    await addDataToProject(projectB.ref, { name: 'Data B' })
    
    // Navigate to Project A
    render(<MyFeature />, { route: `/project/${projectA.ref}/my-feature` })
    
    // Should only see Project A's data
    expect(screen.getByText('Data A')).toBeInTheDocument()
    expect(screen.queryByText('Data B')).not.toBeInTheDocument()
    
    // Navigate to Project B
    render(<MyFeature />, { route: `/project/${projectB.ref}/my-feature` })
    
    // Should only see Project B's data
    expect(screen.getByText('Data B')).toBeInTheDocument()
    expect(screen.queryByText('Data A')).not.toBeInTheDocument()
  })
})
```

## Need Help?

- **Documentation**: See `SERVICE-ISOLATION-UI-INTEGRATION.md` for detailed guide
- **Verification**: See `UI-SERVICE-ISOLATION-VERIFICATION.md` for verification details
- **Examples**: Look at existing implementations:
  - Auth: `data/auth/users-infinite-query.ts`
  - Storage: `data/storage/buckets-query.ts`
  - Functions: `data/edge-functions/edge-functions-query.ts`
  - Logs: `data/logs/unified-logs-infinite-query.ts`

## Summary

**Remember the three key principles:**

1. **Always get projectRef from URL params** using `useParams()`
2. **Always pass projectRef to your queries** as a required parameter
3. **Always validate projectRef** before making API calls

Following these principles ensures your feature respects project-level service isolation and prevents data leakage between projects.
