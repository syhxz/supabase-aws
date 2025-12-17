/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  RealtimeServiceAdapter,
  getRealtimeServiceAdapter,
  resetRealtimeServiceAdapter,
  RealtimeEvent,
} from '../../lib/realtime-service'

// Mock the service router to avoid database dependencies
vi.mock('../../lib/service-router', () => ({
  getServiceRouter: () => ({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    withTransaction: vi.fn((projectRef, fn) => fn({ query: vi.fn() })),
  }),
}))

describe('RealtimeServiceAdapter', () => {
  let adapter: RealtimeServiceAdapter

  beforeEach(() => {
    resetRealtimeServiceAdapter()
    adapter = getRealtimeServiceAdapter()
  })

  afterEach(async () => {
    await adapter.cleanup()
    resetRealtimeServiceAdapter()
  })

  describe('subscribe', () => {
    it('should create a subscription with project-prefixed channel name', async () => {
      const callback = vi.fn()
      const subscription = await adapter.subscribe('project-a', 'users', callback)

      expect(subscription).toBeDefined()
      expect(subscription.id).toBeDefined()
      expect(subscription.projectRef).toBe('project-a')
      expect(subscription.channel).toBe('realtime:project-a:users')
      expect(subscription.callback).toBe(callback)
    })

    it('should throw error if project ref is missing', async () => {
      const callback = vi.fn()
      await expect(adapter.subscribe('', 'users', callback)).rejects.toThrow(
        'Project reference and channel are required'
      )
    })

    it('should throw error if channel is missing', async () => {
      const callback = vi.fn()
      await expect(adapter.subscribe('project-a', '', callback)).rejects.toThrow(
        'Project reference and channel are required'
      )
    })

    it('should throw error if callback is not a function', async () => {
      await expect(
        adapter.subscribe('project-a', 'users', 'not-a-function' as any)
      ).rejects.toThrow('Callback must be a function')
    })
  })

  describe('unsubscribe', () => {
    it('should remove a subscription', async () => {
      const callback = vi.fn()
      const subscription = await adapter.subscribe('project-a', 'users', callback)

      await adapter.unsubscribe('project-a', subscription.id)

      const subscriptions = adapter.getSubscriptions('project-a')
      expect(subscriptions).toHaveLength(0)
    })

    it('should throw error if subscription not found', async () => {
      await expect(adapter.unsubscribe('project-a', 'invalid-id')).rejects.toThrow(
        'Subscription not found'
      )
    })

    it('should throw error if project ref mismatch', async () => {
      const callback = vi.fn()
      const subscription = await adapter.subscribe('project-a', 'users', callback)

      await expect(adapter.unsubscribe('project-b', subscription.id)).rejects.toThrow(
        'Project reference mismatch'
      )
    })
  })

  describe('broadcast', () => {
    it('should broadcast event to subscribers of the same project', async () => {
      const callback = vi.fn()
      await adapter.subscribe('project-a', 'notifications', callback)

      await adapter.broadcast('project-a', 'notifications', {
        type: 'test',
        payload: { message: 'Hello' },
      })

      expect(callback).toHaveBeenCalledTimes(1)
      const event: RealtimeEvent = callback.mock.calls[0][0]
      expect(event.type).toBe('BROADCAST')
      expect(event.project_ref).toBe('project-a')
      expect(event.record).toEqual({ message: 'Hello' })
    })

    it('should not broadcast to subscribers of different projects', async () => {
      const callbackA = vi.fn()
      const callbackB = vi.fn()

      await adapter.subscribe('project-a', 'notifications', callbackA)
      await adapter.subscribe('project-b', 'notifications', callbackB)

      await adapter.broadcast('project-a', 'notifications', {
        type: 'test',
        payload: { message: 'Hello' },
      })

      expect(callbackA).toHaveBeenCalledTimes(1)
      expect(callbackB).not.toHaveBeenCalled()
    })

    it('should throw error if project ref is missing', async () => {
      await expect(
        adapter.broadcast('', 'notifications', { type: 'test', payload: {} })
      ).rejects.toThrow('Project reference and channel are required')
    })
  })

  describe('emitDatabaseChange', () => {
    it('should emit INSERT event to table subscribers', async () => {
      const callback = vi.fn()
      await adapter.subscribe('project-a', 'users', callback)

      await adapter.emitDatabaseChange('project-a', 'users', 'INSERT', {
        id: '123',
        email: 'test@example.com',
      })

      expect(callback).toHaveBeenCalledTimes(1)
      const event: RealtimeEvent = callback.mock.calls[0][0]
      expect(event.type).toBe('INSERT')
      expect(event.table).toBe('users')
      expect(event.record).toEqual({ id: '123', email: 'test@example.com' })
    })

    it('should emit UPDATE event with old and new records', async () => {
      const callback = vi.fn()
      await adapter.subscribe('project-a', 'users', callback)

      await adapter.emitDatabaseChange(
        'project-a',
        'users',
        'UPDATE',
        { id: '123', email: 'new@example.com' },
        { id: '123', email: 'old@example.com' }
      )

      expect(callback).toHaveBeenCalledTimes(1)
      const event: RealtimeEvent = callback.mock.calls[0][0]
      expect(event.type).toBe('UPDATE')
      expect(event.record).toEqual({ id: '123', email: 'new@example.com' })
      expect(event.old_record).toEqual({ id: '123', email: 'old@example.com' })
    })

    it('should not emit to subscribers of different projects', async () => {
      const callbackA = vi.fn()
      const callbackB = vi.fn()

      await adapter.subscribe('project-a', 'users', callbackA)
      await adapter.subscribe('project-b', 'users', callbackB)

      await adapter.emitDatabaseChange('project-a', 'users', 'INSERT', {
        id: '123',
        email: 'test@example.com',
      })

      expect(callbackA).toHaveBeenCalledTimes(1)
      expect(callbackB).not.toHaveBeenCalled()
    })
  })

  describe('getActiveChannels', () => {
    it('should return active channels for a project', async () => {
      await adapter.subscribe('project-a', 'users', vi.fn())
      await adapter.subscribe('project-a', 'posts', vi.fn())
      await adapter.subscribe('project-a', 'users', vi.fn()) // Second subscriber to users

      const channels = await adapter.getActiveChannels('project-a')

      expect(channels).toHaveLength(2)
      
      const usersChannel = channels.find((c) => c.name === 'realtime:project-a:users')
      expect(usersChannel).toBeDefined()
      expect(usersChannel?.subscriberCount).toBe(2)

      const postsChannel = channels.find((c) => c.name === 'realtime:project-a:posts')
      expect(postsChannel).toBeDefined()
      expect(postsChannel?.subscriberCount).toBe(1)
    })

    it('should not return channels from other projects', async () => {
      await adapter.subscribe('project-a', 'users', vi.fn())
      await adapter.subscribe('project-b', 'users', vi.fn())

      const channelsA = await adapter.getActiveChannels('project-a')
      const channelsB = await adapter.getActiveChannels('project-b')

      expect(channelsA).toHaveLength(1)
      expect(channelsA[0].name).toBe('realtime:project-a:users')

      expect(channelsB).toHaveLength(1)
      expect(channelsB[0].name).toBe('realtime:project-b:users')
    })
  })

  describe('getSubscriptions', () => {
    it('should return subscriptions for a specific project', async () => {
      await adapter.subscribe('project-a', 'users', vi.fn())
      await adapter.subscribe('project-a', 'posts', vi.fn())
      await adapter.subscribe('project-b', 'users', vi.fn())

      const subscriptionsA = adapter.getSubscriptions('project-a')
      const subscriptionsB = adapter.getSubscriptions('project-b')

      expect(subscriptionsA).toHaveLength(2)
      expect(subscriptionsB).toHaveLength(1)
    })
  })

  describe('unsubscribeAll', () => {
    it('should remove all subscriptions for a project', async () => {
      await adapter.subscribe('project-a', 'users', vi.fn())
      await adapter.subscribe('project-a', 'posts', vi.fn())
      await adapter.subscribe('project-b', 'users', vi.fn())

      await adapter.unsubscribeAll('project-a')

      const subscriptionsA = adapter.getSubscriptions('project-a')
      const subscriptionsB = adapter.getSubscriptions('project-b')

      expect(subscriptionsA).toHaveLength(0)
      expect(subscriptionsB).toHaveLength(1)
    })
  })

  describe('getStats', () => {
    it('should return service statistics', async () => {
      await adapter.subscribe('project-a', 'users', vi.fn())
      await adapter.subscribe('project-a', 'posts', vi.fn())
      await adapter.subscribe('project-b', 'users', vi.fn())

      const stats = adapter.getStats()

      expect(stats.totalSubscriptions).toBe(3)
      expect(stats.totalChannels).toBe(3)
      expect(stats.projectCount).toBe(2)
    })
  })

  describe('isolation', () => {
    it('should ensure complete isolation between projects', async () => {
      const callbackA1 = vi.fn()
      const callbackA2 = vi.fn()
      const callbackB1 = vi.fn()
      const callbackB2 = vi.fn()

      // Subscribe to same channel names in different projects
      await adapter.subscribe('project-a', 'users', callbackA1)
      await adapter.subscribe('project-a', 'notifications', callbackA2)
      await adapter.subscribe('project-b', 'users', callbackB1)
      await adapter.subscribe('project-b', 'notifications', callbackB2)

      // Emit events to project A
      await adapter.emitDatabaseChange('project-a', 'users', 'INSERT', { id: '1' })
      await adapter.broadcast('project-a', 'notifications', {
        type: 'test',
        payload: { msg: 'A' },
      })

      // Emit events to project B
      await adapter.emitDatabaseChange('project-b', 'users', 'INSERT', { id: '2' })
      await adapter.broadcast('project-b', 'notifications', {
        type: 'test',
        payload: { msg: 'B' },
      })

      // Verify project A callbacks received only project A events
      expect(callbackA1).toHaveBeenCalledTimes(1)
      expect(callbackA1.mock.calls[0][0].project_ref).toBe('project-a')
      expect(callbackA2).toHaveBeenCalledTimes(1)
      expect(callbackA2.mock.calls[0][0].project_ref).toBe('project-a')

      // Verify project B callbacks received only project B events
      expect(callbackB1).toHaveBeenCalledTimes(1)
      expect(callbackB1.mock.calls[0][0].project_ref).toBe('project-b')
      expect(callbackB2).toHaveBeenCalledTimes(1)
      expect(callbackB2.mock.calls[0][0].project_ref).toBe('project-b')
    })
  })
})
