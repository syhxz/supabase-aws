# Credential Monitoring and Alerting Guide

## Overview

This guide provides comprehensive monitoring and alerting recommendations for the credential management system in Supabase Studio. It covers key metrics, alerting thresholds, dashboard configurations, and operational procedures for maintaining system health.

## Key Metrics and KPIs

### Primary Metrics

#### 1. Fallback Usage Rate
- **Definition**: Percentage of projects using fallback credentials
- **Target**: < 5%
- **Warning Threshold**: > 10%
- **Critical Threshold**: > 25%
- **Collection Method**: Real-time API monitoring

#### 2. Credential Validation Success Rate
- **Definition**: Percentage of successful credential validations
- **Target**: > 99%
- **Warning Threshold**: < 95%
- **Critical Threshold**: < 90%
- **Collection Method**: Validation service metrics

#### 3. Migration Success Rate
- **Definition**: Percentage of successful credential migrations
- **Target**: > 95%
- **Warning Threshold**: < 90%
- **Critical Threshold**: < 80%
- **Collection Method**: Migration service logs

#### 4. API Response Time (Credential Operations)
- **Definition**: Average response time for credential-related API calls
- **Target**: < 200ms
- **Warning Threshold**: > 500ms
- **Critical Threshold**: > 1000ms
- **Collection Method**: Application performance monitoring

### Secondary Metrics

#### 5. Database Connection Success Rate
- **Definition**: Percentage of successful database connections using project credentials
- **Target**: > 99.5%
- **Warning Threshold**: < 98%
- **Critical Threshold**: < 95%

#### 6. Credential Audit Log Volume
- **Definition**: Number of credential-related events logged per hour
- **Baseline**: Establish based on system usage
- **Anomaly Detection**: > 3 standard deviations from baseline

#### 7. System Resource Utilization
- **CPU Usage**: < 70% average
- **Memory Usage**: < 80% average
- **Database Connections**: < 80% of pool limit

## Monitoring Infrastructure

### Metrics Collection

#### Application Metrics (Prometheus)

```yaml
# prometheus.yml configuration
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'supabase-studio-credentials'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics/credential-usage'
    scrape_interval: 30s

  - job_name: 'credential-monitoring-service'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

#### Custom Metrics Endpoints

```javascript
// /api/metrics/credential-usage
{
  "fallback_usage_rate": 0.08,
  "total_projects": 1250,
  "projects_using_fallback": 100,
  "validation_success_rate": 0.995,
  "migration_success_rate": 0.92,
  "avg_response_time_ms": 145,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Database Metrics

```sql
-- Credential status query for monitoring
SELECT 
  COUNT(*) as total_projects,
  COUNT(CASE WHEN database_user IS NULL OR database_password_hash IS NULL THEN 1 END) as projects_missing_credentials,
  COUNT(CASE WHEN database_user IS NOT NULL AND database_password_hash IS NOT NULL THEN 1 END) as projects_with_credentials,
  ROUND(
    COUNT(CASE WHEN database_user IS NULL OR database_password_hash IS NULL THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as fallback_usage_percentage
FROM projects;
```

### Log Aggregation

#### Structured Logging Configuration

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "credential-manager",
  "event_type": "fallback_used",
  "project_ref": "abc123def456",
  "reason": "missing_both",
  "user_id": "user_789",
  "duration_ms": 45,
  "metadata": {
    "fallback_source": "environment",
    "api_endpoint": "/api/platform/projects/abc123def456/databases"
  }
}
```

#### Log Parsing Rules (Fluentd/Logstash)

```ruby
# Fluentd configuration for credential logs
<source>
  @type tail
  path /var/log/supabase-studio/credential-*.log
  pos_file /var/log/fluentd/credential.log.pos
  tag credential.*
  format json
</source>

<filter credential.**>
  @type record_transformer
  <record>
    service_name "credential-management"
    environment "#{ENV['ENVIRONMENT']}"
  </record>
</filter>

<match credential.**>
  @type elasticsearch
  host elasticsearch.local
  port 9200
  index_name credential-logs
</match>
```

## Alerting Configuration

### Alert Definitions

#### Critical Alerts

##### 1. High Fallback Usage Rate
```yaml
# Prometheus Alert Rule
- alert: HighFallbackUsageRate
  expr: credential_fallback_usage_rate > 0.25
  for: 5m
  labels:
    severity: critical
    service: credential-management
  annotations:
    summary: "Critical: High fallback credential usage detected"
    description: "{{ $value | humanizePercentage }} of projects are using fallback credentials"
    runbook_url: "https://docs.internal/runbooks/credential-fallback-high"
