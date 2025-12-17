# Production Deployment Verification Guide

This guide provides comprehensive verification steps to ensure your Supabase Studio deployment is production-ready.

## Overview

Before deploying to production, you must verify that:

1. All correctness properties are satisfied
2. Runtime configuration is working correctly
3. No localhost URLs are used in production
4. All deployment checklist items are complete
5. Services are healthy and reachable

## Quick Verification

Run the comprehensive deployment verification script:

```bash
# For local testing (before deployment)
pnpm tsx apps/studio/scripts/verify-deployment.ts

# For production deployment verification
pnpm tsx apps/studio/scripts/verify-deployment.ts --host your-server-ip --port 3000 --verbose
```

This script verifies all correctness properties and deployment checklist items in one command.

## Detailed Verification Steps

### Step 1: Verify Environment Variables

Before starting the deployment, ensure all required environment variables are set:

```bash
# Validate environment variables
pnpm tsx apps/studio/scripts/validate-env-vars.ts --verbose --strict
```

**Required variables for production:**
- `SUPABASE_PUBLIC_URL` - Your production API URL
- `API_EXTERNAL_URL` - Your production API gateway URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous API key
- `AUTH_JWT_SECRET` - JWT secret for authentication
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_HOST` - Database host
- `POSTGRES_PORT` - Database port
- `POSTGRES_DB` - Database name

**Expected output:**
```
✅ All required environment variables are set
✅ All URLs are properly formatted
✅ No localhost URLs in production configuration
✅ All secrets meet minimum length requirements
```

### Step 2: Build and Start the Container

```bash
# Build the Docker image
docker build -f apps/studio/Dockerfile --target production -t supabase/studio:latest .

# Start the container with production environment variables
docker run -d \
  --name studio-production \
  -p 3000:3000 \
  -e SUPABASE_PUBLIC_URL=http://your-server-ip:8000 \
  -e API_EXTERNAL_URL=http://your-server-ip:8000 \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -e AUTH_JWT_SECRET=your-jwt-secret \
  -e POSTGRES_PASSWORD=your-password \
  -e POSTGRES_HOST=db \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_DB=postgres \
  supabase/studio:latest

# Wait for container to start
sleep 10
```

### Step 3: Verify Runtime Configuration

Check that the runtime configuration API is working and returning correct values:

```bash
# Verify runtime configuration
pnpm tsx apps/studio/scripts/verify-runtime-config.ts --verbose

# Or manually check
curl http://localhost:3000/api/runtime-config
```

**Expected response:**
```json
{
  "gotrueUrl": "http://your-server-ip:8000/auth/v1",
  "supabaseUrl": "http://your-server-ip:8000",
  "apiUrl": "http://your-server-ip:8000",
  "anonKey": "your-anon-key",
  "source": "derived",
  "environment": "production",
  "timestamp": 1234567890
}
```

**Verify:**
- ✅ All URLs use your production IP/domain (not localhost)
- ✅ `source` is "explicit" or "derived" (not "default")
- ✅ `environment` is "production"
- ✅ All URLs start with `http://` or `https://`
- ✅ No URLs have trailing slashes

### Step 4: Test Health Checks

Verify that all services are reachable:

```bash
# Run health checks
pnpm tsx apps/studio/scripts/test-health-checks.ts --verbose
```

**Expected output:**
```
✅ Runtime configuration available
✅ GoTrue service reachable
✅ API gateway reachable
✅ Overall health: HEALTHY
```

### Step 5: Verify Correctness Properties

Run the comprehensive deployment verification:

```bash
# Verify all correctness properties
pnpm tsx apps/studio/scripts/verify-deployment.ts --verbose
```

**Properties verified:**

1. **Property 1: Runtime configuration loading**
   - Validates: Requirements 1.1
   - Checks: Runtime config loads with all required fields

2. **Property 2: Production URL usage**
   - Validates: Requirements 1.2
   - Checks: No localhost/127.0.0.1 URLs in production

3. **Property 3: Runtime config API correctness**
   - Validates: Requirements 1.3
   - Checks: URLs are properly formatted and derived

