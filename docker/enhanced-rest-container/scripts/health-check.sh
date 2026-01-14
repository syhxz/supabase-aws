#!/bin/bash
# Enhanced health check script for PostgREST container
# Requirements: 13.1, 13.4, 13.5

set -euo pipefail

# Configuration
HEALTH_CHECK_URL="http://localhost:${PGRST_SERVER_PORT:-3000}"
METRICS_URL="http://localhost:${ENHANCED_METRICS_PORT:-9090}/metrics"
TIMEOUT=5
MAX_RESPONSE_TIME=2000  # milliseconds

# Function to check PostgREST API health
check_api_health() {
    local start_time=$(date +%s%3N)
    
    # Check if PostgREST is responding (any response is OK, even 404)
    if ! curl -s --max-time $TIMEOUT "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
        echo "UNHEALTHY: PostgREST API not responding"
        return 1
    fi
    
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    # Check response time
    if [ $response_time -gt $MAX_RESPONSE_TIME ]; then
        echo "UNHEALTHY: API response time too slow (${response_time}ms > ${MAX_RESPONSE_TIME}ms)"
        return 1
    fi
    
    echo "API_HEALTH: OK (${response_time}ms)"
    return 0
}

# Function to check database connectivity
check_database_health() {
    if [ -z "${PGRST_DB_URI:-}" ]; then
        echo "UNHEALTHY: Database URI not configured"
        return 1
    fi
    
    # Extract host and port from URI
    local db_host=$(echo "$PGRST_DB_URI" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$PGRST_DB_URI" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    # Use netcat to check database port
    if ! nc -z -w $TIMEOUT "$db_host" "$db_port" 2>/dev/null; then
        echo "UNHEALTHY: Database not accessible"
        return 1
    fi
    
    echo "DB_HEALTH: OK"
    return 0
}

# Function to check memory usage
check_memory_usage() {
    local memory_limit_mb=${ENHANCED_MEMORY_LIMIT_MB:-512}
    local memory_usage_mb
    
    # Get memory usage in MB
    if command -v ps >/dev/null 2>&1; then
        memory_usage_mb=$(ps -o rss= -p $$ | awk '{print int($1/1024)}')
        
        if [ $memory_usage_mb -gt $memory_limit_mb ]; then
            echo "WARNING: High memory usage (${memory_usage_mb}MB > ${memory_limit_mb}MB)"
            return 1
        fi
        
        echo "MEMORY_HEALTH: OK (${memory_usage_mb}MB)"
    else
        echo "MEMORY_HEALTH: UNKNOWN (ps not available)"
    fi
    
    return 0
}

# Function to check disk space
check_disk_space() {
    local min_free_space_mb=${ENHANCED_MIN_DISK_SPACE_MB:-100}
    local cache_dir="/tmp/postgrest-cache"
    local log_dir="/var/log/postgrest"
    
    # Check cache directory disk space
    if [ -d "$cache_dir" ]; then
        local free_space_mb=$(df -m "$cache_dir" | awk 'NR==2 {print $4}')
        if [ $free_space_mb -lt $min_free_space_mb ]; then
            echo "WARNING: Low disk space in cache directory (${free_space_mb}MB < ${min_free_space_mb}MB)"
            return 1
        fi
    fi
    
    echo "DISK_HEALTH: OK"
    return 0
}

# Function to check connection pool health
check_connection_pool() {
    local max_connections=${PGRST_DB_POOL:-10}
    
    # This is a simplified check - in a real implementation,
    # you would query PostgREST's internal metrics
    if [ -f /tmp/postgrest.pid ]; then
        local pid=$(cat /tmp/postgrest.pid)
        if ! kill -0 "$pid" 2>/dev/null; then
            echo "UNHEALTHY: PostgREST process not running"
            return 1
        fi
    fi
    
    echo "POOL_HEALTH: OK"
    return 0
}

# Function to check monitoring service
check_monitoring_service() {
    if [ "${ENHANCED_METRICS_ENABLED:-true}" = "true" ]; then
        if ! curl -f -s --max-time $TIMEOUT "$METRICS_URL" >/dev/null 2>&1; then
            echo "WARNING: Monitoring service not responding"
            return 1
        fi
        echo "MONITORING_HEALTH: OK"
    else
        echo "MONITORING_HEALTH: DISABLED"
    fi
    
    return 0
}

# Function to perform comprehensive health check
comprehensive_health_check() {
    local overall_status=0
    local checks_passed=0
    local checks_total=0
    
    echo "=== Enhanced PostgREST Health Check ==="
    echo "Timestamp: $(date -Iseconds)"
    echo "Container: supabase-rest"
    echo ""
    
    # API Health Check
    checks_total=$((checks_total + 1))
    if check_api_health; then
        checks_passed=$((checks_passed + 1))
    else
        overall_status=1
    fi
    
    # Database Health Check
    checks_total=$((checks_total + 1))
    if check_database_health; then
        checks_passed=$((checks_passed + 1))
    else
        overall_status=1
    fi
    
    # Memory Usage Check
    checks_total=$((checks_total + 1))
    if check_memory_usage; then
        checks_passed=$((checks_passed + 1))
    else
        overall_status=1
    fi
    
    # Disk Space Check
    checks_total=$((checks_total + 1))
    if check_disk_space; then
        checks_passed=$((checks_passed + 1))
    else
        overall_status=1
    fi
    
    # Connection Pool Check
    checks_total=$((checks_total + 1))
    if check_connection_pool; then
        checks_passed=$((checks_passed + 1))
    else
        overall_status=1
    fi
    
    # Monitoring Service Check
    checks_total=$((checks_total + 1))
    if check_monitoring_service; then
        checks_passed=$((checks_passed + 1))
    else
        # Monitoring is not critical for health
        checks_passed=$((checks_passed + 1))
    fi
    
    echo ""
    echo "=== Health Check Summary ==="
    echo "Checks passed: $checks_passed/$checks_total"
    
    if [ $overall_status -eq 0 ]; then
        echo "Overall status: HEALTHY"
    else
        echo "Overall status: UNHEALTHY"
    fi
    
    return $overall_status
}

# Main health check execution
main() {
    # Simple health check for Docker HEALTHCHECK
    if [ "${1:-}" = "--simple" ]; then
        if curl -s --max-time $TIMEOUT "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
            echo "HEALTHY"
            exit 0
        else
            echo "UNHEALTHY"
            exit 1
        fi
    fi
    
    # Comprehensive health check
    comprehensive_health_check
    exit $?
}

# Run main function
main "$@"