# Authentication Migration Guide

## Overview

This guide provides step-by-step instructions for enabling GoTrue authentication in Supabase Studio for self-hosted deployments. By default, Studio runs in "auto-login" mode where authentication is bypassed. This guide will help you transition to full authentication with login/logout flows.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Understanding the Authentication System](#understanding-the-authentication-system)
3. [Enabling Authentication](#enabling-authentication)
4. [Creating Initial Users](#creating-initial-users)
5. [Testing the Setup](#testing-the-setup)
6. [Rollback Instructions](#rollback-instructions)
7. [Troubleshooting](#troubleshooting)
8. [Security Considerations](#security-considerations)

---

## Prerequisites

Before enabling authentication, ensure you have:

- ✅ Docker and Docker Compose installed
- ✅ Supabase services running (PostgreSQL, GoTrue, Kong)
- ✅ Access to modify environment variables
- ✅ Ability to restart Studio application

### Required Services

The following Docker services must be running:

```bash
cd docker
docker-compose up -d db gotrue kong
```

Verify services are running:

```bash
docker-compose ps
```

Expected output:
```
NAME                COMMAND                  SERVICE             STATUS
supabase-db         "docker-entrypoint.s…"   db                  Up
supabase-gotrue     "/gotrue"                gotrue              Up
supabase-kong       "/docker-entrypoint.…"   kong                Up
```

---

## Understanding the Authentication System

### Current Behavior (Auto-Login Mode)

When `NEXT_PUBLIC_REQUIRE_LOGIN=false` or unset:
- Users are automatically logged in with a default session
- No login page is displayed
- All routes are accessible without authentication
- Suitable for local development or trusted environments

### New Behavior (Authentication Mode)

When `NEXT_PUBLIC_REQUIRE_LOGIN=true`:
- Users must log in with valid credentials
- Unauthenticated users are redirected to `/sign-in`
- Sessions are managed via GoTrue JWT tokens
- Logout functionality is available
- Suitable for production or multi-user environments

### Architecture

```
Browser → Studio (Next.js) → Kong Gateway → GoTrue Service → PostgreSQL
                                                              (auth.users)
```

---

## Enabling Authentication

### Step 1: Configure Environment Variables

#### Option A: Using Environment Variable (Recommended)

Add to `apps/studio/.env`:

```properties
# Enable authentication requirement
NEXT_PUBLIC_REQUIRE_LOGIN=true

# GoTrue configuration
NEXT_PUBLIC_GOTRUE_URL=http://127.0.0.1:54321/auth/v1
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your-anon-key-from-docker-env
SUPABASE_SERVICE_KEY=your-service-key-from-docker-env

# JWT Secret (must match GoTrue configuration)
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
```

**Important**: The `JWT_SECRET` must match the value in `docker/.env` for GoTrue.

#### Option B: Code Modification (Alternative)

If you prefer to hardcode the setting, modify `apps/studio/lib/auth.tsx`:

```typescript
export const AuthProvider = ({ children }: PropsWithChildren) => {
  // Read from environment variable
  const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
  const alwaysLoggedIn = !requireLogin
  
  return (
    <AuthProviderInternal alwaysLoggedIn={alwaysLoggedIn}>
      <AuthErrorToaster>{children}</AuthErrorToaster>
    </AuthProviderInternal>
  )
}
```

### Step 2: Verify GoTrue Configuration

Check `docker/.env` contains:

```properties
# GoTrue Configuration
GOTRUE_SITE_URL=http://localhost:8082
GOTRUE_JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
GOTRUE_JWT_EXP=3600
GOTRUE_DISABLE_SIGNUP=false
ENABLE_EMAIL_AUTOCONFIRM=true

# Database connection for GoTrue
GOTRUE_DB_DRIVER=postgres
DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres?search_path=auth
```

### Step 3: Restart Services

#### Restart GoTrue (if configuration changed)

```bash
cd docker
docker-compose restart gotrue
```

#### Restart Studio

```bash
# Stop the development server (Ctrl+C)

# Clear Next.js cache (optional but recommended)
rm -rf apps/studio/.next

# Restart Studio
pnpm dev:studio
```

### Step 4: Clear Browser Cache

**Important**: Browser caching can prevent authentication from working properly.

1. Open browser Developer Tools (F12)
2. Go to Application tab → Storage
3. Clear:
   - Local Storage (all items)
   - Session Storage (all items)
   - Cookies (all cookies)
4. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

**Or use Incognito/Private mode** to test without cache issues.

---

## Creating Initial Users

You must create at least one user before you can log in. Choose one of the following methods:

### Method 1: Using the Convenience Script (Recommended)

A script is provided for easy user creation:

```bash
./scripts/create-admin-user.sh admin@example.com YourSecurePassword123
```

**Features**:
- Validates email format
- Validates password length (minimum 6 characters)
- Automatically loads configuration from `docker/.env`
- Provides clear success/error messages
- Auto-confirms email if `ENABLE_EMAIL_AUTOCONFIRM=true`

**Example output**:
```
INFO: Loading configuration from docker/.env
INFO: Creating user with email: admin@example.com
INFO: Using GoTrue URL: http://127.0.0.1:54321/auth/v1
SUCCESS: User created successfully!
INFO: User ID: 12345678-1234-1234-1234-123456789abc
INFO: Email: admin@example.com
SUCCESS: Email auto-confirmed
```

### Method 2: Using GoTrue API Directly

```bash
# Set your anon key from docker/.env
export SUPABASE_ANON_KEY="your-anon-key"

# Create user
curl -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "YourSecurePassword123"
  }'
```

**Response** (success):
```json
{
  "id": "12345678-1234-1234-1234-123456789abc",
  "email": "admin@example.com",
  "confirmed_at": "2025-11-27T10:00:00Z",
  ...
}
```

### Method 3: Using SQL (Advanced)

Connect to PostgreSQL and insert directly:

```bash
# Connect to database
psql -h localhost -p 54322 -U postgres -d postgres

# Create user with encrypted password
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmed_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@example.com',
  crypt('YourSecurePassword123', gen_salt('bf')),
  now(),
  now(),
  now(),
  now()
);
```

**Note**: This method requires the `pgcrypto` extension to be enabled.

### Email Confirmation

By default, GoTrue requires email confirmation. For self-hosted deployments, you can disable this:

In `docker/.env`:
```properties
ENABLE_EMAIL_AUTOCONFIRM=true
```

Then restart GoTrue:
```bash
cd docker
docker-compose restart gotrue
```

---

## Testing the Setup

### 1. Verify GoTrue is Running

```bash
curl http://127.0.0.1:54321/auth/v1/health
```

Expected response:
```json
{
  "version": "v2.x.x",
  "name": "GoTrue"
}
```

### 2. Test Login Flow

1. **Visit Studio**: Navigate to http://localhost:8082
2. **Expect Redirect**: You should be redirected to `/sign-in`
3. **Enter Credentials**: Use the email/password you created
4. **Verify Login**: After successful login, you should be redirected to the dashboard
5. **Check Session**: Open Developer Tools → Application → Local Storage
   - Look for `supabase.auth.token` key
   - Should contain JWT token and user information

### 3. Test Session Persistence

1. **Refresh Page**: Press F5 or reload the page
2. **Verify**: You should remain logged in (no redirect to login page)
3. **Check Console**: Look for authentication logs (if debug logging is enabled)

### 4. Test Logout

1. **Click Logout**: Find and click the logout button in the UI
2. **Verify Redirect**: You should be redirected to `/sign-in`
3. **Check Storage**: Local storage should be cleared
4. **Test Access**: Try accessing a protected route directly
   - Should redirect back to login page

### 5. Test Protected Routes

Try accessing these URLs directly (while logged out):
- http://localhost:8082/project/default
- http://localhost:8082/project/default/editor

Expected behavior: Redirect to `/sign-in` with return URL preserved.

---

## Rollback Instructions

If you need to revert to auto-login mode:

### Quick Rollback

1. **Update Environment Variable**:
   
   In `apps/studio/.env`:
   ```properties
   NEXT_PUBLIC_REQUIRE_LOGIN=false
   ```

2. **Restart Studio**:
   ```bash
   # Stop server (Ctrl+C)
   pnpm dev:studio
   ```

3. **Clear Browser Cache**:
   - Clear Local Storage
   - Clear Session Storage
   - Hard refresh page

### Complete Rollback

If you modified code directly:

1. **Revert Code Changes**:
   
   In `apps/studio/lib/auth.tsx`:
   ```typescript
   export const AuthProvider = ({ children }: PropsWithChildren) => {
     const alwaysLoggedIn = !IS_PLATFORM  // Revert to original logic
     
     return (
       <AuthProviderInternal alwaysLoggedIn={alwaysLoggedIn}>
         <AuthErrorToaster>{children}</AuthErrorToaster>
       </AuthProviderInternal>
     )
   }
   ```

2. **Clear Build Cache**:
   ```bash
   rm -rf apps/studio/.next
   rm -rf packages/common/.next
   ```

3. **Restart Studio**:
   ```bash
   pnpm dev:studio
   ```

### Verification After Rollback

1. Visit http://localhost:8082
2. You should be automatically logged in (no login page)
3. All routes should be accessible immediately

**Important**: Rollback does not affect user data. Users created in GoTrue will remain in the database.

---

## Troubleshooting

### Issue 1: Login Page Not Appearing

**Symptoms**:
- Still automatically logged in after enabling authentication
- No redirect to `/sign-in`

**Possible Causes**:
1. Environment variable not loaded
2. Browser cache
3. Build cache not cleared
4. Code changes not compiled

**Solutions**:

```bash
# 1. Verify environment variable
echo $NEXT_PUBLIC_REQUIRE_LOGIN  # Should output: true

# 2. Clear all caches
rm -rf apps/studio/.next
rm -rf packages/common/.next

# 3. Clear browser storage
# In browser console:
localStorage.clear()
sessionStorage.clear()
location.reload()

# 4. Restart with clean slate
pnpm dev:studio
```

### Issue 2: "Invalid Credentials" Error

**Symptoms**:
- Login form shows "Invalid email or password"
- Credentials are correct

**Possible Causes**:
1. User not created in database
2. Password mismatch
3. Email not confirmed (if confirmation required)
4. GoTrue not running

**Solutions**:

```bash
# 1. Verify user exists
psql -h localhost -p 54322 -U postgres -d postgres -c \
  "SELECT email, email_confirmed_at FROM auth.users WHERE email='admin@example.com';"

# 2. Check GoTrue logs
cd docker
docker-compose logs gotrue --tail=50

# 3. Verify GoTrue is running
curl http://127.0.0.1:54321/auth/v1/health

# 4. Recreate user with script
./scripts/create-admin-user.sh admin@example.com NewPassword123
```

### Issue 3: "Authentication Service Unavailable"

**Symptoms**:
- Error message about GoTrue being unavailable
- Cannot access login page

**Possible Causes**:
1. GoTrue service not running
2. Wrong GoTrue URL
3. Network connectivity issues
4. Kong gateway not routing correctly

**Solutions**:

```bash
# 1. Check GoTrue service status
cd docker
docker-compose ps gotrue

# 2. Start GoTrue if stopped
docker-compose up -d gotrue

# 3. Check GoTrue logs
docker-compose logs gotrue --tail=50

# 4. Verify GoTrue URL
curl http://127.0.0.1:54321/auth/v1/health

# 5. Check Kong routing
curl http://127.0.0.1:54321/auth/v1/health -v
```

### Issue 4: Session Expires Immediately

**Symptoms**:
- Login successful but immediately logged out
- Session doesn't persist

**Possible Causes**:
1. JWT secret mismatch
2. Token validation failing
3. Clock skew between services

**Solutions**:

```bash
# 1. Verify JWT secrets match
# In docker/.env:
grep JWT_SECRET docker/.env

# In apps/studio/.env:
grep JWT_SECRET apps/studio/.env

# They must be identical!

# 2. Restart both services
cd docker
docker-compose restart gotrue
cd ../
pnpm dev:studio

# 3. Check token in browser console
# In browser console:
const token = localStorage.getItem('supabase.auth.token')
console.log(JSON.parse(token))
```

### Issue 5: CORS Errors

**Symptoms**:
- Browser console shows CORS errors
- Authentication requests blocked

**Possible Causes**:
1. Kong not configured for CORS
2. Wrong origin in GoTrue configuration

**Solutions**:

In `docker/.env`, verify:
```properties
GOTRUE_SITE_URL=http://localhost:8082
```

Restart GoTrue:
```bash
cd docker
docker-compose restart gotrue
```

### Issue 6: "User Already Exists" When Creating User

**Symptoms**:
- Script or API returns "User already exists" error
- Cannot create new user

**Solutions**:

```bash
# 1. Check existing users
psql -h localhost -p 54322 -U postgres -d postgres -c \
  "SELECT id, email, created_at FROM auth.users;"

# 2. Delete existing user (if needed)
psql -h localhost -p 54322 -U postgres -d postgres -c \
  "DELETE FROM auth.users WHERE email='admin@example.com';"

# 3. Recreate user
./scripts/create-admin-user.sh admin@example.com NewPassword123
```

### Debug Logging

Enable debug logging to diagnose issues:

In `apps/studio/lib/auth.tsx`, add:

```typescript
export const AuthProvider = ({ children }: PropsWithChildren) => {
  const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
  const alwaysLoggedIn = !requireLogin
  
  console.log('🔐 [AuthProvider] Configuration:', {
    requireLogin,
    alwaysLoggedIn,
    IS_PLATFORM,
    GOTRUE_URL: process.env.NEXT_PUBLIC_GOTRUE_URL
  })
  
  return (
    <AuthProviderInternal alwaysLoggedIn={alwaysLoggedIn}>
      <AuthErrorToaster>{children}</AuthErrorToaster>
    </AuthProviderInternal>
  )
}
```

Check browser console for debug output.

---

## Security Considerations

### Production Deployment

When deploying to production, follow these security best practices:

#### 1. Use Strong JWT Secret

```properties
# Generate a secure random secret (at least 32 characters)
JWT_SECRET=$(openssl rand -base64 32)
```

**Never use default or weak secrets in production!**

#### 2. Enable HTTPS

```properties
# Use HTTPS URLs in production
SUPABASE_URL=https://your-domain.com
GOTRUE_SITE_URL=https://your-domain.com
```

#### 3. Configure Password Policy

In `docker/.env`:
```properties
# Minimum password length
GOTRUE_PASSWORD_MIN_LENGTH=12

# Require special characters
GOTRUE_PASSWORD_REQUIRED_CHARACTERS=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*
```

#### 4. Enable Rate Limiting

Configure Kong to rate limit authentication endpoints:

```yaml
# In Kong configuration
plugins:
  - name: rate-limiting
    config:
      minute: 5
      policy: local
```

#### 5. Enable Email Verification

In production, require email verification:

```properties
ENABLE_EMAIL_AUTOCONFIRM=false
GOTRUE_MAILER_AUTOCONFIRM=false
```

Configure SMTP settings for email delivery.

#### 6. Set Appropriate Session Timeout

```properties
# Session expires after 1 hour
GOTRUE_JWT_EXP=3600

# Refresh token expires after 30 days
GOTRUE_JWT_REFRESH_TOKEN_ROTATION_ENABLED=true
```

#### 7. Secure Cookie Settings

```properties
GOTRUE_COOKIE_DOMAIN=your-domain.com
GOTRUE_COOKIE_SECURE=true
GOTRUE_COOKIE_SAME_SITE=strict
```

#### 8. Disable Signup (Optional)

If you want to manually manage users:

```properties
GOTRUE_DISABLE_SIGNUP=true
```

#### 9. Enable Audit Logging

Monitor authentication events:

```bash
# View GoTrue logs
docker-compose logs gotrue -f

# Export logs to file
docker-compose logs gotrue > gotrue-audit.log
```

#### 10. Regular Security Updates

Keep services updated:

```bash
# Update Docker images
cd docker
docker-compose pull
docker-compose up -d
```

### Security Checklist

Before going to production:

- [ ] Strong JWT secret (32+ characters)
- [ ] HTTPS enabled
- [ ] Password policy configured
- [ ] Rate limiting enabled
- [ ] Email verification enabled (if applicable)
- [ ] Appropriate session timeout
- [ ] Secure cookie settings
- [ ] Signup disabled (if manual user management)
- [ ] Audit logging enabled
- [ ] Regular backups of auth.users table
- [ ] Monitoring and alerting configured

---

## Additional Resources

### Documentation

- [GoTrue Documentation](https://github.com/supabase/gotrue)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)

### Related Files

- `apps/studio/lib/auth.tsx` - Studio auth provider
- `packages/common/auth.tsx` - Common auth provider
- `apps/studio/middleware.ts` - Route protection middleware
- `apps/studio/pages/sign-in.tsx` - Login page
- `scripts/create-admin-user.sh` - User creation script

### Support

If you encounter issues not covered in this guide:

1. Check GoTrue logs: `docker-compose logs gotrue`
2. Check Studio logs in terminal
3. Check browser console for errors
4. Review [GitHub Issues](https://github.com/supabase/supabase/issues)

---

## Summary

### Migration Steps

1. ✅ Verify Docker services are running
2. ✅ Configure `NEXT_PUBLIC_REQUIRE_LOGIN=true`
3. ✅ Verify JWT secrets match
4. ✅ Restart Studio
5. ✅ Clear browser cache
6. ✅ Create initial user
7. ✅ Test login flow
8. ✅ Verify session persistence

### Rollback Steps

1. ✅ Set `NEXT_PUBLIC_REQUIRE_LOGIN=false`
2. ✅ Restart Studio
3. ✅ Clear browser cache

### Key Points

- Authentication is controlled by `NEXT_PUBLIC_REQUIRE_LOGIN` environment variable
- JWT secrets must match between GoTrue and Studio
- Browser cache must be cleared after changes
- Users must be created before login is possible
- Rollback is simple and non-destructive

---

**Last Updated**: November 27, 2025
**Version**: 1.0.0
