# Runtime Configuration Examples

This document provides complete, working examples of runtime configuration for different deployment scenarios.

## Table of Contents

1. [Local Development](#local-development)
2. [Docker Compose Development](#docker-compose-development)
3. [Production with Public IP](#production-with-public-ip)
4. [Production with Domain Name](#production-with-domain-name)
5. [Staging Environment](#staging-environment)
6. [Multi-Environment Setup](#multi-environment-setup)
7. [Kubernetes Deployment](#kubernetes-deployment)
8. [Cloud Provider Examples](#cloud-provider-examples)

## Local Development

### Minimal Configuration

For local development with default settings:

```bash
# apps/studio/.env
# No configuration needed - uses defaults
# Defaults to http://127.0.0.1:54321 for all services
```

### Explicit Local Configuration

If you want to be explicit about local URLs:

```bash
# apps/studio/.env
SUPABASE_PUBLIC_URL=http://127.0.0.1:54321
API_EXTERNAL_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# Database configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_PASSWORD=postgres
```

### Running Locally

```bash
# Start local Supabase stack
cd docker
docker compose up -d

# Start Studio
cd ../apps/studio
pnpm install
pnpm run dev

# Access at http://localhost:8082
```

## Docker Compose Development

### docker-compose.dev.yml

```yaml
version: '3.8'

services:
  studio:
    image: supabase/studio:latest
    ports:
      - "3000:3000"
    environment:
      # Runtime configuration (uses localhost for development)
      SUPABASE_PUBLIC_URL: http://127.0.0.1:54321
      API_EXTERNAL_URL: http://127.0.0.1:8000
      
      # API keys
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SERVICE_KEY}
      
      # Database configuration
      POSTGRES_HOST: db
      POSTGRES_PORT: 5432
      POSTGRES_DB: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      
      # JWT configuration
      AUTH_JWT_SECRET: ${JWT_SECRET}
      
      # pg-meta configuration
      STUDIO_PG_META_URL: http://meta:8080
      PG_META_CRYPTO_KEY: ${PG_META_CRYPTO_KEY}
    depends_on:
      - db
      - kong
      - gotrue
    networks:
      - supabase

networks:
  supabase:
    driver: bridge
```

### .env file for development

```bash
# docker/.env

# API Keys (from docker/volumes/api/kong.yml)
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Database
POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password

# JWT Secret (must be at least 32 characters)
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long

# pg-meta encryption key (must be at least 32 characters)
PG_META_CRYPTO_KEY=your-encryption-key-at-least-32-characters-long
```

### Running

```bash
cd docker
docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml up -d
```

## Production with Public IP

### docker-compose.prod.yml

```yaml
version: '3.8'

services:
  studio:
    image: supabase/studio:latest
    ports:
      - "3000:3000"
    environment:
      # Runtime configuration (production IP)
      SUPABASE_PUBLIC_URL: http://192.0.2.1:8000
      API_EXTERNAL_URL: http://192.0.2.1:8000
      
      # API keys (use production keys!)
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SERVICE_KEY}
      
      # Database configuration
      POSTGRES_HOST: db
      POSTGRES_PORT: 5432
      POSTGRES_DB: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      
      # JWT configuration
      AUTH_JWT_SECRET: ${JWT_SECRET}
      
      # pg-meta configuration
      STUDIO_PG_META_URL: http://meta:8080
      PG_META_CRYPTO_KEY: ${PG_META_CRYPTO_KEY}
      
      # Environment
      NODE_ENV: production
    restart: unless-stopped
    depends_on:
      - db
      - kong
      - gotrue
    networks:
      - supabase
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/runtime-config').then((r) => {if (r.status !== 200) throw new Error('Health check failed')})"]
      interval: 10s
      timeout: 5s
      retries: 3

networks:
  supabase:
    driver: bridge
```

### .env file for production

```bash
# docker/.env

# IMPORTANT: Replace these with your actual production values!

# Public IP or domain
PUBLIC_IP=192.0.2.1

# API Keys (generate new ones for production!)
ANON_KEY=your-production-anon-key-here
SERVICE_KEY=your-production-service-key-here

# Database (use strong password!)
POSTGRES_PASSWORD=your-very-strong-production-password-at-least-32-chars

# JWT Secret (generate a new one for production!)
JWT_SECRET=your-production-jwt-secret-at-least-32-characters-long

# pg-meta encryption key (generate a new one for production!)
PG_META_CRYPTO_KEY=your-production-encryption-key-at-least-32-chars
```

### Generating Production Keys

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate pg-meta crypto key
openssl rand -base64 32

# Generate anon key (use Supabase JWT generator or create manually)
# Visit: https://supabase.com/docs/guides/hosting/overview#api-keys
```

### Running

```bash
cd docker
docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml up -d

# Verify configuration
curl http://192.0.2.1:3000/api/runtime-config

# Check logs
docker logs supabase-studio | grep "Runtime Config"
```

## Production with Domain Name

### docker-compose.prod.yml with SSL

```yaml
version: '3.8'

services:
  studio:
    image: supabase/studio:latest
    ports:
      - "3000:3000"
    environment:
      # Runtime configuration (domain with HTTPS)
      SUPABASE_PUBLIC_URL: https://api.example.com
      API_EXTERNAL_URL: https://api.example.com
      
      # API keys
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SERVICE_KEY}
      
      # Database configuration
      POSTGRES_HOST: db
      POSTGRES_PORT: 5432
      POSTGRES_DB: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      
      # JWT configuration
      AUTH_JWT_SECRET: ${JWT_SECRET}
      
      # pg-meta configuration
      STUDIO_PG_META_URL: http://meta:8080
      PG_META_CRYPTO_KEY: ${PG_META_CRYPTO_KEY}
      
      # Environment
      NODE_ENV: production
    restart: unless-stopped
    depends_on:
      - db
      - kong
      - gotrue
    networks:
      - supabase

  # Nginx reverse proxy with SSL
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - studio
      - kong
    networks:
      - supabase

networks:
  supabase:
    driver: bridge
```

### nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    upstream studio {
        server studio:3000;
    }

    upstream kong {
        server kong:8000;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name api.example.com studio.example.com;
        return 301 https://$server_name$request_uri;
    }

    # Studio (HTTPS)
    server {
        listen 443 ssl http2;
        server_name studio.example.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location / {
            proxy_pass http://studio;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # API Gateway (HTTPS)
    server {
        listen 443 ssl http2;
        server_name api.example.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location / {
            proxy_pass http://kong;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### .env file

```bash
# docker/.env

# Domain configuration
DOMAIN=example.com
STUDIO_URL=https://studio.example.com
API_URL=https://api.example.com

# API Keys
ANON_KEY=your-production-anon-key
SERVICE_KEY=your-production-service-key

# Database
POSTGRES_PASSWORD=your-strong-password

# JWT Secret
JWT_SECRET=your-jwt-secret

# pg-meta encryption key
PG_META_CRYPTO_KEY=your-encryption-key
```

## Staging Environment

### docker-compose.staging.yml

```yaml
version: '3.8'

services:
  studio:
    image: supabase/studio:latest
    ports:
      - "3000:3000"
    environment:
      # Runtime configuration (staging URLs)
      SUPABASE_PUBLIC_URL: https://staging-api.example.com
      API_EXTERNAL_URL: https://staging-api.example.com
      
      # Staging API keys
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${STAGING_ANON_KEY}
      SUPABASE_SERVICE_KEY: ${STAGING_SERVICE_KEY}
      
      # Database configuration
      POSTGRES_HOST: db
      POSTGRES_PORT: 5432
      POSTGRES_DB: postgres
      POSTGRES_PASSWORD: ${STAGING_POSTGRES_PASSWORD}
      
      # JWT configuration
      AUTH_JWT_SECRET: ${STAGING_JWT_SECRET}
      
      # pg-meta configuration
      STUDIO_PG_META_URL: http://meta:8080
      PG_META_CRYPTO_KEY: ${STAGING_PG_META_CRYPTO_KEY}
      
      # Environment
      NODE_ENV: staging
    restart: unless-stopped
    depends_on:
      - db
      - kong
      - gotrue
    networks:
      - supabase

networks:
  supabase:
    driver: bridge
```

### .env.staging

```bash
# docker/.env.staging

# Staging URLs
SUPABASE_PUBLIC_URL=https://staging-api.example.com
API_EXTERNAL_URL=https://staging-api.example.com

# Staging API Keys (different from production!)
STAGING_ANON_KEY=staging-anon-key-here
STAGING_SERVICE_KEY=staging-service-key-here

# Staging Database
STAGING_POSTGRES_PASSWORD=staging-password

# Staging JWT Secret
STAGING_JWT_SECRET=staging-jwt-secret

# Staging pg-meta encryption key
STAGING_PG_META_CRYPTO_KEY=staging-encryption-key
```

## Multi-Environment Setup

### Directory Structure

```
project/
├── docker/
│   ├── .env.development
│   ├── .env.staging
│   ├── .env.production
│   ├── docker-compose.yml (base)
│   ├── dev/
│   │   └── docker-compose.dev.yml
│   ├── staging/
│   │   └── docker-compose.staging.yml
│   └── prod/
│       └── docker-compose.prod.yml
```

### Deployment Scripts

```bash
#!/bin/bash
# deploy-dev.sh

cd docker
docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml --env-file .env.development up -d
```

```bash
#!/bin/bash
# deploy-staging.sh

cd docker
docker compose -f docker-compose.yml -f staging/docker-compose.staging.yml --env-file .env.staging up -d
```

```bash
#!/bin/bash
# deploy-prod.sh

cd docker
docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml --env-file .env.production up -d
```

## Kubernetes Deployment

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: studio-config
  namespace: supabase
data:
  SUPABASE_PUBLIC_URL: "https://api.example.com"
  API_EXTERNAL_URL: "https://api.example.com"
  POSTGRES_HOST: "postgres-service"
  POSTGRES_PORT: "5432"
  POSTGRES_DB: "postgres"
  STUDIO_PG_META_URL: "http://pg-meta-service:8080"
  NODE_ENV: "production"
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: studio-secrets
  namespace: supabase
type: Opaque
stringData:
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "your-anon-key"
  SUPABASE_SERVICE_KEY: "your-service-key"
  POSTGRES_PASSWORD: "your-postgres-password"
  AUTH_JWT_SECRET: "your-jwt-secret"
  PG_META_CRYPTO_KEY: "your-encryption-key"
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: studio
  namespace: supabase
spec:
  replicas: 2
  selector:
    matchLabels:
      app: studio
  template:
    metadata:
      labels:
        app: studio
    spec:
      containers:
      - name: studio
        image: supabase/studio:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: studio-config
        - secretRef:
            name: studio-secrets
        livenessProbe:
          httpGet:
            path: /api/runtime-config
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/runtime-config
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: studio-service
  namespace: supabase
spec:
  selector:
    app: studio
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Cloud Provider Examples

### AWS ECS

```json
{
  "family": "supabase-studio",
  "containerDefinitions": [
    {
      "name": "studio",
      "image": "supabase/studio:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "SUPABASE_PUBLIC_URL",
          "value": "https://api.example.com"
        },
        {
          "name": "API_EXTERNAL_URL",
          "value": "https://api.example.com"
        },
        {
          "name": "POSTGRES_HOST",
          "value": "postgres.example.com"
        },
        {
          "name": "POSTGRES_PORT",
          "value": "5432"
        },
        {
          "name": "POSTGRES_DB",
          "value": "postgres"
        },
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:anon-key"
        },
        {
          "name": "SUPABASE_SERVICE_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:service-key"
        },
        {
          "name": "POSTGRES_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:postgres-password"
        },
        {
          "name": "AUTH_JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:jwt-secret"
        }
      ],
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:3000/api/runtime-config || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

### Google Cloud Run

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: studio
spec:
  template:
    spec:
      containers:
      - image: supabase/studio:latest
        ports:
        - containerPort: 3000
        env:
        - name: SUPABASE_PUBLIC_URL
          value: "https://api.example.com"
        - name: API_EXTERNAL_URL
          value: "https://api.example.com"
        - name: POSTGRES_HOST
          value: "postgres-instance"
        - name: POSTGRES_PORT
          value: "5432"
        - name: POSTGRES_DB
          value: "postgres"
        - name: NODE_ENV
          value: "production"
        - name: NEXT_PUBLIC_SUPABASE_ANON_KEY
          valueFrom:
            secretKeyRef:
              name: studio-secrets
              key: anon-key
        - name: SUPABASE_SERVICE_KEY
          valueFrom:
            secretKeyRef:
              name: studio-secrets
              key: service-key
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: studio-secrets
              key: postgres-password
        - name: AUTH_JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: studio-secrets
              key: jwt-secret
```

### Azure Container Instances

```json
{
  "location": "eastus",
  "properties": {
    "containers": [
      {
        "name": "studio",
        "properties": {
          "image": "supabase/studio:latest",
          "ports": [
            {
              "port": 3000,
              "protocol": "TCP"
            }
          ],
          "environmentVariables": [
            {
              "name": "SUPABASE_PUBLIC_URL",
              "value": "https://api.example.com"
            },
            {
              "name": "API_EXTERNAL_URL",
              "value": "https://api.example.com"
            },
            {
              "name": "POSTGRES_HOST",
              "value": "postgres.database.azure.com"
            },
            {
              "name": "POSTGRES_PORT",
              "value": "5432"
            },
            {
              "name": "POSTGRES_DB",
              "value": "postgres"
            },
            {
              "name": "NODE_ENV",
              "value": "production"
            },
            {
              "name": "NEXT_PUBLIC_SUPABASE_ANON_KEY",
              "secureValue": "your-anon-key"
            },
            {
              "name": "SUPABASE_SERVICE_KEY",
              "secureValue": "your-service-key"
            },
            {
              "name": "POSTGRES_PASSWORD",
              "secureValue": "your-postgres-password"
            },
            {
              "name": "AUTH_JWT_SECRET",
              "secureValue": "your-jwt-secret"
            }
          ],
          "resources": {
            "requests": {
              "cpu": 1,
              "memoryInGB": 1.5
            }
          }
        }
      }
    ],
    "osType": "Linux",
    "ipAddress": {
      "type": "Public",
      "ports": [
        {
          "port": 3000,
          "protocol": "TCP"
        }
      ]
    }
  }
}
```

## Verification

After deploying with any of these configurations, verify:

```bash
# Check runtime configuration
curl http://your-server/api/runtime-config

# Expected response structure:
# {
#   "gotrueUrl": "...",
#   "supabaseUrl": "...",
#   "apiUrl": "...",
#   "anonKey": "...",
#   "source": "explicit" or "derived",
#   "environment": "production" or "staging" or "development",
#   "timestamp": 1234567890
# }

# Verify no localhost URLs in production
curl http://your-server/api/runtime-config | grep -i "localhost"
# Should return nothing

# Check logs
docker logs supabase-studio | grep "Runtime Config"
# Should show successful configuration load
```

## Related Documentation

- [Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)
- [Required Environment Variables](./REQUIRED-ENV-VARS.md)
- [Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md)
- [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)