```

##### 2. Credential System Failure
```yaml
- alert: CredentialSystemFailure
  expr: up{job="credential-monitoring-service"} == 0
  for: 2m
  labels:
    severity: critical
    service: credential-management
  annotations:
    summary: "Critical: Credential monitoring service is down"
    description: "Credential monitoring service has been down for more than 2 minutes"
    runbook_url: "https://docs.internal/runbooks/credential-system-failure"
```

##### 3. Mass Validation Failures
```yaml
- alert: MassValidationFailures
  expr: credential_validation_success_rate < 0.90
  for: 3m
  labels:
    severity: critical
    service: credential-management
  annotations:
    summary: "Critical: Mass credential validation failures"
    description: "Credential validation success rate is {{ $value | humanizePercentage }}"
    runbook_url: "https://docs.internal/runbooks/credential-validation-failures"
```

#### Warning Alerts

##### 1. Elevated Fallback Usage
```yaml
- alert: ElevatedFallbackUsage
  expr: credential_fallback_usage_rate > 0.10
  for: 10m
  labels:
    severity: warning
    service: credential-management
  annotations:
    summary: "Warning: Elevated fallback credential usage"
    description: "{{ $value | humanizePercentage }} of projects are using fallback credentials"
    runbook_url: "https://docs.internal/runbooks/credential-fallback-elevated"
```

##### 2. Slow Credential Operations
```yaml
- alert: SlowCredentialOperations
  expr: credential_operation_duration_seconds > 0.5
  for: 5m
  labels:
    severity: warning
    service: credential-management
  annotations:
    summary: "Warning: Slow credential operations detected"
    description: "Credential operations taking {{ $value }}s on average"
    runbook_url: "https://docs.internal/runbooks/credential-performance"
```

##### 3. Migration Failures
```yaml
- alert: MigrationFailures
  expr: credential_migration_success_rate < 0.90
  for: 15m
  labels:
    severity: warning
    service: credential-management
  annotations:
    summary: "Warning: Credential migration failures detected"
    description: "Migration success rate is {{ $value | humanizePercentage }}"
    runbook_url: "https://docs.internal/runbooks/credential-migration-failures"
```

### Notification Channels

#### Slack Integration
```yaml
# Alertmanager configuration
route:
  group_by: ['alertname', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'credential-alerts'

receivers:
- name: 'credential-alerts'
  slack_configs:
  - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    channel: '#credential-alerts'
    title: 'Credential System Alert'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
    actions:
    - type: button
      text: 'View Runbook'
      url: '{{ .CommonAnnotations.runbook_url }}'
    - type: button
      text: 'View Dashboard'
      url: 'https://grafana.internal/d/credential-dashboard'
```

#### Email Notifications
```yaml
- name: 'credential-email'
  email_configs:
  - to: 'platform-team@company.com'
    from: 'alerts@company.com'
    subject: 'Credential System Alert: {{ .GroupLabels.alertname }}'
    body: |
      Alert: {{ .GroupLabels.alertname }}
      Severity: {{ .CommonLabels.severity }}
      
      {{ range .Alerts }}
      Summary: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      Runbook: {{ .Annotations.runbook_url }}
      {{ end }}
```

#### PagerDuty Integration
```yaml
- name: 'credential-pagerduty'
  pagerduty_configs:
  - routing_key: 'YOUR_PAGERDUTY_INTEGRATION_KEY'
    description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'
    details:
      severity: '{{ .CommonLabels.severity }}'
      service: '{{ .CommonLabels.service }}'
      runbook: '{{ .CommonAnnotations.runbook_url }}'
```

## Dashboard Configuration

### Grafana Dashboard

#### Main Credential Management Dashboard

```json
{
  "dashboard": {
    "title": "Credential Management System",
    "panels": [
      {
        "title": "Fallback Usage Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "credential_fallback_usage_rate * 100",
            "legendFormat": "Fallback Usage %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                {"color": "green", "value": 0},
                {"color": "yellow", "value": 10},
                {"color": "red", "value": 25}
              ]
            }
          }
        }
      },
      {
        "title": "Projects by Credential Status",
        "type": "piechart",
        "targets": [
          {
            "expr": "credential_projects_with_credentials",
            "legendFormat": "Complete Credentials"
          },
          {
            "expr": "credential_projects_missing_credentials",
            "legendFormat": "Missing Credentials"
          }
        ]
      },
      {
        "title": "Credential Operations Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(credential_operation_duration_seconds_sum[5m]) / rate(credential_operation_duration_seconds_count[5m])",
            "legendFormat": "Average Response Time"
          },
          {
            "expr": "histogram_quantile(0.95, rate(credential_operation_duration_seconds_bucket[5m]))",
            "legendFormat": "95th Percentile"
          }
        ]
      },
      {
        "title": "Migration Success Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(credential_migrations_successful[1h]) / rate(credential_migrations_total[1h]) * 100",
            "legendFormat": "Success Rate %"
          }
        ]
      }
    ]
  }
}
```

#### Operational Dashboard

```json
{
  "dashboard": {
    "title": "Credential Operations Dashboard",
    "panels": [
      {
        "title": "Recent Fallback Usage Events",
        "type": "logs",
        "targets": [
          {
            "expr": "{service=\"credential-manager\"} |= \"fallback_used\"",
            "refId": "A"
          }
        ]
      },
      {
        "title": "Validation Failure Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(credential_validation_failures[5m])",
            "legendFormat": "Validation Failures/sec"
          }
        ]
      },
      {
        "title": "Database Connection Health",
        "type": "graph",
        "targets": [
          {
            "expr": "credential_db_connection_success_rate * 100",
            "legendFormat": "Connection Success Rate %"
          }
        ]
      }
    ]
  }
}
```

### Custom Monitoring Scripts

#### Health Check Script
```bash
#!/bin/bash
# credential-health-monitor.sh

