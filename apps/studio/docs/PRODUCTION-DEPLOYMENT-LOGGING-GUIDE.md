# Production Deployment Logging Guide

This guide provides comprehensive logging strategies for debugging environment detection and configuration issues in production deployments.

## Overview

Effective logging is crucial for diagnosing environment detection issues in production. This guide covers:

- Environment detection logging patterns
- Production-safe logging practices
- Log analysis techniques
- Monitoring and alerting strategies

## Environment Detection Logging

### Enable Detailed Environment Detection Logging

The environment detection system provides comprehensive logging that can be enabled in production:

```bash
# Enable detailed environment detection logging
DEBUG_ENVIRONMENT_DETECTION=true

# Set log level for detailed output
LOG_LEVEL=debug

# Enable configuration logging
DEBUG_CONFIGURATION=true
```

### Key Log Patterns to Monitor

#### Successful Environment Detection

```
[Environment Detection] 🔍 Starting environment detection at 2024-01-15T10:30:00.000Z
[Environment Detection] Phase: RUNTIME
[Environment Detection] 📋 Environment Variables Analyzed:
[Environment Detection]   ✓ ENVIRONMENT: production
[Environment Detection]   ✓ NODE_ENV: production
[Environment Detection]   ✓ SUPABASE_PUBLIC_URL: https://your-project.supabase.co
[Environment Detection]   ✓ API_EXTERNAL_URL: https://api.your-domain.com
[Environment Detection] 🔗 Priority Chain Analysis:
[Environment Detection]   1. ENVIRONMENT variable: 🎯 SELECTED
[Environment Detection]      Reason: Explicit ENVIRONMENT="production" takes HIGHEST priority
[Environment Detection] ✅ PRODUCTION environment detected via ENVIRONMENT variable
[Environment Detection] 🎯 FINAL RESULT: PRODUCTION environment detected
```

#### Build-Time Environment Detection Issues

```
[Environment Detection] 🏗️  BUILD-TIME DETECTION:
[Environment Detection]   Build context: Build-time execution detected: Docker BuildKit
[Environment Detection]   Container context: Docker image build process
[Environment Detection]   Docker build: ✓ YES
[Environment Detection] ⚠️  Docker build missing critical environment variables: ENVIRONMENT
[Environment Detection] 💡 Add ARG declarations in Dockerfile: ARG ENVIRONMENT
[Environment Detection] 💡 Pass variables during build: docker build --build-arg ENVIRONMENT=production
```

#### Production-Localhost Mismatch Errors

```
[Environment Detection] ❌ Production environment using localhost URLs!
[Environment Detection] All API requests will fail!
[Environment Detection] Check your environment variables:
[Environment Detection]   - SUPABASE_PUBLIC_URL: http://localhost:54321 (INVALID for production)
[Environment Detection]   - API_EXTERNAL_URL: http://localhost:8000 (INVALID for production)
[Environment Detection] 💡 Set SUPABASE_PUBLIC_URL=https://your-project.supabase.co
[Environment Detection] 💡 Set API_EXTERNAL_URL=https://api.your-domain.com
```

## Production Logging Configuration

### Structured Logging Setup

```typescript
// lib/logger.ts
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'studio',
    environment: process.env.ENVIRONMENT || 'unknown',
    version: process.env.npm_package_version || 'unknown'
  },
  transports: [
    // Console output for container logs
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File output for persistent logging
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
})

// Environment detection specific logger
export const envLogger = logger.child({ component: 'environment-detection' })

// Configuration logger
export const configLogger = logger.child({ component: 'configuration' })
```

### Environment-Aware Log Levels

```typescript
// Configure log levels based on environment
const getLogLevel = (): string => {
  const env = process.env.ENVIRONMENT || process.env.NODE_ENV || 'production'
  
  switch (env) {
    case 'development':
      return 'debug'
    case 'staging':
      return 'info'
    case 'production':
      return 'warn'
    default:
      return 'info'
  }
}

// Set log level
process.env.LOG_LEVEL = process.env.LOG_LEVEL || getLogLevel()
```

### Production-Safe Sensitive Data Masking

```typescript
// lib/log-sanitizer.ts
export function sanitizeForLogging(data: any): any {
  const sensitiveKeys = [
    'password', 'secret', 'key', 'token', 'auth',
    'SUPABASE_ANON_KEY', 'NEXTAUTH_SECRET', 'DATABASE_URL'
  ]
  
  if (typeof data === 'string') {
    // Mask URLs with credentials
    return data.replace(
      /postgresql:\/\/([^:]+):([^@]+)@/g,
      'postgresql://$1:***@'
    )
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data }
    
    for (const key in sanitized) {
      if (sensitiveKeys.some(sensitive => 
        key.toLowerCase().includes(sensitive.toLowerCase())
      )) {
        const value = sanitized[key]
        if (typeof value === 'string' && value.length > 8) {
          sanitized[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        } else {
          sanitized[key] = '***'
        }
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeForLogging(sanitized[key])
      }
    }
    
    return sanitized
  }
  
  return data
}
```

