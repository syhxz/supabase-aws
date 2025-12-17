# Webhook Service Adapter

The Webhook Service Adapter provides project-isolated webhook functionality for Supabase Studio. Each project has its own webhook configurations and execution logs, ensuring complete isolation between projects.

## Features

- **Project Isolation**: Each project has independent webhook configurations stored in its own `webhooks.hooks` table
- **Event-Based Triggering**: Webhooks are triggered based on event names
- **Automatic Retries**: Failed webhooks are automatically retried with exponential backoff
- **Execution Logging**: All webhook executions (successful and failed) are logged in `webhooks.logs`
- **HMAC Signatures**: Optional webhook signatures for secure payload verification
- **Custom Headers**: Support for custom HTTP headers per webhook

## Architecture

### Database Schema

Each project database contains:

```sql
-- webhooks.hooks table
CREATE TABLE webhooks.hooks (
  id UUID PRIMARY KEY,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT,
  headers JSONB,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- webhooks.logs table
CREATE TABLE webhooks.logs (
  id UUID PRIMARY KEY,
  hook_id UUID NOT NULL REFERENCES webhooks.hooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Isolation Strategy

- **Database-Level**: Webhook configurations are stored in project-specific databases
- **Event Filtering**: Only webhooks configured for a specific event in a project are triggered
- **Execution Isolation**: Webhook executions are completely isolated per project

## Usage

### Creating a Webhook

```typescript
import { getWebhookServiceAdapter } from '@/lib/webhook-service'

const webhookService = getWebhookServiceAdapter()

const webhook = await webhookService.createWebhook('project-ref', {
  url: 'https://example.com/webhook',
  events: ['user.created', 'user.updated'],
  secret: 'your-webhook-secret',
  headers: {
    'X-Custom-Header': 'value'
  },
  enabled: true
})
```

### Triggering Webhooks

```typescript
// Trigger all webhooks configured for 'user.created' event
await webhookService.triggerWebhook('project-ref', 'user.created', {
  user_id: '123',
  email: 'user@example.com',
  created_at: new Date().toISOString()
})
```

### Listing Webhooks

```typescript
const webhooks = await webhookService.listWebhooks('project-ref', {
  limit: 50,
  offset: 0
})
```

### Viewing Webhook Logs

```typescript
const logs = await webhookService.getWebhookLogs('project-ref', 'webhook-id', {
  limit: 100,
  offset: 0
})
```

### Updating a Webhook

```typescript
const updated = await webhookService.updateWebhook('project-ref', 'webhook-id', {
  enabled: false,
  events: ['user.created', 'user.updated', 'user.deleted']
})
```

### Deleting a Webhook

```typescript
await webhookService.deleteWebhook('project-ref', 'webhook-id')
```

## Retry Logic

The webhook service implements automatic retry with exponential backoff:

- **Default Max Retries**: 3 attempts
- **Base Retry Delay**: 1 second
- **Exponential Backoff**: Delay doubles with each retry (1s, 2s, 4s, ...)
- **Max Retry Delay**: 60 seconds

Failed executions are logged with retry count for debugging.

## Webhook Signatures

When a webhook has a `secret` configured, the service automatically generates an HMAC-SHA256 signature:

```
X-Webhook-Signature: <hmac-sha256-hex>
```

Recipients can verify the signature to ensure the webhook came from your Supabase instance.

### Verifying Signatures (Recipient Side)

```javascript
const crypto = require('crypto')

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(JSON.stringify(payload))
  const expectedSignature = hmac.digest('hex')
  
  return signature === expectedSignature
}
```

## Event Naming Conventions

Event names should follow these conventions:

- Use lowercase letters, numbers, dots, underscores, and hyphens
- Use dot notation for namespacing: `resource.action`
- Examples:
  - `user.created`
  - `user.updated`
  - `user.deleted`
  - `order.completed`
  - `payment.succeeded`

## Error Handling

The service handles various error scenarios:

- **Invalid URL**: Validates URL format and protocol (HTTP/HTTPS only)
- **Network Errors**: Automatically retries with exponential backoff
- **Timeout**: 30-second timeout per request
- **HTTP Errors**: Non-2xx responses are treated as failures and retried
- **Validation Errors**: Invalid configurations are rejected before creation

## Logging

All webhook executions are logged to `webhooks.logs`:

- **Successful executions**: Includes response status and body
- **Failed executions**: Includes error message and retry count
- **Payload**: Full event payload is stored for debugging

## Performance Considerations

- **Parallel Execution**: Multiple webhooks for the same event are triggered in parallel
- **Async Processing**: Webhook execution doesn't block the triggering operation
- **Connection Pooling**: Uses project-specific connection pools for database operations
- **Timeout Protection**: 30-second timeout prevents hanging requests

## Security

- **URL Validation**: Only HTTP/HTTPS URLs are allowed
- **HMAC Signatures**: Optional signatures for payload verification
- **Custom Headers**: Support for authentication headers
- **Project Isolation**: Complete isolation between projects
- **Access Control**: Webhook operations require project ownership validation

## Testing

See `apps/studio/tests/lib/webhook-service.test.ts` for unit tests.

## Related Services

- **Service Router**: Manages database connections and project routing
- **Auth Service**: Provides user authentication for webhook creation
- **Project Initialization**: Creates webhook schema during project setup

## Future Enhancements

- Webhook delivery queue for better reliability
- Webhook delivery statistics and analytics
- Webhook testing/debugging tools
- Webhook templates for common integrations
- Rate limiting per webhook
- Batch webhook delivery
