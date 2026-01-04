import { NextApiRequest } from 'next'
import { getCurrentUserId } from '../api/auth-helpers'
import { getProjectConfigStorage } from './ProjectConfigStorage'

/**
 * Rate limiting configuration per project
 */
interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * Access validation result
 */
export interface AccessValidationResult {
  allowed: boolean
  userId?: string
  reason?: string
}

/**
 * Validates access to project resources
 */
export class AccessValidator {
  private rateLimits: Map<string, RateLimitEntry> = new Map()
  private readonly DEFAULT_RATE_LIMIT: RateLimitConfig = {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  }

  /**
   * Validate that a user has access to a project
   */
  async validateProjectAccess(
    projectRef: string,
    userId: string
  ): Promise<AccessValidationResult> {
    try {
      // Get project configuration
      const configStorage = getProjectConfigStorage()
      const config = await configStorage.get(projectRef)

      if (!config) {
        return {
          allowed: false,
          reason: 'Project not found',
        }
      }

      // Check if user owns the project
      if (config.ownerUserId !== userId) {
        return {
          allowed: false,
          reason: 'User does not own this project',
        }
      }

      return {
        allowed: true,
        userId,
      }
    } catch (error) {
      console.error('Error validating project access:', error)
      return {
        allowed: false,
        reason: 'Internal error during access validation',
      }
    }
  }

  /**
   * Validate JWT token and extract user ID
   */
  async validateToken(req: NextApiRequest): Promise<AccessValidationResult> {
    try {
      const userId = await getCurrentUserId(req)

      if (!userId) {
        return {
          allowed: false,
          reason: 'Invalid or missing authentication token',
        }
      }

      return {
        allowed: true,
        userId,
      }
    } catch (error) {
      console.error('Error validating token:', error)
      return {
        allowed: false,
        reason: 'Token validation failed',
      }
    }
  }

  /**
   * Check rate limit for a project
   */
  checkRateLimit(
    projectRef: string,
    config?: RateLimitConfig
  ): AccessValidationResult {
    const rateLimitConfig = config ?? this.DEFAULT_RATE_LIMIT
    const key = `project:${projectRef}`
    const now = Date.now()

    let entry = this.rateLimits.get(key)

    // Create new entry if doesn't exist or window has expired
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + rateLimitConfig.windowMs,
      }
      this.rateLimits.set(key, entry)
    }

    // Increment count
    entry.count++

    // Check if limit exceeded
    if (entry.count > rateLimitConfig.maxRequests) {
      return {
        allowed: false,
        reason: `Rate limit exceeded. Max ${rateLimitConfig.maxRequests} requests per ${rateLimitConfig.windowMs / 1000}s`,
      }
    }

    return {
      allowed: true,
    }
  }

  /**
   * Complete validation: token + project access + rate limit
   */
  async validateRequest(
    req: NextApiRequest,
    projectRef: string,
    rateLimitConfig?: RateLimitConfig
  ): Promise<AccessValidationResult> {
    // 1. Validate token
    const tokenResult = await this.validateToken(req)
    if (!tokenResult.allowed) {
      return tokenResult
    }

    const userId = tokenResult.userId!

    // 2. Validate project access
    const accessResult = await this.validateProjectAccess(projectRef, userId)
    if (!accessResult.allowed) {
      return accessResult
    }

    // 3. Check rate limit
    const rateLimitResult = this.checkRateLimit(projectRef, rateLimitConfig)
    if (!rateLimitResult.allowed) {
      return rateLimitResult
    }

    return {
      allowed: true,
      userId,
    }
  }

  /**
   * Reset rate limit for a project (useful for testing)
   */
  resetRateLimit(projectRef: string): void {
    const key = `project:${projectRef}`
    this.rateLimits.delete(key)
  }

  /**
   * Clear all rate limits
   */
  clearAllRateLimits(): void {
    this.rateLimits.clear()
  }

  /**
   * Get rate limit stats for a project
   */
  getRateLimitStats(projectRef: string): { count: number; resetAt: number } | null {
    const key = `project:${projectRef}`
    const entry = this.rateLimits.get(key)
    
    if (!entry) {
      return null
    }

    return {
      count: entry.count,
      resetAt: entry.resetAt,
    }
  }

  /**
   * Cleanup expired rate limit entries
   */
  cleanupExpiredRateLimits(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.rateLimits.entries()) {
      if (entry.resetAt < now) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.rateLimits.delete(key)
    }

    if (expiredKeys.length > 0) {
      console.log(`Cleaned up ${expiredKeys.length} expired rate limit entries`)
    }
  }
}

// Singleton instance
let accessValidator: AccessValidator | null = null

/**
 * Get the singleton AccessValidator instance
 */
export function getAccessValidator(): AccessValidator {
  if (!accessValidator) {
    accessValidator = new AccessValidator()
    
    // Start periodic cleanup of expired rate limits
    setInterval(() => {
      accessValidator?.cleanupExpiredRateLimits()
    }, 60 * 1000) // Every minute
  }
  return accessValidator
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetAccessValidator(): void {
  accessValidator = null
}

/**
 * Middleware helper for Next.js API routes
 */
export async function withProjectAccess(
  req: NextApiRequest,
  projectRef: string,
  handler: (userId: string) => Promise<any>
): Promise<any> {
  const validator = getAccessValidator()
  const result = await validator.validateRequest(req, projectRef)

  if (!result.allowed) {
    return {
      error: result.reason,
      status: 403,
    }
  }

  return handler(result.userId!)
}