## Deployment-Specific Logging

### Docker Container Logging

#### Dockerfile Logging Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

# Enable logging during build
ARG LOG_LEVEL=info
ENV LOG_LEVEL=${LOG_LEVEL}

# Create log directory
RUN mkdir -p /app/logs

# Build application with logging
COPY . .
RUN npm run build 2>&1 | tee /app/logs/build.log

# Log environment detection during startup
RUN echo "=== Environment Detection Test ===" && \
    npm run debug:env --no-recommendations 2>&1 | tee /app/logs/env-detection.log || true

# Configure log rotation
RUN apk add --no-cache logrotate
COPY docker/logrotate.conf /etc/logrotate.d/app

EXPOSE 3000

# Start with logging
CMD ["sh", "-c", "npm start 2>&1 | tee -a /app/logs/runtime.log"]
```

#### Docker Compose Logging

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  studio:
    build:
      context: .
      args:
        LOG_LEVEL: info
    environment:
      LOG_LEVEL: info
      DEBUG_ENVIRONMENT_DETECTION: "true"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=studio,environment=production"
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "npm", "run", "config:health:quick"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Kubernetes Logging

#### Deployment with Logging

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: studio
  labels:
    app: studio
    environment: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: studio
  template:
    metadata:
      labels:
        app: studio
        environment: production
    spec:
      containers:
      - name: studio
        image: your-registry/studio:latest
        env:
        - name: ENVIRONMENT
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        - name: DEBUG_ENVIRONMENT_DETECTION
          value: "true"
        ports:
        - containerPort: 3000
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
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: logs
        emptyDir: {}
```

#### Logging ConfigMap

```yaml
# k8s/logging-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: logging-config
data:
  log-level: "info"
  debug-environment-detection: "true"
  log-format: "json"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         1
        Log_Level     info
        Daemon        off
        Parsers_File  parsers.conf

    [INPUT]
        Name              tail
        Path              /app/logs/*.log
        Parser            json
        Tag               studio.*
        Refresh_Interval  5

    [FILTER]
        Name                kubernetes
        Match               studio.*
        Kube_URL            https://kubernetes.default.svc:443
        Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token

    [OUTPUT]
        Name  es
        Match *
        Host  elasticsearch.logging.svc.cluster.local
        Port  9200
        Index studio-logs
```

### Cloud Platform Logging

#### Vercel Logging

```typescript
// vercel-logger.ts
import { NextRequest } from 'next/server'

export function createVercelLogger() {
  return {
    info: (message: string, meta?: any) => {
      console.log(JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        platform: 'vercel',
        environment: process.env.VERCEL_ENV || 'unknown',
        ...meta
      }))
    },
    
    error: (message: string, error?: Error, meta?: any) => {
      console.error(JSON.stringify({
        level: 'error',
        message,
        error: error?.message,
        stack: error?.stack,
        timestamp: new Date().toISOString(),
        platform: 'vercel',
        environment: process.env.VERCEL_ENV || 'unknown',
        ...meta
      }))
    },
    
    warn: (message: string, meta?: any) => {
      console.warn(JSON.stringify({
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        platform: 'vercel',
        environment: process.env.VERCEL_ENV || 'unknown',
        ...meta
      }))
    }
  }
}
```

#### AWS CloudWatch Logging

```typescript
// aws-logger.ts
import AWS from 'aws-sdk'

const cloudWatchLogs = new AWS.CloudWatchLogs({
  region: process.env.AWS_REGION || 'us-east-1'
})

export class CloudWatchLogger {
  private logGroupName: string
  private logStreamName: string

  constructor(logGroupName: string, logStreamName: string) {
    this.logGroupName = logGroupName
    this.logStreamName = logStreamName
  }

  async log(level: string, message: string, meta?: any) {
    const logEvent = {
      timestamp: Date.now(),
      message: JSON.stringify({
        level,
        message,
        timestamp: new Date().toISOString(),
        environment: process.env.ENVIRONMENT || 'unknown',
        service: 'studio',
        ...meta
      })
    }

    try {
      await cloudWatchLogs.putLogEvents({
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
        logEvents: [logEvent]
      }).promise()
    } catch (error) {
      // Fallback to console logging
      console.error('CloudWatch logging failed:', error)
      console.log(logEvent.message)
    }
  }
}
```

