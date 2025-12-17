# Advisors Service Adapter

The Advisors Service Adapter provides project-isolated performance analysis and optimization recommendations for Supabase Studio projects.

## Overview

Each project gets independent performance analysis based on:
- Query statistics from `pg_stat_statements`
- Schema analysis for missing indexes
- Slow query detection
- Database statistics

## Features

### Query Analysis
- Analyzes query performance using PostgreSQL's `pg_stat_statements` extension
- Tracks execution times, call counts, and row counts
- Identifies the most expensive queries per project

### Index Suggestions
- Detects foreign key columns without indexes
- Identifies tables with high sequential scan counts
- Provides CREATE INDEX statements for suggested indexes
- Estimates impact of each suggestion (high/medium/low)

### Slow Query Detection
- Monitors queries exceeding a configurable threshold
- Tracks execution times and timestamps
- Helps identify performance bottlenecks

### Performance Reports
- Generates comprehensive performance reports
- Includes slow queries, query analysis, and index suggestions
- Provides database statistics (size, table count, index count)

## Usage

```typescript
import { getAdvisorsServiceAdapter } from '@/lib/advisors-service'

const advisors = getAdvisorsServiceAdapter()

// Analyze queries for a project
const queryAnalysis = await advisors.analyzeQueries('project-ref')

// Get index suggestions
const suggestions = await advisors.suggestIndexes('project-ref')

// Detect slow queries (threshold in milliseconds)
const slowQueries = await advisors.detectSlowQueries('project-ref', 100)

// Generate comprehensive performance report
const report = await advisors.generatePerformanceReport('project-ref')

// Subscribe to performance alerts
await advisors.subscribeToAlerts('project-ref', 'user-id')
```

## API Reference

### `analyzeQueries(projectRef: string): Promise<QueryAnalysis[]>`

Analyzes queries for a project using `pg_stat_statements`.

**Returns:** Array of query analysis results including:
- `query`: The SQL query text
- `calls`: Number of times the query was executed
- `total_time`: Total execution time in milliseconds
- `mean_time`: Average execution time in milliseconds
- `min_time`: Minimum execution time in milliseconds
- `max_time`: Maximum execution time in milliseconds
- `rows`: Total number of rows returned

### `suggestIndexes(projectRef: string): Promise<IndexSuggestion[]>`

Suggests indexes based on schema analysis.

**Returns:** Array of index suggestions including:
- `table_name`: Name of the table
- `column_name`: Name of the column
- `reason`: Explanation for the suggestion
- `estimated_impact`: Impact level (high/medium/low)
- `create_statement`: SQL statement to create the index

### `detectSlowQueries(projectRef: string, threshold: number): Promise<SlowQuery[]>`

Detects queries exceeding the specified execution time threshold.

**Parameters:**
- `threshold`: Execution time threshold in milliseconds

**Returns:** Array of slow queries including:
- `query`: The SQL query text
- `execution_time`: Execution time in milliseconds
- `timestamp`: When the query was detected

### `generatePerformanceReport(projectRef: string): Promise<PerformanceReport>`

Generates a comprehensive performance report for a project.

**Returns:** Performance report including:
- `project_ref`: The project reference
- `generated_at`: Report generation timestamp
- `slow_queries`: Array of slow queries
- `query_analysis`: Array of query analysis results
- `index_suggestions`: Array of index suggestions
- `database_stats`: Database statistics (size, table count, index count)

### `subscribeToAlerts(projectRef: string, userId: string): Promise<void>`

Subscribes a user to performance alerts for a project.

**Note:** This is currently a placeholder for future implementation.

## Isolation Guarantees

The Advisors Service ensures complete isolation between projects:

1. **Query Analysis Isolation**: Only analyzes queries executed against the specific project's database
2. **Schema Analysis Isolation**: Only examines the project's own schema and tables
3. **Performance Metrics Isolation**: Metrics are collected and reported per project
4. **Alert Isolation**: Alerts are only sent to the project owner

## Requirements

- PostgreSQL 12+ (for `pg_stat_statements` extension)
- `pg_stat_statements` extension enabled (automatically enabled by the adapter)

## Implementation Details

### Database Filtering

All queries are filtered to only include data from the current project's database:

```sql
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
```

### Extension Management

The adapter automatically attempts to enable `pg_stat_statements`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements
```

If the extension cannot be enabled, the adapter gracefully degrades functionality.

### Performance Considerations

- Query analysis is limited to the top 50 queries by total execution time
- Index suggestions are limited to the most impactful recommendations
- Slow query detection is limited to the top 20 slowest queries

## Error Handling

The adapter handles various error scenarios:

1. **Missing Extension**: If `pg_stat_statements` is not available, methods return empty arrays
2. **Project Not Found**: Throws an error if the project is not registered
3. **Invalid Threshold**: Throws an error if threshold is <= 0
4. **Database Connection Issues**: Propagates connection errors from the Service Router

## Testing

See `apps/studio/tests/lib/advisors-service.test.ts` for unit tests.

## Related Services

- **Service Router**: Manages database connections and routing
- **Analytics Service**: Tracks usage metrics and events
- **Logs Service**: Records API requests and errors

## Future Enhancements

1. **Real-time Alerts**: Implement background monitoring and notifications
2. **Query Optimization Suggestions**: Provide specific optimization recommendations
3. **Historical Trend Analysis**: Track performance metrics over time
4. **Automated Index Creation**: Option to automatically create suggested indexes
5. **Query Plan Analysis**: Analyze EXPLAIN plans for slow queries
