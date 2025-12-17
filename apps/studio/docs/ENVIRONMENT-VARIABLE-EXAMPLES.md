# Environment Variable Configuration Examples

This guide provides complete examples of correct environment variable configurations for different deployment scenarios.

## Quick Reference

### Essential Variables by Environment

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `ENVIRONMENT` | `development` | `staging` | `production` |
| `NODE_ENV` | `development` | `production` | `production` |
| `SUPABASE_PUBLIC_URL` | `http://localhost:54321` | `https://staging.example.com` | `https://your-project.supabase.co` |
| `API_EXTERNAL_URL` | `http://localhost:8000` | `https://staging-api.example.com` | `https://api.example.com` |
| `NEXT_PUBLIC_GOTRUE_URL` | `http://localhost:54321/auth/v1` | `https://staging.example.com/auth/v1` | `https://your-project.supabase.co/auth/v1` |

## Complete Configuration Examples

### Production Environment

#### Standard Production Deployment

```bash
# .env.production
# Core Environment Configuration
ENVIRONMENT=production
NODE_ENV=production

# Supabase Configuration
SUPABASE_PUBLIC_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API Gateway Configuration
API_EXTERNAL_URL=https://api.your-domain.com
KONG_URL=https://api.your-domain.com

# Authentication Configuration
NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1
GOTRUE_URL=https://your-project.supabase.co/auth/v1

# Platform Configuration
NEXT_PUBLIC_IS_PLATFORM=true

# Security Configuration
NEXTAUTH_URL=https://studio.your-domain.com
NEXTAUTH_SECRET=your-nextauth-secret-here

# Database Configuration (if using direct connections)
DATABASE_URL=postgresql://user:password@db.your-domain.com:5432/postgres
POSTGRES_PASSWORD=your-secure-password

# Storage Configuration
STORAGE_BACKEND=s3
AWS_S3_BUCKET=your-production-bucket
AWS_REGION=us-east-1

# Monitoring and Logging
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

#### Self-Hosted Production

```bash
# .env.production.self-hosted
# Core Environment Configuration
ENVIRONMENT=production
NODE_ENV=production

# Self-Hosted Supabase Configuration
SUPABASE_PUBLIC_URL=https://supabase.your-domain.com
NEXT_PUBLIC_SUPABASE_URL=https://supabase.your-domain.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Self-Hosted API Configuration
API_EXTERNAL_URL=https://api.your-domain.com
KONG_URL=https://api.your-domain.com

# Self-Hosted Authentication
NEXT_PUBLIC_GOTRUE_URL=https://supabase.your-domain.com/auth/v1
GOTRUE_URL=https://supabase.your-domain.com/auth/v1

# Platform Configuration
NEXT_PUBLIC_IS_PLATFORM=false

# Self-Hosted Services
POSTGRES_HOST=postgres.your-domain.com
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password

# Redis Configuration
REDIS_URL=redis://redis.your-domain.com:6379

# Storage Configuration
STORAGE_BACKEND=file
STORAGE_FILE_PATH=/var/lib/storage

# SSL Configuration
SSL_CERT_PATH=/etc/ssl/certs/your-domain.crt
SSL_KEY_PATH=/etc/ssl/private/your-domain.key
```

### Staging Environment

#### Standard Staging Setup

```bash
# .env.staging
# Core Environment Configuration
ENVIRONMENT=staging
NODE_ENV=production

# Staging Supabase Configuration
SUPABASE_PUBLIC_URL=https://staging-your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://staging-your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key

# Staging API Configuration
API_EXTERNAL_URL=https://staging-api.your-domain.com
KONG_URL=https://staging-api.your-domain.com

# Staging Authentication
NEXT_PUBLIC_GOTRUE_URL=https://staging-your-project.supabase.co/auth/v1
GOTRUE_URL=https://staging-your-project.supabase.co/auth/v1

# Platform Configuration
NEXT_PUBLIC_IS_PLATFORM=true

# Staging-Specific Configuration
NEXTAUTH_URL=https://staging-studio.your-domain.com
NEXTAUTH_SECRET=staging-nextauth-secret

# Staging Database
DATABASE_URL=postgresql://user:password@staging-db.your-domain.com:5432/postgres

# Staging Storage
STORAGE_BACKEND=s3
AWS_S3_BUCKET=your-staging-bucket
AWS_REGION=us-east-1

# Staging Monitoring
LOG_LEVEL=debug
SENTRY_DSN=https://staging-sentry-dsn@sentry.io/staging-project-id
SENTRY_ENVIRONMENT=staging
```

#### Preview/Branch Staging

```bash
# .env.preview
# Core Environment Configuration
ENVIRONMENT=staging
NODE_ENV=production

