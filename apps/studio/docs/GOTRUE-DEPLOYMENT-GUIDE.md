# GoTrue Authentication Service Deployment Guide

This guide provides comprehensive instructions for configuring the GoTrue authentication service URL across different deployment environments.

## Table of Contents

- [Overview](#overview)
- [URL Resolution Priority](#url-resolution-priority)
- [Deployment Scenarios](#deployment-scenarios)
  - [Local Development (Docker)](#local-development-docker)
  - [Docker Compose Production](#docker-compose-production)
  - [Vercel Deployment](#vercel-deployment)
  - [AWS/Cloud Deployment](#awscloud-deployment)
  - [Kubernetes Deployment](#kubernetes-deployment)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)

## Overview

The GoTrue authentication service is a critical component of Supabase Studio. Proper configuration of the GoTrue URL ensures that authentication operations (signup, login, session management) work correctly in all environments.

The system uses a flexible URL resolution strategy that automatically adapts to different deployment scenarios while allowing explicit configuration when needed.

## URL Resolution Priority

The GoTrue URL is resolved using the following priority order (highest to lowest):

1. **`NEXT_PUBLIC_GOTRUE_URL`** - Explicit configuration (highest priority)
2. **`SUPABASE_PUBLIC_URL + '/auth/v1'`** - Derived from public URL
3. **`SUPABASE_URL + '/auth/v1'`** - Derived from internal URL
4. **`http://127.0.0.1:54321/auth/v1`** - Development default (lowest priority)

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│  URL Resolution Flow                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Check NEXT_PUBLIC_GOTRUE_URL                       │
│     ├─ Set? → Use it (explicit configuration)          │
│     └─ Not set? → Continue to step 2                   │
│                                                         │
│  2. Check SUPABASE_PUBLIC_URL                          │
│     ├─ Set? → Append '/auth/v1' and use               │
│     └─ Not set? → Continue to step 3                   │
│                                                         │
│  3. Check SUPABASE_URL                                 │
│     ├─ Set? → Append '/auth/v1' and use               │
│     └─ Not set? → Continue to step 4                   │
│                                                         │
│  4. Use development default                            │
│     └─ http://127.0.0.1:54321/auth/v1                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Deployment Scenarios

### Local Development (Docker)

For local development using Docker Compose, the default configuration works out of the box.

**Configuration:**

```bash
# .env file
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLIC_URL=http://127.0.0.1:54321

# Optional: Explicit GoTrue URL (not required for local development)
# NEXT_PUBLIC_GOTRUE_URL=http://127.0.0.1:54321/auth/v1
```

**Verification:**

```bash
# Start Docker services
cd docker
docker-compose up -d

# Check GoTrue is accessible
curl http://127.0.0.1:54321/auth/v1/health

# Expected response: {"version":"...","name":"GoTrue"}
```

**Notes:**
- The system automatically derives the GoTrue URL from `SUPABASE_URL`
- No explicit `NEXT_PUBLIC_GOTRUE_URL` configuration is needed
- Logs will show: `GoTrue URL resolved: http://127.0.0.1:54321/auth/v1 (source: derived)`

---

### Docker Compose Production

For production deployments using Docker Compose with custom domains.

**Configuration:**

```bash
# .env file
SUPABASE_URL=https://api.yourcompany.com
SUPABASE_PUBLIC_URL=https://api.yourcompany.com
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_KEY=your-production-service-key

# Optional: Explicit GoTrue URL if using a different domain
# NEXT_PUBLIC_GOTRUE_URL=https://auth.yourcompany.com/auth/v1
```

**Docker Compose Setup:**

```yaml
# docker-compose.yml
version: '3.8'

services:
  studio:
    image: supabase/studio:latest
    environment:
      - SUPABASE_URL=https://api.yourcompany.com
      - SUPABASE_PUBLIC_URL=https://api.yourcompany.com
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      # Only set if using a different auth domain
      # - NEXT_PUBLIC_GOTRUE_URL=https://auth.yourcompany.com/auth/v1
    ports:
      - "3000:3000"
    networks:
      - supabase-network

  gotrue:
    image: supabase/gotrue:latest
    environment:
      - GOTRUE_SITE_URL=https://yourcompany.com
      - GOTRUE_JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=${DATABASE_URL}
    networks:
      - supabase-network

networks:
  supabase-network:
    driver: bridge
```

**Verification:**

```bash
# Check GoTrue health endpoint
curl https://api.yourcompany.com/auth/v1/health

# Check Studio logs for URL resolution
docker-compose logs studio | grep "GoTrue URL resolved"
```

---

### Vercel Deployment

For deploying Studio to Vercel with a separate Supabase backend.

**Configuration:**

Add environment variables in Vercel dashboard or `vercel.json`:

```json
{
  "env": {
    "SUPABASE_URL": "https://your-project.supabase.co",
    "SUPABASE_PUBLIC_URL": "https://your-project.supabase.co",
    "SUPABASE_ANON_KEY": "@supabase-anon-key",
    "SUPABASE_SERVICE_KEY": "@supabase-service-key",
    "NEXT_PUBLIC_SITE_URL": "https://studio.yourcompany.com"
  }
}
```

**Using Vercel CLI:**

```bash
# Set environment variables
vercel env add SUPABASE_URL production
# Enter: https://your-project.supabase.co

vercel env add SUPABASE_PUBLIC_URL production
# Enter: https://your-project.supabase.co

vercel env add SUPABASE_ANON_KEY production
# Enter: your-anon-key

vercel env add SUPABASE_SERVICE_KEY production
# Enter: your-service-key

# Deploy
vercel --prod
```

**Verification:**

```bash
# Check deployment logs
vercel logs --follow

# Test authentication endpoint
curl https://studio.yourcompany.com/api/platform/signup \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

**Notes:**
- Vercel automatically injects environment variables at build time
- The GoTrue URL is derived from `SUPABASE_PUBLIC_URL`
- Ensure `NEXT_PUBLIC_GOTRUE_URL` is NOT set unless using a custom auth domain

---

### AWS/Cloud Deployment

For deployments on AWS (EC2, ECS, Lambda) or other cloud providers.

**Configuration:**

```bash
# .env.production
SUPABASE_URL=https://api.yourcompany.com
SUPABASE_PUBLIC_URL=https://api.yourcompany.com
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_KEY=your-production-service-key
NEXT_PUBLIC_SITE_URL=https://studio.yourcompany.com

# Optional: If GoTrue is on a separate domain
# NEXT_PUBLIC_GOTRUE_URL=https://auth.yourcompany.com/auth/v1
```

**AWS ECS Task Definition Example:**

```json
{
  "family": "supabase-studio",
  "containerDefinitions": [
    {
      "name": "studio",
      "image": "supabase/studio:latest",
      "environment": [
        {
          "name": "SUPABASE_URL",
          "value": "https://api.yourcompany.com"
        },
        {
          "name": "SUPABASE_PUBLIC_URL",
          "value": "https://api.yourcompany.com"
        },
        {
          "name": "SUPABASE_ANON_KEY",
          "value": "your-anon-key"
        },
        {
          "name": "SUPABASE_SERVICE_KEY",
          "value": "your-service-key"
        }
      ],
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ]
    }
  ]
}
```

**AWS Systems Manager Parameter Store:**

```bash
# Store secrets in Parameter Store
aws ssm put-parameter \
  --name "/supabase/studio/supabase-url" \
  --value "https://api.yourcompany.com" \
  --type "String"

aws ssm put-parameter \
  --name "/supabase/studio/anon-key" \
  --value "your-anon-key" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/supabase/studio/service-key" \
  --value "your-service-key" \
  --type "SecureString"
```

**Verification:**

```bash
# Check ECS task logs
aws ecs describe-tasks --cluster your-cluster --tasks your-task-id

# Test health endpoint
curl https://studio.yourcompany.com/api/health
```

---

### Kubernetes Deployment

For Kubernetes deployments using ConfigMaps and Secrets.

**Configuration:**

Create a ConfigMap for non-sensitive configuration:

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: studio-config
  namespace: supabase
data:
  SUPABASE_URL: "https://api.yourcompany.com"
  SUPABASE_PUBLIC_URL: "https://api.yourcompany.com"
  NEXT_PUBLIC_SITE_URL: "https://studio.yourcompany.com"
  # Optional: Only if using separate auth domain
  # NEXT_PUBLIC_GOTRUE_URL: "https://auth.yourcompany.com/auth/v1"
```

Create a Secret for sensitive data:

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: studio-secrets
  namespace: supabase
type: Opaque
stringData:
  SUPABASE_ANON_KEY: "your-anon-key"
  SUPABASE_SERVICE_KEY: "your-service-key"
  AUTH_JWT_SECRET: "your-jwt-secret"
```

Deployment manifest:

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: studio
  namespace: supabase
spec:
  replicas: 3
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
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

Service and Ingress:

```yaml
# service.yaml
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
  type: ClusterIP

---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: studio-ingress
  namespace: supabase
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - studio.yourcompany.com
    secretName: studio-tls
  rules:
  - host: studio.yourcompany.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: studio-service
            port:
              number: 80
```

**Deployment:**

```bash
# Apply configurations
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml

# Verify deployment
kubectl get pods -n supabase
kubectl logs -n supabase -l app=studio --tail=100

# Check GoTrue URL resolution in logs
kubectl logs -n supabase -l app=studio | grep "GoTrue URL resolved"
```

**Verification:**

```bash
# Port-forward for local testing
kubectl port-forward -n supabase svc/studio-service 3000:80

# Test locally
curl http://localhost:3000/api/health

# Test via ingress
curl https://studio.yourcompany.com/api/health
```

---

## Troubleshooting

### Connection Refused Errors

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:54321
```

**Diagnosis:**
1. Check application logs for "GoTrue URL resolved" message
2. Verify the resolved URL matches your actual GoTrue service

**Solution:**
```bash
# Check what URL is being used
grep "GoTrue URL resolved" /var/log/studio.log

# If it shows 127.0.0.1:54321 in production, set the correct URL:
export SUPABASE_PUBLIC_URL=https://api.yourcompany.com

# Or set explicitly:
export NEXT_PUBLIC_GOTRUE_URL=https://api.yourcompany.com/auth/v1
```

---

### DNS Resolution Failures

**Symptom:**
```
Error: getaddrinfo ENOTFOUND api.yourcompany.com
```

**Diagnosis:**
1. Verify DNS is configured correctly
2. Check network connectivity from the deployment environment

**Solution:**
```bash
# Test DNS resolution
nslookup api.yourcompany.com

# Test connectivity
curl -v https://api.yourcompany.com/auth/v1/health

# If using internal DNS, ensure the container/pod can resolve it
# For Docker:
docker exec -it studio-container nslookup api.yourcompany.com

# For Kubernetes:
kubectl exec -it -n supabase studio-pod -- nslookup api.yourcompany.com
```

---

### SSL/TLS Certificate Errors

**Symptom:**
```
Error: unable to verify the first certificate
```

**Diagnosis:**
1. Check if the GoTrue URL uses HTTPS
2. Verify SSL certificate is valid

**Solution:**
```bash
# Test SSL certificate
openssl s_client -connect api.yourcompany.com:443 -servername api.yourcompany.com

# For self-signed certificates in development (NOT for production):
export NODE_TLS_REJECT_UNAUTHORIZED=0

# For production, ensure valid SSL certificates:
# - Use Let's Encrypt with cert-manager (Kubernetes)
# - Use AWS Certificate Manager (AWS)
# - Use proper CA-signed certificates
```

---

### Wrong Environment URL

**Symptom:**
Authentication works in development but fails in production.

**Diagnosis:**
1. Check if environment variables are properly set in production
2. Verify build-time vs runtime environment variables

**Solution:**
```bash
# For Next.js, NEXT_PUBLIC_* variables are embedded at build time
# Ensure they're set during the build process

# Vercel:
vercel env add NEXT_PUBLIC_GOTRUE_URL production

# Docker:
# Pass as build args if needed at build time
docker build --build-arg NEXT_PUBLIC_GOTRUE_URL=https://api.yourcompany.com/auth/v1 .

# Or use runtime environment variables (preferred):
# Don't set NEXT_PUBLIC_GOTRUE_URL, let it derive from SUPABASE_PUBLIC_URL
```

---

### Health Check Failures

**Symptom:**
```
GoTrue health check failed: timeout
```

**Diagnosis:**
1. Check if GoTrue service is running
2. Verify network connectivity
3. Check firewall rules

**Solution:**
```bash
# Check GoTrue service status
curl -v https://api.yourcompany.com/auth/v1/health

# Check from the same network as Studio
# Docker:
docker exec -it studio-container curl http://gotrue:9999/health

# Kubernetes:
kubectl exec -it -n supabase studio-pod -- curl http://gotrue-service:9999/health

# Verify firewall rules allow traffic on port 9999 (or your GoTrue port)
```

---

### Logs Show Wrong URL Source

**Symptom:**
```
GoTrue URL resolved: http://127.0.0.1:54321/auth/v1 (source: default)
```

**Diagnosis:**
Environment variables are not being loaded correctly.

**Solution:**
```bash
# Verify environment variables are set
env | grep SUPABASE

# For Docker Compose:
docker-compose config | grep SUPABASE

# For Kubernetes:
kubectl describe pod -n supabase studio-pod | grep -A 10 Environment

# Ensure .env file is in the correct location
ls -la .env

# For Next.js, restart the development server after changing .env
npm run dev
```

---

## Security Best Practices

### 1. Use HTTPS in Production

Always use HTTPS URLs for production deployments:

```bash
# ✅ Good
NEXT_PUBLIC_GOTRUE_URL=https://api.yourcompany.com/auth/v1

# ❌ Bad (only for development)
NEXT_PUBLIC_GOTRUE_URL=http://api.yourcompany.com/auth/v1
```

### 2. Protect Sensitive Environment Variables

Never commit sensitive values to version control:

```bash
# .gitignore
.env
.env.local
.env.production
.env.*.local
```

Use secret management systems:
- **AWS**: Systems Manager Parameter Store or Secrets Manager
- **Kubernetes**: Secrets with encryption at rest
- **Vercel**: Environment Variables (encrypted)
- **Docker**: Docker Secrets

### 3. Validate URLs

The system automatically validates URLs, but you should also:

```bash
# Test the URL before deploying
curl -f https://api.yourcompany.com/auth/v1/health || echo "URL not accessible"

# Use health checks in your deployment
# Docker Compose:
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3

# Kubernetes:
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
```

### 4. Use Environment-Specific Configuration

Maintain separate configuration for each environment:

```
.env.development    # Local development
.env.staging        # Staging environment
.env.production     # Production environment
```

### 5. Monitor GoTrue Connectivity

Set up monitoring and alerting:

```bash
# Example monitoring script
#!/bin/bash
GOTRUE_URL="https://api.yourcompany.com/auth/v1/health"

if ! curl -f -s "$GOTRUE_URL" > /dev/null; then
  echo "ALERT: GoTrue service is down!"
  # Send alert to your monitoring system
fi
```

### 6. Implement Rate Limiting

Protect your GoTrue service from abuse:

```nginx
# Nginx rate limiting example
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/s;

location /auth/v1 {
    limit_req zone=auth_limit burst=20 nodelay;
    proxy_pass http://gotrue:9999;
}
```

### 7. Regular Security Audits

- Review access logs regularly
- Update dependencies and Docker images
- Rotate secrets periodically
- Monitor for unusual authentication patterns

---

## Additional Resources

- [Supabase Self-Hosting Guide](https://supabase.com/docs/guides/self-hosting)
- [GoTrue Documentation](https://github.com/supabase/gotrue)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kubernetes ConfigMaps and Secrets](https://kubernetes.io/docs/concepts/configuration/)

---

## Support

If you encounter issues not covered in this guide:

1. Check the [troubleshooting section](#troubleshooting)
2. Review application logs for "GoTrue URL resolved" messages
3. Verify your environment variables are correctly set
4. Test GoTrue connectivity manually using curl
5. Consult the [Supabase Discord](https://discord.supabase.com) or [GitHub Issues](https://github.com/supabase/supabase)
