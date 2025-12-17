# Runtime Configuration Troubleshooting Guide

This guide provides step-by-step troubleshooting for common runtime configuration issues in Supabase Studio.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [Environment-Specific Issues](#environment-specific-issues)
4. [Advanced Troubleshooting](#advanced-troubleshooting)
5. [Getting Help](#getting-help)

## Quick Diagnostics

### Step 1: Check Runtime Configuration API

```bash
# Test the runtime config endpoint
curl http://localhost:3000/api/runtime-config

# Or from your production server
curl http://your-server-ip:3000/api/runtime-config
```

**Expected Response:**
```json
{
  "gotrueUrl": "http://192.0.2.1:8000/auth/v1",
  "supabaseUrl": "http://192.0.2.1:8000",
  "apiUrl": "http://192.0.2.1:8000",
  "anonKey": "eyJhbGc...",
  "source": "derived",
  "environment": "production",
  "timestamp": 1234567890
}
```

### Step 2: Check Environment Variables

```bash
# List all Studio environment variables
docker exec supabase-studio env | grep -E "SUPABASE|API_EXTERNAL|POSTGRES|AUTH_JWT"

# Or if running locally
printenv | grep -E "SUPABASE|API_EXTERNAL|POSTGRES|AUTH_JWT"
```

### Step 3: Check Container Logs

```bash
# View recent logs
docker logs --tail 100 supabase-studio

# Follow logs in real-time
docker logs -f supabase-studio

# Filter for configuration-related logs
docker logs supabase-studio | grep -E "Runtime Config|GoTrue Config"
```

### Step 4: Check Container Health

```bash
# Check container status
docker ps --filter name=supabase-studio

# Check health status
docker inspect supabase-studio | grep -A 10 Health
```

## Common Issues

### Issue 1: Frontend Using Localhost URLs in Production

**Symptoms:**
- API requests fail with connection errors
- Browser console shows requests to `127.0.0.1` or `localhost`
- Network tab shows failed requests to localhost

**Diagnosis:**
```bash
# Check runtime configuration
curl http://your-server-ip:3000/api/runtime-config

# Look for localhost in the response
# If you see "127.0.0.1" or "localhost", configuration is wrong
```

**Solution:**

1. **Set production environment variables:**
   ```bash
   # In docker-compose.yml or .env
   SUPABASE_PUBLIC_URL=http://47.96.6.236:8000
   API_EXTERNAL_URL=http://47.96.6.236:8000
   ```

2. **Restart the container:**
   ```bash
   docker compose restart studio
   ```

3. **Verify the fix:**
   ```bash
   curl http://your-server-ip:3000/api/runtime-config
   # Should now show production URLs
   ```

**Why this happens:**
- No runtime environment variables are set
- System falls back to development defaults
- Development defaults use localhost

### Issue 2: Configuration Shows "default" Source in Production

**Symptoms:**
- Runtime config API returns `"source": "default"`
- Logs show "Using development defaults"
- Application uses localhost URLs

**Diagnosis:**
```bash
# Check if environment variables are set
docker exec supabase-studio env | grep SUPABASE_PUBLIC_URL
docker exec supabase-studio env | grep API_EXTERNAL_URL

# If both are empty, that's the problem
```

**Solution:**

Set at least one of these environment variables:

```bash
# Option 1: Set SUPABASE_PUBLIC_URL (recommended)
SUPABASE_PUBLIC_URL=http://47.96.6.236:8000

# Option 2: Set API_EXTERNAL_URL
API_EXTERNAL_URL=http://47.96.6.236:8000

# Option 3: Set explicit GoTrue URL
NEXT_PUBLIC_GOTRUE_URL=http://47.96.6.236:8000/auth/v1
```

Then restart:
```bash
docker compose restart studio
```

**Why this happens:**
- Configuration resolution follows a priority chain
- Without any environment variables, it falls back to defaults
- Defaults are only suitable for local development

### Issue 3: Health Check Failing

**Symptoms:**
- Container shows as "unhealthy" in `docker ps`
- Container keeps restarting
- Health check logs show errors

**Diagnosis:**
```bash
# Check health status
docker inspect supabase-studio | grep -A 10 Health

# Test health check manually
docker exec supabase-studio curl http://localhost:3000/api/runtime-config

# Check if port 3000 is accessible
docker exec supabase-studio netstat -tlnp | grep 3000
```

**Solution:**

1. **If runtime-config API is not accessible:**
   ```bash
   # Check if Next.js is running
   docker exec supabase-studio ps aux | grep node
   
   # Check application logs
   docker logs supabase-studio
   ```

2. **If environment variables are invalid:**
   ```bash
   # Verify URL format
   # ✅ Correct: http://47.96.6.236:8000
   # ❌ Wrong: 47.96.6.236:8000 (missing protocol)
   # ❌ Wrong: http://47.96.6.236:8000/ (trailing slash)
   ```

3. **Restart with correct configuration:**
   ```bash
   docker compose down studio
   docker compose up -d studio
   ```

**Why this happens:**
- Runtime config API is not responding
- Invalid environment variable format
- Application failed to start

### Issue 4: Invalid URL Errors

**Symptoms:**
- Runtime config API returns 500 error
- Logs show "Invalid environment configuration"
- Error message mentions invalid URL

**Diagnosis:**
```bash
# Check environment variables
docker exec supabase-studio env | grep -E "SUPABASE|API_EXTERNAL"

# Look for common issues:
# - Missing http:// or https://
# - Trailing slashes
# - Invalid characters
# - Typos
```

**Solution:**

Fix URL format:

```bash
# ✅ Correct formats:
SUPABASE_PUBLIC_URL=http://47.96.6.236:8000
SUPABASE_PUBLIC_URL=https://api.example.com
API_EXTERNAL_URL=http://47.96.6.236:8000

# ❌ Wrong formats:
SUPABASE_PUBLIC_URL=47.96.6.236:8000          # Missing protocol
SUPABASE_PUBLIC_URL=http://47.96.6.236:8000/  # Trailing slash
SUPABASE_PUBLIC_URL=ftp://47.96.6.236:8000    # Invalid protocol
```

**Why this happens:**
- URLs must start with `http://` or `https://`
- Trailing slashes are not allowed
- Only http and https protocols are supported

### Issue 5: Configuration Not Updating After Changes

**Symptoms:**
- Changed environment variables but still seeing old URLs
- Runtime config API returns old values
- Container restart doesn't help

**Diagnosis:**
```bash
# Check if environment variables are actually set in the container
docker exec supabase-studio env | grep SUPABASE_PUBLIC_URL

# Check if you're editing the right file
# - docker-compose.yml
# - .env file
# - docker-compose.prod.yml
```

**Solution:**

1. **Verify environment variables are in the right place:**
   ```yaml
   # In docker-compose.yml
   services:
     studio:
       environment:
         SUPABASE_PUBLIC_URL: ${SUPABASE_PUBLIC_URL}
   ```

2. **Ensure .env file is being loaded:**
   ```bash
   # Check if .env file exists
   ls -la docker/.env
   
   # Verify it contains your variables
   cat docker/.env | grep SUPABASE_PUBLIC_URL
   ```

3. **Recreate the container (not just restart):**
   ```bash
   docker compose down studio
   docker compose up -d studio
   ```

4. **Verify the change:**
   ```bash
   docker exec supabase-studio env | grep SUPABASE_PUBLIC_URL
   curl http://localhost:3000/api/runtime-config
   ```

**Why this happens:**
- Environment variables are set at container creation time
- Restart doesn't reload environment variables
- Must recreate container to pick up new variables

### Issue 6: CORS Errors

**Symptoms:**
- Browser console shows CORS errors
- Requests to runtime-config API fail with CORS error
- "Access-Control-Allow-Origin" errors

**Diagnosis:**
```bash
# Test from browser console
fetch('/api/runtime-config')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)

# Check if accessing from different origin
# Runtime config API should only be accessed from same origin
```

**Solution:**

Runtime config API is designed to be accessed from the same origin only. If you're getting CORS errors:

1. **Ensure you're accessing Studio from the correct URL:**
   ```
   ✅ http://localhost:3000
   ✅ http://47.96.6.236:3000
   ❌ http://different-domain.com
   ```

2. **Don't try to access runtime-config from external domains**
   - Runtime config is for internal use only
   - It should be fetched by the Studio frontend
   - Not meant to be accessed by external applications

**Why this happens:**
- Runtime config API doesn't set CORS headers
- It's designed for same-origin access only
- Security measure to prevent SSRF attacks

## Environment-Specific Issues

### Development Environment

**Issue: "Cannot connect to localhost services"**

**Solution:**
```bash
# Ensure local Supabase stack is running
cd docker
docker compose up -d

# Verify services are running
docker ps

# Check if ports are accessible
curl http://127.0.0.1:54321/auth/v1/health
curl http://127.0.0.1:8000
```

**Issue: "Using production URLs in development"**

**Solution:**
```bash
# Unset production environment variables for local dev
unset SUPABASE_PUBLIC_URL
unset API_EXTERNAL_URL

# Or set them to localhost
export SUPABASE_PUBLIC_URL=http://127.0.0.1:54321
export API_EXTERNAL_URL=http://127.0.0.1:8000
```

### Production Environment

**Issue: "Using localhost URLs in production"**

**Critical:** This will cause all API requests to fail!

**Solution:**
```bash
# Set production URLs immediately
SUPABASE_PUBLIC_URL=http://your-production-ip:8000
API_EXTERNAL_URL=http://your-production-ip:8000

# Restart container
docker compose restart studio

# Verify fix
curl http://your-production-ip:3000/api/runtime-config
```

**Issue: "SSL/TLS certificate errors"**

**Solution:**
```bash
# Ensure you're using https:// for production
SUPABASE_PUBLIC_URL=https://api.example.com
API_EXTERNAL_URL=https://api.example.com

# Verify SSL certificate is valid
curl -v https://api.example.com
```

### Staging Environment

**Issue: "Staging using production URLs"**

**Solution:**
```bash
# Set staging-specific URLs
SUPABASE_PUBLIC_URL=https://staging-api.example.com
API_EXTERNAL_URL=https://staging-api.example.com

# Use staging API keys
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key
```

## Advanced Troubleshooting

### Debugging Configuration Resolution

Add detailed logging to see how configuration is resolved:

```bash
# Enable debug logging
docker logs -f supabase-studio | grep -E "Runtime Config|GoTrue Config|Environment"

# Look for these log messages:
# - "Configuration loaded successfully"
# - "Source: explicit|derived|default"
# - "Environment: production|development|staging"
```

### Testing Configuration Fallback

Test what happens when runtime config fails:

```bash
# Temporarily break runtime config API
# (Don't do this in production!)
docker exec supabase-studio mv /app/pages/api/runtime-config.ts /app/pages/api/runtime-config.ts.bak

# Application should fall back to build-time config
# Check logs for fallback messages

# Restore the file
docker exec supabase-studio mv /app/pages/api/runtime-config.ts.bak /app/pages/api/runtime-config.ts
```

### Inspecting Network Requests

Use browser DevTools to inspect configuration requests:

1. Open DevTools (F12)
2. Go to Network tab
3. Filter for "runtime-config"
4. Refresh the page
5. Click on the request to see:
   - Request headers
   - Response body
   - Status code
   - Timing

### Checking Build-time Configuration

If runtime config fails, check what build-time config is being used:

```bash
# Check if build-time variables were set
docker exec supabase-studio env | grep NEXT_PUBLIC

# These should be empty or minimal for runtime config to work
# If they contain production URLs, the image was built incorrectly
```

### Validating Docker Image

Ensure the Docker image was built correctly:

```bash
# Check image build date
docker images supabase/studio:latest

# Inspect image environment variables
docker inspect supabase/studio:latest | grep -A 20 Env

# Build-time variables should be minimal
# Runtime variables should be empty in the image
```

## Getting Help

### Before Asking for Help

Collect this information:

1. **Runtime configuration:**
   ```bash
   curl http://localhost:3000/api/runtime-config > runtime-config.json
   ```

2. **Environment variables (sanitized):**
   ```bash
   docker exec supabase-studio env | grep -E "SUPABASE|API_EXTERNAL" | sed 's/=.*/=***/' > env-vars.txt
   ```

3. **Container logs:**
   ```bash
   docker logs supabase-studio > studio-logs.txt
   ```

4. **Container status:**
   ```bash
   docker ps --filter name=supabase-studio > container-status.txt
   docker inspect supabase-studio > container-inspect.json
   ```

### Where to Get Help

- **GitHub Issues**: [supabase/supabase](https://github.com/supabase/supabase/issues)
- **Discord**: [Supabase Discord](https://discord.supabase.com)
- **Documentation**: [Supabase Docs](https://supabase.com/docs)

### What to Include

When reporting an issue:

1. **Environment**: Development, Staging, or Production
2. **Deployment method**: Docker Compose, Kubernetes, etc.
3. **Runtime config response**: Output from `/api/runtime-config`
4. **Relevant logs**: Configuration-related log messages
5. **Steps to reproduce**: What you did before the issue occurred
6. **Expected vs actual behavior**: What should happen vs what actually happens

## Related Documentation

- [Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)
- [Required Environment Variables](./REQUIRED-ENV-VARS.md)
- [Runtime Configuration Error Handling](./RUNTIME-CONFIG-ERROR-HANDLING.md)
- [Configuration Logging](./CONFIGURATION-LOGGING.md)
- [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)
