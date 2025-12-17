# Project-Level Service Isolation - Operations Guide

## Introduction

This guide provides operational procedures for deploying, migrating, monitoring, and troubleshooting the project-level service isolation feature in Supabase Studio. It is intended for system administrators and DevOps engineers.

## Table of Contents

1. [Deployment Guide](#deployment-guide)
2. [Migration Guide](#migration-guide)
3. [Monitoring Guide](#monitoring-guide)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Backup and Recovery](#backup-and-recovery)
6. [Performance Tuning](#performance-tuning)
7. [Security Operations](#security-operations)

## Deployment Guide

> **Note**: For detailed GoTrue authentication service configuration across different deployment environments (Docker, Vercel, AWS, Kubernetes), see the **[GoTrue Deployment Guide](./GOTRUE-DEPLOYMENT-GUIDE.md)**.

### Prerequisites

Before deploying the service isolation feature, ensure:

- **PostgreSQL 14+** with logical replication enabled
- **Docker** and **Docker Compose** installed
- **Sufficient disk space**: At least 10GB per project
- **Memory**: Minimum 4GB RAM, recommended 8GB+
- **Network**: Ports 8000, 8082, 5432 accessible

### System Requirements

```yaml
Minimum:
  CPU: 2 cores
  RAM: 4GB
  Disk: 50GB SSD
  Network: 100Mbps

Recommended:
  CPU: 4+ cores
  RAM: 8GB+
  Disk: 200GB+ SSD
  Network: 1Gbps
```

### Pre-Deployment Checklist

- [ ] Backup all existing data
- [ ] Review current project configurations
- [ ] Test deployment on staging environment
- [ ] Prepare rollback procedures
- [ ] Notify users of maintenance window
- [ ] Document current system state

### Deployment Steps

#### Step 1: Prepare the Environment

```bash
# Clone or update repository
cd /opt/supabase
git pull origin main

# Backup current configuration
cp docker/.env docker/.env.backup
cp docker/docker-compose.yml docker/docker-compose.yml.backup
```

#### Step 2: Configure PostgreSQL

Edit `docker/.env`:

```bash
# Enable logical replication
POSTGRES_CONFIG="wal_level=logical,max_replication_slots=10,max_wal_senders=10"

# Increase connection limits
POSTGRES_MAX_CONNECTIONS=200
```

#### Step 3: Update Docker Compose

Ensure `docker/docker-compose.yml` includes:

```yaml
services:
  db:
    image: supabase/postgres:14
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
    command:
      - postgres
      - -c
      - wal_level=logical
      - -c
      - max_replication_slots=10
      - -c
      - max_wal_senders=10
    volumes:
      - ./volumes/db/data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  studio:
    image: supabase/studio:latest
    environment:
      SUPABASE_URL: http://kong:8000
      SUPABASE_ANON_KEY: ${ANON_KEY}
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
    ports:
      - "8082:3000"
    depends_on:
      - db
```

#### Step 4: Deploy Services

```bash
# Navigate to docker directory
cd docker

# Pull latest images
docker-compose pull

# Start services
docker-compose up -d

# Verify services are running
docker-compose ps
```

#### Step 5: Verify Deployment

```bash
# Check database is accessible
psql -h localhost -U postgres -d postgres -c "SELECT version();"

# Check Studio is accessible
curl http://localhost:8082/api/health

# Verify logical replication is enabled
psql -h localhost -U postgres -d postgres -c "SHOW wal_level;"
# Should return: logical
```

#### Step 6: Initialize System

```bash
# Run initialization script
cd /opt/supabase/apps/studio
pnpm run init-service-isolation

# Verify initialization
./scripts/verify-service-isolation.sh
```

### Post-Deployment Verification

1. **Create a test project**
```bash
curl -X POST http://localhost:8082/api/platform/projects/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${STUDIO_TOKEN}" \
  -d '{
    "name": "Test Project",
    "organization_id": "org-123",
    "database_password": "secure-password"
  }'
```

2. **Verify schemas were created**
```bash
psql -h localhost -U postgres -d project_test_123 -c "\dn"
# Should show: auth, storage, webhooks, analytics schemas
```

3. **Test service isolation**
```bash
./verify-service-isolation.sh
```

### Rollback Procedure

If deployment fails:

```bash
# Stop services
docker-compose down

# Restore configuration
cp docker/.env.backup docker/.env
cp docker/docker-compose.yml.backup docker/docker-compose.yml

# Restore database
pg_restore -h localhost -U postgres -d postgres backup.dump

# Restart services
docker-compose up -d
```

## Migration Guide

### Overview

This guide covers migrating existing projects to the service isolation architecture.

### Migration Strategy

We use a **phased migration** approach:

1. **Phase 1**: Backup all data
2. **Phase 2**: Create new schemas in project databases
3. **Phase 3**: Migrate data to new schemas
4. **Phase 4**: Update service configurations
5. **Phase 5**: Verify and test
6. **Phase 6**: Cleanup old data

### Pre-Migration Checklist

- [ ] Full database backup completed
- [ ] Migration tested on staging
- [ ] Maintenance window scheduled
- [ ] Users notified
- [ ] Rollback plan prepared
- [ ] Monitoring alerts configured

### Migration Steps

#### Step 1: Backup Everything

```bash
# Backup main database
pg_dump -h localhost -U postgres -d postgres -F c -f postgres_backup.dump

# Backup each project database
for db in $(psql -h localhost -U postgres -d postgres -t -c \
  "SELECT database_name FROM projects"); do
  pg_dump -h localhost -U postgres -d $db -F c -f ${db}_backup.dump
done

# Backup file storage
tar -czf storage_backup.tar.gz /var/lib/storage/

# Backup function code
tar -czf functions_backup.tar.gz /var/lib/functions/
```

#### Step 2: Run Migration Script

```bash
cd /opt/supabase/apps/studio

# Dry run (no changes)
pnpm run migrate-projects --dry-run

# Review the migration plan
cat migration-plan.json

# Execute migration
pnpm run migrate-projects --execute
```

The migration script will:
- Create auth schema in each project database
- Migrate user data from shared auth to project-specific auth
- Create storage schema in each project database
- Migrate storage metadata
- Create webhooks and analytics schemas
- Update service router configurations

#### Step 3: Verify Migration

```bash
# Run verification script
./scripts/verify-migration.sh

# Check each project
for project in $(psql -h localhost -U postgres -d postgres -t -c \
  "SELECT ref FROM projects"); do
  echo "Verifying project: $project"
  ./scripts/verify-project-isolation.sh $project
done
```

#### Step 4: Update Service Configurations

```bash
# Restart services to pick up new configurations
docker-compose restart studio
docker-compose restart kong
docker-compose restart realtime
```

#### Step 5: Test Services

```bash
# Test auth isolation
./test-auth-isolation.sh

# Test storage isolation
./test-storage-isolation.sh

# Test realtime isolation
./test-realtime-isolation.sh
```

### Migration Rollback

If migration fails:

```bash
# Stop services
docker-compose down

# Restore databases
pg_restore -h localhost -U postgres -d postgres -c postgres_backup.dump

for db in $(ls *_backup.dump); do
  dbname=$(basename $db _backup.dump)
  pg_restore -h localhost -U postgres -d $dbname -c $db
done

# Restore files
tar -xzf storage_backup.tar.gz -C /
tar -xzf functions_backup.tar.gz -C /

# Restart services
docker-compose up -d
```

### Post-Migration Tasks

1. **Monitor for 24 hours**
   - Check error logs
   - Monitor resource usage
   - Verify user reports

2. **Update documentation**
   - Document any issues encountered
   - Update runbooks
   - Share lessons learned

3. **Cleanup (after 7 days)**
   - Remove old shared schemas (if any)
   - Archive migration logs
   - Delete backup files (keep offsite backups)

## Monitoring Guide

### Key Metrics to Monitor

#### System Metrics

```yaml
CPU Usage:
  Warning: > 70%
  Critical: > 90%

Memory Usage:
  Warning: > 80%
  Critical: > 95%

Disk Usage:
  Warning: > 80%
  Critical: > 90%

Disk I/O:
  Warning: > 80% utilization
  Critical: > 95% utilization
```

#### Database Metrics

```yaml
Connection Count:
  Warning: > 150 connections
  Critical: > 180 connections

Query Duration:
  Warning: > 1 second average
  Critical: > 5 seconds average

Replication Lag:
  Warning: > 100MB
  Critical: > 500MB

Database Size:
  Warning: > 80% of allocated space
  Critical: > 95% of allocated space
```

#### Application Metrics

```yaml
API Response Time:
  Warning: > 500ms average
  Critical: > 2000ms average

Error Rate:
  Warning: > 1% of requests
  Critical: > 5% of requests

Active Projects:
  Info: Track growth over time

Failed Authentications:
  Warning: > 10 per minute
  Critical: > 50 per minute
```

### Monitoring Tools

#### PostgreSQL Monitoring

```sql
-- Check active connections per database
SELECT datname, count(*) 
FROM pg_stat_activity 
GROUP BY datname;

-- Check slow queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds';

-- Check database sizes
SELECT datname, pg_size_pretty(pg_database_size(datname))
FROM pg_database
ORDER BY pg_database_size(datname) DESC;

-- Check replication slots
SELECT slot_name, active, restart_lsn
FROM pg_replication_slots;
```

#### Application Monitoring

```bash
# Check Studio logs
docker-compose logs -f studio | grep ERROR

# Check API response times
tail -f /var/log/supabase/api.log | grep "duration"

# Monitor connection pools
curl http://localhost:8082/api/metrics/connection-pools

# Check service health
curl http://localhost:8082/api/health
```

#### System Monitoring

```bash
# CPU and memory
htop

# Disk usage
df -h

# Disk I/O
iostat -x 1

# Network
iftop
```

### Setting Up Alerts

#### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'supabase-studio'
    static_configs:
      - targets: ['localhost:8082']
    metrics_path: '/api/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']
```

#### Alert Rules

```yaml
# alerts.yml
groups:
  - name: supabase_alerts
    rules:
      - alert: HighCPUUsage
        expr: cpu_usage > 80
        for: 5m
        annotations:
          summary: "High CPU usage detected"
          
      - alert: DatabaseConnectionsHigh
        expr: pg_stat_database_numbackends > 150
        for: 5m
        annotations:
          summary: "High number of database connections"
          
      - alert: SlowQueries
        expr: avg_query_duration > 1000
        for: 5m
        annotations:
          summary: "Slow queries detected"
```

### Log Management

#### Log Locations

```bash
# Application logs
/var/log/supabase/studio.log
/var/log/supabase/api.log

# Project-specific logs
/var/log/supabase/projects/{project_ref}/

# Database logs
/var/log/postgresql/postgresql-14-main.log

# Docker logs
docker-compose logs studio
docker-compose logs db
```

#### Log Rotation

```bash
# /etc/logrotate.d/supabase
/var/log/supabase/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 supabase supabase
    sharedscripts
    postrotate
        systemctl reload supabase-studio
    endscript
}
```

#### Log Analysis

```bash
# Find errors in last hour
grep ERROR /var/log/supabase/studio.log | \
  awk -v d="$(date -d '1 hour ago' '+%Y-%m-%d %H:%M:%S')" '$0 > d'

# Count errors by type
grep ERROR /var/log/supabase/studio.log | \
  awk '{print $5}' | sort | uniq -c | sort -rn

# Find slow API calls
grep "duration" /var/log/supabase/api.log | \
  awk '$NF > 1000' | tail -20
```

## Troubleshooting Guide

### Common Issues

#### Issue 1: Project Creation Fails

**Symptoms**:
- Error message: "Failed to create project"
- Project stuck in "initializing" state

**Diagnosis**:
```bash
# Check database logs
docker-compose logs db | grep ERROR

# Check if database was created
psql -h localhost -U postgres -l | grep project_

# Check disk space
df -h
```

**Solutions**:

1. **Insufficient disk space**
```bash
# Free up space
docker system prune -a
# Or expand disk
```

2. **Database connection limit reached**
```bash
# Increase max_connections
psql -h localhost -U postgres -c \
  "ALTER SYSTEM SET max_connections = 200;"
# Restart PostgreSQL
docker-compose restart db
```

3. **Schema creation failed**
```bash
# Manually create schemas
psql -h localhost -U postgres -d project_xxx -f \
  /opt/supabase/apps/studio/lib/project-initialization/schemas/auth.sql
```

#### Issue 2: Users Cannot Authenticate

**Symptoms**:
- Login fails with "Invalid credentials"
- Users exist in database but cannot sign in

**Diagnosis**:
```bash
# Check if user exists
psql -h localhost -U postgres -d project_xxx -c \
  "SELECT email FROM auth.users WHERE email = 'user@example.com';"

# Check GoTrue logs
docker-compose logs auth | grep ERROR

# Verify project database connection
psql -h localhost -U postgres -d project_xxx -c "SELECT 1;"
```

**Solutions**:

1. **Wrong project database**
```bash
# Verify Service Router configuration
curl http://localhost:8082/api/debug/service-router/project_xxx
```

2. **Password hash mismatch**
```bash
# Reset user password
psql -h localhost -U postgres -d project_xxx -c \
  "UPDATE auth.users SET encrypted_password = crypt('newpassword', gen_salt('bf')) \
   WHERE email = 'user@example.com';"
```

#### Issue 3: Storage Files Not Accessible

**Symptoms**:
- File upload succeeds but download fails
- 404 errors when accessing files

**Diagnosis**:
```bash
# Check file exists on disk
ls -la /var/lib/storage/project_xxx/bucket_name/

# Check storage metadata
psql -h localhost -U postgres -d project_xxx -c \
  "SELECT * FROM storage.objects WHERE name = 'file.jpg';"

# Check permissions
ls -la /var/lib/storage/
```

**Solutions**:

1. **File path mismatch**
```bash
# Verify file path in database matches disk
# Update if needed
```

2. **Permission issues**
```bash
# Fix permissions
chown -R supabase:supabase /var/lib/storage/
chmod -R 755 /var/lib/storage/
```

#### Issue 4: Realtime Events Not Received

**Symptoms**:
- Subscriptions succeed but no events received
- Events delayed significantly

**Diagnosis**:
```bash
# Check replication slots
psql -h localhost -U postgres -c \
  "SELECT * FROM pg_replication_slots;"

# Check realtime logs
docker-compose logs realtime | grep ERROR

# Check logical replication is enabled
psql -h localhost -U postgres -c "SHOW wal_level;"
```

**Solutions**:

1. **Replication slot not created**
```bash
# Create replication slot
psql -h localhost -U postgres -d project_xxx -c \
  "SELECT pg_create_logical_replication_slot('project_xxx_slot', 'pgoutput');"
```

2. **WAL level not set to logical**
```bash
# Update postgresql.conf
echo "wal_level = logical" >> /var/lib/postgresql/data/postgresql.conf
# Restart PostgreSQL
docker-compose restart db
```

#### Issue 5: High Memory Usage

**Symptoms**:
- System becomes slow
- Out of memory errors

**Diagnosis**:
```bash
# Check memory usage
free -h

# Check process memory
ps aux --sort=-%mem | head -10

# Check connection pool sizes
curl http://localhost:8082/api/metrics/connection-pools
```

**Solutions**:

1. **Too many connection pools**
```bash
# Reduce max connections per pool
# Edit apps/studio/lib/service-router/ConnectionPoolManager.ts
# Set max: 5 instead of max: 10
```

2. **Memory leak**
```bash
# Restart Studio
docker-compose restart studio
```

3. **Increase system memory**
```bash
# Add swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Performance Issues

#### Slow API Responses

**Diagnosis**:
```bash
# Check slow queries
psql -h localhost -U postgres -c \
  "SELECT query, mean_exec_time FROM pg_stat_statements \
   ORDER BY mean_exec_time DESC LIMIT 10;"

# Check connection pool wait times
curl http://localhost:8082/api/metrics/pool-wait-times
```

**Solutions**:

1. **Add missing indexes**
```sql
-- Find missing indexes
SELECT schemaname, tablename, attname
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND n_distinct > 100
  AND correlation < 0.1;

-- Add indexes
CREATE INDEX idx_users_email ON auth.users(email);
```

2. **Optimize queries**
```sql
-- Use EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM auth.users WHERE email = 'user@example.com';
```

#### High Disk I/O

**Diagnosis**:
```bash
# Check I/O stats
iostat -x 1 10

# Check which processes are using I/O
iotop
```

**Solutions**:

1. **Move to SSD**
2. **Increase shared_buffers**
```sql
ALTER SYSTEM SET shared_buffers = '2GB';
-- Restart PostgreSQL
```

3. **Enable query result caching**

## Backup and Recovery

### Backup Strategy

#### Daily Backups

```bash
#!/bin/bash
# /opt/supabase/scripts/daily-backup.sh

DATE=$(date +%Y%m%d)
BACKUP_DIR=/var/backups/supabase

# Backup main database
pg_dump -h localhost -U postgres -d postgres -F c \
  -f $BACKUP_DIR/postgres_$DATE.dump

# Backup each project database
for db in $(psql -h localhost -U postgres -d postgres -t -c \
  "SELECT database_name FROM projects WHERE status = 'active'"); do
  pg_dump -h localhost -U postgres -d $db -F c \
    -f $BACKUP_DIR/${db}_$DATE.dump
done

# Backup storage files
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz /var/lib/storage/

# Backup function code
tar -czf $BACKUP_DIR/functions_$DATE.tar.gz /var/lib/functions/

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.dump" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

#### Automated Backup Schedule

```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /opt/supabase/scripts/daily-backup.sh

# Weekly full backup at 3 AM on Sundays
0 3 * * 0 /opt/supabase/scripts/weekly-backup.sh
```

### Recovery Procedures

#### Restore Single Project

```bash
# Stop services
docker-compose stop studio

# Restore project database
pg_restore -h localhost -U postgres -d project_xxx -c \
  /var/backups/supabase/project_xxx_20250127.dump

# Restore project files
tar -xzf /var/backups/supabase/storage_20250127.tar.gz \
  -C / var/lib/storage/project_xxx/

# Restart services
docker-compose start studio
```

#### Restore All Projects

```bash
# Stop all services
docker-compose down

# Restore main database
pg_restore -h localhost -U postgres -d postgres -c \
  /var/backups/supabase/postgres_20250127.dump

# Restore all project databases
for dump in /var/backups/supabase/project_*_20250127.dump; do
  dbname=$(basename $dump _20250127.dump)
  pg_restore -h localhost -U postgres -d $dbname -c $dump
done

# Restore all files
tar -xzf /var/backups/supabase/storage_20250127.tar.gz -C /
tar -xzf /var/backups/supabase/functions_20250127.tar.gz -C /

# Start services
docker-compose up -d
```

#### Point-in-Time Recovery

```bash
# Enable WAL archiving
# In postgresql.conf:
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'

# Restore to specific time
pg_restore -h localhost -U postgres -d project_xxx \
  --use-set-session-authorization \
  /var/backups/supabase/project_xxx_base.dump

# Apply WAL files up to target time
# This requires WAL archiving to be enabled
```

## Performance Tuning

### PostgreSQL Tuning

```sql
-- Increase shared buffers (25% of RAM)
ALTER SYSTEM SET shared_buffers = '2GB';

-- Increase work memory
ALTER SYSTEM SET work_mem = '64MB';

-- Increase maintenance work memory
ALTER SYSTEM SET maintenance_work_mem = '512MB';

-- Increase effective cache size (50-75% of RAM)
ALTER SYSTEM SET effective_cache_size = '6GB';

-- Optimize checkpoint settings
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';

-- Restart PostgreSQL
-- docker-compose restart db
```

### Connection Pool Tuning

```typescript
// apps/studio/lib/service-router/ConnectionPoolManager.ts

const poolConfig = {
  // Adjust based on load
  max: 10,              // Max connections per project
  min: 2,               // Min connections to keep alive
  idleTimeoutMillis: 300000,  // 5 minutes
  connectionTimeoutMillis: 5000,
  
  // Enable statement timeout
  statement_timeout: 30000,  // 30 seconds
  
  // Enable query timeout
  query_timeout: 30000
}
```

### Caching Strategy

```typescript
// Implement Redis caching for project configs
import Redis from 'ioredis'

const redis = new Redis({
  host: 'localhost',
  port: 6379
})

async function getProjectConfig(projectRef: string): Promise<ProjectConfig> {
  // Try cache first
  const cached = await redis.get(`project:${projectRef}`)
  if (cached) {
    return JSON.parse(cached)
  }
  
  // Load from database
  const config = await loadFromDB(projectRef)
  
  // Cache for 5 minutes
  await redis.setex(`project:${projectRef}`, 300, JSON.stringify(config))
  
  return config
}
```

## Security Operations

### Security Checklist

- [ ] All passwords are strong and rotated regularly
- [ ] Database connections use SSL
- [ ] API endpoints require authentication
- [ ] Rate limiting is enabled
- [ ] Logs are monitored for suspicious activity
- [ ] Backups are encrypted
- [ ] Access logs are retained for 90 days
- [ ] Security updates are applied promptly

### Access Control

```bash
# Restrict database access
# In pg_hba.conf:
host    all    all    127.0.0.1/32    scram-sha-256
host    all    all    ::1/128         scram-sha-256

# Reload PostgreSQL
docker-compose exec db pg_ctl reload
```

### Audit Logging

```sql
-- Enable audit logging
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- Configure audit settings
ALTER SYSTEM SET pgaudit.log = 'all';
ALTER SYSTEM SET pgaudit.log_catalog = off;
ALTER SYSTEM SET pgaudit.log_parameter = on;

-- Restart PostgreSQL
```

### Security Monitoring

```bash
# Monitor failed login attempts
grep "authentication failed" /var/log/postgresql/*.log | \
  awk '{print $1, $2, $NF}' | sort | uniq -c | sort -rn

# Check for suspicious queries
grep "DROP\|DELETE\|TRUNCATE" /var/log/postgresql/*.log | \
  grep -v "pg_catalog"

# Monitor privilege escalations
grep "ALTER ROLE\|GRANT" /var/log/postgresql/*.log
```

## Maintenance Tasks

### Daily Tasks

- [ ] Check service health
- [ ] Review error logs
- [ ] Monitor disk space
- [ ] Verify backups completed

### Weekly Tasks

- [ ] Review performance metrics
- [ ] Check for slow queries
- [ ] Update statistics
- [ ] Test backup restoration
- [ ] Review security logs

### Monthly Tasks

- [ ] Apply security updates
- [ ] Review and optimize indexes
- [ ] Archive old logs
- [ ] Review capacity planning
- [ ] Update documentation

### Quarterly Tasks

- [ ] Disaster recovery drill
- [ ] Security audit
- [ ] Performance review
- [ ] Capacity planning review

## Emergency Procedures

### Service Outage

1. **Assess the situation**
   - Check service status
   - Review recent changes
   - Check error logs

2. **Communicate**
   - Notify users
   - Update status page
   - Inform team

3. **Restore service**
   - Restart failed services
   - Rollback recent changes if needed
   - Restore from backup if necessary

4. **Post-mortem**
   - Document what happened
   - Identify root cause
   - Implement preventive measures

### Data Corruption

1. **Stop writes immediately**
```bash
# Set database to read-only
psql -h localhost -U postgres -c \
  "ALTER DATABASE project_xxx SET default_transaction_read_only = on;"
```

2. **Assess damage**
```bash
# Check for corruption
psql -h localhost -U postgres -d project_xxx -c \
  "SELECT * FROM pg_stat_database WHERE datname = 'project_xxx';"
```

3. **Restore from backup**
```bash
# Restore latest good backup
pg_restore -h localhost -U postgres -d project_xxx -c \
  /var/backups/supabase/project_xxx_latest_good.dump
```

4. **Verify integrity**
```bash
# Run integrity checks
psql -h localhost -U postgres -d project_xxx -c \
  "SELECT * FROM auth.users LIMIT 1;"
```

## Support and Escalation

### Support Levels

**Level 1**: Basic troubleshooting
- Check logs
- Restart services
- Verify configuration

**Level 2**: Advanced troubleshooting
- Database optimization
- Performance tuning
- Complex debugging

**Level 3**: Critical issues
- Data corruption
- Security incidents
- System-wide outages

### Contact Information

- **On-call Engineer**: [Contact details]
- **Database Administrator**: [Contact details]
- **Security Team**: [Contact details]
- **Management**: [Contact details]

## Resources

- **User Guide**: `apps/studio/docs/USER-GUIDE.md`
- **Developer Guide**: `apps/studio/docs/DEVELOPER-GUIDE.md`
- **Design Document**: `.kiro/specs/project-level-service-isolation/design.md`
- **Requirements**: `.kiro/specs/project-level-service-isolation/requirements.md`

## Conclusion

This operations guide provides the essential procedures for deploying, maintaining, and troubleshooting the project-level service isolation feature. Regular maintenance and monitoring are key to ensuring system reliability and performance.

For additional support, consult the other documentation or contact the operations team.

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-27  
**Maintained By**: Operations Team
