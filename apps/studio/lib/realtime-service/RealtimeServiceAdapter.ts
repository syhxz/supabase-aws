import { PoolClient } from 'pg'
import { getServiceRouter } from '../service-router'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'

/**
 * Realtime event types
 */
export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | 'BROADCAST'

/**
 * Realtime event payload
 */
export interface RealtimeEvent {
  type: RealtimeEventType
  table?: string
  schema?: string
  record?: Record<string, any>
  old_record?: Record<string, any>
  timestamp: string
  project_ref: string
}

/**
 * Event callback function
 */
export type EventCallback = (event: RealtimeEvent) => void

/**
 * Subscription object
 */
export interface Subscription {
  id: string
  projectRef: string
  channel: string
  callback: EventCallback
  createdAt: Date
}

/**
 * Channel information
 */
export interface Channel {
  name: string
  projectRef: string
  subscriberCount: number
  createdAt: Date
}

/**
 * Broadcast event payload
 */
export interface BroadcastPayload {
  type: string
  payload: Record<string, any>
}

/**
 * Realtime Service Adapter
 * 
 * Provides project-isolated realtime data synchronization.
 * Each project has its own realtime channels and logical replication configuration.
 * 
 * Channel naming convention:
 * - Table changes: realtime:{project_ref}:{table_name}
 * - Custom channels: realtime:{project_ref}:custom:{channel_name}
 */
export class RealtimeServiceAdapter {
  private serviceRouter = getServiceRouter()
  private eventEmitter = new EventEmitter()
  private subscriptions = new Map<string, Subscription>()
  private replicationSlots = new Map<string, string>() // projectRef -> slot name
  
  // Increase max listeners to avoid warnings with many subscriptions
  constructor() {
    this.eventEmitter.setMaxListeners(1000)
  }

  /**
   * Subscribe to realtime events on a channel
   * 
   * @param projectRef - The project reference
   * @param channel - The channel name (without project prefix)
   * @param callback - Callback function for events
   * @returns Subscription object
   */
  async subscribe(
    projectRef: string,
    channel: string,
    callback: EventCallback
  ): Promise<Subscription> {
    // Validate inputs
    if (!projectRef || !channel) {
      throw new Error('Project reference and channel are required')
    }

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function')
    }

    // Create subscription ID
    const subscriptionId = uuidv4()

    // Create channel name with project prefix
    const fullChannelName = this.getChannelName(projectRef, channel)

    // Create subscription object
    const subscription: Subscription = {
      id: subscriptionId,
      projectRef,
      channel: fullChannelName,
      callback,
      createdAt: new Date(),
    }

    // Store subscription
    this.subscriptions.set(subscriptionId, subscription)

    // Register event listener
    this.eventEmitter.on(fullChannelName, callback)

    // Ensure logical replication is configured for this project
    await this.ensureReplicationSlot(projectRef)

    console.log(`Subscribed to channel: ${fullChannelName} (subscription: ${subscriptionId})`)

