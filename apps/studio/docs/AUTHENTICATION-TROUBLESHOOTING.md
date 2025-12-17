# Authentication Troubleshooting Guide

This guide helps you diagnose and resolve common authentication issues in Supabase Studio.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Service Health Checks](#service-health-checks)
- [Debugging Authentication](#debugging-authentication)
- [Advanced Troubleshooting](#advanced-troubleshooting)

## Quick Diagnostics

Run these checks first to identify the issue:

### 1. Check Environment Variables

```bash
# In apps/studio/.env
cat apps/studio/.env | grep -E "NEXT_PUBLIC_REQUIRE_LOGIN|NEXT_PUBLIC_GOTRUE_URL|JWT_SECRET"
```

Expected output:
```
NEXT_PUBLIC_REQUIRE_LOGIN=true
NEXT_PUBLIC_GOTRUE_URL=http://127.0.0.1:54321/auth/v1
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
```

### 2. Check GoTrue Service Status

```bash
# Check if GoTrue container is running
docker ps | grep gotrue

# Check GoTrue health endpoint
curl http://127.0.0.1:54321/auth/v1/health

# Expected response: {"status":"ok"}
```

### 3. Check Kong Gateway

```bash
# Verify Kong is routing to GoTrue
curl -I http://127.0.0.1:54321/auth/v1/health

# Should return HTTP 200
```

### 4. Check Database Connection

```bash
# Connect to PostgreSQL
docker exec -it <postgres-container> psql -U postgres

# Check if auth schema exists
\dn

# Check if users table exists
\dt auth.*

# Count users
SELECT COUNT(*) FROM auth.users;
```

## Common Issues

### Issue 1: Cannot Access Login Page

**Symptoms:**
- Redirected to login page but page doesn't load
- Blank screen or loading spinner
- Console errors about GoTrue

**Solutions:**

1. **Verify authentication is enabled:**
   ```bash
   # Check .env file
   grep NEXT_PUBLIC_REQUIRE_LOGIN apps/studio/.env
   ```
   Should be `NEXT_PUBLIC_REQUIRE_LOGIN=true`

2. **Restart Studio:**
   ```bash
   cd apps/studio
   pnpm run dev
   ```

3. **Clear browser cache and localStorage:**
   - Open browser DevTools (F12)
   - Go to Application > Local Storage
   - Clear all items
   - Refresh the page

### Issue 2: "Authentication Service Unavailable"

**Symptoms:**
- Error message: "Authentication service is unavailable"
- Cannot log in
- Login button doesn't respond

**Solutions:**

1. **Check GoTrue is running:**
   ```bash
   docker ps | grep gotrue
   ```
   
   If not running:
   ```bash
   cd docker
   docker compose up -d gotrue
   ```

2. **Check GoTrue logs:**
   ```bash
   docker logs <gotrue-container-id>
   ```
   
   Look for errors related to:
   - Database connection
   - JWT secret configuration
   - Port binding

3. **Verify GoTrue URL:**
   ```bash
   # Test direct connection
   curl http://127.0.0.1:54321/auth/v1/health
   ```
   
   If this fails, check Kong gateway:
   ```bash
   docker logs <kong-container-id>
   ```

4. **Check network connectivity:**
   ```bash
   # From Studio container/process
   curl http://gotrue:9999/health  # Internal Docker network
   curl http://127.0.0.1:54321/auth/v1/health  # Via Kong
   ```

### Issue 3: "Invalid Credentials" Error

**Symptoms:**
- Login fails with "Invalid email or password"
- User exists in database
- Password is correct

**Solutions:**

1. **Verify user exists:**
   ```sql
   SELECT id, email, email_confirmed_at, encrypted_password 
   FROM auth.users 
   WHERE email = 'your-email@example.com';
   ```

2. **Check email confirmation:**
   ```sql
   -- If email_confirmed_at is NULL, update it
   UPDATE auth.users 
   SET email_confirmed_at = NOW(), confirmed_at = NOW()
   WHERE email = 'your-email@example.com';
   ```

3. **Reset password:**
   ```sql
   UPDATE auth.users 
   SET encrypted_password = crypt('new-password', gen_salt('bf'))
   WHERE email = 'your-email@example.com';
   ```

4. **Check GoTrue configuration:**
   ```bash
   # In docker/.env
   grep -E "GOTRUE_|JWT_SECRET" docker/.env
   ```
   
   Verify:
   - `GOTRUE_JWT_SECRET` matches Studio's `JWT_SECRET`
   - `GOTRUE_SITE_URL` is set correctly
   - `GOTRUE_DISABLE_SIGNUP` is not preventing login

### Issue 4: Session Expires Immediately

**Symptoms:**
- Login succeeds but immediately redirected back to login
- Session doesn't persist
- "Session expired" message

**Solutions:**

1. **Check JWT secret match:**
   ```bash
   # Studio JWT secret
   grep JWT_SECRET apps/studio/.env
   
   # GoTrue JWT secret
   grep GOTRUE_JWT_SECRET docker/.env
   ```
   
   These MUST match exactly.

2. **Check system time:**
   ```bash
   # Check Docker container time
   docker exec <gotrue-container> date
   
   # Check host system time
   date
   ```
   
   If times don't match, synchronize clocks.

3. **Check token expiration:**
   ```bash
   # In docker/.env
   grep GOTRUE_JWT_EXP docker/.env
   ```
   
   Default is 3600 seconds (1 hour). Increase if needed:
   ```
   GOTRUE_JWT_EXP=86400  # 24 hours
   ```

4. **Clear localStorage and try again:**
   - Open DevTools > Application > Local Storage
   - Delete `supabase.dashboard.auth.token`
   - Try logging in again

### Issue 5: CORS Errors

**Symptoms:**
- Console errors: "CORS policy: No 'Access-Control-Allow-Origin' header"
- Login request fails
- Network tab shows failed OPTIONS request

**Solutions:**

1. **Check GoTrue CORS configuration:**
   ```bash
   # In docker/.env
   grep GOTRUE_EXTERNAL_URL docker/.env
   ```
   
   Should match your Studio URL.

2. **Update Kong CORS configuration:**
   Edit `docker/docker-compose.yml` to add CORS headers to Kong.

3. **Use Kong gateway URL:**
   Ensure `NEXT_PUBLIC_GOTRUE_URL` points to Kong (port 54321), not directly to GoTrue (port 9999).

### Issue 6: "Token Validation Failed"

**Symptoms:**
- Login succeeds but subsequent requests fail
- Console errors about invalid tokens
- Automatically logged out

**Solutions:**

1. **Verify JWT secret:**
   ```bash
   # Must be at least 32 characters
   echo $JWT_SECRET | wc -c
   ```

2. **Check token structure:**
   - Open DevTools > Application > Local Storage
   - Find `supabase.dashboard.auth.token`
   - Copy the `access_token` value
   - Decode at https://jwt.io
   - Verify claims: `sub`, `aud`, `exp`, `iat`

3. **Check token expiration:**
   ```javascript
   // In browser console
   const token = JSON.parse(localStorage.getItem('supabase.dashboard.auth.token'))
   const exp = token.expires_at * 1000
   const now = Date.now()
   console.log('Token expires:', new Date(exp))
   console.log('Expired:', exp < now)
   ```

## Service Health Checks

### GoTrue Health Check

```bash
#!/bin/bash
# save as check-gotrue-health.sh

GOTRUE_URL="http://127.0.0.1:54321/auth/v1"

echo "Checking GoTrue health..."
response=$(curl -s -o /dev/null -w "%{http_code}" $GOTRUE_URL/health)

if [ $response -eq 200 ]; then
  echo "✓ GoTrue is healthy"
else
  echo "✗ GoTrue is not responding (HTTP $response)"
  exit 1
fi

echo "Checking GoTrue settings..."
curl -s $GOTRUE_URL/settings | jq .

echo "✓ All checks passed"
```

### Database Health Check

```bash
#!/bin/bash
# save as check-db-health.sh

echo "Checking PostgreSQL connection..."
docker exec <postgres-container> psql -U postgres -c "SELECT version();"

echo "Checking auth schema..."
docker exec <postgres-container> psql -U postgres -c "\dn" | grep auth

echo "Checking auth.users table..."
docker exec <postgres-container> psql -U postgres -c "SELECT COUNT(*) FROM auth.users;"

echo "✓ Database checks passed"
```

## Debugging Authentication

### Enable Debug Logging

1. **Studio debug logging:**
   ```bash
   # In apps/studio/.env
   NEXT_PUBLIC_AUTH_DEBUG=true
   ```

2. **GoTrue debug logging:**
   ```bash
   # In docker/.env
   GOTRUE_LOG_LEVEL=debug
   ```

3. **Restart services:**
   ```bash
   docker compose restart gotrue
   cd apps/studio && pnpm run dev
   ```

### Monitor Authentication Flow

1. **Open browser DevTools (F12)**

2. **Go to Network tab**

3. **Filter by "auth"**

4. **Attempt login and watch requests:**
   - `POST /auth/v1/token` - Login request
   - `GET /auth/v1/user` - Get user info
   - `POST /auth/v1/token?grant_type=refresh_token` - Token refresh

5. **Check request/response:**
   - Request headers (apikey, Content-Type)
   - Request body (email, password)
   - Response status (200, 400, 401, 500)
   - Response body (session, error message)

### Check Browser Console

Look for authentication-related logs:

```
[Auth] Initializing authentication...
[Auth] Session restored from localStorage
[Auth] Token expiring soon, refreshing...
[Auth] Token refreshed successfully
[Security] Invalid token structure, signing out
```

## Advanced Troubleshooting

### Reset Authentication Completely

If all else fails, reset everything:

```bash
# 1. Stop all services
cd docker
docker compose down

# 2. Clear Studio cache
cd ../apps/studio
rm -rf .next node_modules/.cache

# 3. Clear browser data
# Open DevTools > Application
# Clear all Local Storage, Session Storage, and Cookies

# 4. Reset database auth schema
docker compose up -d db
docker exec -it <postgres-container> psql -U postgres -c "
  DROP SCHEMA IF EXISTS auth CASCADE;
  CREATE SCHEMA auth;
"

# 5. Restart GoTrue (will recreate auth schema)
docker compose up -d gotrue

# 6. Wait for GoTrue to initialize
sleep 5

# 7. Create new admin user
./scripts/create-admin-user.sh admin@example.com new-password

# 8. Restart Studio
cd ../apps/studio
pnpm run dev
```

### Inspect JWT Token

```javascript
// In browser console
function inspectToken() {
  const stored = localStorage.getItem('supabase.dashboard.auth.token')
  if (!stored) {
    console.log('No token found')
    return
  }
  
  const session = JSON.parse(stored)
  console.log('Session:', session)
  
  // Decode JWT
  const token = session.access_token
  const parts = token.split('.')
  const payload = JSON.parse(atob(parts[1]))
  
  console.log('Token payload:', payload)
  console.log('Issued at:', new Date(payload.iat * 1000))
  console.log('Expires at:', new Date(payload.exp * 1000))
  console.log('Time until expiry:', Math.floor((payload.exp * 1000 - Date.now()) / 1000), 'seconds')
}

inspectToken()
```

### Test GoTrue API Directly

```bash
# Test signup
curl -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass123"}'

# Test login
curl -X POST 'http://127.0.0.1:54321/auth/v1/token?grant_type=password' \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass123"}'

# Test token refresh
curl -X POST 'http://127.0.0.1:54321/auth/v1/token?grant_type=refresh_token' \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN"}'
```

### Check Docker Network

```bash
# List Docker networks
docker network ls

# Inspect network
docker network inspect <network-name>

# Check if services can communicate
docker exec <studio-container> ping gotrue
docker exec <studio-container> curl http://gotrue:9999/health
```

## Getting Help

If you're still experiencing issues:

1. **Check GoTrue logs:**
   ```bash
   docker logs <gotrue-container-id> --tail 100
   ```

2. **Check Kong logs:**
   ```bash
   docker logs <kong-container-id> --tail 100
   ```

3. **Check PostgreSQL logs:**
   ```bash
   docker logs <postgres-container-id> --tail 100
   ```

4. **Gather diagnostic information:**
   - Studio version
   - GoTrue version
   - Docker compose configuration
   - Environment variables (redact secrets)
   - Error messages from logs
   - Browser console errors
   - Network tab screenshots

5. **Create an issue:**
   - Visit https://github.com/supabase/supabase/issues
   - Search for existing issues
   - Create a new issue with diagnostic information

## Related Documentation

- [Authentication Migration Guide](./AUTHENTICATION-MIGRATION-GUIDE.md)
- [Studio README](../README.md)
- [GoTrue Documentation](https://github.com/supabase/gotrue)
- [Self-Hosting Guide](https://supabase.com/docs/guides/hosting/docker)