4. **Property 10: Configuration source logging**
   - Validates: Requirements 2.5
   - Checks: Configuration source and environment are logged

**Expected output:**
```
✅ Property 1: Runtime configuration loading
   Validates: Requirements 1.1
   Runtime configuration loads successfully with all required fields

✅ Property 2: Production URL usage
   Validates: Requirements 1.2
   Production URLs are correctly configured

✅ Property 3: Runtime config API correctness
   Validates: Requirements 1.3
   Runtime config API returns correctly formatted URLs

✅ Property 10: Configuration source logging
   Validates: Requirements 2.5
   Configuration source: derived, environment: production
```

### Step 6: Verify Deployment Checklist

The deployment verification script also checks these items:

1. ✅ Runtime config API accessible
2. ✅ Environment variables configured (source not "default")
3. ✅ No localhost URLs in production
4. ✅ All URLs properly formatted
5. ✅ Anon key configured

**Expected output:**
```
📋 Deployment Checklist Verification
============================================================
✅ 1. Runtime config API accessible
✅ 2. Environment variables configured
✅ 3. No localhost URLs in production
✅ 4. All URLs properly formatted
✅ 5. Anon key configured
============================================================
✅ All deployment checks passed!
```

### Step 7: Test Frontend Access

Verify the Studio frontend loads correctly:

```bash
# Test HTTP response
curl -I http://your-server-ip:3000

# Or open in browser
open http://your-server-ip:3000
```

**In the browser:**
1. Open Developer Tools (F12)
2. Go to Network tab
3. Reload the page
4. Check that:
   - ✅ Page loads without errors
   - ✅ API requests use production URLs
   - ✅ No requests to localhost or 127.0.0.1
   - ✅ Runtime config is fetched successfully

### Step 8: Test API Connectivity

Test that the frontend can communicate with backend services:

```bash
# Test GoTrue health
curl http://your-server-ip:8000/auth/v1/health

# Test API gateway
curl http://your-server-ip:8000/rest/v1/
```

**In the Studio UI:**
1. Navigate to SQL Editor
2. Run a simple query: `SELECT 1;`
3. Verify:
   - ✅ Query executes successfully
   - ✅ No authentication errors
   - ✅ No connection errors
   - ✅ Network requests use production URLs (check DevTools)

### Step 9: Check Container Logs

Review logs for any errors or warnings:

```bash
# View recent logs
docker logs --tail 100 studio-production

# Follow logs in real-time
docker logs -f studio-production
```

**Look for:**
- ✅ "Runtime Config API: Configuration loaded successfully"
- ✅ "Runtime Config API: Source: derived" (or "explicit")
- ✅ "Runtime Config API: Environment: production"
- ❌ No error messages
- ❌ No warnings about using defaults in production

### Step 10: Monitor Container Health

Check that the container is healthy:

```bash
# Check container status
docker ps --filter name=studio-production

# Check health status
docker inspect studio-production | grep -A 10 Health
```

**Expected:**
- Status: "Up" (not "Restarting")
- Health: "healthy"

## Verification Checklist

Use this checklist before deploying to production:

### Pre-Deployment

- [ ] All required environment variables are set
- [ ] Environment variables validated with `validate-env-vars.ts`
- [ ] No localhost URLs in production configuration
- [ ] Secrets are at least 32 characters long
- [ ] Docker image builds successfully

### Post-Deployment

- [ ] Container starts and stays running
- [ ] Runtime config API returns correct URLs
- [ ] Configuration source is "explicit" or "derived" (not "default")
- [ ] Environment is detected as "production"
- [ ] No localhost URLs in runtime configuration
- [ ] All URLs are properly formatted
- [ ] Health checks pass
- [ ] Frontend loads without errors
- [ ] API requests use production URLs
- [ ] Backend services are reachable
- [ ] No errors in container logs
- [ ] Container health status is "healthy"

### Verification Scripts

- [ ] `validate-env-vars.ts --strict` passes
- [ ] `verify-runtime-config.ts --verbose` passes
- [ ] `test-health-checks.ts --verbose` passes
- [ ] `verify-deployment.ts --verbose` passes