METRICS_ENDPOINT="http://localhost:3000/api/metrics/credential-usage"
ALERT_THRESHOLD=0.15  # 15% fallback usage

# Fetch current metrics
METRICS=$(curl -s $METRICS_ENDPOINT)
FALLBACK_RATE=$(echo $METRICS | jq -r '.fallback_usage_rate')

# Check threshold
if (( $(echo "$FALLBACK_RATE > $ALERT_THRESHOLD" | bc -l) )); then
  echo "ALERT: High fallback usage detected: $FALLBACK_RATE"
  # Send alert notification
  curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"High credential fallback usage: $(echo "$FALLBACK_RATE * 100" | bc)%\"}" \
    $SLACK_WEBHOOK_URL
fi

# Log metrics for trending
echo "$(date -Iseconds),$FALLBACK_RATE" >> /var/log/credential-metrics.csv
```

#### Migration Progress Monitor
```javascript
#!/usr/bin/env node
// migration-progress-monitor.js

const { CredentialMonitoringService } = require('../lib/api/self-hosted/credential-monitoring-service');

async function monitorMigrationProgress() {
  const service = new CredentialMonitoringService();
  
  try {
    const stats = await service.getFallbackUsageStats();
    const healthCheck = await service.performCredentialHealthCheck();
    
    console.log('Migration Progress Report:');
    console.log(`Total Projects: ${stats.totalProjects}`);
    console.log(`Projects Using Fallback: ${stats.projectsUsingFallback}`);
    console.log(`Fallback Usage Rate: ${(stats.fallbackUsagePercentage).toFixed(2)}%`);
    console.log(`Health Score: ${healthCheck.overallScore}/100`);
    
    // Check if migration target is met
    const targetFallbackRate = 0.05; // 5%
    if (stats.fallbackUsagePercentage <= targetFallbackRate) {
      console.log('✓ Migration target achieved!');
    } else {
      const remaining = stats.projectsUsingFallback;
      console.log(`⚠ ${remaining} projects still need migration`);
    }
    
    // Export metrics for external monitoring
    const metrics = {
      timestamp: new Date().toISOString(),
      fallback_usage_rate: stats.fallbackUsagePercentage,
      projects_remaining: stats.projectsUsingFallback,
      health_score: healthCheck.overallScore
    };
    
    console.log(JSON.stringify(metrics));
    
  } catch (error) {
    console.error('Monitoring failed:', error);
    process.exit(1);
  }
}

// Run monitoring
monitorMigrationProgress();
```

## Operational Procedures

### Daily Monitoring Routine

#### Morning Health Check (9:00 AM)
```bash
# Run comprehensive health check
./scripts/credential-health-monitor.sh

# Check overnight alerts
curl -s "http://alertmanager:9093/api/v1/alerts" | jq '.data[] | select(.labels.service=="credential-management")'

