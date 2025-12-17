import { PoolClient } from 'pg'
import { getServiceRouter } from '../service-router'
import { v4 as uuidv4 } from 'uuid'

/**
 * Webhook object
 */
export interface Webhook {
  id: string
  url: string
  events: string[]
  secret?: string
  headers?: Record<string, string>
  enabled: boolean
  created_at: string
  updated_at: string
  created_by?: string
}

/**
 * Webhook configuration for creation
 */
export interface WebhookConfig {
  url: string
  events: string[]
  secret?: string
  headers?: Record<string, string>
  enabled?: boolean
}

/**
 * Webhook log entry
 */
export interface WebhookLog {
  id: string
  hook_id: string
  event: string
  payload?: Record<string, any>
  response_status?: number
  response_body?: string
  error?: string
  created_at: string
  retry_count?: number
}

/**
 * Webhook trigger options
 */
export interface WebhookTriggerOptions {
  maxRetries?: number
  retryDelay?: number
}

/**
 * Webhook Service Adapter
 * 
 * Provides project-isolated webhook services.
 * Each project has its own webhooks.hooks and webhooks.logs tables.
 */
export class WebhookServiceAdapter {
  private serviceRouter = getServiceRouter()
  
  // Default retry configuration
  private readonly DEFAULT_MAX_RETRIES = 3
  private readonly DEFAULT_RETRY_DELAY = 1000 // 1 second
  private readonly MAX_RETRY_DELAY = 60000 // 60 seconds

  /**
   * Create a new webhook in a project
   * 
   * @param projectRef - The project reference
   * @param config - Webhook configuration
   * @returns Created webhook
   */
  async createWebhook(projectRef: string, config: WebhookConfig): Promise<Webhook> {
    const { url, events, secret, headers, enabled = true } = config

    // Validate webhook configuration
    this.validateWebhookConfig(config)

    return this.serviceRouter.withTransaction(projectRef, async (client) => {
      const webhookId = uuidv4()
      const now = new Date().toISOString()

      // Insert webhook into webhooks.hooks table
      const webhookResult = await client.query(
        `INSERT INTO webhooks.hooks (
          id, url, events, secret, headers, enabled, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, url, events, secret, headers, enabled, created_at, updated_at, created_by`,
        [
          webhookId,
          url,
          events,
          secret || null,
          headers ? JSON.stringify(headers) : null,
          enabled,
          now,
          now,
        ]
      )

      return this.mapWebhookRow(webhookResult.rows[0])
    })
  }

