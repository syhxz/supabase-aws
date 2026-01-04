import { TextDecoder, TextEncoder } from 'node:util'
import { ReadableStream, TransformStream } from 'node:stream/web'
import { vi } from 'vitest'

// Create localStorage mock that works in both browser and Node environments
const createLocalStorageMock = () => ({
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
})

// Setup localStorage and sessionStorage globally FIRST for MSW compatibility
// This must happen before any MSW imports
const localStorageMock = createLocalStorageMock()
const sessionStorageMock = createLocalStorageMock()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
  configurable: true,
})

// Only setup browser-specific polyfills in jsdom environment
if (typeof window !== 'undefined') {
  const { configMocks } = await import('jsdom-testing-mocks')
  const { act } = await import('@testing-library/react')
  
  configMocks({ act })

  // Ensure window.localStorage uses the same mock as globalThis
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  })

  // Ensure window.sessionStorage uses the same mock as globalThis
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true,
    configurable: true,
  })

  // Ensure AbortController and AbortSignal are available on window
  if (!window.AbortController) {
    window.AbortController = globalThis.AbortController
  }
  if (!window.AbortSignal) {
    window.AbortSignal = globalThis.AbortSignal
  }

  // Warning: `restoreMocks: true` in vitest.config.ts will
  // cause this global mockImplementation to be **reset**
  // before any tests are run!
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  window.HTMLElement.prototype.hasPointerCapture = vi.fn()
}

Object.defineProperties(globalThis, {
  TextDecoder: { value: TextDecoder },
  TextEncoder: { value: TextEncoder },
  CSS: {
    value: {
      supports: (_k: any, _v: any) => false,
      escape: (v: any) => v,
    },
  },
  ReadableStream: { value: ReadableStream },
  TransformStream: { value: TransformStream },
})

// Mock fetch to avoid AbortSignal compatibility issues in tests
const originalFetch = globalThis.fetch

// Create a test-friendly fetch that doesn't use AbortSignal
const testFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  // Remove the signal from init to avoid AbortSignal issues
  const { signal, ...restInit } = init || {}
  
  // Convert relative URLs to absolute URLs for testing
  let url = input
  if (typeof input === 'string' && input.startsWith('/')) {
    url = `http://localhost:3000${input}`
  }
  
  // For tests, we'll just ignore the signal and make a simple fetch
  // This is acceptable since tests should mock fetch responses anyway
  if (originalFetch) {
    return originalFetch(url, restInit)
  }
  
  // If no original fetch, throw an error that tests can catch
  throw new Error('Fetch not available in test environment')
}

// Replace global fetch with our test-friendly version
Object.defineProperty(globalThis, 'fetch', {
  value: testFetch,
  writable: true,
  configurable: true,
})

// Provide minimal AbortController/AbortSignal for compatibility
if (typeof globalThis.AbortController === 'undefined') {
  class TestAbortSignal extends EventTarget {
    aborted = false
    reason: any = undefined
    
    throwIfAborted() {
      if (this.aborted) {
        throw this.reason || new Error('AbortError')
      }
    }
  }
  
  class TestAbortController {
    signal = new TestAbortSignal()
    
    abort(reason?: any) {
      if (!this.signal.aborted) {
        this.signal.aborted = true
        this.signal.reason = reason
        this.signal.dispatchEvent(new Event('abort'))
      }
    }
  }
  
  Object.defineProperty(globalThis, 'AbortController', {
    value: TestAbortController,
    writable: true,
    configurable: true,
  })
  
  Object.defineProperty(globalThis, 'AbortSignal', {
    value: TestAbortSignal,
    writable: true,
    configurable: true,
  })
}
