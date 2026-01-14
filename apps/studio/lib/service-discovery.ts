/**
 * Service Discovery for Self-Hosted Supabase
 * 
 * Discovers and validates local Supabase services including Edge Functions.
 * Provides health checks and service endpoint resolution.
 */

export interface ServiceEndpoint {
  name: string
  url: string
  healthy: boolean
  version?: string
  error?: string
  lastChecked: Date
}

export interface ServiceDiscoveryConfig {
  timeout: number
  retryAttempts: number
  retryDelay: number
}

class ServiceDiscoveryImpl {
  private config: ServiceDiscoveryConfig
  private serviceCache: Map<string, ServiceEndpoint> = new Map()
  private readonly CACHE_TTL = 30000 // 30 seconds

  constructor(config: Partial<ServiceDiscoveryConfig> = {}) {
    this.config = {
      timeout: config.timeout || 5000,
      retryAttempts: config.retryAttempts || 2,
      retryDelay: config.retryDelay || 1000,
    }
  }

  /**
   * Discover Edge Functions service endpoint with Kong proxy integration
   */
  async discoverEdgeFunctions(): Promise<ServiceEndpoint> {
    const serviceName = 'edge-functions'
    const cached = this.getCachedService(serviceName)
    
    if (cached) {
      return cached
    }

    // For self-hosted environments, always use Kong proxy endpoints
    // This avoids CORS issues by routing through the same origin
    const possibleEndpoints = [
      // Kong proxy endpoints (preferred for CORS compliance)
      process.env.SUPABASE_PUBLIC_URL ? `${process.env.SUPABASE_PUBLIC_URL}/functions/v1` : 'http://localhost:8000/functions/v1',
      'http://localhost:8000/functions/v1',
      'http://127.0.0.1:8000/functions/v1',
      // Fallback to environment variable if set
      process.env.EDGE_FUNCTIONS_URL || 'http://localhost:54321/functions/v1',
    ]

    for (const url of possibleEndpoints) {
      try {
        const endpoint = await this.checkServiceHealth(serviceName, url)
        if (endpoint.healthy) {
          this.cacheService(serviceName, endpoint)
          return endpoint
        }
      } catch (error) {
        console.debug(`Failed to connect to Edge Functions at ${url}:`, error)
      }
    }

    // If no endpoint is healthy, return the first one with error info
    const defaultEndpoint: ServiceEndpoint = {
      name: serviceName,
      url: possibleEndpoints[0],
      healthy: false,
      error: 'No healthy Edge Functions service found. Ensure Kong proxy and supabase-edge-functions container are running.',
      lastChecked: new Date(),
    }

    this.cacheService(serviceName, defaultEndpoint)
    return defaultEndpoint
  }

  /**
   * Check health of a specific service endpoint
   */
  private async checkServiceHealth(serviceName: string, url: string): Promise<ServiceEndpoint> {
    const healthUrl = this.getHealthEndpoint(url)
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Supabase-Studio-ServiceDiscovery',
          },
        })

        clearTimeout(timeoutId)

        const endpoint: ServiceEndpoint = {
          name: serviceName,
          url: url,
          healthy: response.ok,
          version: response.headers.get('x-edge-runtime-version') || 
                   response.headers.get('x-service-version') || 
                   undefined,
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
          lastChecked: new Date(),
        }

        if (response.ok) {
          return endpoint
        }

        // If not the last attempt, wait before retrying
        if (attempt < this.config.retryAttempts) {
          await this.sleep(this.config.retryDelay)
        }

        return endpoint
      } catch (error) {
        const endpoint: ServiceEndpoint = {
          name: serviceName,
          url: url,
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          lastChecked: new Date(),
        }

        // If not the last attempt, wait before retrying
        if (attempt < this.config.retryAttempts) {
          await this.sleep(this.config.retryDelay)
          continue
        }

        return endpoint
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Unexpected end of health check attempts')
  }

  /**
   * Get health check endpoint for a service URL
   */
  private getHealthEndpoint(serviceUrl: string): string {
    // For Kong proxy URLs, use the health endpoint route
    if (serviceUrl.includes('/functions/v1')) {
      return `${serviceUrl}/health`
    }
    
    // Remove trailing slashes and function paths for direct container access
    const baseUrl = serviceUrl.replace(/\/+$/, '').replace(/\/functions\/v\d+.*$/, '')
    return `${baseUrl}/health`
  }

  /**
   * Get cached service if still valid
   */
  private getCachedService(serviceName: string): ServiceEndpoint | null {
    const cached = this.serviceCache.get(serviceName)
    
    if (cached && Date.now() - cached.lastChecked.getTime() < this.CACHE_TTL) {
      return cached
    }
    
    return null
  }

  /**
   * Cache service endpoint
   */
  private cacheService(serviceName: string, endpoint: ServiceEndpoint): void {
    this.serviceCache.set(serviceName, endpoint)
  }

  /**
   * Clear service cache
   */
  clearCache(): void {
    this.serviceCache.clear()
  }

  /**
   * Get all discovered services
   */
  getDiscoveredServices(): ServiceEndpoint[] {
    return Array.from(this.serviceCache.values())
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get diagnostic information
   */
  getDiagnosticInfo(): Record<string, any> {
    return {
      config: this.config,
      cachedServices: this.getDiscoveredServices(),
      environment: {
        EDGE_FUNCTIONS_URL: process.env.EDGE_FUNCTIONS_URL,
        NODE_ENV: process.env.NODE_ENV,
      },
    }
  }
}

// Singleton instance
export const serviceDiscovery = new ServiceDiscoveryImpl()

/**
 * Utility function to discover Edge Functions service
 */
export async function discoverEdgeFunctionsService(): Promise<ServiceEndpoint> {
  return serviceDiscovery.discoverEdgeFunctions()
}

/**
 * Utility function to check if Edge Functions service is available
 */
export async function isEdgeFunctionsServiceAvailable(): Promise<boolean> {
  const endpoint = await discoverEdgeFunctionsService()
  return endpoint.healthy
}