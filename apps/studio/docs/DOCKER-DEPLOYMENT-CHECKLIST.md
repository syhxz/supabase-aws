# Docker Deployment Checklist

Use this checklist to ensure your Studio Docker deployment is properly configured with runtime configuration.

## Pre-Deployment

### 1. Build the Docker Image

```bash
# Build from project root
docker build -f apps/studio/Dockerfile --target production -t supabase/studio:latest .
```

**Verify:**
- ✅ Build completes without errors
- ✅ No URL-related build arguments are required
- ✅ Image size is reasonable (check with `docker images`)

### 2. Prepare Environment Variables

Create or update your `.env` file with required variables:

```bash
# Required for production
SUPABASE_PUBLIC_URL=http://your-server-ip:8000
API_EXTERNAL_URL=http://your-server-ip:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
AUTH_JWT_SECRET=your-jwt-secret
POSTGRES_PASSWORD=your-postgres-password

# Database configuration
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres
PG_META_CRYPTO_KEY=your-encryption-key-32-chars-min
```

**Verify:**
- ✅ All URLs use `http://` or `https://` protocol
- ✅ URLs do not have trailing slashes
- ✅ Secrets are at least 32 characters long
- ✅ URLs are accessible from the deployment environment

### 3. Test Configuration Locally

```bash
# Start the container with your production environment variables
docker run -d \
  --name studio-test \
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

# Test runtime configuration
curl http://localhost:3000/api/runtime-config

# Check logs
docker logs studio-test | grep "Runtime Config"

# Clean up
docker stop studio-test
docker rm studio-test
```

**Verify:**
- ✅ Container starts successfully
- ✅ Runtime config API returns correct URLs
- ✅ Logs show "Configuration loaded successfully"
- ✅ No errors in container logs

## Deployment

### 4. Deploy with Docker Compose

```bash
# For production deployment
cd docker
docker compose -f docker-compose.yml -f ./prod/docker-compose.prod.yml up -d studio
```

**Verify:**
- ✅ Container starts and stays running
- ✅ Health check passes (check with `docker ps`)
- ✅ No restart loops

### 5. Verify Runtime Configuration

```bash
# Check runtime configuration
curl http://your-server-ip:3000/api/runtime-config

# Expected response:
# {
#   "gotrueUrl": "http://your-server-ip:8000/auth/v1",
#   "supabaseUrl": "http://your-server-ip:8000",
#   "apiUrl": "http://your-server-ip:8000",
#   "anonKey": "your-anon-key",
#   "source": "derived",
#   "environment": "production",
#   "timestamp": 1234567890
# }
```

**Verify:**
- ✅ All URLs match your production configuration
- ✅ `source` is "explicit" or "derived" (not "default")
- ✅ `environment` is "production"
- ✅ `anonKey` is present and correct

### 6. Check Container Health

```bash
# Check container status
docker ps --filter name=supabase-studio

# Check health status
docker inspect supabase-studio | grep -A 10 Health

# View recent logs
docker logs --tail 50 supabase-studio
```

**Verify:**
- ✅ Container status is "Up" (not "Restarting")
- ✅ Health status is "healthy"
- ✅ Logs show successful configuration load
- ✅ No error messages in logs

### 7. Test Frontend Access

```bash
# Access Studio in browser
open http://your-server-ip:3000

# Or test with curl
curl -I http://your-server-ip:3000
```

**Verify:**
- ✅ Studio loads in browser
- ✅ No console errors related to configuration
- ✅ API requests use production URLs (check browser DevTools Network tab)
- ✅ No requests to localhost or 127.0.0.1

### 8. Test API Connectivity

From the Studio UI:

1. Navigate to SQL Editor
2. Run a simple query: `SELECT 1;`
3. Check browser console for any errors

**Verify:**
- ✅ Query executes successfully
- ✅ No authentication errors
- ✅ No connection errors
- ✅ Network requests use production URLs

## Post-Deployment

### 9. Monitor Logs

```bash
# Follow logs in real-time
docker logs -f supabase-studio

# Look for these messages:
# [Runtime Config API] ✓ Configuration loaded successfully
# [Runtime Config API] Source: derived
# [Runtime Config API] Environment: production
```

**Verify:**
- ✅ No error messages
- ✅ Configuration source is correct
- ✅ No warnings about using defaults in production

### 10. Set Up Monitoring

Add monitoring for:

- Container health status
- Runtime configuration API availability
- API request success rates
- Error logs

**Recommended tools:**
- Docker health checks (already configured)
- Prometheus + Grafana for metrics
- Log aggregation (ELK stack, Loki, etc.)

### 11. Document Your Configuration

Create a deployment document with:

- Environment variables used
- URLs and endpoints
- Deployment date and version
- Any custom configurations
- Rollback procedures

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs supabase-studio

# Common issues:
# - Missing required environment variables
# - Invalid URL format
# - Port conflicts
```

### Health Check Failing

```bash
# Test runtime config API manually
docker exec supabase-studio curl http://localhost:3000/api/runtime-config

# Check if port 3000 is accessible
docker exec supabase-studio netstat -tlnp | grep 3000
```

### Using Localhost URLs in Production

```bash
# Check environment variables
docker exec supabase-studio env | grep -E "SUPABASE|API_EXTERNAL"

# Verify runtime config
curl http://your-server-ip:3000/api/runtime-config
```

### Configuration Shows "default" Source

This means no runtime configuration variables are set.

**Solution:**
```bash
# Set required variables in docker-compose.yml or .env
SUPABASE_PUBLIC_URL=http://your-server-ip:8000
API_EXTERNAL_URL=http://your-server-ip:8000
```

## Rollback Procedure

If deployment fails:

1. **Stop the new container:**
   ```bash
   docker compose -f docker-compose.yml -f ./prod/docker-compose.prod.yml down studio
   ```

2. **Restore previous image:**
   ```bash
   docker tag supabase/studio:previous supabase/studio:latest
   ```

3. **Restart with previous configuration:**
   ```bash
   docker compose -f docker-compose.yml -f ./prod/docker-compose.prod.yml up -d studio
   ```

4. **Verify rollback:**
   ```bash
   docker ps --filter name=supabase-studio
   curl http://your-server-ip:3000/api/runtime-config
   ```

## Additional Resources

- [Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)
- [Required Environment Variables](./REQUIRED-ENV-VARS.md)
- [Runtime Configuration Error Handling](./RUNTIME-CONFIG-ERROR-HANDLING.md)
- [Configuration Logging](./CONFIGURATION-LOGGING.md)
- [Production Deployment Guide](../../PRODUCTION-DEPLOYMENT-GUIDE.md)

## Quick Reference Commands

```bash
# Build image
docker build -f apps/studio/Dockerfile --target production -t supabase/studio:latest .

# Test locally
docker run -d --name studio-test -p 3000:3000 \
  -e SUPABASE_PUBLIC_URL=http://your-ip:8000 \
  -e API_EXTERNAL_URL=http://your-ip:8000 \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  supabase/studio:latest

# Check runtime config
curl http://localhost:3000/api/runtime-config

# View logs
docker logs supabase-studio | grep "Runtime Config"

# Check health
docker inspect supabase-studio | grep -A 10 Health

# Deploy production
cd docker
docker compose -f docker-compose.yml -f ./prod/docker-compose.prod.yml up -d studio

# Verify deployment
docker ps --filter name=supabase-studio
curl http://your-ip:3000/api/runtime-config
```
