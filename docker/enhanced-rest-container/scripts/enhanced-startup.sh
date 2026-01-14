#!/bin/bash
# Enhanced PostgREST startup script with graceful shutdown and monitoring
# Requirements: 13.1, 13.2, 13.3, 13.4, 13.5

set -euo pipefail

# Configuration
POSTGREST_CONFIG_FILE="/etc/postgrest/enhanced/postgrest.conf"
PERFORMANCE_LOG="/var/log/postgrest/performance.log"
ERROR_LOG="/var/log/postgrest/error.log"
PID_FILE="/tmp/postgrest.pid"

# Enhanced environment variables with defaults
export PGRST_DB_URI="${PGRST_DB_URI:-}"
export PGRST_DB_SCHEMAS="${PGRST_DB_SCHEMAS:-public}"
export PGRST_DB_ANON_ROLE="${PGRST_DB_ANON_ROLE:-anon}"
export PGRST_JWT_SECRET="${PGRST_JWT_SECRET:-}"
export PGRST_DB_USE_LEGACY_GUCS="${PGRST_DB_USE_LEGACY_GUCS:-false}"

# Enhanced REST API configuration
export PGRST_DB_MAX_ROWS="${PGRST_DB_MAX_ROWS:-1000}"
export PGRST_DB_POOL="${PGRST_DB_POOL:-10}"
export PGRST_DB_POOL_TIMEOUT="${PGRST_DB_POOL_TIMEOUT:-10}"
export PGRST_DB_POOL_ACQUISITION_TIMEOUT="${PGRST_DB_POOL_ACQUISITION_TIMEOUT:-10}"
export PGRST_SERVER_HOST="${PGRST_SERVER_HOST:-0.0.0.0}"
export PGRST_SERVER_PORT="${PGRST_SERVER_PORT:-3000}"

# Performance optimization settings
export PGRST_DB_PREPARED_STATEMENTS="${PGRST_DB_PREPARED_STATEMENTS:-true}"
export PGRST_DB_CONFIG="${PGRST_DB_CONFIG:-true}"
export PGRST_DB_ROOT_SPEC="${PGRST_DB_ROOT_SPEC:-true}"

# Monitoring and logging configuration
export PGRST_LOG_LEVEL="${PGRST_LOG_LEVEL:-info}"
export PGRST_SERVER_TRACE_HEADER="${PGRST_SERVER_TRACE_HEADER:-X-Request-ID}"

# Enhanced features configuration
export ENHANCED_RPC_ENABLED="${ENHANCED_RPC_ENABLED:-true}"
export ENHANCED_JSON_OPS_ENABLED="${ENHANCED_JSON_OPS_ENABLED:-true}"
export ENHANCED_FTS_ENABLED="${ENHANCED_FTS_ENABLED:-true}"
export ENHANCED_AGGREGATES_ENABLED="${ENHANCED_AGGREGATES_ENABLED:-true}"
export ENHANCED_BULK_OPS_ENABLED="${ENHANCED_BULK_OPS_ENABLED:-true}"
export ENHANCED_TRANSACTIONS_ENABLED="${ENHANCED_TRANSACTIONS_ENABLED:-true}"
export ENHANCED_ARRAY_OPS_ENABLED="${ENHANCED_ARRAY_OPS_ENABLED:-true}"

# Cache configuration
export PGRST_DB_SCHEMA_CACHE_SIZE="${PGRST_DB_SCHEMA_CACHE_SIZE:-100}"
export ENHANCED_RESPONSE_CACHE_ENABLED="${ENHANCED_RESPONSE_CACHE_ENABLED:-true}"
export ENHANCED_RESPONSE_CACHE_TTL="${ENHANCED_RESPONSE_CACHE_TTL:-300}"

# Query complexity limits
export ENHANCED_MAX_QUERY_COMPLEXITY="${ENHANCED_MAX_QUERY_COMPLEXITY:-1000}"
export ENHANCED_MAX_NESTED_DEPTH="${ENHANCED_MAX_NESTED_DEPTH:-5}"
export ENHANCED_MAX_BULK_SIZE="${ENHANCED_MAX_BULK_SIZE:-1000}"

# Monitoring configuration
export ENHANCED_METRICS_ENABLED="${ENHANCED_METRICS_ENABLED:-true}"
export ENHANCED_METRICS_PORT="${ENHANCED_METRICS_PORT:-9090}"
export ENHANCED_HEALTH_CHECK_ENABLED="${ENHANCED_HEALTH_CHECK_ENABLED:-true}"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$ERROR_LOG"
}

# Function to log performance metrics
log_performance() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] PERF: $*" >> "$PERFORMANCE_LOG"
}

