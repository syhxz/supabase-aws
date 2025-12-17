/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  WebhookServiceAdapter,
  getWebhookServiceAdapter,
  resetWebhookServiceAdapter,
  WebhookConfig,
} from '../../lib/webhook-service'

describe('WebhookServiceAdapter', () => {
  let adapter: WebhookServiceAdapter

  beforeEach(() => {
    resetWebhookServiceAdapter()
    adapter = getWebhookServiceAdapter()
  })

  afterEach(() => {
    resetWebhookServiceAdapter()
    vi.restoreAllMocks()
  })

  describe('Webhook Configuration Validation', () => {
    it('should reject webhook with empty URL', async () => {
      const config: WebhookConfig = {
        url: '',
        events: ['user.created'],
      }

      // We can't test createWebhook directly without a database connection,
      // but we can test the validation logic through the error messages
      await expect(async () => {
        // This will fail at the service router level, but validation happens first
        const adapter = getWebhookServiceAdapter()
        // Access private method through type assertion for testing
        ;(adapter as any).validateWebhookConfig(config)
      }).rejects.toThrow('Webhook URL is required')
    })

    it('should reject webhook with invalid URL format', async () => {
      const config: WebhookConfig = {
        url: 'not-a-valid-url',
        events: ['user.created'],
      }

      await expect(async () => {
        const adapter = getWebhookServiceAdapter()
        ;(adapter as any).validateWebhookConfig(config)
      }).rejects.toThrow('Invalid webhook URL format')
    })

    it('should reject webhook with non-HTTP(S) protocol', async () => {
      const config: WebhookConfig = {
        url: 'ftp://example.com/webhook',
        events: ['user.created'],
      }

      await expect(async () => {
        const adapter = getWebhookServiceAdapter()
        ;(adapter as any).validateWebhookConfig(config)
      }).rejects.toThrow('Webhook URL must use HTTP or HTTPS protocol')
    })

    it('should reject webhook with no events', async () => {
      const config: WebhookConfig = {
        url: 'https://example.com/webhook',
        events: [],
      }

      await expect(async () => {
        const adapter = getWebhookServiceAdapter()
        ;(adapter as any).validateWebhookConfig(config)
      }).rejects.toThrow('At least one event must be specified')
    })

    it('should reject webhook with invalid event names', async () => {
      const config: WebhookConfig = {
        url: 'https://example.com/webhook',
        events: ['user created'], // Space is not allowed
      }

      await expect(async () => {
        const adapter = getWebhookServiceAdapter()
        ;(adapter as any).validateWebhookConfig(config)
      }).rejects.toThrow('Invalid event name')
    })

    it('should accept valid webhook configuration', async () => {
      const config: WebhookConfig = {
        url: 'https://example.com/webhook',
        events: ['user.created', 'user_updated', 'order-completed'],
        secret: 'my-secret',
        headers: {
          'X-Custom-Header': 'value',
        },
      }

      expect(() => {
        const adapter = getWebhookServiceAdapter()
        ;(adapter as any).validateWebhookConfig(config)
      }).not.toThrow()
    })
  })

  describe('HMAC Signature Generation', () => {
    it('should generate consistent signatures for same payload and secret', async () => {
      const adapter = getWebhookServiceAdapter()
      const payload = { user_id: '123', email: 'test@example.com' }
      const secret = 'test-secret'

      const signature1 = await (adapter as any).generateSignature(payload, secret)
      const signature2 = await (adapter as any).generateSignature(payload, secret)

      expect(signature1).toBe(signature2)
      expect(signature1).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex is 64 characters
    })

    it('should generate different signatures for different payloads', async () => {
      const adapter = getWebhookServiceAdapter()
      const payload1 = { user_id: '123' }
      const payload2 = { user_id: '456' }
      const secret = 'test-secret'

      const signature1 = await (adapter as any).generateSignature(payload1, secret)
      const signature2 = await (adapter as any).generateSignature(payload2, secret)

      expect(signature1).not.toBe(signature2)
    })

    it('should generate different signatures for different secrets', async () => {
      const adapter = getWebhookServiceAdapter()
      const payload = { user_id: '123' }
      const secret1 = 'secret-1'
      const secret2 = 'secret-2'

      const signature1 = await (adapter as any).generateSignature(payload, secret1)
      const signature2 = await (adapter as any).generateSignature(payload, secret2)

      expect(signature1).not.toBe(signature2)
    })
  })

  describe('Webhook Request Sending', () => {
    it('should send webhook request with correct headers', async () => {
      const adapter = getWebhookServiceAdapter()
      const webhook = {
        id: 'webhook-1',
        url: 'https://httpbin.org/post',
        events: ['test.event'],
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      }
      const event = 'test.event'
      const payload = { test: 'data' }

      // Mock fetch to avoid actual HTTP requests
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      })
      global.fetch = mockFetch

      await (adapter as any).sendWebhookRequest(webhook, event, payload)

      expect(mockFetch).toHaveBeenCalledWith(
        webhook.url,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'Supabase-Webhook/1.0',
            'X-Webhook-Event': event,
            'X-Custom-Header': 'custom-value',
          }),
          body: JSON.stringify(payload),
        })
      )
    })

    it('should include signature header when secret is provided', async () => {
      const adapter = getWebhookServiceAdapter()
      const webhook = {
        id: 'webhook-1',
        url: 'https://httpbin.org/post',
        events: ['test.event'],
        secret: 'test-secret',
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const event = 'test.event'
      const payload = { test: 'data' }

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      })
      global.fetch = mockFetch

      await (adapter as any).sendWebhookRequest(webhook, event, payload)

      expect(mockFetch).toHaveBeenCalledWith(
        webhook.url,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Webhook-Signature': expect.stringMatching(/^[a-f0-9]{64}$/),
          }),
        })
      )
    })

    it('should throw error for non-2xx responses', async () => {
      const adapter = getWebhookServiceAdapter()
      const webhook = {
        id: 'webhook-1',
        url: 'https://httpbin.org/status/500',
        events: ['test.event'],
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const event = 'test.event'
      const payload = { test: 'data' }

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })
      global.fetch = mockFetch

      await expect(
        (adapter as any).sendWebhookRequest(webhook, event, payload)
      ).rejects.toThrow('Webhook request failed with status 500')
    })
  })

  describe('Retry Logic', () => {
    it('should retry failed webhooks with exponential backoff', async () => {
      const adapter = getWebhookServiceAdapter()
      
      // Mock sleep to avoid actual delays in tests
      const sleepSpy = vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined)
      
      // Mock sendWebhookRequest to fail twice then succeed
      let attemptCount = 0
      const sendWebhookRequestSpy = vi
        .spyOn(adapter as any, 'sendWebhookRequest')
        .mockImplementation(async () => {
          attemptCount++
          if (attemptCount <= 2) {
            throw new Error('Network error')
          }
          return { status: 200, body: 'OK' }
        })

      // Mock logWebhookExecution to avoid database calls
      const logSpy = vi.spyOn(adapter as any, 'logWebhookExecution').mockResolvedValue(undefined)

      const webhook = {
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        events: ['test.event'],
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await (adapter as any).executeWebhook(
        'test-project',
        webhook,
        'test.event',
        { test: 'data' },
        3, // maxRetries
        1000 // baseRetryDelay
      )

      // Should have attempted 3 times (initial + 2 retries)
      expect(sendWebhookRequestSpy).toHaveBeenCalledTimes(3)
      
      // Should have slept twice (after first and second failures)
      expect(sleepSpy).toHaveBeenCalledTimes(2)
      
      // Check exponential backoff: 1000ms, 2000ms
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000)
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000)
      
      // Should have logged 3 times (2 failures + 1 success)
      expect(logSpy).toHaveBeenCalledTimes(3)
    })

    it('should respect max retry delay', async () => {
      const adapter = getWebhookServiceAdapter()
      
      const sleepSpy = vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined)
      
      // Mock to always fail
      vi.spyOn(adapter as any, 'sendWebhookRequest').mockRejectedValue(new Error('Network error'))
      vi.spyOn(adapter as any, 'logWebhookExecution').mockResolvedValue(undefined)

      const webhook = {
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        events: ['test.event'],
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await (adapter as any).executeWebhook(
        'test-project',
        webhook,
        'test.event',
        { test: 'data' },
        10, // maxRetries (high number to test max delay)
        10000 // baseRetryDelay (10 seconds)
      )

      // Check that delays don't exceed MAX_RETRY_DELAY (60000ms)
      const calls = sleepSpy.mock.calls
      for (const call of calls) {
        expect(call[0]).toBeLessThanOrEqual(60000)
      }
    })
  })

  describe('Event Name Validation', () => {
    const validEventNames = [
      'user.created',
      'user_updated',
      'order-completed',
      'payment.succeeded',
      'data.sync.complete',
      'api_call_123',
    ]

    const invalidEventNames = [
      'user created', // space
      'user@created', // special char
      'user/created', // slash
      'user\\created', // backslash
      'user created!', // exclamation
    ]

    validEventNames.forEach((eventName) => {
      it(`should accept valid event name: ${eventName}`, () => {
        const config: WebhookConfig = {
          url: 'https://example.com/webhook',
          events: [eventName],
        }

        expect(() => {
          const adapter = getWebhookServiceAdapter()
          ;(adapter as any).validateWebhookConfig(config)
        }).not.toThrow()
      })
    })

    invalidEventNames.forEach((eventName) => {
      it(`should reject invalid event name: ${eventName}`, () => {
        const config: WebhookConfig = {
          url: 'https://example.com/webhook',
          events: [eventName],
        }

        expect(() => {
          const adapter = getWebhookServiceAdapter()
          ;(adapter as any).validateWebhookConfig(config)
        }).toThrow('Invalid event name')
      })
    })
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getWebhookServiceAdapter()
      const instance2 = getWebhookServiceAdapter()

      expect(instance1).toBe(instance2)
    })

    it('should create new instance after reset', () => {
      const instance1 = getWebhookServiceAdapter()
      resetWebhookServiceAdapter()
      const instance2 = getWebhookServiceAdapter()

      expect(instance1).not.toBe(instance2)
    })
  })
})
