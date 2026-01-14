const DEFAULT_TIMEOUT_MILLISECONDS = 2000

/**
 * Ping Postgrest for health check. Default timeout in 2s.
 *
 * @param projectRef project reference (not used in self-hosted mode)
 * @param options optional, include custom timeout in milliseconds
 *
 * @return true if ping is successful else false
 */
async function pingPostgrest(
  projectRef: string,
  options?: {
    timeout?: number
  }
) {
  if (projectRef === undefined) return false

  const { timeout } = options ?? {}

  return pingOpenApi(timeout)
}

export default pingPostgrest

/**
 * Send a HEAD request to postgrest OpenAPI.
 * In self-hosted mode, we ping Kong directly which routes to PostgREST.
 *
 * @return true if there's no error else false
 */
async function pingOpenApi(timeout?: number) {
  try {
    // In self-hosted mode, ping Kong directly
    // Kong will route to PostgREST at /rest/v1/
    const restUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8000'
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout ?? DEFAULT_TIMEOUT_MILLISECONDS)
    
    const response = await fetch(`${restUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: apikey,
      },
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    // PostgREST returns 200 for root endpoint
    return response.ok
  } catch (error) {
    // Network error or timeout
    return false
  }
}
