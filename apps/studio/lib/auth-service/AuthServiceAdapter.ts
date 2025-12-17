import { PoolClient } from 'pg'
import { getServiceRouter } from '../service-router'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import jwt from 'jsonwebtoken'

/**
 * User object returned from auth operations
 */
export interface User {
  id: string
  email: string
  email_confirmed_at?: string
  created_at: string
  updated_at: string
  raw_app_meta_data?: Record<string, any>
  raw_user_meta_data?: Record<string, any>
  phone?: string
  phone_confirmed_at?: string
  confirmed_at?: string
  is_super_admin?: boolean
  is_sso_user?: boolean
}

/**
 * Session object returned from auth operations
 */
export interface Session {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at: number
  token_type: string
  user: User
}

/**
 * Sign up parameters
 */
export interface SignUpParams {
  email: string
  password: string
  user_metadata?: Record<string, any>
  app_metadata?: Record<string, any>
}

/**
 * Sign in parameters
 */
export interface SignInParams {
  email: string
  password: string
}

/**
 * Auth Service Adapter
 * 
 * Provides project-isolated authentication services.
 * Each project has its own auth.users table and session management.
 */
export class AuthServiceAdapter {
  private serviceRouter = getServiceRouter()
  
  // JWT configuration
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this'
  private readonly JWT_EXPIRY = 3600 // 1 hour in seconds
  private readonly REFRESH_TOKEN_EXPIRY = 30 * 24 * 3600 // 30 days in seconds

  /**
   * Sign up a new user in a project's auth system
   * 
   * @param projectRef - The project reference
   * @param params - Sign up parameters
   * @returns Session with user and tokens
   */
  async signUp(projectRef: string, params: SignUpParams): Promise<Session> {
    const { email, password, user_metadata = {}, app_metadata = {} } = params

    // Validate inputs
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address')
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    return this.serviceRouter.withTransaction(projectRef, async (client) => {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM auth.users WHERE email = $1',
        [email]
      )

      if (existingUser.rows.length > 0) {
        throw new Error('User already exists')
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10)

      // Generate user ID
      const userId = uuidv4()
      const now = new Date().toISOString()

      // Insert user into auth.users
      // Note: confirmed_at is a generated column and should not be explicitly set
      const instanceId = '00000000-0000-0000-0000-000000000000'
      const userResult = await client.query(
        `INSERT INTO auth.users (
          id, instance_id, email, encrypted_password, 
          email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at,
          is_super_admin, is_sso_user
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, email, email_confirmed_at, created_at, updated_at, 
                  raw_app_meta_data, raw_user_meta_data, phone, phone_confirmed_at,
                  confirmed_at, is_super_admin, is_sso_user`,
        [
          userId,
          instanceId,
          email,
          hashedPassword,
          now, // email_confirmed_at (auto-confirm for local development)
          JSON.stringify(app_metadata),
          JSON.stringify(user_metadata),
          now, // created_at
          now, // updated_at
          false, // is_super_admin
          false, // is_sso_user
        ]
      )

      const user = this.mapUserRow(userResult.rows[0])

      // Create identity record in auth.identities
      // Check if the identities table has provider_id column (GoTrue standard schema)
      // or id column as TEXT (our custom schema)
      const schemaCheckResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'auth' 
        AND table_name = 'identities' 
        AND column_name IN ('id', 'provider_id')
      `)
      
      const hasProviderId = schemaCheckResult.rows.some(row => row.column_name === 'provider_id')
      const idColumn = schemaCheckResult.rows.find(row => row.column_name === 'id')
      const idIsUuid = idColumn?.data_type === 'uuid'
      
      if (hasProviderId) {
        // GoTrue standard schema with provider_id
        await client.query(
          `INSERT INTO auth.identities (
            provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (provider_id, provider) DO NOTHING`,
          [
            userId, // provider_id is the user_id for email provider
            userId,
            JSON.stringify({ sub: userId, email: email }),
            'email',
            now,
            now,
            now
          ]
        )
      } else if (idIsUuid) {
        // Schema with UUID id (let database generate it)
        await client.query(
          `INSERT INTO auth.identities (
            user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING`,
          [
            userId,
            JSON.stringify({ sub: userId, email: email }),
            'email',
            now,
            now,
            now
          ]
        )
      } else {
        // Our custom schema with TEXT id
        const identityId = `email-${userId}`
        await client.query(
          `INSERT INTO auth.identities (
            id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING`,
          [
            identityId,
            userId,
            JSON.stringify({ sub: userId, email: email }),
            'email',
            now,
            now,
            now
          ]
        )
      }

      // Create session
      const session = await this.createSession(client, projectRef, user)

      return session
    })
  }

  /**
   * Invite a user to a project's auth system
   * 
   * @param projectRef - The project reference
   * @param email - The user's email address
   * @param user_metadata - Optional user metadata
   * @param app_metadata - Optional app metadata
   * @returns User object
   */
  async invite(
    projectRef: string, 
    email: string,
    user_metadata: Record<string, any> = {},
    app_metadata: Record<string, any> = {}
  ): Promise<User> {
    // Validate inputs
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address')
    }

    return this.serviceRouter.withTransaction(projectRef, async (client) => {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM auth.users WHERE email = $1',
        [email]
      )

      if (existingUser.rows.length > 0) {
        throw new Error('User already exists')
      }

      // Generate user ID
      const userId = uuidv4()
      const now = new Date().toISOString()
      const instanceId = '00000000-0000-0000-0000-000000000000'

      // Insert user into auth.users (invited users don't have a password yet)
      const userResult = await client.query(
        `INSERT INTO auth.users (
          id, instance_id, email,
          invited_at,
          raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at,
          is_super_admin, is_sso_user
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, email, email_confirmed_at, created_at, updated_at, 
                  raw_app_meta_data, raw_user_meta_data, phone, phone_confirmed_at,
                  confirmed_at, is_super_admin, is_sso_user, invited_at`,
        [
          userId,
          instanceId,
          email,
          now, // invited_at
          JSON.stringify(app_metadata),
          JSON.stringify(user_metadata),
          now, // created_at
          now, // updated_at
          false, // is_super_admin
          false, // is_sso_user
        ]
      )

      const user = this.mapUserRow(userResult.rows[0])

      // Create identity record in auth.identities
      // Check if the identities table has provider_id column (GoTrue standard schema)
      // or id column as TEXT (our custom schema)
      const schemaCheckResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'auth' 
        AND table_name = 'identities' 
        AND column_name IN ('id', 'provider_id')
      `)
      
      const hasProviderId = schemaCheckResult.rows.some(row => row.column_name === 'provider_id')
      const idColumn = schemaCheckResult.rows.find(row => row.column_name === 'id')
      const idIsUuid = idColumn?.data_type === 'uuid'
      
      if (hasProviderId) {
        // GoTrue standard schema with provider_id
        await client.query(
          `INSERT INTO auth.identities (
            provider_id, user_id, identity_data, provider, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (provider_id, provider) DO NOTHING`,
          [
            userId, // provider_id is the user_id for email provider
            userId,
            JSON.stringify({ sub: userId, email: email }),
            'email',
            now,
            now
          ]
        )
      } else if (idIsUuid) {
        // Schema with UUID id (let database generate it)
        await client.query(
          `INSERT INTO auth.identities (
            user_id, identity_data, provider, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING`,
          [
            userId,
            JSON.stringify({ sub: userId, email: email }),
            'email',
            now,
            now
          ]
        )
      } else {
        // Our custom schema with TEXT id
        const identityId = `email-${userId}`
        await client.query(
          `INSERT INTO auth.identities (
            id, user_id, identity_data, provider, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING`,
          [
            identityId,
            userId,
            JSON.stringify({ sub: userId, email: email }),
            'email',
            now,
            now
          ]
        )
      }

      return user
    })
  }

  /**
   * Sign in a user to a project's auth system
   * 
   * @param projectRef - The project reference
   * @param params - Sign in parameters
   * @returns Session with user and tokens
   */
  async signIn(projectRef: string, params: SignInParams): Promise<Session> {
    const { email, password } = params

    // Validate inputs
    if (!email || !password) {
      throw new Error('Email and password are required')
    }

    return this.serviceRouter.withTransaction(projectRef, async (client) => {
      // Query user from project's auth.users table
      const userResult = await client.query(
        `SELECT id, email, encrypted_password, email_confirmed_at, 
                created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
                phone, phone_confirmed_at, confirmed_at, is_super_admin, is_sso_user
         FROM auth.users 
         WHERE email = $1 AND deleted_at IS NULL`,
        [email]
      )

      if (userResult.rows.length === 0) {
        throw new Error('Invalid email or password')
      }

      const userRow = userResult.rows[0]

      // Verify password
      const passwordMatch = await bcrypt.compare(password, userRow.encrypted_password)

      if (!passwordMatch) {
        throw new Error('Invalid email or password')
      }

      // Update last_sign_in_at
      await client.query(
        'UPDATE auth.users SET last_sign_in_at = $1, updated_at = $1 WHERE id = $2',
        [new Date().toISOString(), userRow.id]
      )

      const user = this.mapUserRow(userRow)

      // Create session
      const session = await this.createSession(client, projectRef, user)

      return session
    })
  }

  /**
   * List all users in a project
   * 
   * @param projectRef - The project reference
   * @param options - Query options (limit, offset, etc.)
   * @returns Array of users
   */
  async listUsers(
    projectRef: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<User[]> {
    const { limit = 50, offset = 0 } = options

    const result = await this.serviceRouter.query(
      projectRef,
      `SELECT id, email, email_confirmed_at, created_at, updated_at,
              raw_app_meta_data, raw_user_meta_data, phone, phone_confirmed_at,
              confirmed_at, is_super_admin, is_sso_user, last_sign_in_at
       FROM auth.users
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    return result.rows.map((row) => this.mapUserRow(row))
  }

  /**
   * Get a user by ID
   * 
   * @param projectRef - The project reference
   * @param userId - The user ID
   * @returns User or null if not found
   */
  async getUser(projectRef: string, userId: string): Promise<User | null> {
    const result = await this.serviceRouter.query(
      projectRef,
      `SELECT id, email, email_confirmed_at, created_at, updated_at,
              raw_app_meta_data, raw_user_meta_data, phone, phone_confirmed_at,
              confirmed_at, is_super_admin, is_sso_user, last_sign_in_at
       FROM auth.users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    )

    if (result.rows.length === 0) {
      return null
    }

    return this.mapUserRow(result.rows[0])
  }

  /**
   * Delete a user (soft delete)
   * 
   * @param projectRef - The project reference
   * @param userId - The user ID
   */
  async deleteUser(projectRef: string, userId: string): Promise<void> {
    await this.serviceRouter.query(
      projectRef,
      'UPDATE auth.users SET deleted_at = $1 WHERE id = $2',
      [new Date().toISOString(), userId]
    )
  }

  /**
   * Create a session for a user
   * 
   * @param client - Database client
   * @param projectRef - The project reference
   * @param user - The user
   * @returns Session with tokens
   */
  private async createSession(
    client: PoolClient,
    projectRef: string,
    user: User
  ): Promise<Session> {
    const sessionId = uuidv4()
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + this.JWT_EXPIRY

    // Generate access token (JWT)
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        project_ref: projectRef,
        role: user.is_super_admin ? 'admin' : 'authenticated',
        aal: 'aal1',
        session_id: sessionId,
      },
      this.JWT_SECRET,
      {
        expiresIn: this.JWT_EXPIRY,
      }
    )

    // Generate refresh token
    const refreshToken = uuidv4()

    // Insert session into auth.sessions
    await client.query(
      `INSERT INTO auth.sessions (id, user_id, created_at, updated_at, aal)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, user.id, new Date().toISOString(), new Date().toISOString(), 'aal1']
    )

    // Insert refresh token into auth.refresh_tokens
    await client.query(
      `INSERT INTO auth.refresh_tokens (token, user_id, session_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [refreshToken, user.id, sessionId, new Date().toISOString(), new Date().toISOString()]
    )

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.JWT_EXPIRY,
      expires_at: expiresAt,
      token_type: 'bearer',
      user,
    }
  }

  /**
   * Map database row to User object
   * 
   * @param row - Database row
   * @returns User object
   */
  private mapUserRow(row: any): User {
    return {
      id: row.id,
      email: row.email,
      email_confirmed_at: row.email_confirmed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      raw_app_meta_data: row.raw_app_meta_data,
      raw_user_meta_data: row.raw_user_meta_data,
      phone: row.phone,
      phone_confirmed_at: row.phone_confirmed_at,
      confirmed_at: row.confirmed_at,
      is_super_admin: row.is_super_admin,
      is_sso_user: row.is_sso_user,
    }
  }

  /**
   * Verify an access token
   * 
   * @param token - JWT access token
   * @returns Decoded token payload
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET)
    } catch (error) {
      throw new Error('Invalid or expired token')
    }
  }

  /**
   * Refresh a session using a refresh token
   * 
   * @param projectRef - The project reference
   * @param refreshToken - The refresh token
   * @returns New session with refreshed tokens
   */
  async refreshSession(projectRef: string, refreshToken: string): Promise<Session> {
    return this.serviceRouter.withTransaction(projectRef, async (client) => {
      // Query refresh token
      const tokenResult = await client.query(
        `SELECT rt.user_id, rt.session_id, rt.revoked, rt.created_at
         FROM auth.refresh_tokens rt
         WHERE rt.token = $1`,
        [refreshToken]
      )

      if (tokenResult.rows.length === 0) {
        throw new Error('Invalid refresh token')
      }

      const tokenRow = tokenResult.rows[0]

      if (tokenRow.revoked) {
        throw new Error('Refresh token has been revoked')
      }

      // Check if token is expired (30 days)
      const tokenAge = Date.now() - new Date(tokenRow.created_at).getTime()
      if (tokenAge > this.REFRESH_TOKEN_EXPIRY * 1000) {
        throw new Error('Refresh token has expired')
      }

      // Get user
      const userResult = await client.query(
        `SELECT id, email, email_confirmed_at, created_at, updated_at,
                raw_app_meta_data, raw_user_meta_data, phone, phone_confirmed_at,
                confirmed_at, is_super_admin, is_sso_user
         FROM auth.users
         WHERE id = $1 AND deleted_at IS NULL`,
        [tokenRow.user_id]
      )

      if (userResult.rows.length === 0) {
        throw new Error('User not found')
      }

      const user = this.mapUserRow(userResult.rows[0])

      // Revoke old refresh token
      await client.query(
        'UPDATE auth.refresh_tokens SET revoked = true WHERE token = $1',
        [refreshToken]
      )

      // Create new session
      const session = await this.createSession(client, projectRef, user)

      return session
    })
  }

  /**
   * Sign out a user by revoking their session
   * 
   * @param projectRef - The project reference
   * @param accessToken - The access token
   */
  async signOut(projectRef: string, accessToken: string): Promise<void> {
    try {
      const payload = this.verifyToken(accessToken)
      const sessionId = payload.session_id

      await this.serviceRouter.withTransaction(projectRef, async (client) => {
        // Revoke all refresh tokens for this session
        await client.query(
          'UPDATE auth.refresh_tokens SET revoked = true WHERE session_id = $1',
          [sessionId]
        )

        // Delete the session (optional, could also just mark as inactive)
        // For now, we'll keep the session record for audit purposes
      })
    } catch (error) {
      // If token is invalid, we still consider the sign out successful
      console.warn('Sign out with invalid token:', error)
    }
  }
}

// Singleton instance
let authServiceAdapter: AuthServiceAdapter | null = null

/**
 * Get the singleton AuthServiceAdapter instance
 */
export function getAuthServiceAdapter(): AuthServiceAdapter {
  if (!authServiceAdapter) {
    authServiceAdapter = new AuthServiceAdapter()
  }
  return authServiceAdapter
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetAuthServiceAdapter(): void {
  authServiceAdapter = null
}