## Log Analysis and Monitoring

### Environment Detection Log Patterns

#### Successful Patterns

```bash
# Grep patterns for successful environment detection
grep "FINAL RESULT.*PRODUCTION" logs/combined.log
grep "Environment determined by ENVIRONMENT variable" logs/combined.log
grep "✅.*environment detected" logs/combined.log
```

#### Error Patterns

```bash
# Critical environment detection errors
grep -E "(CRITICAL ERROR|Production environment using localhost)" logs/combined.log
grep "Environment variables not available during build" logs/combined.log
grep "NODE_ENV=production overridden by localhost URLs" logs/combined.log
```

#### Warning Patterns

```bash
# Environment detection warnings
grep -E "(⚠️|WARNING).*environment" logs/combined.log
grep "Missing Variables" logs/combined.log
grep "Docker build missing critical environment variables" logs/combined.log
```

### Automated Log Analysis Script

```bash
#!/bin/bash
# analyze-environment-logs.sh

LOG_FILE=${1:-"logs/combined.log"}
REPORT_FILE="environment-analysis-$(date +%Y%m%d-%H%M%S).txt"

echo "Environment Detection Log Analysis Report" > $REPORT_FILE
echo "Generated: $(date)" >> $REPORT_FILE
echo "Log file: $LOG_FILE" >> $REPORT_FILE
echo "=========================================" >> $REPORT_FILE

# Count environment detection events
echo "" >> $REPORT_FILE
echo "Environment Detection Events:" >> $REPORT_FILE
echo "----------------------------" >> $REPORT_FILE
grep -c "Starting environment detection" $LOG_FILE >> $REPORT_FILE

# Environment detection results
echo "" >> $REPORT_FILE
echo "Environment Detection Results:" >> $REPORT_FILE
echo "-----------------------------" >> $REPORT_FILE
grep "FINAL RESULT" $LOG_FILE | tail -10 >> $REPORT_FILE

# Critical errors
echo "" >> $REPORT_FILE
echo "Critical Errors:" >> $REPORT_FILE
echo "---------------" >> $REPORT_FILE
grep -E "(CRITICAL ERROR|Production environment using localhost)" $LOG_FILE >> $REPORT_FILE

# Warnings
echo "" >> $REPORT_FILE
echo "Warnings:" >> $REPORT_FILE
echo "--------" >> $REPORT_FILE
grep -E "(⚠️|WARNING).*environment" $LOG_FILE | tail -20 >> $REPORT_FILE

# Build-time issues
echo "" >> $REPORT_FILE
echo "Build-time Issues:" >> $REPORT_FILE
echo "-----------------" >> $REPORT_FILE
grep "Docker build missing" $LOG_FILE >> $REPORT_FILE

# Environment variable issues
echo "" >> $REPORT_FILE
echo "Environment Variable Issues:" >> $REPORT_FILE
echo "---------------------------" >> $REPORT_FILE
grep "Missing Variables" $LOG_FILE >> $REPORT_FILE

echo "Analysis complete. Report saved to: $REPORT_FILE"
```

### Real-time Monitoring

#### Log Monitoring Script

```bash
#!/bin/bash
# monitor-environment-detection.sh

LOG_FILE=${1:-"logs/combined.log"}
ALERT_WEBHOOK=${2:-""}

echo "Monitoring environment detection logs: $LOG_FILE"
echo "Press Ctrl+C to stop"

tail -f $LOG_FILE | while read line; do
  # Check for critical errors
  if echo "$line" | grep -q "CRITICAL ERROR\|Production environment using localhost"; then
    echo "🚨 CRITICAL: $line"
    
    # Send alert if webhook provided
    if [ -n "$ALERT_WEBHOOK" ]; then
      curl -X POST "$ALERT_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"🚨 Environment Detection Critical Error: $line\"}"
    fi
  fi
  
  # Check for warnings
  if echo "$line" | grep -q "⚠️\|WARNING.*environment"; then
    echo "⚠️  WARNING: $line"
  fi
  
  # Check for successful detection
  if echo "$line" | grep -q "FINAL RESULT.*PRODUCTION"; then
    echo "✅ SUCCESS: $line"
  fi
done
```

#### Health Check Monitoring

