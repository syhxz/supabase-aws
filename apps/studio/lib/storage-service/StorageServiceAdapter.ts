import { PoolClient } from 'pg'
import { getServiceRouter } from '../service-router'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Bucket object
 */
export interface Bucket {
  id: string
  name: string
  owner?: string
  created_at: string
  updated_at: string
  public: boolean
  avif_autodetection?: boolean
  file_size_limit?: number
  allowed_mime_types?: string[]
}

/**
 * File object metadata
 */
export interface FileObject {
  id: string
  bucket_id: string
  name: string
  owner?: string
  created_at: string
  updated_at: string
  last_accessed_at?: string
  metadata?: Record<string, any>
  path_tokens?: string[]
  version?: string
}

/**
 * Bucket creation options
 */
export interface BucketOptions {
  public?: boolean
  file_size_limit?: number
  allowed_mime_types?: string[]
  avif_autodetection?: boolean
}

/**
 * File upload options
 */
export interface FileUploadOptions {
  contentType?: string
  cacheControl?: string
  upsert?: boolean
  metadata?: Record<string, any>
}

/**
 * Storage Service Adapter
 * 
 * Provides project-isolated storage services.
 * Each project has its own storage.buckets and storage.objects tables,
 * and files are stored in project-specific directories.
 */
export class StorageServiceAdapter {
  private serviceRouter = getServiceRouter()
  
  // Base storage directory (configurable via environment variable)
  private readonly STORAGE_BASE_PATH = process.env.STORAGE_BASE_PATH || '/var/lib/storage'

  /**
   * Create a new bucket in a project's storage
   * 
   * @param projectRef - The project reference
   * @param bucketName - The bucket name
   * @param options - Bucket options
   * @returns Created bucket
   */
  async createBucket(
    projectRef: string,
    bucketName: string,
    options: BucketOptions = {}
  ): Promise<Bucket> {
    const {
      public: isPublic = false,
      file_size_limit = null,
      allowed_mime_types = null,
      avif_autodetection = false,
    } = options

    // Validate bucket name
    if (!bucketName || bucketName.length === 0) {
      throw new Error('Bucket name is required')
    }

    // Bucket name validation (lowercase alphanumeric and hyphens only)
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(bucketName)) {
      throw new Error(
        'Bucket name must start and end with alphanumeric characters and contain only lowercase letters, numbers, and hyphens'
      )
    }

