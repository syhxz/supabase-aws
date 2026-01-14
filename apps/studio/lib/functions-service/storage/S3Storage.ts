import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import {
  StorageBackend,
  FunctionFile,
  FunctionMetadata,
  StorageHealthStatus,
  StorageBackendError,
  StorageNotFoundError,
  StorageAccessError,
  StorageConfigurationError,
} from './StorageBackend'

/**
 * S3 Storage Backend Configuration
 */
export interface S3StorageConfig {
  /** S3 bucket name */
  bucketName: string
  /** AWS region */
  region: string
  /** Custom S3 endpoint (optional) */
  endpoint?: string
  /** AWS access key ID */
  accessKeyId: string
  /** AWS secret access key */
  secretAccessKey: string
  /** Base prefix for all Edge Functions */
  basePrefix?: string
}

/**
 * AWS S3 Storage Backend
 * 
 * Implements storage backend using AWS S3.
 * Uses existing AWS credentials from environment variables.
 */
export class S3Storage implements StorageBackend {
  private readonly s3Client: S3Client
  private readonly bucketName: string
  private readonly basePrefix: string

  constructor(config?: Partial<S3StorageConfig>) {
    // Load configuration from environment variables with optional overrides
    const bucketName = config?.bucketName || process.env.EDGE_FUNCTIONS_S3_BUCKET_NAME
    const region = config?.region || process.env.EDGE_FUNCTIONS_S3_REGION
    const endpoint = config?.endpoint || process.env.EDGE_FUNCTIONS_S3_ENDPOINT
    const accessKeyId = config?.accessKeyId || process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = config?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY

    // Validate required configuration
    if (!bucketName) {
      throw new StorageConfigurationError(
        'S3 bucket name is required. Set EDGE_FUNCTIONS_S3_BUCKET_NAME environment variable.'
      )
    }

    if (!region) {
      throw new StorageConfigurationError(
        'S3 region is required. Set EDGE_FUNCTIONS_S3_REGION environment variable.'
      )
    }

    if (!accessKeyId || !secretAccessKey) {
      throw new StorageConfigurationError(
        'AWS credentials are required. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.'
      )
    }

    this.bucketName = bucketName
    this.basePrefix = config?.basePrefix || 'edge-functions'

    // Initialize S3 client
    this.s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // Force path-style addressing for compatibility with S3-compatible services
      forcePathStyle: !!endpoint,
    })
  }

  /**
   * Get the storage backend type
   */
  getType(): string {
    return 's3'
  }

  /**
   * Get the S3 key prefix for a project
   */
  private getProjectPrefix(projectRef: string): string {
    return `${this.basePrefix}/${projectRef}`
  }

  /**
   * Get the S3 key prefix for a function
   */
  private getFunctionPrefix(projectRef: string, functionSlug: string): string {
    return `${this.getProjectPrefix(projectRef)}/${functionSlug}`
  }

  /**
   * Get the S3 key for function metadata
   */
  private getMetadataKey(projectRef: string, functionSlug: string): string {
    return `${this.getFunctionPrefix(projectRef, functionSlug)}/metadata.json`
  }

  /**
   * Get the S3 key for a function file
   */
  private getFileKey(projectRef: string, functionSlug: string, filePath: string): string {
    return `${this.getFunctionPrefix(projectRef, functionSlug)}/${filePath}`
  }

  /**
   * Store function files and metadata
   */
  async store(
    projectRef: string,
    functionSlug: string,
    files: FunctionFile[],
    metadata: FunctionMetadata
  ): Promise<void> {
    try {
      // Store all function files
      const filePromises = files.map(async (file) => {
        const key = this.getFileKey(projectRef, functionSlug, file.path)
        
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.content,
          ContentType: this.getContentType(file.name),
          ServerSideEncryption: 'AES256',
          Metadata: {
            'project-ref': projectRef,
            'function-slug': functionSlug,
            'file-name': file.name,
          },
        })

        await this.s3Client.send(command)
      })

      // Store metadata
      const metadataKey = this.getMetadataKey(projectRef, functionSlug)
      const metadataCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: metadataKey,
        Body: JSON.stringify(metadata, null, 2),
        ContentType: 'application/json',
        ServerSideEncryption: 'AES256',
        Metadata: {
          'project-ref': projectRef,
          'function-slug': functionSlug,
          'content-type': 'metadata',
        },
      })

      // Execute all uploads in parallel
      await Promise.all([...filePromises, this.s3Client.send(metadataCommand)])

    } catch (error: any) {
      if (error instanceof StorageBackendError) {
        throw error
      }
      throw new StorageAccessError(`Failed to store function in S3: ${error.message}`, {
        projectRef,
        functionSlug,
        bucketName: this.bucketName,
        originalError: error,
      })
    }
  }

  /**
   * Retrieve function files
   */
  async retrieve(projectRef: string, functionSlug: string): Promise<FunctionFile[]> {
    try {
      // Check if function exists
      if (!(await this.exists(projectRef, functionSlug))) {
        throw new StorageNotFoundError(`Function ${functionSlug} in project ${projectRef}`)
      }

      // List all objects with the function prefix
      const functionPrefix = this.getFunctionPrefix(projectRef, functionSlug)
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `${functionPrefix}/`,
      })

      const listResponse = await this.s3Client.send(listCommand)
      
      if (!listResponse.Contents) {
        return []
      }

      // Filter out metadata.json and get file contents
      const fileKeys = listResponse.Contents
        .filter(obj => obj.Key && !obj.Key.endsWith('/metadata.json'))
        .map(obj => obj.Key!)

      const files: FunctionFile[] = []

      // Retrieve each file
      for (const key of fileKeys) {
        try {
          const getCommand = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          })

          const response = await this.s3Client.send(getCommand)
          
          if (response.Body) {
            const content = await this.streamToString(response.Body)
            const relativePath = key.replace(`${functionPrefix}/`, '')
            const fileName = relativePath.split('/').pop() || relativePath

            files.push({
              name: fileName,
              content,
              path: relativePath,
            })
          }
        } catch (error) {
          console.warn(`Failed to retrieve file ${key}:`, error)
          // Continue with other files
        }
      }

      return files

    } catch (error: any) {
      if (error instanceof StorageBackendError) {
        throw error
      }
      throw new StorageAccessError(`Failed to retrieve function from S3: ${error.message}`, {
        projectRef,
        functionSlug,
        bucketName: this.bucketName,
        originalError: error,
      })
    }
  }

  /**
   * List all functions in a project
   */
  async list(projectRef: string): Promise<FunctionMetadata[]> {
    try {
      const projectPrefix = this.getProjectPrefix(projectRef)
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `${projectPrefix}/`,
        Delimiter: '/',
      })

      const listResponse = await this.s3Client.send(listCommand)
      
      if (!listResponse.CommonPrefixes) {
        return []
      }

      const functions: FunctionMetadata[] = []

      // Get metadata for each function
      for (const prefix of listResponse.CommonPrefixes) {
        if (!prefix.Prefix) continue

        // Extract function slug from prefix
        const functionSlug = prefix.Prefix
          .replace(`${projectPrefix}/`, '')
          .replace('/', '')

        try {
          const metadata = await this.getMetadata(projectRef, functionSlug)
          if (metadata) {
            functions.push(metadata)
          }
        } catch (error) {
          console.warn(`Failed to get metadata for function ${functionSlug}:`, error)
          // Continue with other functions
        }
      }

      // Sort by name for consistent ordering
      return functions.sort((a, b) => a.name.localeCompare(b.name))

    } catch (error: any) {
      throw new StorageAccessError(`Failed to list functions from S3: ${error.message}`, {
        projectRef,
        bucketName: this.bucketName,
        originalError: error,
      })
    }
  }

  /**
   * Delete a function and all its files
   */
  async delete(projectRef: string, functionSlug: string): Promise<void> {
    try {
      // Check if function exists
      if (!(await this.exists(projectRef, functionSlug))) {
        throw new StorageNotFoundError(`Function ${functionSlug} in project ${projectRef}`)
      }

      // List all objects with the function prefix
      const functionPrefix = this.getFunctionPrefix(projectRef, functionSlug)
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `${functionPrefix}/`,
      })

      const listResponse = await this.s3Client.send(listCommand)
      
      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        return
      }

      // Delete all objects
      const deletePromises = listResponse.Contents
        .filter(obj => obj.Key)
        .map(obj => {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: obj.Key!,
          })
          return this.s3Client.send(deleteCommand)
        })

      await Promise.all(deletePromises)

    } catch (error: any) {
      if (error instanceof StorageBackendError) {
        throw error
      }
      throw new StorageAccessError(`Failed to delete function from S3: ${error.message}`, {
        projectRef,
        functionSlug,
        bucketName: this.bucketName,
        originalError: error,
      })
    }
  }

  /**
   * Get function metadata
   */
  async getMetadata(projectRef: string, functionSlug: string): Promise<FunctionMetadata | null> {
    try {
      const metadataKey = this.getMetadataKey(projectRef, functionSlug)
      
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: metadataKey,
      })

      try {
        const response = await this.s3Client.send(getCommand)
        
        if (response.Body) {
          const content = await this.streamToString(response.Body)
          const metadata = JSON.parse(content) as FunctionMetadata
          
          // Convert date strings back to Date objects
          return {
            ...metadata,
            createdAt: new Date(metadata.createdAt),
            updatedAt: new Date(metadata.updatedAt),
          }
        }
        
        return null
      } catch (error: any) {
        if (error.name === 'NoSuchKey') {
          return null
        }
        throw error
      }

    } catch (error: any) {
      if (error instanceof StorageBackendError) {
        throw error
      }
      throw new StorageAccessError(`Failed to get metadata from S3: ${error.message}`, {
        projectRef,
        functionSlug,
        bucketName: this.bucketName,
        originalError: error,
      })
    }
  }

  /**
   * Check if a function exists
   */
  async exists(projectRef: string, functionSlug: string): Promise<boolean> {
    try {
      const metadataKey = this.getMetadataKey(projectRef, functionSlug)
      
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: metadataKey,
      })

      await this.s3Client.send(headCommand)
      return true
    } catch (error: any) {
      if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
        return false
      }
      // For other errors, assume function doesn't exist
      return false
    }
  }

  /**
   * Perform health check on the storage backend
   */
  async healthCheck(): Promise<StorageHealthStatus> {
    try {
      // Try to list objects in the bucket (with a limit to avoid large responses)
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.basePrefix,
        MaxKeys: 1,
      })

      await this.s3Client.send(listCommand)

      // Try to put and delete a test object
      const testKey = `${this.basePrefix}/.health-check-${Date.now()}`
      const testContent = `Health check at ${new Date().toISOString()}`

      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
        Body: testContent,
        ServerSideEncryption: 'AES256',
      })

      await this.s3Client.send(putCommand)

      // Verify we can read it back
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
      })

      const getResponse = await this.s3Client.send(getCommand)
      const readContent = await this.streamToString(getResponse.Body!)

      // Clean up test object
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
      })

      await this.s3Client.send(deleteCommand)

      if (readContent !== testContent) {
        return {
          healthy: false,
          error: 'S3 read/write test failed - content mismatch',
          details: {
            bucketName: this.bucketName,
            basePrefix: this.basePrefix,
          },
        }
      }

      return {
        healthy: true,
        details: {
          bucketName: this.bucketName,
          basePrefix: this.basePrefix,
          type: 's3',
        },
      }

    } catch (error: any) {
      return {
        healthy: false,
        error: `S3 health check failed: ${error.message}`,
        details: {
          bucketName: this.bucketName,
          basePrefix: this.basePrefix,
          errorCode: error.name || error.code,
          originalError: error.message,
        },
      }
    }
  }

  /**
   * Convert a stream to string
   */
  private async streamToString(stream: any): Promise<string> {
    if (typeof stream === 'string') {
      return stream
    }

    if (stream instanceof Buffer) {
      return stream.toString('utf-8')
    }

    // Handle ReadableStream
    if (stream && typeof stream.transformToString === 'function') {
      return await stream.transformToString()
    }

    // Handle Node.js streams
    const chunks: Buffer[] = []
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    })
  }

  /**
   * Get content type for a file based on its extension
   */
  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase()
    
    switch (ext) {
      case 'ts':
        return 'application/typescript'
      case 'js':
        return 'application/javascript'
      case 'json':
        return 'application/json'
      case 'md':
        return 'text/markdown'
      case 'txt':
        return 'text/plain'
      case 'html':
        return 'text/html'
      case 'css':
        return 'text/css'
      default:
        return 'text/plain'
    }
  }
}