```bash
#!/bin/bash
# health-check-monitor.sh

HEALTH_URL=${1:-"http://localhost:3000/api/health"}
CHECK_INTERVAL=${2:-60}

while true; do
  echo "Checking health at $(date)..."
  
  RESPONSE=$(curl -s -w "%{http_code}" "$HEALTH_URL")
  HTTP_CODE="${RESPONSE: -3}"
  BODY="${RESPONSE%???}"
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed"
    
    # Check for environment detection in health response
    if echo "$BODY" | grep -q "environment.*production"; then
      echo "✅ Production environment confirmed"
    elif echo "$BODY" | grep -q "environment.*development"; then
      echo "⚠️  Development environment detected"
    fi
  else
    echo "❌ Health check failed: HTTP $HTTP_CODE"
    echo "Response: $BODY"
    
    # Run environment detection debug
    echo "Running environment detection debug..."
    npm run debug:env --no-recommendations
  fi
  
  sleep $CHECK_INTERVAL
done
```

## Alerting and Notifications

### Slack Notifications

```typescript
// lib/slack-notifier.ts
export class SlackNotifier {
  private webhookUrl: string

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
  }

  async sendEnvironmentAlert(
    severity: 'critical' | 'warning' | 'info',
    message: string,
    details?: any
  ) {
    const emoji = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️'
    const color = severity === 'critical' ? 'danger' : severity === 'warning' ? 'warning' : 'good'

    const payload = {
      text: `${emoji} Environment Detection Alert`,
      attachments: [
        {
          color,
          fields: [
            {
              title: 'Severity',
              value: severity.toUpperCase(),
              short: true
            },
            {
              title: 'Environment',
              value: process.env.ENVIRONMENT || 'unknown',
              short: true
            },
            {
              title: 'Message',
              value: message,
              short: false
            }
          ],
          footer: 'Studio Environment Detection',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    }

    if (details) {
      payload.attachments[0].fields.push({
        title: 'Details',
        value: `\`\`\`${JSON.stringify(details, null, 2)}\`\`\``,
        short: false
      })
    }

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      console.error('Failed to send Slack notification:', error)
    }
  }
}
```

### Email Notifications

```typescript
// lib/email-notifier.ts
import nodemailer from 'nodemailer'

export class EmailNotifier {
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  }

  async sendEnvironmentAlert(
    to: string[],
    severity: 'critical' | 'warning' | 'info',
    message: string,
    logExcerpt?: string
  ) {
    const subject = `${severity.toUpperCase()}: Environment Detection Alert - ${process.env.ENVIRONMENT}`
    
    const html = `
      <h2>Environment Detection Alert</h2>
      <p><strong>Severity:</strong> ${severity.toUpperCase()}</p>
      <p><strong>Environment:</strong> ${process.env.ENVIRONMENT || 'unknown'}</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      <p><strong>Message:</strong> ${message}</p>
      
      ${logExcerpt ? `
        <h3>Log Excerpt:</h3>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${logExcerpt}</pre>
      ` : ''}
      
      <h3>Recommended Actions:</h3>
      <ul>
        <li>Check environment variables configuration</li>
        <li>Run diagnostics: <code>pnpm config:diagnose:verbose</code></li>
        <li>Review deployment logs</li>
        <li>Verify URL configurations</li>
      </ul>
    `

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: to.join(', '),
      subject,
      html
    })
  }
}
```

## Production Deployment Checklist

### Pre-Deployment Logging Verification

```bash
# 1. Validate environment variables
pnpm config:validate-env:strict

# 2. Test environment detection
pnpm debug:env --simulate-production

# 3. Verify logging configuration
pnpm config:check:verbose

# 4. Test health checks
pnpm config:health:verbose

# 5. Run comprehensive diagnostics
pnpm config:diagnose:verbose
```

### Post-Deployment Monitoring

```bash
# 1. Check initial environment detection
curl -f https://your-domain.com/api/health

# 2. Monitor logs for first 5 minutes
tail -f logs/combined.log | grep -E "(Environment Detection|CRITICAL|ERROR)"

# 3. Verify environment detection results
curl -s https://your-domain.com/api/runtime-config | jq '.environment'

# 4. Check for any warnings
grep -E "(⚠️|WARNING)" logs/combined.log | tail -10
```

### Ongoing Monitoring Setup

```bash
# Set up log rotation
sudo logrotate -f /etc/logrotate.d/studio

# Configure monitoring alerts
./scripts/setup-monitoring.sh

# Schedule regular health checks
echo "*/5 * * * * /path/to/health-check-monitor.sh" | crontab -

# Set up log analysis reports
echo "0 6 * * * /path/to/analyze-environment-logs.sh" | crontab -
```

## Related Documentation

- [Environment Detection Troubleshooting](./ENVIRONMENT-DETECTION-TROUBLESHOOTING.md)
- [Environment Variable Examples](./ENVIRONMENT-VARIABLE-EXAMPLES.md)
- [Configuration Logging Guide](./CONFIGURATION-LOGGING.md)
- [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)