#!/bin/bash
# Monitoring service for enhanced PostgREST container
# Requirements: 13.1, 13.5

set -euo pipefail

# Configuration
METRICS_PORT="${ENHANCED_METRICS_PORT:-9090}"
METRICS_INTERVAL="${ENHANCED_METRICS_INTERVAL:-30}"
PERFORMANCE_LOG="/var/log/postgrest/performance.log"
METRICS_LOG="/var/log/postgrest/metrics.log"

# Function to log metrics
log_metric() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$METRICS_LOG"
}

# Function to collect system metrics
collect_system_metrics() {
    local timestamp=$(date +%s)
    local memory_usage_kb memory_usage_mb cpu_usage disk_usage
    
    # Memory usage
    if command -v ps >/dev/null 2>&1; then
        memory_usage_kb=$(ps -o rss= -p $$ 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")
        memory_usage_mb=$((memory_usage_kb / 1024))
    else
        memory_usage_mb=0
    fi
    
    # CPU usage (simplified)
    if command -v top >/dev/null 2>&1; then
        cpu_usage=$(top -bn1 -p $$ 2>/dev/null | grep "^[[:space:]]*$$" | awk '{print $9}' || echo "0.0")
    else
        cpu_usage="0.0"
    fi
    
    # Disk usage for cache directory
    if [ -d "/tmp/postgrest-cache" ]; then
        disk_usage=$(du -sm /tmp/postgrest-cache 2>/dev/null | awk '{print $1}' || echo "0")
    else
        disk_usage=0
    fi
    
    # Log metrics in Prometheus format
    cat << EOF
# HELP postgrest_memory_usage_bytes Memory usage in bytes
# TYPE postgrest_memory_usage_bytes gauge
postgrest_memory_usage_bytes{container="supabase-rest"} $((memory_usage_mb * 1024 * 1024)) $timestamp

# HELP postgrest_cpu_usage_percent CPU usage percentage
# TYPE postgrest_cpu_usage_percent gauge
postgrest_cpu_usage_percent{container="supabase-rest"} $cpu_usage $timestamp

# HELP postgrest_disk_usage_bytes Disk usage in bytes
# TYPE postgrest_disk_usage_bytes gauge
postgrest_disk_usage_bytes{container="supabase-rest",path="/tmp/postgrest-cache"} $((disk_usage * 1024 * 1024)) $timestamp

EOF
}

# Function to collect PostgREST-specific metrics
collect_postgrest_metrics() {
    local timestamp=$(date +%s)
    local api_url="http://localhost:${PGRST_SERVER_PORT:-3000}"
    local response_time connection_count
    
    # API response time
    local start_time=$(date +%s%3N)
    if curl -f -s --max-time 5 "$api_url" >/dev/null 2>&1; then
        local end_time=$(date +%s%3N)
        response_time=$((end_time - start_time))
    else
        response_time=-1
    fi
    
    # Connection count (simplified - would need actual PostgREST metrics in production)
    connection_count=${PGRST_DB_POOL:-10}
    
    # Log metrics in Prometheus format
    cat << EOF
# HELP postgrest_api_response_time_ms API response time in milliseconds
# TYPE postgrest_api_response_time_ms gauge
postgrest_api_response_time_ms{container="supabase-rest"} $response_time $timestamp

# HELP postgrest_connection_pool_size Connection pool size
# TYPE postgrest_connection_pool_size gauge
postgrest_connection_pool_size{container="supabase-rest"} $connection_count $timestamp

# HELP postgrest_enhanced_features_enabled Enhanced features status
# TYPE postgrest_enhanced_features_enabled gauge
postgrest_enhanced_features_enabled{container="supabase-rest",feature="rpc"} $([ "${ENHANCED_RPC_ENABLED:-true}" = "true" ] && echo 1 || echo 0) $timestamp
postgrest_enhanced_features_enabled{container="supabase-rest",feature="json_ops"} $([ "${ENHANCED_JSON_OPS_ENABLED:-true}" = "true" ] && echo 1 || echo 0) $timestamp
postgrest_enhanced_features_enabled{container="supabase-rest",feature="fts"} $([ "${ENHANCED_FTS_ENABLED:-true}" = "true" ] && echo 1 || echo 0) $timestamp
postgrest_enhanced_features_enabled{container="supabase-rest",feature="aggregates"} $([ "${ENHANCED_AGGREGATES_ENABLED:-true}" = "true" ] && echo 1 || echo 0) $timestamp
postgrest_enhanced_features_enabled{container="supabase-rest",feature="bulk_ops"} $([ "${ENHANCED_BULK_OPS_ENABLED:-true}" = "true" ] && echo 1 || echo 0) $timestamp
postgrest_enhanced_features_enabled{container="supabase-rest",feature="transactions"} $([ "${ENHANCED_TRANSACTIONS_ENABLED:-true}" = "true" ] && echo 1 || echo 0) $timestamp
postgrest_enhanced_features_enabled{container="supabase-rest",feature="array_ops"} $([ "${ENHANCED_ARRAY_OPS_ENABLED:-true}" = "true" ] && echo 1 || echo 0) $timestamp

EOF
}

# Function to collect cache metrics
collect_cache_metrics() {
    local timestamp=$(date +%s)
    local cache_dir="/tmp/postgrest-cache"
    local cache_files=0 cache_size_mb=0
    
    if [ -d "$cache_dir" ]; then
        cache_files=$(find "$cache_dir" -type f 2>/dev/null | wc -l || echo "0")
        cache_size_mb=$(du -sm "$cache_dir" 2>/dev/null | awk '{print $1}' || echo "0")
    fi
    
    # Log cache metrics
    cat << EOF
# HELP postgrest_cache_files_total Number of cached files
# TYPE postgrest_cache_files_total gauge
postgrest_cache_files_total{container="supabase-rest"} $cache_files $timestamp

# HELP postgrest_cache_size_bytes Cache size in bytes
# TYPE postgrest_cache_size_bytes gauge
postgrest_cache_size_bytes{container="supabase-rest"} $((cache_size_mb * 1024 * 1024)) $timestamp

EOF
}

# Function to serve metrics via HTTP
serve_metrics() {
    local port="$1"
    
    log_metric "Starting metrics server on port $port"
    
    # Simple HTTP server using netcat
    while true; do
        {
            echo "HTTP/1.1 200 OK"
            echo "Content-Type: text/plain; version=0.0.4"
            echo "Cache-Control: no-cache"
            echo ""
            
            # Collect and output all metrics
            collect_system_metrics
            collect_postgrest_metrics
            collect_cache_metrics
            
            # Add timestamp
            echo "# HELP postgrest_metrics_last_updated_timestamp Last metrics update timestamp"
            echo "# TYPE postgrest_metrics_last_updated_timestamp gauge"
            echo "postgrest_metrics_last_updated_timestamp{container=\"supabase-rest\"} $(date +%s)"
            
        } | nc -l -p "$port" -q 1
        
        # Small delay to prevent overwhelming the system
        sleep 1
    done
}

# Function to collect and log performance metrics
collect_performance_metrics() {
    while true; do
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        local memory_mb cpu_percent response_time
        
        # Collect metrics
        if command -v ps >/dev/null 2>&1; then
            memory_mb=$(ps -o rss= -p $$ 2>/dev/null | awk '{print int($1/1024)}' || echo "0")
        else
            memory_mb=0
        fi
        
        # Test API response time
        local start_time=$(date +%s%3N)
        if curl -f -s --max-time 5 "http://localhost:${PGRST_SERVER_PORT:-3000}" >/dev/null 2>&1; then
            local end_time=$(date +%s%3N)
            response_time=$((end_time - start_time))
        else
            response_time=-1
        fi
        
        # Log performance data
        log_metric "PERF memory_mb=$memory_mb response_time_ms=$response_time"
        
        sleep "$METRICS_INTERVAL"
    done
}

# Function to handle graceful shutdown
graceful_shutdown() {
    log_metric "Monitoring service shutting down gracefully"
    exit 0
}

# Set up signal handlers
trap graceful_shutdown SIGTERM SIGINT SIGQUIT

# Main monitoring service
main() {
    log_metric "Starting Enhanced PostgREST Monitoring Service"
    log_metric "Metrics port: $METRICS_PORT"
    log_metric "Collection interval: ${METRICS_INTERVAL}s"
    
    # Create log directory
    mkdir -p "$(dirname "$METRICS_LOG")"
    
    # Start performance metrics collection in background
    collect_performance_metrics &
    local perf_pid=$!
    
    # Start metrics HTTP server
    serve_metrics "$METRICS_PORT" &
    local server_pid=$!
    
    log_metric "Monitoring service started (Performance PID: $perf_pid, Server PID: $server_pid)"
    
    # Wait for either process to exit
    wait $server_pid $perf_pid
}

# Run main function
main "$@"