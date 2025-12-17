# Docker Runtime Configuration Guide

## Overview

The Supabase Studio Docker image now uses **runtime configuration** instead of build-time environment variables. This allows the same Docker image to be deployed to multiple environments (development, staging, production) without rebuilding.

## How It Works

```
┌──────────────────────────────────────────────────────────┐
│  Application Startup                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 1. Container starts with environment variables    │  │
│  │ 2. Frontend fetches /api/runtime-config           │  │
│  │ 3. Server reads process.env at runtime            │  │
│  │ 4. Returns: { gotrueUrl, supabaseUrl, apiUrl }   │  │
│  │ 5. Frontend uses runtime config for all requests │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Required Environment Variables

### Production Deployment

For production deployments, set these environment variables when running the container:

```bash
# Public-facing API URL (required)
SUPABASE_PUBLIC_URL=http://192.0.2.1:8000

# External API gateway URL (required)
API_EXTERNAL_URL=http://192.0.2.1:8000

# Anonymous API key (required)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# JWT secret for authentication (required)
AUTH_JWT_SECRET=your-jwt-secret-here

# Service role key (required)
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Database configuration (required)
POSTGRES_PASSWORD=your-postgres-password
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres
```

### Development Environment

For local development, the system uses sensible defaults:

```bash
# Optional - defaults to http://127.0.0.1:54321
SUPABASE_PUBLIC_URL=http://127.0.0.1:54321

# Optional - defaults to http://127.0.0.1:8000
API_EXTERNAL_URL=http://127.0.0.1:8000
```

## Configuration Priority

The runtime configuration API resolves URLs using this priority order:

1. **Explicit environment variables** (highest priority)
   - `NEXT_PUBLIC_GOTRUE_URL`
   - `API_EXTERNAL_URL`
   - `SUPABASE_PUBLIC_URL`

2. **Derived from base URL**
   - Derives GoTrue URL from `SUPABASE_PUBLIC_URL` + `/auth/v1`
   - Derives API URL from `SUPABASE_PUBLIC_URL`

3. **Development defaults** (lowest priority)
   - `http://127.0.0.1:54321/auth/v1` (GoTrue)
   - `http://127.0.0.1:8000` (API)

## Docker Compose Examples

### Using docker-compose.yml

```yaml
services:
  studio:
    image: supabase/studio:latest
    environment:
      # Runtime configuration
      SUPABASE_PUBLIC_URL: ${SUPABASE_PUBLIC_URL}
      API_EXTERNAL_URL: ${API_EXTERNAL_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${ANON_KEY}
      AUTH_JWT_SECRET: ${JWT_SECRET}
      
      # Database configuration
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_HOST: db
      POSTGRES_PORT: 5432
      POSTGRES_DB: postgres
```

### Using docker run

```bash
docker run -d \
  -p 3000:3000 \
  -e SUPABASE_PUBLIC_URL=http://192.0.2.1:8000 \
  -e API_EXTERNAL_URL=http://192.0.2.1:8000 \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -e AUTH_JWT_SECRET=your-jwt-secret \
  -e POSTGRES_PASSWORD=your-password \
  -e POSTGRES_HOST=db \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_DB=postgres \
  supabase/studio:latest
```

## Building the Docker Image

The Dockerfile now uses minimal build-time variables:

```bash
# Build the image (no URL configuration needed at build time)
docker build -f apps/studio/Dockerfile --target production -t supabase/studio:latest .

# The same image can be used in all environments
```

### What Changed

**Before (Build-time configuration):**
```dockerfile
# URLs were compiled into the JavaScript bundle
ARG NEXT_PUBLIC_GOTRUE_URL=http://127.0.0.1:54321/auth/v1
ENV NEXT_PUBLIC_GOTRUE_URL=${NEXT_PUBLIC_GOTRUE_URL}
```

**After (Runtime configuration):**
```dockerfile
# URLs are read at runtime from environment variables
ENV SUPABASE_PUBLIC_URL=""
ENV API_EXTERNAL_URL=""
```

## Health Check

The Docker image includes a health check that validates the runtime configuration:

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/runtime-config').then((r) => {if (r.status !== 200) throw new Error('Health check failed: ' + r.status)})"
```

This ensures:
- The application is running
- The runtime configuration API is accessible
- Environment variables are properly configured

## Verifying Configuration

### Check Runtime Configuration

```bash
# From inside the container
curl http://localhost:3000/api/runtime-config

# From the host (if port 3000 is exposed)
curl http://localhost:3000/api/runtime-config
```

Expected response:
```json
{
  "gotrueUrl": "http://192.0.2.1:8000/auth/v1",
  "supabaseUrl": "http://192.0.2.1:8000",
  "apiUrl": "http://192.0.2.1:8000",
  "anonKey": "your-anon-key",
  "source": "derived",
  "environment": "production",
  "timestamp": 1234567890
}
```

### Check Container Logs

```bash
# View configuration logs
docker logs supabase-studio | grep "Runtime Config"