# Review fallback usage trends
./scripts/generate-daily-credential-report.sh
```

#### Midday Review (1:00 PM)
```bash
# Check migration progress
node scripts/migration-progress-monitor.js

# Review performance metrics
curl -s "http://localhost:3000/api/metrics/credential-usage" | jq '.'

# Check for any validation issues
grep "validation_failed" /var/log/supabase-studio/credential-*.log | tail -10
```

#### Evening Summary (6:00 PM)
```bash
# Generate daily summary report
./scripts/generate-daily-summary.sh

# Check system resource usage
./scripts/check-credential-system-resources.sh

# Plan next day's migrations if needed
./scripts/plan-migration-batch.sh
```

### Weekly Monitoring Tasks

#### Monday: Migration Planning
- Review projects still using fallback credentials
- Plan migration batches for the week
- Check migration success rates from previous week

#### Wednesday: Performance Review
- Analyze credential operation performance trends
- Review database connection success rates
- Check for any performance degradation

#### Friday: Health Assessment
- Run comprehensive system health check
- Review alert patterns and false positives
- Update monitoring thresholds if needed

### Monthly Monitoring Tasks

#### Security Review
- Audit credential access patterns
- Review credential rotation schedules
- Check for any security anomalies

#### Capacity Planning
- Analyze growth in credential operations
- Plan infrastructure scaling if needed
- Review monitoring system capacity

#### Process Improvement
- Review alert effectiveness
- Update monitoring procedures
- Train team on new monitoring tools

## Alerting Runbooks

### High Fallback Usage Runbook

#### Immediate Actions (< 5 minutes)
1. **Verify Alert Accuracy**
   ```bash
   curl -s "http://localhost:3000/api/metrics/credential-usage" | jq '.fallback_usage_rate'
   ```

2. **Check System Health**
   ```bash
   ./scripts/credential-health-monitor.sh
   ```

3. **Identify Affected Projects**
   ```bash
   node scripts/list-projects-using-fallback.js --limit 10
   ```

#### Investigation (< 15 minutes)
1. **Analyze Fallback Patterns**
   ```bash
   grep "fallback_used" /var/log/supabase-studio/credential-*.log | tail -50
   ```

2. **Check for Recent Changes**
   ```bash
   git log --since="24 hours ago" --oneline
   ```

3. **Verify Migration Status**
   ```bash
   node scripts/check-migration-status.js
   ```

#### Resolution (< 30 minutes)
1. **If Migration Failure**: Restart failed migrations
2. **If System Issue**: Fix underlying system problem
3. **If Data Corruption**: Restore from backup and re-migrate

### Credential System Failure Runbook

#### Emergency Response (< 2 minutes)
1. **Enable Emergency Mode**
   ```bash
   export CREDENTIAL_EMERGENCY_MODE=true
   systemctl restart supabase-studio
   ```

2. **Verify Basic Functionality**
   ```bash
   curl -X GET "http://localhost:3000/api/health"
   ```

3. **Notify Stakeholders**
   ```bash
   ./scripts/send-emergency-notification.sh --type system-failure
   ```

#### Diagnosis and Recovery
1. **Check Service Status**
2. **Review Error Logs**
3. **Implement Recovery Procedures**
4. **Validate System Recovery**

## Best Practices

### Monitoring Strategy

1. **Layered Monitoring**
   - Application-level metrics
   - Infrastructure metrics
   - Business metrics
   - User experience metrics

2. **Proactive Alerting**
   - Set thresholds based on business impact
   - Use trend-based alerts for early warning
   - Implement escalation procedures

3. **Continuous Improvement**
   - Regular review of alert effectiveness
   - Update thresholds based on system behavior
   - Automate common remediation tasks

### Alert Management

1. **Alert Fatigue Prevention**
   - Tune alert thresholds carefully
   - Group related alerts
   - Implement alert suppression during maintenance

2. **Clear Escalation Paths**
   - Define ownership for each alert type
   - Document escalation procedures
   - Maintain up-to-date contact information

3. **Post-Incident Reviews**
   - Analyze alert effectiveness after incidents
   - Update procedures based on lessons learned
   - Share knowledge across the team

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Review Schedule**: Monthly  
**Related Documents**:
- [Credential Management Runbook](./CREDENTIAL-MANAGEMENT-RUNBOOK.md)
- [Credential Troubleshooting Guide](./CREDENTIAL-TROUBLESHOOTING-GUIDE.md)
- [Credential Migration Procedures](./CREDENTIAL-MIGRATION-PROCEDURES.md)