# Branch-specific URLs (using branch name in subdomain)
SUPABASE_PUBLIC_URL=https://pr-123-your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://pr-123-your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-anon-key

# Preview API Configuration
API_EXTERNAL_URL=https://pr-123-api.your-domain.com
KONG_URL=https://pr-123-api.your-domain.com

# Preview Authentication
NEXT_PUBLIC_GOTRUE_URL=https://pr-123-your-project.supabase.co/auth/v1

# Preview-Specific Configuration
NEXTAUTH_URL=https://pr-123-studio.your-domain.com
NEXTAUTH_SECRET=preview-nextauth-secret

# Shared staging database with schema isolation
DATABASE_URL=postgresql://user:password@staging-db.your-domain.com:5432/postgres?schema=pr_123

# Preview storage with prefix
STORAGE_BACKEND=s3
AWS_S3_BUCKET=your-staging-bucket
STORAGE_S3_PREFIX=pr-123/

# Preview monitoring
LOG_LEVEL=debug
SENTRY_ENVIRONMENT=preview-pr-123
```

### Development Environment

#### Local Development

```bash
# .env.development
# Core Environment Configuration
ENVIRONMENT=development
NODE_ENV=development

# Local Supabase Configuration (docker-compose)
SUPABASE_PUBLIC_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# Local API Configuration
API_EXTERNAL_URL=http://localhost:8000
KONG_URL=http://localhost:8000

# Local Authentication
NEXT_PUBLIC_GOTRUE_URL=http://localhost:54321/auth/v1
GOTRUE_URL=http://kong:8000/auth/v1

# Platform Configuration
NEXT_PUBLIC_IS_PLATFORM=false

# Local Development Configuration
NEXTAUTH_URL=http://localhost:8082
NEXTAUTH_SECRET=local-development-secret

# Local Database (docker-compose)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
POSTGRES_PASSWORD=postgres

# Local Storage
STORAGE_BACKEND=file
STORAGE_FILE_PATH=./storage

# Development Monitoring
LOG_LEVEL=debug
DEBUG=true

# Development Features
ENABLE_DEV_TOOLS=true
HOT_RELOAD=true
```

#### Remote Development (connecting to staging)

```bash
# .env.development.remote
# Core Environment Configuration
ENVIRONMENT=development
NODE_ENV=development

# Connect to staging Supabase for development
SUPABASE_PUBLIC_URL=https://staging-your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://staging-your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key

# Connect to staging API
API_EXTERNAL_URL=https://staging-api.your-domain.com
KONG_URL=https://staging-api.your-domain.com

# Staging Authentication
NEXT_PUBLIC_GOTRUE_URL=https://staging-your-project.supabase.co/auth/v1

# Local Development Server
NEXTAUTH_URL=http://localhost:8082
NEXTAUTH_SECRET=local-development-secret

# Platform Configuration
NEXT_PUBLIC_IS_PLATFORM=true

# Development-specific overrides
LOG_LEVEL=debug
DEBUG=true
ENABLE_DEV_TOOLS=true
```

## Docker Configuration Examples

### Production Docker

#### Dockerfile with Environment Variables

```dockerfile
# Dockerfile.production
FROM node:18-alpine AS base

# Build-time arguments (must match environment variables)
ARG ENVIRONMENT=production
ARG NODE_ENV=production
ARG SUPABASE_PUBLIC_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG API_EXTERNAL_URL
ARG NEXT_PUBLIC_GOTRUE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_IS_PLATFORM