# Function to wait for database connection
wait_for_database() {
    log "Waiting for database connection..."
    local max_attempts=10
    local attempt=1
    
    # Extract host and port from PGRST_DB_URI
    local db_host=$(echo "$PGRST_DB_URI" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$PGRST_DB_URI" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    log "Checking database connectivity at ${db_host}:${db_port}"
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z -w 1 "$db_host" "$db_port" 2>/dev/null; then
            log "Database port is reachable"
            sleep 2  # Give database a moment to be fully ready
            return 0
        fi
        
        log "Database not ready (attempt $attempt/$max_attempts), waiting..."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    log "WARNING: Database not responding after $max_attempts attempts, starting PostgREST anyway"
    log "PostgREST will retry connection automatically"
    return 0  # Return success to allow PostgREST to start
}

# Function to generate enhanced PostgREST configuration
generate_config() {
    log "Generating enhanced PostgREST configuration..."
    
    # Use the database URI as-is for PostgREST configuration
    local db_uri_for_config="$PGRST_DB_URI"
    
    cat > "$POSTGREST_CONFIG_FILE" << EOF
# Enhanced PostgREST Configuration
# Generated at $(date)

# Database connection
db-uri = "$db_uri_for_config"
db-schemas = "$PGRST_DB_SCHEMAS"
db-anon-role = "$PGRST_DB_ANON_ROLE"
db-use-legacy-gucs = $PGRST_DB_USE_LEGACY_GUCS

# Connection pooling
db-pool = $PGRST_DB_POOL
db-pool-timeout = $PGRST_DB_POOL_TIMEOUT
db-pool-acquisition-timeout = $PGRST_DB_POOL_ACQUISITION_TIMEOUT

# Server configuration
server-host = "$PGRST_SERVER_HOST"
server-port = $PGRST_SERVER_PORT

# JWT configuration
jwt-secret = "$PGRST_JWT_SECRET"

# Performance optimization
db-prepared-statements = $PGRST_DB_PREPARED_STATEMENTS
db-config = $PGRST_DB_CONFIG
# Disable db-root-spec to avoid "function public.true not found" error
# OpenAPI schema will be generated by Studio instead
# db-root-spec = $PGRST_DB_ROOT_SPEC
db-max-rows = $PGRST_DB_MAX_ROWS

# Logging
log-level = "$PGRST_LOG_LEVEL"
server-trace-header = "$PGRST_SERVER_TRACE_HEADER"

# Schema cache
db-schema-cache-size = $PGRST_DB_SCHEMA_CACHE_SIZE
EOF

    log "Configuration generated successfully"
}

# Function to start monitoring service
start_monitoring() {
    if [ "$ENHANCED_METRICS_ENABLED" = "true" ]; then
        log "Starting monitoring service on port $ENHANCED_METRICS_PORT..."
        /usr/local/bin/monitoring-service.sh &
        echo $! > /tmp/monitoring.pid
    fi
}

# Function to handle graceful shutdown
graceful_shutdown() {
    log "Received shutdown signal, performing graceful shutdown..."
    
    # Stop monitoring service
    if [ -f /tmp/monitoring.pid ]; then
        local monitoring_pid=$(cat /tmp/monitoring.pid)
        if kill -0 "$monitoring_pid" 2>/dev/null; then
            log "Stopping monitoring service (PID: $monitoring_pid)..."
            kill -TERM "$monitoring_pid" 2>/dev/null || true
            wait "$monitoring_pid" 2>/dev/null || true
        fi
        rm -f /tmp/monitoring.pid
    fi
    
    # Stop PostgREST
    if [ -f "$PID_FILE" ]; then
        local postgrest_pid=$(cat "$PID_FILE")
        if kill -0 "$postgrest_pid" 2>/dev/null; then
            log "Stopping PostgREST (PID: $postgrest_pid)..."
            kill -TERM "$postgrest_pid" 2>/dev/null || true
            
            # Wait for graceful shutdown with timeout
            local timeout=30
            local count=0
            while kill -0 "$postgrest_pid" 2>/dev/null && [ $count -lt $timeout ]; do
                sleep 1
                count=$((count + 1))
            done
            
            # Force kill if still running
            if kill -0 "$postgrest_pid" 2>/dev/null; then
                log "Force killing PostgREST..."
                kill -KILL "$postgrest_pid" 2>/dev/null || true
            fi
        fi
        rm -f "$PID_FILE"
    fi
    
    log "Graceful shutdown completed"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap graceful_shutdown SIGTERM SIGINT SIGQUIT

# Main startup sequence
main() {
    log "Starting Enhanced PostgREST Container..."
    log "Version: PostgREST v13.0.7 with Supabase enhancements"
    
    # Create log directories
    mkdir -p "$(dirname "$PERFORMANCE_LOG")"
    mkdir -p "$(dirname "$ERROR_LOG")"
    
    # Wait for database
    if ! wait_for_database; then
        log "ERROR: Database connection failed, exiting"
        exit 1
    fi
    
    # Generate configuration
    generate_config
    
    # Start monitoring service
    start_monitoring
    
    # Log startup configuration
    log "Enhanced features enabled:"
    log "  - RPC Functions: $ENHANCED_RPC_ENABLED"
    log "  - JSON Operations: $ENHANCED_JSON_OPS_ENABLED"
    log "  - Full-Text Search: $ENHANCED_FTS_ENABLED"
    log "  - Aggregates: $ENHANCED_AGGREGATES_ENABLED"
    log "  - Bulk Operations: $ENHANCED_BULK_OPS_ENABLED"
    log "  - Transactions: $ENHANCED_TRANSACTIONS_ENABLED"
    log "  - Array Operations: $ENHANCED_ARRAY_OPS_ENABLED"
    log "  - Response Cache: $ENHANCED_RESPONSE_CACHE_ENABLED"
    log "  - Metrics: $ENHANCED_METRICS_ENABLED"
    
    log_performance "Container startup completed"
    
    # Start PostgREST with enhanced configuration
    log "Starting PostgREST with configuration: $POSTGREST_CONFIG_FILE"
    exec "$@" "$POSTGREST_CONFIG_FILE" &
    
    # Store PID for graceful shutdown
    echo $! > "$PID_FILE"
    
    # Wait for PostgREST process
    wait $!
}

# Run main function
main "$@"