    return subscription
  }

  /**
   * Unsubscribe from realtime events
   * 
   * @param projectRef - The project reference
   * @param subscriptionId - The subscription ID
   */
  async unsubscribe(projectRef: string, subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId)

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`)
    }

    // Verify project ref matches
    if (subscription.projectRef !== projectRef) {
      throw new Error('Project reference mismatch')
    }

    // Remove event listener
    this.eventEmitter.off(subscription.channel, subscription.callback)

    // Remove subscription
    this.subscriptions.delete(subscriptionId)

    console.log(`Unsubscribed from channel: ${subscription.channel} (subscription: ${subscriptionId})`)
  }

  /**
   * Broadcast a custom event to a channel
   * 
   * @param projectRef - The project reference
   * @param channel - The channel name (without project prefix)
   * @param payload - Event payload
   */
  async broadcast(
    projectRef: string,
    channel: string,
    payload: BroadcastPayload
  ): Promise<void> {
    // Validate inputs
    if (!projectRef || !channel) {
      throw new Error('Project reference and channel are required')
    }

    // Create channel name with project prefix
    const fullChannelName = this.getChannelName(projectRef, channel)

    // Create event
    const event: RealtimeEvent = {
      type: 'BROADCAST',
      timestamp: new Date().toISOString(),
      project_ref: projectRef,
      record: payload.payload,
    }

    // Emit event to subscribers
    this.eventEmitter.emit(fullChannelName, event)

    console.log(`Broadcast event to channel: ${fullChannelName}`)
  }

  /**
   * Get active channels for a project
   * 
   * @param projectRef - The project reference
   * @returns Array of active channels
   */
  async getActiveChannels(projectRef: string): Promise<Channel[]> {
    const channels = new Map<string, Channel>()

    // Iterate through subscriptions to find active channels
    for (const subscription of this.subscriptions.values()) {
      if (subscription.projectRef === projectRef) {
        const channelName = subscription.channel

        if (!channels.has(channelName)) {
          channels.set(channelName, {
            name: channelName,
            projectRef,
            subscriberCount: 0,
            createdAt: subscription.createdAt,
          })
        }

        const channel = channels.get(channelName)!
        channel.subscriberCount++
      }
    }

    return Array.from(channels.values())
  }

  /**
   * Get all subscriptions for a project
   * 
   * @param projectRef - The project reference
   * @returns Array of subscriptions
   */
  getSubscriptions(projectRef: string): Subscription[] {
    const projectSubscriptions: Subscription[] = []

    for (const subscription of this.subscriptions.values()) {
      if (subscription.projectRef === projectRef) {
        projectSubscriptions.push(subscription)
      }
    }

    return projectSubscriptions
  }

  /**
   * Simulate a database change event (for testing and development)
   * In production, this would be triggered by logical replication
   * 
   * @param projectRef - The project reference
   * @param table - The table name
   * @param eventType - The event type
   * @param record - The record data
   * @param oldRecord - The old record data (for UPDATE/DELETE)
   */
  async emitDatabaseChange(
    projectRef: string,
    table: string,
    eventType: RealtimeEventType,
    record?: Record<string, any>,
    oldRecord?: Record<string, any>
  ): Promise<void> {
    // Create channel name for table
    const channelName = this.getChannelName(projectRef, table)

    // Create event
    const event: RealtimeEvent = {
      type: eventType,
      table,
      schema: 'public',
      record,
      old_record: oldRecord,
      timestamp: new Date().toISOString(),
      project_ref: projectRef,
    }

    // Emit event to subscribers
    this.eventEmitter.emit(channelName, event)

    console.log(`Emitted ${eventType} event for ${projectRef}.${table}`)
  }

  /**
   * Ensure logical replication slot exists for a project
   * 
   * @param projectRef - The project reference
   */
  private async ensureReplicationSlot(projectRef: string): Promise<void> {
    // Check if we already have a replication slot for this project
    if (this.replicationSlots.has(projectRef)) {
      return
    }

    try {
      // Create replication slot name
      const slotName = `realtime_${projectRef.replace(/-/g, '_')}`

      // Check if replication slot exists
      const result = await this.serviceRouter.query(
        projectRef,
        `SELECT slot_name FROM pg_replication_slots WHERE slot_name = $1`,
        [slotName]
      )

      if (result.rows.length === 0) {
        // Create replication slot
        // Note: This requires superuser privileges or the pg_create_logical_replication_slot role
        try {
          await this.serviceRouter.query(
            projectRef,
            `SELECT pg_create_logical_replication_slot($1, 'pgoutput')`,
            [slotName]
          )
          console.log(`Created replication slot: ${slotName}`)
        } catch (error: any) {
          // If we don't have permissions, log a warning but don't fail
          if (error.message?.includes('permission denied')) {
            console.warn(
              `Cannot create replication slot ${slotName}: insufficient permissions. ` +
              `Realtime features may be limited.`
            )
          } else {
            throw error
          }
        }
      }

      // Store slot name
      this.replicationSlots.set(projectRef, slotName)
    } catch (error) {
      console.error(`Error ensuring replication slot for ${projectRef}:`, error)
      // Don't throw - allow subscriptions to work even if replication setup fails
    }
  }

  /**
   * Get full channel name with project prefix
   * 
   * @param projectRef - The project reference
   * @param channel - The channel name
   * @returns Full channel name
   */
  private getChannelName(projectRef: string, channel: string): string {
    return `realtime:${projectRef}:${channel}`
  }

  /**
   * Drop replication slot for a project
   * 
   * @param projectRef - The project reference
   */
  async dropReplicationSlot(projectRef: string): Promise<void> {
    const slotName = this.replicationSlots.get(projectRef)

    if (!slotName) {
      return
    }

    try {
      // Drop replication slot
      await this.serviceRouter.query(
        projectRef,
        `SELECT pg_drop_replication_slot($1)`,
        [slotName]
      )

      console.log(`Dropped replication slot: ${slotName}`)

      // Remove from map
      this.replicationSlots.delete(projectRef)
    } catch (error: any) {
      // If slot doesn't exist, that's okay
      if (!error.message?.includes('does not exist')) {
        console.error(`Error dropping replication slot ${slotName}:`, error)
      }
    }
  }

  /**
   * Unsubscribe all subscriptions for a project
   * 
   * @param projectRef - The project reference
   */
  async unsubscribeAll(projectRef: string): Promise<void> {
    const subscriptionsToRemove: string[] = []

    // Find all subscriptions for this project
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.projectRef === projectRef) {
        subscriptionsToRemove.push(id)
      }
    }

    // Remove each subscription
    for (const id of subscriptionsToRemove) {
      await this.unsubscribe(projectRef, id)
    }

    console.log(`Unsubscribed all ${subscriptionsToRemove.length} subscriptions for project: ${projectRef}`)
  }

  /**
   * Get statistics about realtime service
   * 
   * @returns Service statistics
   */
  getStats(): {
    totalSubscriptions: number
    totalChannels: number
    projectCount: number
    replicationSlots: number
  } {
    const projects = new Set<string>()
    const channels = new Set<string>()

    for (const subscription of this.subscriptions.values()) {
      projects.add(subscription.projectRef)
      channels.add(subscription.channel)
    }

    return {
      totalSubscriptions: this.subscriptions.size,
      totalChannels: channels.size,
      projectCount: projects.size,
      replicationSlots: this.replicationSlots.size,
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Remove all event listeners
    this.eventEmitter.removeAllListeners()

    // Clear subscriptions
    this.subscriptions.clear()

    // Note: We don't drop replication slots here as they should persist
    // They can be manually dropped when a project is deleted

    console.log('Realtime service adapter cleaned up')
  }
}

// Singleton instance
let realtimeServiceAdapter: RealtimeServiceAdapter | null = null

/**
 * Get the singleton RealtimeServiceAdapter instance
 */
export function getRealtimeServiceAdapter(): RealtimeServiceAdapter {
  if (!realtimeServiceAdapter) {
    realtimeServiceAdapter = new RealtimeServiceAdapter()
  }
  return realtimeServiceAdapter
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetRealtimeServiceAdapter(): void {
  if (realtimeServiceAdapter) {
    realtimeServiceAdapter.cleanup().catch(console.error)
    realtimeServiceAdapter = null
  }
}
