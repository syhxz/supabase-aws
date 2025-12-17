# Analytics Service Adapter

The Analytics Service Adapter provides project-isolated analytics services for Supabase Studio. Each project has its own analytics data stored in dedicated `analytics.events` and `analytics.metrics` tables.

## Features

- **Event Tracking**: Track custom events with optional metadata
- **Metrics Recording**: Record numeric metrics with dimensions
- **Database Size Monitoring**: Query project database size
- **Report Generation**: Generate usage, events, metrics, and summary reports
- **API Call Tracking**: Count API calls within time ranges
- **Connection Monitoring**: Track active database connections

## Architecture

### Data Isolation

Each project has its own analytics schema with two main tables:

1. **analytics.events**: Stores event data
   - `id`: UUID primary key
   - `event_type`: Type of event (e.g., 'api_call', 'user_action')
   - `event_data`: JSON data associated with the event
   - `user_id`: Optional user ID
   - `created_at`: Timestamp

2. **analytics.metrics**: Stores metric data
   - `id`: UUID primary key
   - `metric_name`: Name of the metric
   - `metric_value`: Numeric value
   - `dimensions`: Optional JSON dimensions
   - `timestamp`: Timestamp

### Service Router Integration

The Analytics Service Adapter uses the Service Router to:
- Route queries to the correct project database
- Manage database connections
- Ensure data isolation between projects

## Usage

### Track an Event

```typescript
import { getAnalyticsServiceAdapter } from '@/lib/analytics-service/AnalyticsServiceAdapter'

const analytics = getAnalyticsServiceAdapter()

await analytics.trackEvent('project-ref', {
  event_type: 'api_call',
  event_data: {
    endpoint: '/api/users',
    method: 'GET',
    status: 200
  },
  user_id: 'user-123'
})
```

### Record a Metric

```typescript
await analytics.recordMetric(
  'project-ref',
  'response_time_ms',
  145.5,
  { endpoint: '/api/users', method: 'GET' }
)
```

### Get Metrics

```typescript
const metrics = await analytics.getMetrics(
  'project-ref',
  ['response_time_ms', 'error_rate'],
  {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-31')
  }
)
```

### Get Database Size

```typescript
const sizeInBytes = await analytics.getDatabaseSize('project-ref')
const sizeInMB = sizeInBytes / (1024 * 1024)
```

### Generate Reports

```typescript
// Usage report
const usageReport = await analytics.generateReport('project-ref', 'usage')

// Events report
const eventsReport = await analytics.generateReport('project-ref', 'events')

// Metrics report
const metricsReport = await analytics.generateReport('project-ref', 'metrics')

// Summary report (combines all)
const summaryReport = await analytics.generateReport('project-ref', 'summary')
```

### Get API Call Count

```typescript
const apiCalls = await analytics.getApiCallCount('project-ref', {
  start: new Date('2025-01-01'),
  end: new Date('2025-01-31')
})
```

### Get Active Connections

```typescript
const activeConnections = await analytics.getActiveConnections('project-ref')
```

## Report Types

### Usage Report

Contains:
- Database size (bytes and MB)
- Event count for last 30 days
- Time period

### Events Report

Contains:
- Total event count
- Events grouped by type (top 20)
- Time period (last 7 days)

### Metrics Report

Contains:
- All unique metrics
- Latest value for each metric
- Timestamp of latest value

### Summary Report

Combines all report types into a single comprehensive report.

## Error Handling

The adapter throws errors for:
- Missing or invalid event types
- Missing or invalid metric names
- Invalid metric values (non-numeric or NaN)
- Missing project configuration
- Database query failures

## Testing

See `apps/studio/tests/lib/analytics-service.test.ts` for unit tests.

## Security

- All queries are scoped to the project's database
- Project access is validated by the Service Router
- No cross-project data leakage
- SQL injection protection via parameterized queries

## Performance Considerations

- Metrics queries are indexed by metric_name and timestamp
- Events queries are indexed by event_type and created_at
- Report generation may be expensive for large datasets
- Consider caching report results for frequently accessed data

## Future Enhancements

- Real-time analytics dashboards
- Custom metric aggregations
- Automated alerting based on thresholds
- Data retention policies
- Export to external analytics platforms
