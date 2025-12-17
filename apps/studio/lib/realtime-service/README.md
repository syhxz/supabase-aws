# Realtime Service Adapter

This module provides project-isolated realtime data synchronization services.

## Overview

The Realtime Service Adapter ensures that each project has completely isolated realtime event streams. Events from one project are never broadcast to subscribers of another project.

## Key Features

- **Project Isolation**: Each project has its own realtime channels with project-specific prefixes
- **Logical Replication**: Uses PostgreSQL logical replication for change data capture
- **Channel Naming**: Channels are prefixed with `realtime:{project_ref}:` to ensure isolation
- **Event Broadcasting**: Events are only sent to subscribers of the same project

## Architecture

```
Client A (Project A) → Subscribe to realtime:project-a:users
                     ↓
                  Service Router
                     ↓
            Realtime Service Adapter
                     ↓
         Project A Database Changes → Broadcast to Project A channels only
```

## Channel Naming Convention

All realtime channels follow this naming pattern:

- Table changes: `realtime:{project_ref}:{table_name}`
- Custom channels: `realtime:{project_ref}:custom:{channel_name}`

## Usage

```typescript
import { getRealtimeServiceAdapter } from './RealtimeServiceAdapter'

const realtime = getRealtimeServiceAdapter()

// Subscribe to table changes
const subscription = await realtime.subscribe(
  'project-a',
  'users',
  (event) => {
    console.log('User changed:', event)
  }
)

// Broadcast custom event
await realtime.broadcast('project-a', 'custom:notifications', {
  type: 'notification',
  message: 'Hello!'
})

// Unsubscribe
await realtime.unsubscribe('project-a', subscription.id)
```

## Security

- All channel subscriptions are validated against project ownership
- Cross-project event delivery is prevented at the channel level
- Logical replication slots are isolated per project database

## Testing

See `tests/lib/realtime-service.test.ts` for unit tests and property-based tests.
