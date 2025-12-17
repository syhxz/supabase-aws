import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { createDynamicRouteParser } from 'next-router-mock/dist/dynamic-routes'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { routerMock } from './lib/route-mock'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

// Set up test environment variables for database connections
// Use localhost instead of 'db' for tests running outside Docker
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost'
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '54322'
process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'postgres'
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres'
process.env.POSTGRES_USER_READ_WRITE = process.env.POSTGRES_USER_READ_WRITE || 'postgres'
process.env.POSTGRES_USER_READ_ONLY = process.env.POSTGRES_USER_READ_ONLY || 'postgres'
process.env.PG_META_CRYPTO_KEY = process.env.PG_META_CRYPTO_KEY || 'test-encryption-key-32-chars-min'

// Uncomment this if HTML in errors are being annoying.
//
// configure({
//   getElementError: (message, container) => {
//     const error = new Error(message ?? 'Element not found')
//     error.name = 'ElementNotFoundError'
//     return error
//   },
// })

// Import and setup MSW - localStorage should be available now via polyfills
let mswServer: any = null
const { mswServer: server } = await import('./lib/msw')
mswServer = server

beforeAll(() => {
  if (mswServer) {
    mswServer.listen({ onUnhandledRequest: `error` })
  }
  vi.mock('next/router', () => require('next-router-mock'))
  vi.mock('next/navigation', async () => {
    const actual = await vi.importActual('next/navigation')
    return {
      ...actual,
      useRouter: () => {
        return {
          push: vi.fn(),
          replace: vi.fn(),
        }
      },
      usePathname: () => vi.fn(),
      useSearchParams: () => ({
        get: vi.fn(),
      }),
    }
  })

  vi.mock('next/compat/router', () => require('next-router-mock'))

  // Mock the useParams hook from common module globally
  vi.mock('common', async (importOriginal: any) => {
    const actual = await importOriginal()
    return {
      ...(typeof actual === 'object' ? actual : {}),
      useParams: () => ({ ref: 'default' }),
    }
  })

  routerMock.useParser(createDynamicRouteParser(['/projects/[ref]']))
})

afterEach(() => {
  if (mswServer) {
    mswServer.resetHandlers()
  }
  cleanup()
})

afterAll(() => {
  if (mswServer) {
    mswServer.close()
  }
})