# Expected output:
# [Runtime Config API] ✓ Configuration loaded successfully
# [Runtime Config API] Source: derived
# [Runtime Config API] Environment: production
# [Runtime Config API] URLs: { gotrueUrl: '...', supabaseUrl: '...', apiUrl: '...' }
```

### Check Health Status

```bash
# Check container health
docker inspect supabase-studio | grep -A 10 Health

# Or use docker ps
docker ps --filter name=supabase-studio
```

## Troubleshooting

### Issue: Container health check failing

**Symptoms:**
- Container shows as "unhealthy" in `docker ps`
- Health check logs show errors

**Solution:**
1. Check if the runtime-config API is accessible:
   ```bash
   docker exec supabase-studio curl http://localhost:3000/api/runtime-config
   ```

2. Verify environment variables are set:
   ```bash
   docker exec supabase-studio env | grep SUPABASE
   ```

3. Check application logs:
   ```bash
   docker logs supabase-studio
   ```

### Issue: Frontend using localhost URLs in production

**Symptoms:**
- API requests fail with connection errors
- Browser console shows requests to `127.0.0.1`

**Solution:**
1. Verify `SUPABASE_PUBLIC_URL` is set correctly:
   ```bash
   docker exec supabase-studio env | grep SUPABASE_PUBLIC_URL
   ```

2. Check runtime configuration:
   ```bash
   curl http://your-server:3000/api/runtime-config
   ```

3. Ensure the URL is accessible from the browser (not just from the container)

### Issue: Configuration shows "default" source in production

**Symptoms:**
- Logs show: `Source: default`
- Application uses localhost URLs

**Solution:**
Set at least one of these environment variables:
- `SUPABASE_PUBLIC_URL` (recommended)
- `API_EXTERNAL_URL`
- `NEXT_PUBLIC_GOTRUE_URL`

### Issue: Invalid URL errors

**Symptoms:**
- Runtime config API returns 500 error
- Logs show "Invalid environment configuration"

**Solution:**
1. Ensure URLs are properly formatted:
   - Must start with `http://` or `https://`
   - Must not have trailing slashes
   - Must be valid URLs

2. Example of correct URLs:
   ```bash
   SUPABASE_PUBLIC_URL=http://192.0.2.1:8000
   API_EXTERNAL_URL=http://192.0.2.1:8000
   ```

## Migration from Build-time Configuration

If you're migrating from the old build-time configuration:

### Step 1: Update your docker-compose.yml

**Before:**
```yaml
services:
  studio:
    build:
      args:
        - NEXT_PUBLIC_GOTRUE_URL=http://192.0.2.1:8000/auth/v1
```

**After:**
```yaml
services:
  studio:
    environment:
      SUPABASE_PUBLIC_URL: http://192.0.2.1:8000
      API_EXTERNAL_URL: http://192.0.2.1:8000
```

### Step 2: Rebuild the image

```bash
docker compose -f docker-compose.yml -f ./prod/docker-compose.prod.yml build studio
```

### Step 3: Restart the container

```bash
docker compose -f docker-compose.yml -f ./prod/docker-compose.prod.yml up -d studio
```

### Step 4: Verify configuration

```bash
# Check runtime config
curl http://localhost:3000/api/runtime-config

# Check logs
docker logs supabase-studio | grep "Runtime Config"
```

## Environment-Specific Configurations

### Development

```bash
# Use defaults or set explicitly
SUPABASE_PUBLIC_URL=http://127.0.0.1:54321
API_EXTERNAL_URL=http://127.0.0.1:8000
```

### Staging

```bash
SUPABASE_PUBLIC_URL=https://staging-api.example.com
API_EXTERNAL_URL=https://staging-api.example.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key
```

### Production

```bash
SUPABASE_PUBLIC_URL=https://api.example.com
API_EXTERNAL_URL=https://api.example.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=production-anon-key
```

## Security Considerations

1. **Never commit secrets to version control**
   - Use `.env` files (add to `.gitignore`)
   - Use Docker secrets or environment variable injection

2. **Use HTTPS in production**
   - Always use `https://` URLs for production deployments
   - HTTP is only acceptable for local development

3. **Validate URLs**
   - The runtime config API validates all URLs
   - Only `http://` and `https://` schemes are allowed
   - Invalid URLs will cause the health check to fail

4. **Rotate keys regularly**
   - Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` periodically
   - Update `AUTH_JWT_SECRET` when compromised

## Additional Resources

- [Runtime Configuration API Documentation](./RUNTIME-CONFIG-ERROR-HANDLING.md)
- [Configuration Logging Guide](./CONFIGURATION-LOGGING.md)
- [Deployment Guide](../../PRODUCTION-DEPLOYMENT-GUIDE.md)
- [Environment Configuration Guide](../../ENV-CONFIG-GUIDE.md)
