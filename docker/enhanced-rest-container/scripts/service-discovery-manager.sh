#!/bin/bash
# Service Discovery Manager Module
# Requirements: 3.1, 3.2, 6.1, 6.3, 3.3, 3.5, 4.3
# Provides functions for Docker service discovery and service availability validation

set -euo pipefail

# Source required modules
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/docker-network-detection.sh"
source "$SCRIPT_DIR/dns-resolution-validator.sh"

# Configuration
SERVICE_CACHE_FILE="/tmp/service-discovery-cache"
SERVICE_CACHE_TTL=300  # 5 minutes
SERVICE_DISCOVERY_TIMEOUT=10  # Service discovery timeout in seconds
DEBUG_SERVICE_DISCOVERY="${DEBUG_SERVICE_DISCOVERY:-false}"

# Function to log debug information
debug_log() {
    if [ "$DEBUG_SERVICE_DISCOVERY" = "true" ]; then
        echo "[DEBUG] $(date '+%Y-%m-%d %H:%M:%S') SERVICE: $*" >&2
    fi
}

# Function to log service discovery information
log_service() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SERVICE: $*"
}

# Function to check if service cache is valid
is_service_cache_valid() {
    local cache_key="$1"
    local cache_entry_file="${SERVICE_CACHE_FILE}.${cache_key}"
    
    if [ ! -f "$cache_entry_file" ]; then
        debug_log "Service cache entry does not exist for: $cache_key"
        return 1
    fi
    
    local cache_timestamp
    cache_timestamp=$(stat -c %Y "$cache_entry_file" 2>/dev/null || echo 0)
    local current_timestamp
    current_timestamp=$(date +%s)
    local cache_age=$((current_timestamp - cache_timestamp))
    
    if [ $cache_age -gt $SERVICE_CACHE_TTL ]; then
        debug_log "Service cache expired for $cache_key (age: ${cache_age}s, TTL: ${SERVICE_CACHE_TTL}s)"
        return 1
    fi
    
    debug_log "Service cache is valid for $cache_key (age: ${cache_age}s)"
    return 0
}

# Function to cache service discovery result
cache_service_result() {
    local cache_key="$1"
    local discovery_result="$2"
    local cache_entry_file="${SERVICE_CACHE_FILE}.${cache_key}"
    
    # Create cache directory if it doesn't exist
    mkdir -p "$(dirname "$cache_entry_file")"
    
    echo "$discovery_result" > "$cache_entry_file"
    debug_log "Service discovery result cached for: $cache_key"
}

# Function to get cached service discovery result
get_cached_service_result() {
    local cache_key="$1"
    local cache_entry_file="${SERVICE_CACHE_FILE}.${cache_key}"
    
    if is_service_cache_valid "$cache_key"; then
        cat "$cache_entry_file"
        return 0
    fi
    
    return 1
}

