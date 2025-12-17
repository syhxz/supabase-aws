# Required Environment Variables for Studio

## Quick Reference

This document lists all required environment variables for running Supabase Studio in Docker.

## Core Runtime Configuration

These variables control how the Studio frontend connects to backend services:

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `SUPABASE_PUBLIC_URL` | Yes (Production) | `http://127.0.0.1:54321` | Public-facing URL for Supabase API | `http://192.0.2.1:8000` |
| `API_EXTERNAL_URL` | Yes (Production) | `http://127.0.0.1:8000` | External API gateway URL | `http://192.0.2.1:8000` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | None | Anonymous API key for authentication | `eyJhbGci...` |
| `AUTH_JWT_SECRET` | Yes | None | JWT secret for token validation | `your-super-secret-jwt-token` |

## Database Configuration

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `POSTGRES_HOST` | Yes | `db` | PostgreSQL host | `db` or `localhost` |
| `POSTGRES_PORT` | Yes | `5432` | PostgreSQL port | `5432` |
| `POSTGRES_DB` | Yes | `postgres` | PostgreSQL database name | `postgres` |
| `POSTGRES_PASSWORD` | Yes | None | PostgreSQL password | `your-password` |
| `PG_META_CRYPTO_KEY` | Yes | None | Encryption key for pg-meta | `your-encryption-key-32-chars-min` |

## Service Configuration

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `STUDIO_PG_META_URL` | Yes | `http://meta:8080` | URL for pg-meta service | `http://meta:8080` |
| `SUPABASE_SERVICE_KEY` | Yes | None | Service role key | `eyJhbGci...` |
| `LOGFLARE_URL` | No | `http://analytics:4000` | Analytics service URL | `http://analytics:4000` |

## Optional Configuration

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `NEXT_PUBLIC_GOTRUE_URL` | No | Derived | Explicit GoTrue URL (overrides derivation) | `http://192.0.2.1:8000/auth/v1` |
| `DEFAULT_ORGANIZATION_NAME` | No | `Default Organization` | Default organization name | `My Company` |
| `DEFAULT_PROJECT_NAME` | No | `Default Project` | Default project name | `My Project` |
| `OPENAI_API_KEY` | No | None | OpenAI API key for SQL assistant | `sk-...` |

## Environment-Specific Examples

### Development (Local Docker)

```bash
# Minimal configuration for local development
SUPABASE_PUBLIC_URL=http://127.0.0.1:54321
API_EXTERNAL_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
AUTH_JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
POSTGRES_PASSWORD=postgres
```

### Production (Public IP)

```bash
# Production configuration with public IP
SUPABASE_PUBLIC_URL=http://192.0.2.1:8000
API_EXTERNAL_URL=http://192.0.2.1:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
AUTH_JWT_SECRET=your-production-jwt-secret
POSTGRES_PASSWORD=your-secure-password
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres
PG_META_CRYPTO_KEY=your-encryption-key-32-chars-min
```

### Production (Domain Name)

```bash
# Production configuration with domain
SUPABASE_PUBLIC_URL=https://api.example.com
API_EXTERNAL_URL=https://api.example.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
AUTH_JWT_SECRET=your-production-jwt-secret
POSTGRES_PASSWORD=your-secure-password
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres
PG_META_CRYPTO_KEY=your-encryption-key-32-chars-min
```

## Configuration Priority

The Studio frontend resolves configuration using this priority order:

1. **Explicit environment variables** (highest priority)
   - `NEXT_PUBLIC_GOTRUE_URL` - if set, used directly
   - `API_EXTERNAL_URL` - used for API gateway URL

2. **Derived from base URL**
   - `SUPABASE_PUBLIC_URL` + `/auth/v1` → GoTrue URL
   - `SUPABASE_PUBLIC_URL` → API URL

3. **Development defaults** (lowest priority)
   - `http://127.0.0.1:54321/auth/v1` (GoTrue)
   - `http://127.0.0.1:8000` (API)

## Validation

The runtime configuration API validates all URLs:

- ✅ Must start with `http://` or `https://`
- ✅ Must be properly formatted URLs
- ✅ Must not have trailing slashes (automatically removed)
- ❌ Other schemes (ftp://, file://, etc.) are rejected

## Checking Your Configuration

### View Runtime Configuration

```bash
# From inside the container
curl http://localhost:3000/api/runtime-config

# From the host (if port 3000 is exposed)
curl http://localhost:3000/api/runtime-config
```

### View Environment Variables

```bash
# List all Studio environment variables
docker exec supabase-studio env | grep -E "SUPABASE|API_EXTERNAL|POSTGRES|AUTH_JWT"
```

### Check Container Logs

```bash
# View configuration logs
docker logs supabase-studio | grep "Runtime Config"
```

## Common Issues

### Issue: "Using development defaults in production"

**Cause:** No runtime configuration variables are set

**Solution:** Set `SUPABASE_PUBLIC_URL` or `API_EXTERNAL_URL`

```bash
SUPABASE_PUBLIC_URL=http://192.0.2.1:8000
API_EXTERNAL_URL=http://192.0.2.1:8000
```

### Issue: "Invalid environment configuration"

**Cause:** URL format is invalid

**Solution:** Ensure URLs are properly formatted:
- ✅ `http://192.0.2.1:8000`
- ✅ `https://api.example.com`
- ❌ `192.0.2.1:8000` (missing protocol)
- ❌ `http://192.0.2.1:8000/` (trailing slash)

### Issue: Health check failing

**Cause:** Runtime configuration API is not accessible

**Solution:** 
1. Check if the container is running: `docker ps`
2. Check logs: `docker logs supabase-studio`
3. Verify environment variables: `docker exec supabase-studio env`

## Security Best Practices

1. **Never commit secrets to version control**
   - Use `.env` files (add to `.gitignore`)
   - Use Docker secrets or environment variable injection

2. **Use strong passwords and keys**
   - `POSTGRES_PASSWORD`: At least 32 characters
   - `AUTH_JWT_SECRET`: At least 32 characters
   - `PG_META_CRYPTO_KEY`: At least 32 characters

3. **Use HTTPS in production**
   - Always use `https://` URLs for production
   - HTTP is only acceptable for local development

4. **Rotate keys regularly**
   - Update keys periodically
   - Update immediately if compromised

## Additional Resources

- [Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)
- [Runtime Configuration Error Handling](./RUNTIME-CONFIG-ERROR-HANDLING.md)
- [Configuration Logging](./CONFIGURATION-LOGGING.md)
- [Production Deployment Guide](../../PRODUCTION-DEPLOYMENT-GUIDE.md)
