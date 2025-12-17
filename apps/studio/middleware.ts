import { IS_PLATFORM } from 'lib/constants'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const config = {
  matcher: ['/api/:function*'],
}

// [Joshen] Return 404 for all next.js API endpoints EXCEPT the ones we use in hosted:
const HOSTED_SUPPORTED_API_URLS = [
  '/ai/sql/generate-v4',
  '/ai/feedback/rate',
  '/ai/code/complete',
  '/ai/sql/cron-v2',
  '/ai/sql/title-v2',
  '/ai/onboarding/design',
  '/ai/feedback/classify',
  '/ai/docs',
  '/ai/table-quickstart/generate-schemas',
  '/get-ip-address',
  '/get-utc-time',
  '/get-deployment-commit',
  '/check-cname',
  '/edge-functions/test',
  '/edge-functions/body',
  '/generate-attachment-url',
]

export function middleware(request: NextRequest) {
  // Skip middleware check for local development
  if (process.env.NODE_ENV === 'development') {
    return
  }
  
  if (
    IS_PLATFORM &&
    !HOSTED_SUPPORTED_API_URLS.some((url) => request.nextUrl.pathname.endsWith(url))
  ) {
    return Response.json(
      { success: false, message: 'Endpoint not supported on hosted' },
      { status: 404 }
    )
  }
}

/**
 * Note: Route protection for authentication is handled client-side in _app.tsx
 * because Next.js middleware runs on the edge and cannot access localStorage
 * where GoTrue stores session tokens. The middleware only handles API route
 * restrictions for the hosted platform.
 */