    return this.serviceRouter.withTransaction(projectRef, async (client) => {
      // Check if bucket already exists
      const existingBucket = await client.query(
        'SELECT id FROM storage.buckets WHERE name = $1',
        [bucketName]
      )

      if (existingBucket.rows.length > 0) {
        throw new Error(`Bucket '${bucketName}' already exists`)
      }

      const now = new Date().toISOString()

      // Insert bucket into storage.buckets
      const bucketResult = await client.query(
        `INSERT INTO storage.buckets (
          id, name, created_at, updated_at, public,
          avif_autodetection, file_size_limit, allowed_mime_types
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, owner, created_at, updated_at, public,
                  avif_autodetection, file_size_limit, allowed_mime_types`,
        [
          bucketName, // Use bucket name as ID for simplicity
          bucketName,
          now,
          now,
          isPublic,
          avif_autodetection,
          file_size_limit,
          allowed_mime_types,
        ]
      )

      const bucket = this.mapBucketRow(bucketResult.rows[0])

      // Create physical directory structure
      await this.createBucketDirectory(projectRef, bucketName)

      return bucket
    })
  }

  /**
   * Upload a file to a bucket
   * 
   * @param projectRef - The project reference
   * @param bucketName - The bucket name
   * @param filePath - The file path within the bucket
   * @param fileData - The file data (Buffer)
   * @param options - Upload options
   * @returns File object metadata
   */
  async uploadFile(
    projectRef: string,
    bucketName: string,
    filePath: string,
    fileData: Buffer,
    options: FileUploadOptions = {}
  ): Promise<FileObject> {
    const { contentType, cacheControl, upsert = false, metadata = {} } = options

    // Validate inputs
    if (!bucketName || !filePath) {
      throw new Error('Bucket name and file path are required')
    }

    // Validate file path (no leading slash, no parent directory references)
    if (filePath.startsWith('/') || filePath.includes('..')) {
      throw new Error('Invalid file path')
    }

    return this.serviceRouter.withTransaction(projectRef, async (client) => {
      // Verify bucket exists
      const bucketResult = await client.query(
        'SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets WHERE name = $1',
        [bucketName]
      )

      if (bucketResult.rows.length === 0) {
        throw new Error(`Bucket '${bucketName}' not found`)
      }

      const bucket = bucketResult.rows[0]

      // Check file size limit
      if (bucket.file_size_limit && fileData.length > bucket.file_size_limit) {
        throw new Error(
          `File size exceeds bucket limit of ${bucket.file_size_limit} bytes`
        )
      }

      // Check allowed mime types
      if (
        bucket.allowed_mime_types &&
        bucket.allowed_mime_types.length > 0 &&
        contentType
      ) {
        if (!bucket.allowed_mime_types.includes(contentType)) {
          throw new Error(
            `File type '${contentType}' is not allowed in this bucket`
          )
        }
      }

      // Check if file already exists
      const existingFile = await client.query(
        'SELECT id FROM storage.objects WHERE bucket_id = $1 AND name = $2',
        [bucketName, filePath]
      )

      let fileId: string
      const now = new Date().toISOString()

      if (existingFile.rows.length > 0) {
        if (!upsert) {
          throw new Error(`File '${filePath}' already exists`)
        }

        // Update existing file
        fileId = existingFile.rows[0].id

        await client.query(
          `UPDATE storage.objects 
           SET updated_at = $1, metadata = $2, last_accessed_at = $3
           WHERE id = $4`,
          [now, JSON.stringify(metadata), now, fileId]
        )
      } else {
        // Insert new file metadata
        fileId = uuidv4()

        // Parse path tokens (split by /)
        const pathTokens = filePath.split('/').filter((token) => token.length > 0)

        await client.query(
          `INSERT INTO storage.objects (
            id, bucket_id, name, created_at, updated_at,
            last_accessed_at, metadata, path_tokens
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            fileId,
            bucketName,
            filePath,
            now,
            now,
            now,
            JSON.stringify(metadata),
            pathTokens,
          ]
        )
      }

      // Generate file path with project_ref
      const physicalPath = this.getPhysicalFilePath(projectRef, bucketName, filePath)

      // Ensure directory exists
      const directory = path.dirname(physicalPath)
      await fs.mkdir(directory, { recursive: true })

      // Write file to disk
      await fs.writeFile(physicalPath, fileData)

      // Fetch and return the file object
      const fileResult = await client.query(
        `SELECT id, bucket_id, name, owner, created_at, updated_at,
                last_accessed_at, metadata, path_tokens, version
         FROM storage.objects
         WHERE id = $1`,
        [fileId]
      )

      return this.mapFileObjectRow(fileResult.rows[0])
    })
  }

  /**
   * List all buckets in a project
   * 
   * @param projectRef - The project reference
   * @param options - Query options
   * @returns Array of buckets
   */
  async listBuckets(
    projectRef: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Bucket[]> {
    const { limit = 100, offset = 0 } = options

    const result = await this.serviceRouter.query(
      projectRef,
      `SELECT id, name, owner, created_at, updated_at, public,
              avif_autodetection, file_size_limit, allowed_mime_types
       FROM storage.buckets
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    return result.rows.map((row) => this.mapBucketRow(row))
  }

  /**
   * Get a bucket by name
   * 
   * @param projectRef - The project reference
   * @param bucketName - The bucket name
   * @returns Bucket or null if not found
   */
  async getBucket(projectRef: string, bucketName: string): Promise<Bucket | null> {
    const result = await this.serviceRouter.query(
      projectRef,
      `SELECT id, name, owner, created_at, updated_at, public,
              avif_autodetection, file_size_limit, allowed_mime_types
       FROM storage.buckets
       WHERE name = $1`,
      [bucketName]
    )

    if (result.rows.length === 0) {
      return null
    }

    return this.mapBucketRow(result.rows[0])
  }

  /**
   * Delete a bucket
   * 
   * @param projectRef - The project reference
   * @param bucketName - The bucket name
   * @param options - Delete options
   */
  async deleteBucket(
    projectRef: string,
    bucketName: string,
    options: { force?: boolean } = {}
  ): Promise<void> {
    const { force = false } = options

    await this.serviceRouter.withTransaction(projectRef, async (client) => {
      // Check if bucket exists
      const bucketResult = await client.query(
        'SELECT id FROM storage.buckets WHERE name = $1',
        [bucketName]
      )

      if (bucketResult.rows.length === 0) {
        throw new Error(`Bucket '${bucketName}' not found`)
      }

      // Check if bucket has files
      if (!force) {
        const fileCount = await client.query(
          'SELECT COUNT(*) as count FROM storage.objects WHERE bucket_id = $1',
          [bucketName]
        )

        if (parseInt(fileCount.rows[0].count) > 0) {
          throw new Error(
            `Bucket '${bucketName}' is not empty. Use force option to delete.`
          )
        }
      }

      // Delete all files in bucket
      await client.query('DELETE FROM storage.objects WHERE bucket_id = $1', [bucketName])

      // Delete bucket
      await client.query('DELETE FROM storage.buckets WHERE name = $1', [bucketName])

      // Delete physical directory
      await this.deleteBucketDirectory(projectRef, bucketName)
    })
  }

  /**
   * List files in a bucket
   * 
   * @param projectRef - The project reference
   * @param bucketName - The bucket name
   * @param options - Query options
   * @returns Array of file objects
   */
  async listFiles(
    projectRef: string,
    bucketName: string,
    options: { prefix?: string; limit?: number; offset?: number } = {}
  ): Promise<FileObject[]> {
    const { prefix = '', limit = 100, offset = 0 } = options

    let query = `
      SELECT id, bucket_id, name, owner, created_at, updated_at,
             last_accessed_at, metadata, path_tokens, version
      FROM storage.objects
      WHERE bucket_id = $1
    `
    const params: any[] = [bucketName]

    if (prefix) {
      query += ` AND name LIKE $${params.length + 1}`
      params.push(`${prefix}%`)
    }

    query += ` ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await this.serviceRouter.query(projectRef, query, params)

    return result.rows.map((row) => this.mapFileObjectRow(row))
  }

  /**
   * Get file metadata
   * 
   * @param projectRef - The project reference
   * @param bucketName - The bucket name
   * @param filePath - The file path
   * @returns File object or null if not found
   */
  async getFile(
    projectRef: string,
    bucketName: string,
    filePath: string
  ): Promise<FileObject | null> {
    const result = await this.serviceRouter.query(
      projectRef,
      `SELECT id, bucket_id, name, owner, created_at, updated_at,
              last_accessed_at, metadata, path_tokens, version
       FROM storage.objects
       WHERE bucket_id = $1 AND name = $2`,
      [bucketName, filePath]
    )

    if (result.rows.length === 0) {
      return null
    }

    return this.mapFileObjectRow(result.rows[0])
  }

  /**
   * Download a file
   * 
   * @param projectRef - The project reference
   * @param bucketName - The bucket name
   * @param filePath - The file path
   * @returns File data as Buffer
   */
  async downloadFile(
    projectRef: string,
    bucketName: string,
    filePath: string
  ): Promise<Buffer> {
    // Verify file exists in database
    const fileObject = await this.getFile(projectRef, bucketName, filePath)

    if (!fileObject) {
      throw new Error(`File '${filePath}' not found in bucket '${bucketName}'`)
    }

    // Update last accessed time
    await this.serviceRouter.query(
      projectRef,
      'UPDATE storage.objects SET last_accessed_at = $1 WHERE id = $2',
      [new Date().toISOString(), fileObject.id]
    )

    // Read file from disk
    const physicalPath = this.getPhysicalFilePath(projectRef, bucketName, filePath)

    try {
      return await fs.readFile(physicalPath)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File '${filePath}' not found on disk`)
      }
      throw error
    }
  }

  /**
   * Delete a file
   * 
   * @param projectRef - The project reference
   * @param bucketName - The bucket name
   * @param filePath - The file path
   */
  async deleteFile(
    projectRef: string,
    bucketName: string,
    filePath: string
  ): Promise<void> {
    await this.serviceRouter.withTransaction(projectRef, async (client) => {
      // Delete from database
      const result = await client.query(
        'DELETE FROM storage.objects WHERE bucket_id = $1 AND name = $2 RETURNING id',
        [bucketName, filePath]
      )

      if (result.rows.length === 0) {
        throw new Error(`File '${filePath}' not found in bucket '${bucketName}'`)
      }

      // Delete physical file
      const physicalPath = this.getPhysicalFilePath(projectRef, bucketName, filePath)

      try {
        await fs.unlink(physicalPath)
      } catch (error: any) {
        // If file doesn't exist on disk, that's okay
        if (error.code !== 'ENOENT') {
          console.error(`Failed to delete physical file: ${physicalPath}`, error)
        }
      }
    })
  }

  /**
   * Create physical directory for a bucket
   * 
   * @param projectRef - The project reference
   * @param bucketName - The bucket name
   */
  private async createBucketDirectory(
    projectRef: string,
    bucketName: string
  ): Promise<void> {
    const bucketPath = path.join(this.STORAGE_BASE_PATH, projectRef, bucketName)
    await fs.mkdir(bucketPath, { recursive: true })
  }

  /**
   * Delete physical directory for a bucket
   * 
   * @param projectRef - The project reference
   * @param bucketName - The bucket name
   */
  private async deleteBucketDirectory(
    projectRef: string,
    bucketName: string
  ): Promise<void> {
    const bucketPath = path.join(this.STORAGE_BASE_PATH, projectRef, bucketName)

    try {
      await fs.rm(bucketPath, { recursive: true, force: true })
    } catch (error: any) {
      // If directory doesn't exist, that's okay
      if (error.code !== 'ENOENT') {
        console.error(`Failed to delete bucket directory: ${bucketPath}`, error)
      }
    }
  }

  /**
   * Get physical file path
   * 
   * @param projectRef - The project reference
   * @param bucketName - The bucket name
   * @param filePath - The file path
   * @returns Physical file path
   */
  private getPhysicalFilePath(
    projectRef: string,
    bucketName: string,
    filePath: string
  ): string {
    return path.join(this.STORAGE_BASE_PATH, projectRef, bucketName, filePath)
  }

  /**
   * Map database row to Bucket object
   * 
   * @param row - Database row
   * @returns Bucket object
   */
  private mapBucketRow(row: any): Bucket {
    return {
      id: row.id,
      name: row.name,
      owner: row.owner,
      created_at: row.created_at,
      updated_at: row.updated_at,
      public: row.public,
      avif_autodetection: row.avif_autodetection,
      file_size_limit: row.file_size_limit,
      allowed_mime_types: row.allowed_mime_types,
    }
  }

  /**
   * Map database row to FileObject
   * 
   * @param row - Database row
   * @returns FileObject
   */
  private mapFileObjectRow(row: any): FileObject {
    return {
      id: row.id,
      bucket_id: row.bucket_id,
      name: row.name,
      owner: row.owner,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_accessed_at: row.last_accessed_at,
      metadata: row.metadata,
      path_tokens: row.path_tokens,
      version: row.version,
    }
  }
}

// Singleton instance
let storageServiceAdapter: StorageServiceAdapter | null = null

/**
 * Get the singleton StorageServiceAdapter instance
 */
export function getStorageServiceAdapter(): StorageServiceAdapter {
  if (!storageServiceAdapter) {
    storageServiceAdapter = new StorageServiceAdapter()
  }
  return storageServiceAdapter
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetStorageServiceAdapter(): void {
  storageServiceAdapter = null
}
