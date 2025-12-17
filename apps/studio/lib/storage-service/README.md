# Storage Service Adapter

The Storage Service Adapter provides project-isolated storage services for Supabase Studio. Each project has its own storage schema and file directory structure.

## Features

- **Project Isolation**: Each project has its own `storage.buckets` and `storage.objects` tables
- **File Path Isolation**: Files are stored in project-specific directories: `/var/lib/storage/{project_ref}/{bucket}/{file}`
- **Bucket Management**: Create, list, and delete buckets per project
- **File Operations**: Upload, download, list, and delete files with metadata
- **Validation**: File size limits, allowed MIME types, and path validation
- **Transaction Support**: All operations use database transactions for consistency

## Architecture

```
/var/lib/storage/
  project-a/
    bucket-1/
      file1.jpg
      folder/
        file2.png
    bucket-2/
      doc1.pdf
  project-b/
    bucket-1/
      image1.jpg
```

## Usage

### Create a Bucket

```typescript
import { getStorageServiceAdapter } from './lib/storage-service/StorageServiceAdapter'

const storage = getStorageServiceAdapter()

const bucket = await storage.createBucket('project-a', 'avatars', {
  public: true,
  file_size_limit: 5 * 1024 * 1024, // 5MB
  allowed_mime_types: ['image/jpeg', 'image/png', 'image/gif']
})
```

### Upload a File

```typescript
const fileData = Buffer.from('...') // Your file data

const fileObject = await storage.uploadFile(
  'project-a',
  'avatars',
  'users/user-123/avatar.jpg',
  fileData,
  {
    contentType: 'image/jpeg',
    metadata: { userId: 'user-123' }
  }
)
```

### List Buckets

```typescript
const buckets = await storage.listBuckets('project-a')
```

### List Files in a Bucket

```typescript
const files = await storage.listFiles('project-a', 'avatars', {
  prefix: 'users/',
  limit: 50
})
```

### Download a File

```typescript
const fileData = await storage.downloadFile('project-a', 'avatars', 'users/user-123/avatar.jpg')
```

### Delete a File

```typescript
await storage.deleteFile('project-a', 'avatars', 'users/user-123/avatar.jpg')
```

### Delete a Bucket

```typescript
// Delete empty bucket
await storage.deleteBucket('project-a', 'avatars')

// Force delete bucket with files
await storage.deleteBucket('project-a', 'avatars', { force: true })
```

## API Reference

### `createBucket(projectRef, bucketName, options)`

Creates a new bucket in a project's storage.

**Parameters:**
- `projectRef` (string): The project reference
- `bucketName` (string): The bucket name (lowercase alphanumeric and hyphens)
- `options` (BucketOptions): Bucket configuration
  - `public` (boolean): Whether the bucket is publicly accessible
  - `file_size_limit` (number): Maximum file size in bytes
  - `allowed_mime_types` (string[]): Allowed MIME types
  - `avif_autodetection` (boolean): Enable AVIF auto-detection

**Returns:** `Promise<Bucket>`

### `uploadFile(projectRef, bucketName, filePath, fileData, options)`

Uploads a file to a bucket.

**Parameters:**
- `projectRef` (string): The project reference
- `bucketName` (string): The bucket name
- `filePath` (string): The file path within the bucket
- `fileData` (Buffer): The file data
- `options` (FileUploadOptions): Upload options
  - `contentType` (string): MIME type
  - `cacheControl` (string): Cache control header
  - `upsert` (boolean): Overwrite if exists
  - `metadata` (object): Custom metadata

**Returns:** `Promise<FileObject>`

### `listBuckets(projectRef, options)`

Lists all buckets in a project.

**Parameters:**
- `projectRef` (string): The project reference
- `options` (object): Query options
  - `limit` (number): Maximum number of results (default: 100)
  - `offset` (number): Offset for pagination (default: 0)

**Returns:** `Promise<Bucket[]>`

### `listFiles(projectRef, bucketName, options)`

Lists files in a bucket.

**Parameters:**
- `projectRef` (string): The project reference
- `bucketName` (string): The bucket name
- `options` (object): Query options
  - `prefix` (string): Filter by path prefix
  - `limit` (number): Maximum number of results (default: 100)
  - `offset` (number): Offset for pagination (default: 0)

**Returns:** `Promise<FileObject[]>`

### `downloadFile(projectRef, bucketName, filePath)`

Downloads a file from a bucket.

**Parameters:**
- `projectRef` (string): The project reference
- `bucketName` (string): The bucket name
- `filePath` (string): The file path

**Returns:** `Promise<Buffer>`

### `deleteFile(projectRef, bucketName, filePath)`

Deletes a file from a bucket.

**Parameters:**
- `projectRef` (string): The project reference
- `bucketName` (string): The bucket name
- `filePath` (string): The file path

**Returns:** `Promise<void>`

### `deleteBucket(projectRef, bucketName, options)`

Deletes a bucket.

**Parameters:**
- `projectRef` (string): The project reference
- `bucketName` (string): The bucket name
- `options` (object): Delete options
  - `force` (boolean): Delete even if bucket contains files

**Returns:** `Promise<void>`

## Error Handling

The adapter throws descriptive errors for common scenarios:

- `Bucket name is required`
- `Bucket name must start and end with alphanumeric characters...`
- `Bucket '{name}' already exists`
- `Bucket '{name}' not found`
- `File size exceeds bucket limit of {limit} bytes`
- `File type '{type}' is not allowed in this bucket`
- `File '{path}' already exists` (when upsert is false)
- `Invalid file path` (for paths with `..` or leading `/`)
- `Bucket '{name}' is not empty. Use force option to delete.`

## Configuration

The storage base path can be configured via environment variable:

```bash
STORAGE_BASE_PATH=/var/lib/storage
```

Default: `/var/lib/storage`

## Database Schema

The adapter expects the following tables in each project database:

### storage.buckets

```sql
CREATE TABLE storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  owner UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  public BOOLEAN DEFAULT FALSE,
  avif_autodetection BOOLEAN DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[]
);
```

### storage.objects

```sql
CREATE TABLE storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL REFERENCES storage.buckets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  metadata JSONB,
  path_tokens TEXT[],
  version TEXT,
  UNIQUE(bucket_id, name)
);
```

## Testing

See `apps/studio/tests/lib/storage-service.test.ts` for unit tests.

## Security Considerations

1. **Path Validation**: File paths are validated to prevent directory traversal attacks
2. **Project Isolation**: All operations are scoped to the project's database and directory
3. **File Size Limits**: Configurable per bucket to prevent abuse
4. **MIME Type Validation**: Restrict allowed file types per bucket
5. **Transaction Safety**: All database operations use transactions for consistency

## Performance Considerations

1. **Connection Pooling**: Uses the ServiceRouter's connection pool management
2. **Efficient Queries**: Indexed queries on bucket_id and name
3. **Streaming**: Large files should be streamed (future enhancement)
4. **Caching**: File metadata is cached in the database

## Future Enhancements

- [ ] Streaming support for large files
- [ ] Image transformation (resize, crop, etc.)
- [ ] CDN integration
- [ ] Signed URLs for temporary access
- [ ] Multipart upload for large files
- [ ] File versioning
- [ ] Automatic cleanup of orphaned files
