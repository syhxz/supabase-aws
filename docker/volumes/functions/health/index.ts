/**
 * Health Check Function for Edge Functions Service
 * 
 * This function provides a health check endpoint for the Edge Functions service.
 * It's used by Studio to verify that the Edge Functions service is running and accessible.
 */

// Export empty object to make this file a module
export {}

// Use Deno's built-in serve function (available in Deno 1.9+)
// This avoids external dependencies and TypeScript import issues
console.log('Health function started')

interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  version?: string
  uptime?: number
  checks: {
    deno: boolean
    runtime: boolean
  }
}

// Use Deno's built-in Deno.serve (available in newer versions)
// Fallback to manual server creation if not available
const requestHandler = async (req: Request): Promise<Response> => {
  console.log('Health check requested:', req.method, req.url)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'user-agent, content-type, authorization, x-client-info, apikey',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Only allow GET requests for health checks
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  try {
    // Perform basic health checks
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: Deno.version.deno,
      uptime: performance.now(),
      checks: {
        deno: true, // If we're running, Deno is working
        runtime: true, // If we can execute this code, runtime is working
      },
    }

    console.log('Health check passed:', health)

    return new Response(JSON.stringify(health), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Expose-Headers': 'x-edge-runtime-version,x-service-version',
        'X-Edge-Runtime-Version': Deno.version.deno,
        'X-Service-Version': '1.0.0',
      },
    })

  } catch (error) {
    console.error('Health check failed:', error)

    const errorHealth: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        deno: false,
        runtime: false,
      },
    }

    return new Response(JSON.stringify(errorHealth), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}

// Use modern Deno.serve if available, otherwise use manual server
if (typeof Deno.serve === 'function') {
  Deno.serve({ port: 8000 }, requestHandler)
} else {
  // Fallback for older Deno versions
  const server = Deno.listen({ port: 8000 })
  console.log('Health server listening on port 8000')
  
  // Handle connections asynchronously
  ;(async () => {
    for await (const conn of server) {
      // Handle each connection in a separate async function
      ;(async () => {
        try {
          const httpConn = Deno.serveHttp(conn)
          for await (const requestEvent of httpConn) {
            const response = await requestHandler(requestEvent.request)
            requestEvent.respondWith(response)
          }
        } catch (error) {
          console.error('Error handling connection:', error)
        }
      })()
    }
  })()
}