# Function to discover services using Docker Compose service names
discover_compose_services() {
    local target_service="${1:-}"
    local network_context="${2:-}"
    local discovery_result=""
    local discovered_services=()
    local service_status="unknown"
    
    debug_log "Discovering Docker Compose services (target: ${target_service:-all}, network: ${network_context:-auto})"
    
    # Get network information if not provided
    if [ -z "$network_context" ]; then
        network_context=$(get_network_info_field "network")
        debug_log "Auto-detected network context: $network_context"
    fi
    
    # Common Docker Compose service names to check
    local common_services=("db" "database" "postgres" "postgresql" "mysql" "mariadb" "redis" "mongo" "mongodb")
    
    # If target service is specified, prioritize it
    if [ -n "$target_service" ]; then
        common_services=("$target_service" "${common_services[@]}")
    fi
    
    # Remove duplicates from service list
    local unique_services=()
    for service in "${common_services[@]}"; do
        local found=false
        if [ ${#unique_services[@]} -gt 0 ]; then
            for unique in "${unique_services[@]}"; do
                if [ "$service" = "$unique" ]; then
                    found=true
                    break
                fi
            done
        fi
        if [ "$found" = false ]; then
            unique_services+=("$service")
        fi
    done
    
    debug_log "Testing ${#unique_services[@]} potential service names"
    
    # Test each service name for DNS resolution
    for service_name in "${unique_services[@]}"; do
        debug_log "Testing service discovery for: $service_name"
        
        # Test DNS resolution for the service
        local resolution_result
        resolution_result=$(test_service_name_resolution "$service_name")
        local resolution_status
        resolution_status=$(echo "$resolution_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
        
        if [ "$resolution_status" = "success" ]; then
            local resolved_ip
            resolved_ip=$(echo "$resolution_result" | sed -n 's/.*ip=\([^;]*\).*/\1/p' || echo "")
            local response_time
            response_time=$(echo "$resolution_result" | sed -n 's/.*time=\([^;]*\).*/\1/p' || echo "")
            local resolution_method
            resolution_method=$(echo "$resolution_result" | sed -n 's/.*method=\([^;]*\).*/\1/p' || echo "")
            
            discovered_services+=("${service_name}:${resolved_ip}:${response_time}:${resolution_method}")
            debug_log "Service discovered: $service_name -> $resolved_ip (${response_time}s via $resolution_method)"
            
            # If this is the target service, mark as found
            if [ -n "$target_service" ] && [ "$service_name" = "$target_service" ]; then
                service_status="found"
            fi
        else
            debug_log "Service not found: $service_name"
        fi
    done
    
    # Build discovery result
    if [ ${#discovered_services[@]} -gt 0 ]; then
        local services_str
        services_str=$(IFS=','; echo "${discovered_services[*]}")
        discovery_result="status=success;network=${network_context};services=${services_str};count=${#discovered_services[@]}"
        
        if [ -n "$target_service" ]; then
            discovery_result="${discovery_result};target=${target_service};target_status=${service_status}"
        fi
        
        log_service "Service discovery completed: found ${#discovered_services[@]} service(s) in network $network_context"
    else
        discovery_result="status=no_services;network=${network_context};count=0"
        
        if [ -n "$target_service" ]; then
            discovery_result="${discovery_result};target=${target_service};target_status=not_found"
        fi
        
        log_service "Service discovery completed: no services found in network $network_context"
    fi
    
    echo "$discovery_result"
}

# Function to discover services using Docker network aliases
discover_network_aliases() {
    local target_service="${1:-}"
    local network_context="${2:-}"
    local discovery_result=""
    local discovered_aliases=()
    
    debug_log "Discovering Docker network aliases (target: ${target_service:-all}, network: ${network_context:-auto})"
    
    # Get network information if not provided
    if [ -z "$network_context" ]; then
        network_context=$(get_network_info_field "network")
        debug_log "Auto-detected network context: $network_context"
    fi
    
    # Common Docker network aliases to check
    local common_aliases=("db" "database" "postgres" "postgresql" "mysql" "mariadb" "redis" "mongo" "mongodb")
    
    # Add service-specific aliases based on network name
    if [[ "$network_context" =~ supabase ]]; then
        common_aliases+=("supabase-db" "supabase_db" "db.supabase" "postgres.supabase")
    fi
    
    # Add target service variations if specified
    if [ -n "$target_service" ]; then
        common_aliases+=("$target_service" "${target_service}.local" "${target_service}.${network_context}")
    fi
    
    # Remove duplicates from alias list
    local unique_aliases=()
    for alias in "${common_aliases[@]}"; do
        local found=false
        if [ ${#unique_aliases[@]} -gt 0 ]; then
            for unique in "${unique_aliases[@]}"; do
                if [ "$alias" = "$unique" ]; then
                    found=true
                    break
                fi
            done
        fi
        if [ "$found" = false ]; then
            unique_aliases+=("$alias")
        fi
    done
    
    debug_log "Testing ${#unique_aliases[@]} potential network aliases"
    
    # Test each alias for DNS resolution
    for alias_name in "${unique_aliases[@]}"; do
        debug_log "Testing network alias: $alias_name"
        
        # Test DNS resolution for the alias
        local resolution_result
        resolution_result=$(test_service_name_resolution "$alias_name")
        local resolution_status
        resolution_status=$(echo "$resolution_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
        
        if [ "$resolution_status" = "success" ]; then
            local resolved_ip
            resolved_ip=$(echo "$resolution_result" | sed -n 's/.*ip=\([^;]*\).*/\1/p' || echo "")
            local response_time
            response_time=$(echo "$resolution_result" | sed -n 's/.*time=\([^;]*\).*/\1/p' || echo "")
            
            discovered_aliases+=("${alias_name}:${resolved_ip}:${response_time}")
            debug_log "Network alias discovered: $alias_name -> $resolved_ip (${response_time}s)"
        else
            debug_log "Network alias not found: $alias_name"
        fi
    done
    
    # Build discovery result
    if [ ${#discovered_aliases[@]} -gt 0 ]; then
        local aliases_str
        aliases_str=$(IFS=','; echo "${discovered_aliases[*]}")
        discovery_result="status=success;network=${network_context};aliases=${aliases_str};count=${#discovered_aliases[@]}"
        
        log_service "Network alias discovery completed: found ${#discovered_aliases[@]} alias(es) in network $network_context"
    else
        discovery_result="status=no_aliases;network=${network_context};count=0"
        
        log_service "Network alias discovery completed: no aliases found in network $network_context"
    fi
    
    echo "$discovery_result"
}

# Function to implement fallback discovery methods
fallback_service_discovery() {
    local target_service="$1"
    local network_context="${2:-}"
    local discovery_result=""
    local fallback_methods=()
    local successful_fallbacks=()
    
    debug_log "Attempting fallback service discovery for: $target_service"
    
    # Get network information if not provided
    if [ -z "$network_context" ]; then
        network_context=$(get_network_info_field "network")
        debug_log "Auto-detected network context: $network_context"
    fi
    
    # Fallback method 1: Try with different DNS servers
    debug_log "Fallback method 1: Alternative DNS servers"
    local dns_servers=("8.8.8.8" "1.1.1.1" "127.0.0.11")
    
    for dns_server in "${dns_servers[@]}"; do
        debug_log "Trying DNS server: $dns_server"
        local resolution_result
        resolution_result=$(resolve_with_nslookup "$target_service" "$dns_server")
        local resolution_status
        resolution_status=$(echo "$resolution_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
        
        if [ "$resolution_status" = "success" ]; then
            fallback_methods+=("dns_server_${dns_server}")
            successful_fallbacks+=("dns_server_${dns_server}:$(echo "$resolution_result" | sed -n 's/.*ip=\([^;]*\).*/\1/p')")
            debug_log "Fallback successful with DNS server $dns_server"
            break
        fi
    done
    
    # Fallback method 2: Try common service name variations
    debug_log "Fallback method 2: Service name variations"
    local service_variations=("${target_service}" "${target_service}-service" "${target_service}_service" "${target_service}.local")
    
    for variation in "${service_variations[@]}"; do
        if [ "$variation" = "$target_service" ]; then
            continue  # Skip the original name as it was already tested
        fi
        
        debug_log "Trying service variation: $variation"
        local resolution_result
        resolution_result=$(test_service_name_resolution "$variation")
        local resolution_status
        resolution_status=$(echo "$resolution_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
        
        if [ "$resolution_status" = "success" ]; then
            fallback_methods+=("variation_${variation}")
            successful_fallbacks+=("variation_${variation}:$(echo "$resolution_result" | sed -n 's/.*ip=\([^;]*\).*/\1/p')")
            debug_log "Fallback successful with service variation $variation"
            break
        fi
    done
    
    # Fallback method 3: Try network-specific service names
    debug_log "Fallback method 3: Network-specific service names"
    if [ -n "$network_context" ] && [ "$network_context" != "unknown" ]; then
        local network_specific_names=("${target_service}.${network_context}" "${network_context}_${target_service}" "${network_context}-${target_service}")
        
        for network_name in "${network_specific_names[@]}"; do
            debug_log "Trying network-specific name: $network_name"
            local resolution_result
            resolution_result=$(test_service_name_resolution "$network_name")
            local resolution_status
            resolution_status=$(echo "$resolution_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
            
            if [ "$resolution_status" = "success" ]; then
                fallback_methods+=("network_specific_${network_name}")
                successful_fallbacks+=("network_specific_${network_name}:$(echo "$resolution_result" | sed -n 's/.*ip=\([^;]*\).*/\1/p')")
                debug_log "Fallback successful with network-specific name $network_name"
                break
            fi
        done
    fi
    
    # Build fallback discovery result
    if [ ${#successful_fallbacks[@]} -gt 0 ]; then
        local fallbacks_str
        fallbacks_str=$(IFS=','; echo "${successful_fallbacks[*]}")
        local methods_str
        methods_str=$(IFS=','; echo "${fallback_methods[*]}")
        discovery_result="status=success;service=${target_service};network=${network_context};fallbacks=${fallbacks_str};methods=${methods_str};count=${#successful_fallbacks[@]}"
        
        log_service "Fallback service discovery successful for $target_service: ${#successful_fallbacks[@]} method(s) worked"
    else
        discovery_result="status=failed;service=${target_service};network=${network_context};count=0"
        
        log_service "Fallback service discovery failed for $target_service: all methods exhausted"
    fi
    
    echo "$discovery_result"
}

# Function to discover database service within Docker networks
discover_database_service() {
    local service_name="${1:-db}"
    local network_context="${2:-}"
    local cache_key="${service_name}_${network_context:-auto}"
    local discovery_result=""
    
    debug_log "Starting database service discovery for: $service_name"
    
    # Check cache first
    if get_cached_service_result "$cache_key" >/dev/null 2>&1; then
        local cached_result
        cached_result=$(get_cached_service_result "$cache_key")
        debug_log "Using cached service discovery result for: $service_name"
        echo "$cached_result"
        return 0
    fi
    
    # Get network information if not provided
    if [ -z "$network_context" ]; then
        network_context=$(get_network_info_field "network")
        debug_log "Auto-detected network context: $network_context"
    fi
    
    # Step 1: Try standard Docker Compose service discovery
    debug_log "Step 1: Standard Docker Compose service discovery"
    local compose_result
    compose_result=$(discover_compose_services "$service_name" "$network_context")
    local compose_status
    compose_status=$(echo "$compose_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
    
    if [ "$compose_status" = "success" ]; then
        local target_status
        target_status=$(echo "$compose_result" | sed -n 's/.*target_status=\([^;]*\).*/\1/p' || echo "unknown")
        
        if [ "$target_status" = "found" ]; then
            discovery_result="$compose_result;discovery_method=compose_standard"
            cache_service_result "$cache_key" "$discovery_result"
            log_service "Database service discovered using standard Compose method: $service_name"
            echo "$discovery_result"
            return 0
        fi
    fi
    
    # Step 2: Try Docker network aliases discovery
    debug_log "Step 2: Docker network aliases discovery"
    local aliases_result
    aliases_result=$(discover_network_aliases "$service_name" "$network_context")
    local aliases_status
    aliases_status=$(echo "$aliases_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
    
    if [ "$aliases_status" = "success" ]; then
        discovery_result="$aliases_result;discovery_method=network_aliases"
        cache_service_result "$cache_key" "$discovery_result"
        log_service "Database service discovered using network aliases method: $service_name"
        echo "$discovery_result"
        return 0
    fi
    
    # Step 3: Try fallback discovery methods
    debug_log "Step 3: Fallback discovery methods"
    local fallback_result
    fallback_result=$(fallback_service_discovery "$service_name" "$network_context")
    local fallback_status
    fallback_status=$(echo "$fallback_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
    
    if [ "$fallback_status" = "success" ]; then
        discovery_result="$fallback_result;discovery_method=fallback"
        cache_service_result "$cache_key" "$discovery_result"
        log_service "Database service discovered using fallback methods: $service_name"
        echo "$discovery_result"
        return 0
    fi
    
    # All methods failed
    discovery_result="status=not_found;service=${service_name};network=${network_context};discovery_method=all_failed"
    log_service "Database service discovery failed for $service_name: service not found in network $network_context"
    
    echo "$discovery_result"
}

# Function to list all available services in the Docker network
list_available_services() {
    local network_context="${1:-}"
    local discovery_result=""
    local all_services=()
    
    debug_log "Listing all available services in Docker network"
    
    # Get network information if not provided
    if [ -z "$network_context" ]; then
        network_context=$(get_network_info_field "network")
        debug_log "Auto-detected network context: $network_context"
    fi
    
    # Discover all Compose services
    local compose_result
    compose_result=$(discover_compose_services "" "$network_context")
    local compose_services
    compose_services=$(echo "$compose_result" | sed -n 's/.*services=\([^;]*\).*/\1/p' || echo "")
    
    if [ -n "$compose_services" ]; then
        IFS=',' read -ra compose_array <<< "$compose_services"
        for service_info in "${compose_array[@]}"; do
            local service_name
            service_name=$(echo "$service_info" | cut -d':' -f1)
            all_services+=("$service_name")
        done
    fi
    
    # Discover network aliases
    local aliases_result
    aliases_result=$(discover_network_aliases "" "$network_context")
    local network_aliases
    network_aliases=$(echo "$aliases_result" | sed -n 's/.*aliases=\([^;]*\).*/\1/p' || echo "")
    
    if [ -n "$network_aliases" ]; then
        IFS=',' read -ra aliases_array <<< "$network_aliases"
        for alias_info in "${aliases_array[@]}"; do
            local alias_name
            alias_name=$(echo "$alias_info" | cut -d':' -f1)
            
            # Check if already in services list
            local found=false
            if [ ${#all_services[@]} -gt 0 ]; then
                for service in "${all_services[@]}"; do
                    if [ "$service" = "$alias_name" ]; then
                        found=true
                        break
                    fi
                done
            fi
            
            if [ "$found" = false ]; then
                all_services+=("$alias_name")
            fi
        done
    fi
    
    # Build result
    if [ ${#all_services[@]} -gt 0 ]; then
        local services_str
        services_str=$(IFS=','; echo "${all_services[*]}")
        discovery_result="status=success;network=${network_context};services=${services_str};count=${#all_services[@]}"
        
        log_service "Available services listed: found ${#all_services[@]} service(s) in network $network_context"
    else
        discovery_result="status=no_services;network=${network_context};count=0"
        
        log_service "No services found in network $network_context"
    fi
    
    echo "$discovery_result"
}

# Function to clear service discovery cache
clear_service_cache() {
    local cache_pattern="${SERVICE_CACHE_FILE}.*"
    
    if ls $cache_pattern >/dev/null 2>&1; then
        rm -f $cache_pattern
        debug_log "Service discovery cache cleared"
        log_service "Service discovery cache cleared"
    else
        debug_log "No service discovery cache files to clear"
    fi
}

# Function to display service discovery cache status
display_service_cache_status() {
    local cache_files=0
    if ls "${SERVICE_CACHE_FILE}".* >/dev/null 2>&1; then
        cache_files=$(ls "${SERVICE_CACHE_FILE}".* 2>/dev/null | wc -l)
    fi
    
    echo "=== Service Discovery Cache Status ==="
    echo "Cache files: $cache_files"
    echo "Cache TTL: ${SERVICE_CACHE_TTL}s"
    echo "Cache location: $SERVICE_CACHE_FILE.*"
    
    if [ "$cache_files" -gt 0 ]; then
        echo "Cached entries:"
        for cache_file in "${SERVICE_CACHE_FILE}".*; do
            if [ -f "$cache_file" ]; then
                local cache_key
                cache_key=$(basename "$cache_file" | sed "s/$(basename "$SERVICE_CACHE_FILE")\.//")
                local cache_age
                cache_age=$(( $(date +%s) - $(stat -c %Y "$cache_file" 2>/dev/null || echo 0) ))
                local cache_status="valid"
                if [ $cache_age -gt $SERVICE_CACHE_TTL ]; then
                    cache_status="expired"
                fi
                echo "  $cache_key: ${cache_age}s old ($cache_status)"
            fi
        done
    fi
    echo "======================================"
}

# ============================================================================
# SERVICE AVAILABILITY VALIDATION FUNCTIONS
# Requirements: 3.3, 3.5, 4.3
# ============================================================================

# Function to validate database service connectivity
validate_database_connectivity() {
    local service_endpoint="$1"
    local connection_timeout="${2:-10}"
    local validation_result=""
    local connectivity_status="unknown"
    local connection_details=""
    local error_message=""
    
    debug_log "Validating database service connectivity: $service_endpoint"
    
    # Parse service endpoint (format: host:port or just host)
    local service_host=""
    local service_port=""
    
    if [[ "$service_endpoint" =~ : ]]; then
        service_host=$(echo "$service_endpoint" | cut -d':' -f1)
        service_port=$(echo "$service_endpoint" | cut -d':' -f2)
    else
        service_host="$service_endpoint"
        service_port="5432"  # Default PostgreSQL port
    fi
    
    debug_log "Testing connectivity to $service_host:$service_port"
    
    # Test 1: Basic network connectivity (port check)
    debug_log "Test 1: Basic network connectivity"
    local port_check_result
    port_check_result=$(test_port_connectivity "$service_host" "$service_port" "$connection_timeout")
    local port_status
    port_status=$(echo "$port_check_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
    
    if [ "$port_status" != "accessible" ]; then
        connectivity_status="port_unreachable"
        error_message="Cannot connect to port $service_port on $service_host"
        debug_log "ERROR: Port connectivity test failed"
    else
        debug_log "Port connectivity test passed"
        
        # Test 2: Database-specific connectivity (if PostgreSQL tools available)
        debug_log "Test 2: Database-specific connectivity"
        local db_check_result
        db_check_result=$(test_database_specific_connectivity "$service_host" "$service_port" "$connection_timeout")
        local db_status
        db_status=$(echo "$db_check_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
        
        if [ "$db_status" = "accessible" ]; then
            connectivity_status="accessible"
            connection_details="port_check=passed;db_check=passed"
            debug_log "Database-specific connectivity test passed"
        elif [ "$db_status" = "auth_required" ]; then
            connectivity_status="auth_required"
            connection_details="port_check=passed;db_check=auth_required"
            debug_log "Database requires authentication (expected)"
        else
            connectivity_status="service_unreachable"
            error_message="Service is listening but not responding as expected database"
            connection_details="port_check=passed;db_check=failed"
            debug_log "WARNING: Port is open but database service not responding correctly"
        fi
    fi
    
    # Build validation result
    validation_result="status=${connectivity_status};endpoint=${service_endpoint};host=${service_host};port=${service_port}"
    
    if [ -n "$connection_details" ]; then
        validation_result="${validation_result};details=${connection_details}"
    fi
    
    if [ -n "$error_message" ]; then
        validation_result="${validation_result};error=${error_message}"
    fi
    
    # Log result
    if [ "$connectivity_status" = "accessible" ] || [ "$connectivity_status" = "auth_required" ]; then
        log_service "Database connectivity validation successful: $service_endpoint ($connectivity_status)"
    else
        log_service "Database connectivity validation failed: $service_endpoint ($connectivity_status)"
    fi
    
    echo "$validation_result"
}

# Function to test port connectivity
test_port_connectivity() {
    local host="$1"
    local port="$2"
    local timeout="${3:-5}"
    local connectivity_result=""
    local status="failed"
    local response_time=""
    local error_message=""
    
    debug_log "Testing port connectivity: $host:$port (timeout: ${timeout}s)"
    
    local start_time
    start_time=$(date +%s.%N)
    
    # Try different methods for port connectivity testing
    if command -v nc >/dev/null 2>&1; then
        debug_log "Using netcat (nc) for port test"
        if timeout "$timeout" nc -z "$host" "$port" >/dev/null 2>&1; then
            status="accessible"
            debug_log "Port $port on $host is accessible via nc"
        else
            error_message="nc_connection_failed"
            debug_log "Port $port on $host is not accessible via nc"
        fi
    elif command -v telnet >/dev/null 2>&1; then
        debug_log "Using telnet for port test"
        local telnet_output
        telnet_output=$(timeout "$timeout" telnet "$host" "$port" 2>&1 <<< "" || echo "failed")
        if [[ "$telnet_output" =~ Connected ]]; then
            status="accessible"
            debug_log "Port $port on $host is accessible via telnet"
        else
            error_message="telnet_connection_failed"
            debug_log "Port $port on $host is not accessible via telnet"
        fi
    elif command -v bash >/dev/null 2>&1; then
        debug_log "Using bash built-in for port test"
        if timeout "$timeout" bash -c "exec 3<>/dev/tcp/$host/$port" >/dev/null 2>&1; then
            status="accessible"
            debug_log "Port $port on $host is accessible via bash built-in"
            exec 3<&- 3>&-  # Close the connection
        else
            error_message="bash_connection_failed"
            debug_log "Port $port on $host is not accessible via bash built-in"
        fi
    else
        error_message="no_connectivity_tools"
        debug_log "ERROR: No port connectivity testing tools available"
    fi
    
    local end_time
    end_time=$(date +%s.%N)
    response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    # Build connectivity result
    connectivity_result="status=${status};host=${host};port=${port};time=${response_time}"
    
    if [ -n "$error_message" ]; then
        connectivity_result="${connectivity_result};error=${error_message}"
    fi
    
    echo "$connectivity_result"
}

# Function to test database-specific connectivity
test_database_specific_connectivity() {
    local host="$1"
    local port="$2"
    local timeout="${3:-5}"
    local db_result=""
    local status="unknown"
    local db_type="unknown"
    local error_message=""
    
    debug_log "Testing database-specific connectivity: $host:$port"
    
    # Test for PostgreSQL
    if command -v pg_isready >/dev/null 2>&1; then
        debug_log "Testing PostgreSQL connectivity with pg_isready"
        local pg_output
        local pg_exit_code=0
        
        pg_output=$(timeout "$timeout" pg_isready -h "$host" -p "$port" 2>&1) || pg_exit_code=$?
        
        if [ $pg_exit_code -eq 0 ]; then
            status="accessible"
            db_type="postgresql"
            debug_log "PostgreSQL database is accessible and ready"
        elif [ $pg_exit_code -eq 2 ]; then
            status="auth_required"
            db_type="postgresql"
            debug_log "PostgreSQL database is accessible but requires authentication"
        else
            debug_log "PostgreSQL test failed: $pg_output"
        fi
    fi
    
    # Test for MySQL/MariaDB if PostgreSQL test didn't succeed
    if [ "$status" = "unknown" ] && command -v mysqladmin >/dev/null 2>&1; then
        debug_log "Testing MySQL/MariaDB connectivity with mysqladmin"
        local mysql_output
        local mysql_exit_code=0
        
        mysql_output=$(timeout "$timeout" mysqladmin -h "$host" -P "$port" ping 2>&1) || mysql_exit_code=$?
        
        if [[ "$mysql_output" =~ "mysqld is alive" ]]; then
            status="accessible"
            db_type="mysql"
            debug_log "MySQL/MariaDB database is accessible"
        elif [[ "$mysql_output" =~ "Access denied" ]]; then
            status="auth_required"
            db_type="mysql"
            debug_log "MySQL/MariaDB database is accessible but requires authentication"
        else
            debug_log "MySQL test failed: $mysql_output"
        fi
    fi
    
    # Generic database connectivity test using telnet/nc if specific tools failed
    if [ "$status" = "unknown" ]; then
        debug_log "Attempting generic database connectivity test"
        
        if command -v nc >/dev/null 2>&1; then
            local nc_output
            nc_output=$(timeout 2 nc "$host" "$port" <<< "" 2>&1 || echo "failed")
            
            # Look for common database greeting patterns
            if [[ "$nc_output" =~ PostgreSQL ]] || [[ "$nc_output" =~ postgres ]]; then
                status="auth_required"
                db_type="postgresql"
                debug_log "Detected PostgreSQL via generic test"
            elif [[ "$nc_output" =~ MySQL ]] || [[ "$nc_output" =~ mysql ]]; then
                status="auth_required"
                db_type="mysql"
                debug_log "Detected MySQL via generic test"
            elif [ ${#nc_output} -gt 10 ] && [ "$nc_output" != "failed" ]; then
                status="auth_required"
                db_type="unknown_database"
                debug_log "Detected unknown database service via generic test"
            else
                error_message="no_database_response"
                debug_log "No recognizable database response received"
            fi
        else
            error_message="no_database_tools"
            debug_log "No database connectivity testing tools available"
        fi
    fi
    
    # Build database connectivity result
    db_result="status=${status};host=${host};port=${port};db_type=${db_type}"
    
    if [ -n "$error_message" ]; then
        db_result="${db_result};error=${error_message}"
    fi
    
    echo "$db_result"
}

# Function to validate service endpoint accessibility
validate_service_endpoint() {
    local service_endpoint="$1"
    local endpoint_type="${2:-database}"
    local timeout="${3:-10}"
    local validation_result=""
    local overall_status="unknown"
    local validation_details=""
    
    debug_log "Validating service endpoint accessibility: $service_endpoint (type: $endpoint_type)"
    
    # First, resolve the service endpoint to IP
    local service_host
    if [[ "$service_endpoint" =~ : ]]; then
        service_host=$(echo "$service_endpoint" | cut -d':' -f1)
    else
        service_host="$service_endpoint"
    fi
    
    debug_log "Resolving service host: $service_host"
    local resolution_result
    resolution_result=$(test_service_name_resolution "$service_host")
    local resolution_status
    resolution_status=$(echo "$resolution_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
    
    if [ "$resolution_status" != "success" ]; then
        overall_status="dns_failed"
        validation_details="dns_resolution=failed"
        debug_log "ERROR: DNS resolution failed for $service_host"
    else
        local resolved_ip
        resolved_ip=$(echo "$resolution_result" | sed -n 's/.*ip=\([^;]*\).*/\1/p' || echo "")
        debug_log "Service host resolved to: $resolved_ip"
        
        # Test connectivity based on endpoint type
        case "$endpoint_type" in
            "database")
                local db_connectivity
                db_connectivity=$(validate_database_connectivity "$service_endpoint" "$timeout")
                local db_status
                db_status=$(echo "$db_connectivity" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
                
                overall_status="$db_status"
                validation_details="dns_resolution=success;resolved_ip=${resolved_ip};connectivity_test=${db_status}"
                ;;
            "generic")
                local port_connectivity
                port_connectivity=$(test_port_connectivity "$service_host" "80" "$timeout")
                local port_status
                port_status=$(echo "$port_connectivity" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
                
                overall_status="$port_status"
                validation_details="dns_resolution=success;resolved_ip=${resolved_ip};port_test=${port_status}"
                ;;
            *)
                overall_status="unknown_type"
                validation_details="dns_resolution=success;resolved_ip=${resolved_ip};endpoint_type=unsupported"
                debug_log "WARNING: Unsupported endpoint type: $endpoint_type"
                ;;
        esac
    fi
    
    # Build validation result
    validation_result="status=${overall_status};endpoint=${service_endpoint};type=${endpoint_type};details=${validation_details}"
    
    # Log result
    if [ "$overall_status" = "accessible" ] || [ "$overall_status" = "auth_required" ]; then
        log_service "Service endpoint validation successful: $service_endpoint ($overall_status)"
    else
        log_service "Service endpoint validation failed: $service_endpoint ($overall_status)"
    fi
    
    echo "$validation_result"
}

# Function to implement dynamic service discovery for services that become available
dynamic_service_discovery() {
    local target_service="$1"
    local network_context="${2:-}"
    local check_interval="${3:-30}"
    local max_attempts="${4:-10}"
    local discovery_result=""
    local attempt=1
    
    debug_log "Starting dynamic service discovery for: $target_service (interval: ${check_interval}s, max attempts: $max_attempts)"
    
    # Get network information if not provided
    if [ -z "$network_context" ]; then
        network_context=$(get_network_info_field "network")
        debug_log "Auto-detected network context: $network_context"
    fi
    
    log_service "Dynamic service discovery started for $target_service (checking every ${check_interval}s)"
    
    while [ $attempt -le $max_attempts ]; do
        debug_log "Dynamic discovery attempt $attempt/$max_attempts for $target_service"
        
        # Try to discover the service
        local current_discovery
        current_discovery=$(discover_database_service "$target_service" "$network_context")
        local current_status
        current_status=$(echo "$current_discovery" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
        
        if [ "$current_status" = "success" ]; then
            discovery_result="$current_discovery;dynamic_discovery=success;attempts=$attempt"
            log_service "Dynamic service discovery successful for $target_service after $attempt attempt(s)"
            echo "$discovery_result"
            return 0
        fi
        
        debug_log "Service $target_service not yet available (attempt $attempt/$max_attempts)"
        
        # Wait before next attempt (unless this is the last attempt)
        if [ $attempt -lt $max_attempts ]; then
            debug_log "Waiting ${check_interval}s before next attempt"
            sleep "$check_interval"
        fi
        
        attempt=$((attempt + 1))
    done
    
    # All attempts exhausted
    discovery_result="status=timeout;service=${target_service};network=${network_context};dynamic_discovery=failed;attempts=$max_attempts"
    log_service "Dynamic service discovery timed out for $target_service after $max_attempts attempts"
    
    echo "$discovery_result"
}

# Function to monitor service availability changes
monitor_service_availability() {
    local service_list="$1"
    local network_context="${2:-}"
    local check_interval="${3:-60}"
    local monitoring_result=""
    local monitored_services=()
    local availability_changes=()
    
    debug_log "Starting service availability monitoring (interval: ${check_interval}s)"
    
    # Parse service list
    IFS=',' read -ra service_array <<< "$service_list"
    for service in "${service_array[@]}"; do
        monitored_services+=("$service")
        debug_log "Added service to monitoring: $service"
    done
    
    # Get network information if not provided
    if [ -z "$network_context" ]; then
        network_context=$(get_network_info_field "network")
        debug_log "Auto-detected network context: $network_context"
    fi
    
    log_service "Service availability monitoring started for ${#monitored_services[@]} service(s)"
    
    # Initial availability check
    declare -A previous_status
    for service in "${monitored_services[@]}"; do
        local initial_discovery
        initial_discovery=$(discover_database_service "$service" "$network_context")
        local initial_status
        initial_status=$(echo "$initial_discovery" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "not_found")
        
        previous_status["$service"]="$initial_status"
        debug_log "Initial status for $service: $initial_status"
    done
    
    # Monitoring loop (this would typically run in background)
    local monitoring_cycles=0
    local max_cycles=5  # Limit for demonstration purposes
    
    while [ $monitoring_cycles -lt $max_cycles ]; do
        sleep "$check_interval"
        monitoring_cycles=$((monitoring_cycles + 1))
        
        debug_log "Service availability check cycle $monitoring_cycles"
        
        for service in "${monitored_services[@]}"; do
            local current_discovery
            current_discovery=$(discover_database_service "$service" "$network_context")
            local current_status
            current_status=$(echo "$current_discovery" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "not_found")
            
            # Check for status change
            if [ "${previous_status[$service]}" != "$current_status" ]; then
                local change_info="${service}:${previous_status[$service]}->${current_status}"
                availability_changes+=("$change_info")
                
                log_service "Service availability change detected: $service (${previous_status[$service]} -> $current_status)"
                previous_status["$service"]="$current_status"
            fi
        done
    done
    
    # Build monitoring result
    if [ ${#availability_changes[@]} -gt 0 ]; then
        local changes_str
        changes_str=$(IFS=','; echo "${availability_changes[*]}")
        monitoring_result="status=changes_detected;network=${network_context};changes=${changes_str};cycles=$monitoring_cycles"
        
        log_service "Service availability monitoring completed: ${#availability_changes[@]} change(s) detected"
    else
        monitoring_result="status=no_changes;network=${network_context};cycles=$monitoring_cycles"
        
        log_service "Service availability monitoring completed: no changes detected"
    fi
    
    echo "$monitoring_result"
}

# ============================================================================
# MAIN FUNCTION AND COMMAND LINE INTERFACE
# ============================================================================

# Main function for testing/debugging
main() {
    case "${1:-help}" in
        "discover")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 discover <service_name> [network_context]"
                exit 1
            fi
            discover_database_service "$2" "${3:-}"
            ;;
        "discover-compose")
            discover_compose_services "${2:-}" "${3:-}"
            ;;
        "discover-aliases")
            discover_network_aliases "${2:-}" "${3:-}"
            ;;
        "fallback")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 fallback <service_name> [network_context]"
                exit 1
            fi
            fallback_service_discovery "$2" "${3:-}"
            ;;
        "list-services")
            list_available_services "${2:-}"
            ;;
        "validate-connectivity")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 validate-connectivity <service_endpoint> [timeout]"
                exit 1
            fi
            validate_database_connectivity "$2" "${3:-10}"
            ;;
        "validate-endpoint")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 validate-endpoint <service_endpoint> [type] [timeout]"
                exit 1
            fi
            validate_service_endpoint "$2" "${3:-database}" "${4:-10}"
            ;;
        "test-port")
            if [ $# -lt 3 ]; then
                echo "Usage: $0 test-port <host> <port> [timeout]"
                exit 1
            fi
            test_port_connectivity "$2" "$3" "${4:-5}"
            ;;
        "dynamic-discovery")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 dynamic-discovery <service_name> [network_context] [interval] [max_attempts]"
                exit 1
            fi
            dynamic_service_discovery "$2" "${3:-}" "${4:-30}" "${5:-10}"
            ;;
        "monitor")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 monitor <service_list> [network_context] [interval]"
                echo "  service_list: comma-separated list of services to monitor"
                exit 1
            fi
            monitor_service_availability "$2" "${3:-}" "${4:-60}"
            ;;
        "clear-cache")
            clear_service_cache
            ;;
        "cache-status")
            display_service_cache_status
            ;;
        "help"|*)
            echo "Usage: $0 {discover|discover-compose|discover-aliases|fallback|list-services|validate-connectivity|validate-endpoint|test-port|dynamic-discovery|monitor|clear-cache|cache-status}"
            echo ""
            echo "Service Discovery Commands:"
            echo "  discover <service_name> [network_context]           - Discover database service using all methods"
            echo "  discover-compose [service_name] [network_context]   - Discover services using Docker Compose names"
            echo "  discover-aliases [service_name] [network_context]   - Discover services using network aliases"
            echo "  fallback <service_name> [network_context]          - Use fallback discovery methods"
            echo "  list-services [network_context]                    - List all available services in network"
            echo ""
            echo "Service Validation Commands:"
            echo "  validate-connectivity <endpoint> [timeout]         - Validate database service connectivity"
            echo "  validate-endpoint <endpoint> [type] [timeout]      - Validate service endpoint accessibility"
            echo "  test-port <host> <port> [timeout]                  - Test basic port connectivity"
            echo ""
            echo "Dynamic Discovery Commands:"
            echo "  dynamic-discovery <service> [network] [interval] [max_attempts] - Wait for service to become available"
            echo "  monitor <service_list> [network] [interval]        - Monitor service availability changes"
            echo ""
            echo "Cache Management Commands:"
            echo "  clear-cache        - Clear service discovery cache"
            echo "  cache-status       - Display service discovery cache status"
            echo ""
            echo "Examples:"
            echo "  $0 discover db                                      - Discover 'db' service in current network"
            echo "  $0 validate-connectivity db:5432                   - Test connectivity to database"
            echo "  $0 dynamic-discovery postgres supabase_default 30 5 - Wait for postgres service"
            echo "  $0 monitor db,redis,postgres                       - Monitor multiple services"
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi