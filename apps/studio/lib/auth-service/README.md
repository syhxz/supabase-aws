# Auth Service Adapter

The Auth Service Adapter provides project-isolated authentication services for Supabase Studio. Each project has its own `auth.users` table and session management, ensuring complete data isolation between projects.

## Overview

This adapter implements the authentication layer for project-level service isolation. It routes authentication requests to the correct project database using the Service Router and manages user accounts, sessions, and tokens on a per-project basis.

## Architecture

```
Client Request (with project_ref)
    ↓
Auth Service Adapter
    ↓
Service Router (routes to correct database)
    ↓
Project Database (auth.users, auth.sessions, auth.refresh_tokens)
```

## Key Features

- **Project Isolation**: Each project has its own auth schema and user base
- **JWT-based Authentication**: Uses JSON Web Tokens for session management
- **Password Hashing**: Secure password storage using bcrypt
- **Session Management**: Supports access tokens and refresh tokens
- **User Management**: CRUD operations for user accounts

## Usage

### Sign Up a New User

```typescript
import { getAuthServiceAdapter } from './lib/auth-service'

const authService = getAuthServiceAdapter()

const session = await authService.signUp('project-ref', {
  email: 'user@example.com',
  password: 'securepassword',
  user_metadata: {
    name: 'John Doe',
  },
})

console.log('User created:', session.user)
console.log('Access token:', session.access_token)
```

### Sign In a User

```typescript
const session = await authService.signIn('project-ref', {
  email: 'user@example.com',
  password: 'securepassword',
})

console.log('User signed in:', session.user)
console.log('Access token:', session.access_token)
```

### List Users in a Project

```typescript
const users = await authService.listUsers('project-ref', {
  limit: 50,
  offset: 0,
})

console.log('Users:', users)
```

### Get a Specific User

```typescript
const user = await authService.getUser('project-ref', 'user-id')

if (user) {
  console.log('User found:', user)
} else {
  console.log('User not found')
}
```

### Verify an Access Token

```typescript
try {
  const payload = authService.verifyToken(accessToken)
  console.log('Token is valid:', payload)
} catch (error) {
  console.error('Invalid token:', error)
}
```

### Refresh a Session

```typescript
const newSession = await authService.refreshSession('project-ref', refreshToken)

console.log('New access token:', newSession.access_token)
```

### Sign Out a User

```typescript
await authService.signOut('project-ref', accessToken)

console.log('User signed out')
```

### Delete a User

```typescript
await authService.deleteUser('project-ref', 'user-id')

console.log('User deleted')
```

## API Reference

### `signUp(projectRef: string, params: SignUpParams): Promise<Session>`

Creates a new user account in the specified project.

**Parameters:**
- `projectRef`: The project reference
- `params.email`: User's email address
- `params.password`: User's password (min 6 characters)
- `params.user_metadata`: Optional user metadata
- `params.app_metadata`: Optional app metadata

**Returns:** Session object with user and tokens

**Throws:** Error if email is invalid, password is too short, or user already exists

### `signIn(projectRef: string, params: SignInParams): Promise<Session>`

Authenticates a user and creates a new session.

**Parameters:**
- `projectRef`: The project reference
- `params.email`: User's email address
- `params.password`: User's password

**Returns:** Session object with user and tokens

**Throws:** Error if credentials are invalid

### `listUsers(projectRef: string, options?: { limit?: number; offset?: number }): Promise<User[]>`

Lists all users in a project.

**Parameters:**
- `projectRef`: The project reference
- `options.limit`: Maximum number of users to return (default: 50)
- `options.offset`: Number of users to skip (default: 0)

**Returns:** Array of user objects

### `getUser(projectRef: string, userId: string): Promise<User | null>`

Gets a specific user by ID.

**Parameters:**
- `projectRef`: The project reference
- `userId`: The user's ID

**Returns:** User object or null if not found

### `deleteUser(projectRef: string, userId: string): Promise<void>`

Soft deletes a user (sets `deleted_at` timestamp).

**Parameters:**
- `projectRef`: The project reference
- `userId`: The user's ID

### `verifyToken(token: string): any`

Verifies a JWT access token.

**Parameters:**
- `token`: JWT access token

**Returns:** Decoded token payload

**Throws:** Error if token is invalid or expired

### `refreshSession(projectRef: string, refreshToken: string): Promise<Session>`

Refreshes a session using a refresh token.

**Parameters:**
- `projectRef`: The project reference
- `refreshToken`: The refresh token

**Returns:** New session with refreshed tokens

**Throws:** Error if refresh token is invalid, revoked, or expired

### `signOut(projectRef: string, accessToken: string): Promise<void>`

Signs out a user by revoking their session.

**Parameters:**
- `projectRef`: The project reference
- `accessToken`: The access token

## Data Models

### User

```typescript
interface User {
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
```

### Session

```typescript
interface Session {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at: number
  token_type: string
  user: User
}
```

## Database Schema

The Auth Service Adapter expects the following tables in each project database:

### auth.users

Stores user accounts.

```sql
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  raw_app_meta_data JSONB,
  raw_user_meta_data JSONB,
  phone TEXT,
  phone_confirmed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  is_super_admin BOOLEAN,
  is_sso_user BOOLEAN,
  last_sign_in_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
```

### auth.sessions

Stores active sessions.

```sql
CREATE TABLE auth.sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  aal TEXT
);
```

### auth.refresh_tokens

Stores refresh tokens.

```sql
CREATE TABLE auth.refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID REFERENCES auth.sessions(id),
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## Security Considerations

1. **Password Hashing**: Passwords are hashed using bcrypt with a cost factor of 10
2. **JWT Secret**: Configure `JWT_SECRET` environment variable for production
3. **Token Expiry**: Access tokens expire after 1 hour, refresh tokens after 30 days
4. **Project Isolation**: All operations are scoped to a specific project
5. **Soft Deletes**: Users are soft-deleted to maintain referential integrity

## Environment Variables

- `JWT_SECRET`: Secret key for signing JWT tokens (required in production)

## Testing

Run the test suite:

```bash
pnpm --filter studio vitest apps/studio/tests/lib/auth-service/AuthServiceAdapter.test.ts
```

## Dependencies

- `pg`: PostgreSQL client
- `bcryptjs`: Password hashing
- `jsonwebtoken`: JWT token generation and verification
- `uuid`: UUID generation

## Related Components

- **Service Router**: Routes requests to project-specific databases
- **Project Initialization Service**: Creates auth schema during project setup
- **Connection Pool Manager**: Manages database connections per project

## Future Enhancements

- Multi-factor authentication (MFA)
- OAuth provider integration
- Email verification workflows
- Password reset functionality
- Account recovery mechanisms
- Rate limiting for authentication attempts
- Audit logging for security events