## Automated Verification

For CI/CD pipelines, use the verification script with exit codes:

```bash
#!/bin/bash
set -e

echo "Starting deployment verification..."

# Validate environment variables
pnpm tsx apps/studio/scripts/validate-env-vars.ts --strict
echo "✅ Environment variables validated"

# Wait for container to be ready
sleep 10

# Verify deployment
pnpm tsx apps/studio/scripts/verify-deployment.ts --host $STUDIO_HOST --port 3000
echo "✅ Deployment verification passed"

# Test health checks
pnpm tsx apps/studio/scripts/test-health-checks.ts
echo "✅ Health checks passed"

echo "🎉 Deployment is production-ready!"
```

## Troubleshooting Failed Verification

### Issue: "Configuration source is 'default'"

**Problem:** No runtime environment variables are set

**Solution:**
```bash
# Set required environment variables
export SUPABASE_PUBLIC_URL=http://your-server-ip:8000
export API_EXTERNAL_URL=http://your-server-ip:8000

# Restart container
docker restart studio-production

# Verify again
pnpm tsx apps/studio/scripts/verify-deployment.ts
```

### Issue: "Using localhost URLs in production"

**Problem:** Environment variables not set or incorrect

**Solution:**
```bash
# Check environment variables
docker exec studio-production env | grep -E "SUPABASE|API_EXTERNAL"

# Update docker-compose.yml or .env file
# Restart container
docker restart studio-production
```

### Issue: "Health check failing"

**Problem:** Backend services not reachable

**Solution:**
```bash
# Check if backend services are running
docker ps

# Test connectivity
curl http://your-server-ip:8000/auth/v1/health

# Check network configuration
docker network inspect supabase_default

# Review service logs
docker logs supabase-auth
docker logs supabase-kong
```

### Issue: "Runtime config API not accessible"

**Problem:** Container not running or port not exposed

**Solution:**
```bash
# Check container status
docker ps --filter name=studio-production

# Check logs
docker logs studio-production

# Restart container
docker restart studio-production

# Verify port is exposed
docker port studio-production
```

## Production Deployment Workflow

Follow this workflow for safe production deployments:

1. **Pre-Deployment Verification**
   ```bash
   pnpm tsx apps/studio/scripts/validate-env-vars.ts --strict
   ```

2. **Build and Deploy**
   ```bash
   docker build -f apps/studio/Dockerfile --target production -t supabase/studio:latest .
   docker-compose -f docker-compose.yml -f ./prod/docker-compose.prod.yml up -d studio
   ```

3. **Wait for Startup**
   ```bash
   sleep 10
   ```

4. **Post-Deployment Verification**
   ```bash
   pnpm tsx apps/studio/scripts/verify-deployment.ts --host your-server-ip --port 3000 --verbose
   ```

5. **Monitor**
   ```bash
   docker logs -f studio-production
   ```

6. **Smoke Test**
   - Open Studio in browser
   - Test login
   - Run a SQL query
   - Verify no errors

## Success Criteria

Your deployment is production-ready when:

✅ All verification scripts pass with exit code 0
✅ All correctness properties are satisfied
✅ All deployment checklist items are complete
✅ No localhost URLs in production
✅ All services are healthy and reachable
✅ Frontend loads without errors
✅ API requests use production URLs
✅ No errors in container logs

## Additional Resources

- [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)
- [Required Environment Variables](./REQUIRED-ENV-VARS.md)
- [Runtime Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md)
- [Diagnostic Scripts Guide](./DIAGNOSTIC-SCRIPTS-GUIDE.md)
- [Production Deployment Guide](../../PRODUCTION-DEPLOYMENT-GUIDE.md)

## Support

If verification fails:

1. Review the error messages from verification scripts
2. Check the troubleshooting section above
3. Review container logs for detailed errors
4. Consult the related documentation
5. Verify all environment variables are correct

---

**Last Updated:** 2024-12-03

**Related Spec:** `.kiro/specs/fix-frontend-runtime-config`