# Runtime environment variables
ENV ENVIRONMENT=${ENVIRONMENT}
ENV NODE_ENV=${NODE_ENV}
ENV SUPABASE_PUBLIC_URL=${SUPABASE_PUBLIC_URL}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV API_EXTERNAL_URL=${API_EXTERNAL_URL}
ENV NEXT_PUBLIC_GOTRUE_URL=${NEXT_PUBLIC_GOTRUE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_IS_PLATFORM=${NEXT_PUBLIC_IS_PLATFORM}

# Validate critical variables during build
RUN if [ -z "$ENVIRONMENT" ]; then echo "ERROR: ENVIRONMENT not set"; exit 1; fi
RUN if [ -z "$SUPABASE_PUBLIC_URL" ]; then echo "ERROR: SUPABASE_PUBLIC_URL not set"; exit 1; fi
RUN if [ "$SUPABASE_PUBLIC_URL" = "http://localhost:54321" ]; then echo "ERROR: Production build with localhost URL"; exit 1; fi

# Build application
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Verify environment detection
RUN npm run debug:env --no-recommendations || true

EXPOSE 3000
CMD ["npm", "start"]
```

#### Docker Compose Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  studio:
    build:
      context: .
      dockerfile: Dockerfile.production
      args:
        ENVIRONMENT: production
        NODE_ENV: production
        SUPABASE_PUBLIC_URL: ${SUPABASE_PUBLIC_URL}
        NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_PUBLIC_URL}
        API_EXTERNAL_URL: ${API_EXTERNAL_URL}
        NEXT_PUBLIC_GOTRUE_URL: ${NEXT_PUBLIC_GOTRUE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
        NEXT_PUBLIC_IS_PLATFORM: "true"
    environment:
      # Runtime environment variables
      ENVIRONMENT: production
      NODE_ENV: production
      SUPABASE_PUBLIC_URL: ${SUPABASE_PUBLIC_URL}
      NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_PUBLIC_URL}
      API_EXTERNAL_URL: ${API_EXTERNAL_URL}
      NEXT_PUBLIC_GOTRUE_URL: ${NEXT_PUBLIC_GOTRUE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      NEXT_PUBLIC_IS_PLATFORM: "true"
      DATABASE_URL: ${DATABASE_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "npm", "run", "config:health:quick"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

### Development Docker

#### Docker Compose Development

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  studio:
    build:
      context: .
      dockerfile: Dockerfile.dev
      args:
        ENVIRONMENT: development
        NODE_ENV: development
    environment:
      ENVIRONMENT: development
      NODE_ENV: development
      SUPABASE_PUBLIC_URL: http://localhost:54321
      NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
      API_EXTERNAL_URL: http://localhost:8000
      NEXT_PUBLIC_GOTRUE_URL: http://localhost:54321/auth/v1
      NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
      NEXT_PUBLIC_IS_PLATFORM: "false"
      DEBUG: "true"
      LOG_LEVEL: debug
    ports:
      - "8082:8082"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - kong
      - gotrue
      - postgres
    networks:
      - supabase-network

  # Local Supabase services
  kong:
    image: kong:2.8.1
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
    ports:
      - "8000:8000"
    volumes:
      - ./docker/volumes/api/kong.yml:/var/lib/kong/kong.yml
    networks:
      - supabase-network

  gotrue:
    image: supabase/gotrue:v2.99.0
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:postgres@postgres:5432/postgres
      GOTRUE_SITE_URL: http://localhost:8082
      GOTRUE_URI_ALLOW_LIST: "*"
      GOTRUE_JWT_SECRET: super-secret-jwt-token-with-at-least-32-characters-long
      GOTRUE_JWT_EXP: 3600
    ports:
      - "9999:9999"
    depends_on:
      - postgres
    networks:
      - supabase-network

  postgres:
    image: supabase/postgres:15.1.0.117
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    ports:
      - "54322:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - supabase-network

volumes:
  postgres-data:

networks:
  supabase-network:
    driver: bridge
```

## Platform-Specific Examples

### Vercel Deployment

```bash
# .env.production (Vercel)
ENVIRONMENT=production
NODE_ENV=production

# Vercel automatically provides VERCEL_URL
NEXTAUTH_URL=https://your-app.vercel.app

# Supabase Configuration
SUPABASE_PUBLIC_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API Configuration
API_EXTERNAL_URL=https://your-project.supabase.co
NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1

# Platform Configuration
NEXT_PUBLIC_IS_PLATFORM=true

# Vercel-specific
VERCEL_ENV=production
```

### Railway Deployment

```bash
# Railway Environment Variables
ENVIRONMENT=production
NODE_ENV=production

# Railway provides RAILWAY_STATIC_URL
NEXTAUTH_URL=${{RAILWAY_STATIC_URL}}

# Supabase Configuration
SUPABASE_PUBLIC_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API Configuration
API_EXTERNAL_URL=https://your-project.supabase.co
NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1

# Platform Configuration
NEXT_PUBLIC_IS_PLATFORM=true

# Railway-specific
RAILWAY_ENVIRONMENT=production
```

### AWS ECS/Fargate

```bash
# AWS ECS Task Definition Environment Variables
ENVIRONMENT=production
NODE_ENV=production

# Load Balancer URL
NEXTAUTH_URL=https://studio.your-domain.com

# Supabase Configuration
SUPABASE_PUBLIC_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API Configuration (ALB)
API_EXTERNAL_URL=https://api.your-domain.com
NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1

# Platform Configuration
NEXT_PUBLIC_IS_PLATFORM=true

# AWS-specific
AWS_REGION=us-east-1
AWS_DEFAULT_REGION=us-east-1
```

## Validation and Testing

### Environment Variable Validation Script

```bash
#!/bin/bash
# validate-env.sh

echo "Validating environment variables..."

# Check required variables
REQUIRED_VARS=(
  "ENVIRONMENT"
  "SUPABASE_PUBLIC_URL"
  "API_EXTERNAL_URL"
  "NEXT_PUBLIC_GOTRUE_URL"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  echo "❌ Missing required environment variables:"
  printf '  %s\n' "${MISSING_VARS[@]}"
  exit 1
fi

# Validate environment-specific requirements
if [ "$ENVIRONMENT" = "production" ]; then
  # Check for localhost URLs in production
  if [[ "$SUPABASE_PUBLIC_URL" == *"localhost"* ]] || [[ "$API_EXTERNAL_URL" == *"localhost"* ]]; then
    echo "❌ Production environment cannot use localhost URLs"
    exit 1
  fi
  
  # Check for HTTPS in production
  if [[ "$SUPABASE_PUBLIC_URL" != "https://"* ]] || [[ "$API_EXTERNAL_URL" != "https://"* ]]; then
    echo "⚠️  Warning: Production should use HTTPS URLs"
  fi
fi

echo "✅ Environment variables validation passed"

# Test environment detection
echo "Testing environment detection..."
pnpm debug:env --no-recommendations

if [ $? -eq 0 ]; then
  echo "✅ Environment detection test passed"
else
  echo "❌ Environment detection test failed"
  exit 1
fi
```

### Testing Different Configurations

```bash
# Test production configuration
ENVIRONMENT=production \
SUPABASE_PUBLIC_URL=https://your-project.supabase.co \
API_EXTERNAL_URL=https://api.your-domain.com \
NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1 \
pnpm debug:env

# Test development configuration
ENVIRONMENT=development \
SUPABASE_PUBLIC_URL=http://localhost:54321 \
API_EXTERNAL_URL=http://localhost:8000 \
NEXT_PUBLIC_GOTRUE_URL=http://localhost:54321/auth/v1 \
pnpm debug:env

# Test staging configuration
ENVIRONMENT=staging \
SUPABASE_PUBLIC_URL=https://staging.your-domain.com \
API_EXTERNAL_URL=https://staging-api.your-domain.com \
NEXT_PUBLIC_GOTRUE_URL=https://staging.your-domain.com/auth/v1 \
pnpm debug:env
```

## Common Mistakes to Avoid

### ❌ Incorrect Configurations

```bash
# DON'T: Mixed localhost and production URLs
ENVIRONMENT=production
SUPABASE_PUBLIC_URL=http://localhost:54321  # ❌ localhost in production
API_EXTERNAL_URL=https://api.your-domain.com

# DON'T: Missing ENVIRONMENT variable
NODE_ENV=production  # ❌ Only NODE_ENV, no explicit ENVIRONMENT
SUPABASE_PUBLIC_URL=https://your-project.supabase.co

# DON'T: Inconsistent URL schemes
SUPABASE_PUBLIC_URL=https://your-project.supabase.co  # ✅ HTTPS
API_EXTERNAL_URL=http://api.your-domain.com           # ❌ HTTP in production

# DON'T: Wrong staging patterns
ENVIRONMENT=staging
SUPABASE_PUBLIC_URL=https://your-project.supabase.co  # ❌ Production URL in staging
```

### ✅ Correct Configurations

```bash
# ✅ Consistent production configuration
ENVIRONMENT=production
NODE_ENV=production
SUPABASE_PUBLIC_URL=https://your-project.supabase.co
API_EXTERNAL_URL=https://api.your-domain.com
NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1

# ✅ Proper development configuration
ENVIRONMENT=development
NODE_ENV=development
SUPABASE_PUBLIC_URL=http://localhost:54321
API_EXTERNAL_URL=http://localhost:8000
NEXT_PUBLIC_GOTRUE_URL=http://localhost:54321/auth/v1

# ✅ Clear staging configuration
ENVIRONMENT=staging
NODE_ENV=production
SUPABASE_PUBLIC_URL=https://staging-your-project.supabase.co
API_EXTERNAL_URL=https://staging-api.your-domain.com
NEXT_PUBLIC_GOTRUE_URL=https://staging-your-project.supabase.co/auth/v1
```

## Related Documentation

- [Environment Detection Troubleshooting](./ENVIRONMENT-DETECTION-TROUBLESHOOTING.md)
- [Environment Detection Overview](./ENVIRONMENT-DETECTION.md)
- [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)
- [Configuration Logging Guide](./CONFIGURATION-LOGGING.md)