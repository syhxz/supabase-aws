# Logs Service Adapter

The Logs Service Adapter provides project-isolated logging services for Supabase Studio. Each project has its own log files, and log entries are tagged with the project reference to ensure complete isolation.

## Features

- **Project Isolation**: Each project has its own log directory and files
- **Multiple Log Levels**: Support for DEBUG, INFO, WARN, and ERROR levels
- **Structured Logging**: Logs are stored as JSON lines for easy parsing
- **Flexible Querying**: Filter logs by level, time range, and search terms
- **Export Capabilities**: Export logs in JSON or CSV format
- **Statistics**: Get log statistics by level and time range

## Architecture

### Log File Structure

```
/var/log/supabase/
  project-a/
    api-2025-01-27.log
    errors-2025-01-27.log
    api-2025-01-28.log
    errors-2025-01-28.log
  project-b/
    api-2025-01-27.log
    errors-2025-01-27.log
```

### Log Entry Format

Each log entry is stored as a JSON line:

```json
{
  "timestamp": "2025-01-27T10:30:45.123Z",
  "level": "INFO",
  "message": "User authenticated successfully",
  "metadata": {
    "userId": "123",
    "ip": "192.168.1.1"
  },
  "project_ref": "project-a"
}
```

## Usage

### Basic Logging

```typescript
import { getLogsServiceAdapter, LogLevel } from '@/lib/logs-service'

const logsService = getLogsServiceAdapter()

// Log an info message
await logsService.log('project-a', LogLevel.INFO, 'User logged in', {
  userId: '123',
  email: 'user@example.com'
})

// Log an error
await logsService.log('project-a', LogLevel.ERROR, 'Database connection failed', {
  error: 'Connection timeout',
  database: 'project_a_db'
})
```

### Querying Logs

```typescript
// Query all logs
const logs = await logsService.query('project-a')

// Query with filters
const errorLogs = await logsService.query('project-a', {
  level: [LogLevel.ERROR, LogLevel.WARN],
  startTime: new Date('2025-01-27T00:00:00Z'),
  endTime: new Date('2025-01-27T23:59:59Z'),
  search: 'database',
  limit: 100
})
```

### Exporting Logs

```typescript
// Export as JSON
const jsonBlob = await logsService.export('project-a', 'json', {
  startTime: new Date('2025-01-27T00:00:00Z'),
  endTime: new Date('2025-01-27T23:59:59Z')
})

// Export as CSV
const csvBlob = await logsService.export('project-a', 'csv', {
  level: [LogLevel.ERROR]
})
```

### Getting Statistics

```typescript
const stats = await logsService.getStats('project-a', {
  start: new Date('2025-01-27T00:00:00Z'),
  end: new Date('2025-01-27T23:59:59Z')
})

console.log(`Total logs: ${stats.totalLogs}`)
console.log(`Errors: ${stats.byLevel.ERROR}`)
console.log(`Warnings: ${stats.byLevel.WARN}`)
```

## API Reference

### LogsServiceAdapter

#### Methods

##### `log(projectRef, level, message, metadata?)`

Log a message for a project.

- **Parameters**:
  - `projectRef` (string): The project reference
  - `level` (LogLevel): Log level (DEBUG, INFO, WARN, ERROR)
  - `message` (string): Log message
  - `metadata` (Record<string, any>, optional): Additional metadata
- **Returns**: Promise<void>

##### `query(projectRef, filters?)`

Query logs for a project.

- **Parameters**:
  - `projectRef` (string): The project reference
  - `filters` (LogFilters, optional): Query filters
    - `level` (LogLevel[]): Filter by log levels
    - `startTime` (Date): Filter logs after this time
    - `endTime` (Date): Filter logs before this time
    - `search` (string): Search in message and metadata
    - `limit` (number): Maximum number of logs to return (default: 1000)
- **Returns**: Promise<LogEntry[]>

##### `export(projectRef, format, filters?)`

Export logs for a project.

- **Parameters**:
  - `projectRef` (string): The project reference
  - `format` ('json' | 'csv'): Export format
  - `filters` (LogFilters, optional): Query filters
- **Returns**: Promise<Blob>

##### `getStats(projectRef, timeRange)`

Get log statistics for a project.

- **Parameters**:
  - `projectRef` (string): The project reference
  - `timeRange` (TimeRange): Time range for statistics
    - `start` (Date): Start time
    - `end` (Date): End time
- **Returns**: Promise<LogStats>

## Isolation Guarantees

The Logs Service Adapter ensures complete isolation between projects:

1. **File System Isolation**: Each project has its own directory under `/var/log/supabase/{project_ref}/`
2. **Query Isolation**: Log queries only read from the current project's log files
3. **Tag Isolation**: All log entries are tagged with `project_ref` for additional verification
4. **Export Isolation**: Log exports only include logs from the specified project

## Configuration

The log base directory can be configured via environment variable:

```bash
LOGS_DIR=/custom/log/path
```

Default: `/var/log/supabase`

## Performance Considerations

- Log files are organized by date to improve query performance
- Separate files for errors (`errors-*.log`) and general logs (`api-*.log`)
- JSON line format allows for efficient streaming and parsing
- Query limits prevent memory issues with large log files

## Error Handling

- Failed log writes are logged to console but don't throw errors
- Malformed log lines are skipped during queries
- Missing log directories are created automatically
- File access errors are handled gracefully

## Testing

See `apps/studio/tests/lib/logs-service.test.ts` for unit tests.

## Related Services

- **Service Router**: Manages project connections and routing
- **Webhook Service**: Uses logs service for webhook execution logging
- **Analytics Service**: May use logs for metrics collection