  /**
   * Validate webhook configuration
   * 
   * @param config - Webhook configuration
   * @throws Error if configuration is invalid
   */
  private validateWebhookConfig(config: WebhookConfig): void {
    // Validate URL
    if (!config.url || config.url.trim().length === 0) {
      throw new Error('Webhook URL is required')
    }

    try {
      const parsedUrl = new URL(config.url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Webhook URL must use HTTP or HTTPS protocol')
      }
    } catch (error: any) {
      // If URL parsing failed, check if it's because of an unsupported protocol
      if (config.url.includes('://')) {
        const protocol = config.url.split('://')[0]
        if (protocol && !['http', 'https'].includes(protocol.toLowerCase())) {
          throw new Error('Webhook URL must use HTTP or HTTPS protocol')
        }
      }
      throw new Error('Invalid webhook URL format')
    }

    // Validate events
    if (!config.events || config.events.length === 0) {
      throw new Error('At least one event must be specified')
    }

    // Validate event names (alphanumeric, dots, underscores, hyphens)
    const eventNameRegex = /^[a-zA-Z0-9._-]+$/
    for (const event of config.events) {
      if (!eventNameRegex.test(event)) {
        throw new Error(
          `Invalid event name '${event}'. Event names must contain only alphanumeric characters, dots, underscores, and hyphens.`
        )
      }
    }

    // Validate headers if provided
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          throw new Error('Webhook headers must be string key-value pairs')
        }
      }
    }
  }

  /**
   * Trigger webhooks for a specific event
   * 
   * @param projectRef - The project reference
   * @param event - The event name
   * @param payload - The event payload
   * @param options - Trigger options
   */
  async triggerWebhook(
    projectRef: string,
    event: string,
    payload: Record<string, any>,
    options: WebhookTriggerOptions = {}
  ): Promise<void> {
    const { maxRetries = this.DEFAULT_MAX_RETRIES, retryDelay = this.DEFAULT_RETRY_DELAY } = options

    // Query webhooks that match this event
    const webhooks = await this.getWebhooksForEvent(projectRef, event)

    if (webhooks.length === 0) {
      console.log(`No webhooks configured for event '${event}' in project ${projectRef}`)
      return
    }

    // Trigger each webhook (in parallel for efficiency)
    await Promise.all(
      webhooks.map((webhook) =>
        this.executeWebhook(projectRef, webhook, event, payload, maxRetries, retryDelay)
      )
    )
  }

  /**
   * Get webhooks that should be triggered for an event
   * 
   * @param projectRef - The project reference
   * @param event - The event name
   * @returns Array of webhooks
   */
  private async getWebhooksForEvent(projectRef: string, event: string): Promise<Webhook[]> {
    const result = await this.serviceRouter.query(
      projectRef,
      `SELECT id, url, events, secret, headers, enabled, created_at, updated_at, created_by
       FROM webhooks.hooks
       WHERE enabled = true AND $1 = ANY(events)`,
      [event]
    )

    return result.rows.map((row) => this.mapWebhookRow(row))
  }

  /**
   * Execute a webhook with retry logic
   * 
   * @param projectRef - The project reference
   * @param webhook - The webhook to execute
   * @param event - The event name
   * @param payload - The event payload
   * @param maxRetries - Maximum number of retries
   * @param baseRetryDelay - Base delay between retries (exponential backoff)
   */
  private async executeWebhook(
    projectRef: string,
    webhook: Webhook,
    event: string,
    payload: Record<string, any>,
    maxRetries: number,
    baseRetryDelay: number
  ): Promise<void> {
    let lastError: Error | null = null
    let retryCount = 0

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Send HTTP request to webhook URL
        const response = await this.sendWebhookRequest(webhook, event, payload)

        // Log successful execution
        await this.logWebhookExecution(projectRef, webhook.id, event, payload, {
          status: response.status,
          body: response.body,
          retryCount: attempt,
        })

        // Success - exit retry loop
        return
      } catch (error: any) {
        lastError = error
        retryCount = attempt

        // Log failed execution
        await this.logWebhookExecution(projectRef, webhook.id, event, payload, {
          error: error.message,
          retryCount: attempt,
        })

        // If this was the last attempt, don't wait
        if (attempt < maxRetries) {
          // Exponential backoff: delay * 2^attempt
          const delay = Math.min(baseRetryDelay * Math.pow(2, attempt), this.MAX_RETRY_DELAY)
          await this.sleep(delay)
        }
      }
    }

    // All retries failed
    console.error(
      `Webhook ${webhook.id} failed after ${retryCount + 1} attempts for event '${event}':`,
      lastError
    )
  }

  /**
   * Send HTTP request to webhook URL
   * 
   * @param webhook - The webhook
   * @param event - The event name
   * @param payload - The event payload
   * @returns Response with status and body
   */
  private async sendWebhookRequest(
    webhook: Webhook,
    event: string,
    payload: Record<string, any>
  ): Promise<{ status: number; body: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Supabase-Webhook/1.0',
      'X-Webhook-Event': event,
      ...webhook.headers,
    }

    // Add signature if secret is provided
    if (webhook.secret) {
      const signature = await this.generateSignature(payload, webhook.secret)
      headers['X-Webhook-Signature'] = signature
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    const body = await response.text()

    if (!response.ok) {
      throw new Error(`Webhook request failed with status ${response.status}: ${body}`)
    }

    return {
      status: response.status,
      body,
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   * 
   * @param payload - The payload
   * @param secret - The webhook secret
   * @returns HMAC signature
   */
  private async generateSignature(payload: Record<string, any>, secret: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(JSON.stringify(payload))
    const key = encoder.encode(secret)

    // Import key for HMAC
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    // Generate signature
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data)

    // Convert to hex string
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Log webhook execution
   * 
   * @param projectRef - The project reference
   * @param hookId - The webhook ID
   * @param event - The event name
   * @param payload - The event payload
   * @param result - Execution result
   */
  private async logWebhookExecution(
    projectRef: string,
    hookId: string,
    event: string,
    payload: Record<string, any>,
    result: {
      status?: number
      body?: string
      error?: string
      retryCount: number
    }
  ): Promise<void> {
    try {
      await this.serviceRouter.query(
        projectRef,
        `INSERT INTO webhooks.logs (
          id, hook_id, event, payload, response_status, response_body, error, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          uuidv4(),
          hookId,
          event,
          JSON.stringify(payload),
          result.status || null,
          result.body || null,
          result.error || null,
          new Date().toISOString(),
        ]
      )
    } catch (error) {
      console.error('Failed to log webhook execution:', error)
    }
  }

  /**
   * Sleep for a specified duration
   * 
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * List all webhooks in a project
   * 
   * @param projectRef - The project reference
   * @param options - Query options
   * @returns Array of webhooks
   */
  async listWebhooks(
    projectRef: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Webhook[]> {
    const { limit = 100, offset = 0 } = options

    const result = await this.serviceRouter.query(
      projectRef,
      `SELECT id, url, events, secret, headers, enabled, created_at, updated_at, created_by
       FROM webhooks.hooks
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    return result.rows.map((row) => this.mapWebhookRow(row))
  }

  /**
   * Get a webhook by ID
   * 
   * @param projectRef - The project reference
   * @param webhookId - The webhook ID
   * @returns Webhook or null if not found
   */
  async getWebhook(projectRef: string, webhookId: string): Promise<Webhook | null> {
    const result = await this.serviceRouter.query(
      projectRef,
      `SELECT id, url, events, secret, headers, enabled, created_at, updated_at, created_by
       FROM webhooks.hooks
       WHERE id = $1`,
      [webhookId]
    )

    if (result.rows.length === 0) {
      return null
    }

    return this.mapWebhookRow(result.rows[0])
  }

  /**
   * Update a webhook
   * 
   * @param projectRef - The project reference
   * @param webhookId - The webhook ID
   * @param updates - Fields to update
   * @returns Updated webhook
   */
  async updateWebhook(
    projectRef: string,
    webhookId: string,
    updates: Partial<WebhookConfig>
  ): Promise<Webhook> {
    // Validate updates if URL or events are being changed
    if (updates.url || updates.events) {
      const tempConfig: WebhookConfig = {
        url: updates.url || 'https://example.com', // Placeholder for validation
        events: updates.events || ['placeholder'],
        ...updates,
      }
      this.validateWebhookConfig(tempConfig)
    }

    return this.serviceRouter.withTransaction(projectRef, async (client) => {
      // Build update query dynamically
      const updateFields: string[] = []
      const values: any[] = []
      let paramIndex = 1

      if (updates.url !== undefined) {
        updateFields.push(`url = $${paramIndex++}`)
        values.push(updates.url)
      }

      if (updates.events !== undefined) {
        updateFields.push(`events = $${paramIndex++}`)
        values.push(updates.events)
      }

      if (updates.secret !== undefined) {
        updateFields.push(`secret = $${paramIndex++}`)
        values.push(updates.secret)
      }

      if (updates.headers !== undefined) {
        updateFields.push(`headers = $${paramIndex++}`)
        values.push(updates.headers ? JSON.stringify(updates.headers) : null)
      }

      if (updates.enabled !== undefined) {
        updateFields.push(`enabled = $${paramIndex++}`)
        values.push(updates.enabled)
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update')
      }

      // Always update updated_at
      updateFields.push(`updated_at = $${paramIndex++}`)
      values.push(new Date().toISOString())

      // Add webhook ID as last parameter
      values.push(webhookId)

      const result = await client.query(
        `UPDATE webhooks.hooks
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, url, events, secret, headers, enabled, created_at, updated_at, created_by`,
        values
      )

      if (result.rows.length === 0) {
        throw new Error(`Webhook '${webhookId}' not found`)
      }

      return this.mapWebhookRow(result.rows[0])
    })
  }

  /**
   * Delete a webhook
   * 
   * @param projectRef - The project reference
   * @param webhookId - The webhook ID
   */
  async deleteWebhook(projectRef: string, webhookId: string): Promise<void> {
    await this.serviceRouter.withTransaction(projectRef, async (client) => {
      // Delete webhook logs first (cascade should handle this, but being explicit)
      await client.query('DELETE FROM webhooks.logs WHERE hook_id = $1', [webhookId])

      // Delete webhook
      const result = await client.query('DELETE FROM webhooks.hooks WHERE id = $1 RETURNING id', [
        webhookId,
      ])

      if (result.rows.length === 0) {
        throw new Error(`Webhook '${webhookId}' not found`)
      }
    })
  }

  /**
   * Get webhook logs
   * 
   * @param projectRef - The project reference
   * @param webhookId - The webhook ID
   * @param options - Query options
   * @returns Array of webhook logs
   */
  async getWebhookLogs(
    projectRef: string,
    webhookId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<WebhookLog[]> {
    const { limit = 100, offset = 0 } = options

    const result = await this.serviceRouter.query(
      projectRef,
      `SELECT id, hook_id, event, payload, response_status, response_body, error, created_at
       FROM webhooks.logs
       WHERE hook_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [webhookId, limit, offset]
    )

    return result.rows.map((row) => this.mapWebhookLogRow(row))
  }

  /**
   * Get all webhook logs for a project
   * 
   * @param projectRef - The project reference
   * @param options - Query options
   * @returns Array of webhook logs
   */
  async getAllWebhookLogs(
    projectRef: string,
    options: { limit?: number; offset?: number; event?: string } = {}
  ): Promise<WebhookLog[]> {
    const { limit = 100, offset = 0, event } = options

    let query = `
      SELECT id, hook_id, event, payload, response_status, response_body, error, created_at
      FROM webhooks.logs
    `
    const params: any[] = []

    if (event) {
      query += ` WHERE event = $1`
      params.push(event)
      query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`
      params.push(limit, offset)
    } else {
      query += ` ORDER BY created_at DESC LIMIT $1 OFFSET $2`
      params.push(limit, offset)
    }

    const result = await this.serviceRouter.query(projectRef, query, params)

    return result.rows.map((row) => this.mapWebhookLogRow(row))
  }

  /**
   * Map database row to Webhook object
   * 
   * @param row - Database row
   * @returns Webhook object
   */
  private mapWebhookRow(row: any): Webhook {
    return {
      id: row.id,
      url: row.url,
      events: row.events,
      secret: row.secret,
      headers: row.headers ? JSON.parse(row.headers) : undefined,
      enabled: row.enabled,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
    }
  }

  /**
   * Map database row to WebhookLog object
   * 
   * @param row - Database row
   * @returns WebhookLog object
   */
  private mapWebhookLogRow(row: any): WebhookLog {
    return {
      id: row.id,
      hook_id: row.hook_id,
      event: row.event,
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      response_status: row.response_status,
      response_body: row.response_body,
      error: row.error,
      created_at: row.created_at,
    }
  }
}

// Singleton instance
let webhookServiceAdapter: WebhookServiceAdapter | null = null

/**
 * Get the singleton WebhookServiceAdapter instance
 */
export function getWebhookServiceAdapter(): WebhookServiceAdapter {
  if (!webhookServiceAdapter) {
    webhookServiceAdapter = new WebhookServiceAdapter()
  }
  return webhookServiceAdapter
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetWebhookServiceAdapter(): void {
  webhookServiceAdapter = null
}
