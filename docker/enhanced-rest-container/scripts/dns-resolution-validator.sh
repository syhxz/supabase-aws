#!/bin/bash
# DNS Resolution Validator Module
# Requirements: 2.1, 2.2, 2.3, 1.1, 1.2, 7.1, 7.3
# Provides functions to validate DNS configuration and test service name resolution

set -euo pipefail

# Configuration
DNS_CACHE_FILE="/tmp/dns-resolution-cache"
DNS_CACHE_TTL=300  # 5 minutes
DNS_TIMEOUT=5      # DNS resolution timeout in seconds
DEBUG_DNS_RESOLUTION="${DEBUG_DNS_RESOLUTION:-false}"

# Function to log debug information
debug_log() {
    if [ "$DEBUG_DNS_RESOLUTION" = "true" ]; then
        echo "[DEBUG] $(date '+%Y-%m-%d %H:%M:%S') DNS: $*" >&2
    fi
}

# Function to log DNS resolution information
log_dns() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] DNS: $*"
}

# Function to validate /etc/resolv.conf configuration
validate_resolv_conf() {
    local validation_result=""
    local dns_servers=()
    local search_domains=()
    local validation_status="valid"
    local validation_issues=()
    
    debug_log "Validating /etc/resolv.conf configuration"
    
    # Check if /etc/resolv.conf exists and is readable
    if [ ! -f /etc/resolv.conf ]; then
        validation_issues+=("resolv_conf_missing")
        validation_status="invalid"
        debug_log "ERROR: /etc/resolv.conf does not exist"
    elif [ ! -r /etc/resolv.conf ]; then
        validation_issues+=("resolv_conf_unreadable")
        validation_status="invalid"
        debug_log "ERROR: /etc/resolv.conf is not readable"
    else
        debug_log "Reading /etc/resolv.conf"
        
        # Parse /etc/resolv.conf
        while IFS= read -r line; do
            # Skip comments and empty lines
            if [[ "$line" =~ ^[[:space:]]*# ]] || [[ "$line" =~ ^[[:space:]]*$ ]]; then
                continue
            fi
            
            if [[ "$line" =~ ^nameserver[[:space:]]+ ]]; then
                local dns_server
                dns_server=$(echo "$line" | awk '{print $2}')
                
                # Validate DNS server IP format
                if [[ "$dns_server" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                    dns_servers+=("$dns_server")
                    debug_log "Found valid DNS server: $dns_server"
                else
                    validation_issues+=("invalid_dns_server_format:$dns_server")
                    validation_status="warning"
                    debug_log "WARNING: Invalid DNS server format: $dns_server"
                fi
            elif [[ "$line" =~ ^search[[:space:]]+ ]]; then
                local domains
                domains=$(echo "$line" | cut -d' ' -f2-)
                IFS=' ' read -ra domain_array <<< "$domains"
                if [ ${#domain_array[@]} -gt 0 ]; then
                    search_domains+=("${domain_array[@]}")
                    debug_log "Found search domains: $domains"
                fi
            elif [[ "$line" =~ ^domain[[:space:]]+ ]]; then
                local domain
                domain=$(echo "$line" | awk '{print $2}')
                search_domains+=("$domain")
                debug_log "Found domain: $domain"
            fi
        done < /etc/resolv.conf
        
        # Validate DNS servers
        if [ ${#dns_servers[@]} -eq 0 ]; then
            validation_issues+=("no_dns_servers")
            validation_status="invalid"
            debug_log "ERROR: No DNS servers found in /etc/resolv.conf"
        fi
        
        # Check for Docker DNS server (127.0.0.11)
        local has_docker_dns=false
        for server in "${dns_servers[@]}"; do
            if [ "$server" = "127.0.0.11" ]; then
                has_docker_dns=true
                debug_log "Docker DNS server (127.0.0.11) found"
                break
            fi
        done
        
        if [ "$has_docker_dns" = false ]; then
            validation_issues+=("no_docker_dns_server")
            validation_status="warning"
            debug_log "WARNING: Docker DNS server (127.0.0.11) not found"
        fi
    fi
    
    # Build validation result
    validation_result="status=${validation_status}"
    
    if [ ${#dns_servers[@]} -gt 0 ]; then
        local servers_str
        servers_str=$(IFS=','; echo "${dns_servers[*]}")
        validation_result="${validation_result};servers=${servers_str}"
    fi
    
    if [ ${#search_domains[@]} -gt 0 ]; then
        local domains_str
        domains_str=$(IFS=','; echo "${search_domains[*]}")
        validation_result="${validation_result};domains=${domains_str}"
    fi
    
    if [ ${#validation_issues[@]} -gt 0 ]; then
        local issues_str
        issues_str=$(IFS=','; echo "${validation_issues[*]}")
        validation_result="${validation_result};issues=${issues_str}"
    fi
    
    echo "$validation_result"
}

# Function to check Docker DNS server accessibility
check_docker_dns_accessibility() {
    local docker_dns_server="127.0.0.11"
    local accessibility_result=""
    local status="accessible"
    local response_time=""
    local error_message=""
    
    debug_log "Checking Docker DNS server accessibility: $docker_dns_server"
    
    # Test DNS server accessibility using nslookup
    local start_time
    start_time=$(date +%s.%N)
    
    if command -v nslookup >/dev/null 2>&1; then
        local nslookup_output
        local nslookup_exit_code
        
        # Test with a simple query to localhost
        nslookup_output=$(timeout "$DNS_TIMEOUT" nslookup localhost "$docker_dns_server" 2>&1) || nslookup_exit_code=$?
        
        local end_time
        end_time=$(date +%s.%N)
        response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        
        if [ ${nslookup_exit_code:-0} -eq 0 ]; then
            debug_log "Docker DNS server is accessible (response time: ${response_time}s)"
        else
            status="inaccessible"
            error_message="nslookup_failed"
            debug_log "ERROR: Docker DNS server is not accessible: $nslookup_output"
        fi
    else
        # Fallback: try to connect to DNS port using nc or telnet
        if command -v nc >/dev/null 2>&1; then
            if timeout "$DNS_TIMEOUT" nc -z "$docker_dns_server" 53 >/dev/null 2>&1; then
                local end_time
                end_time=$(date +%s.%N)
                response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
                debug_log "Docker DNS server port is accessible (response time: ${response_time}s)"
            else
                status="inaccessible"
                error_message="port_unreachable"
                debug_log "ERROR: Docker DNS server port 53 is not accessible"
            fi
        else
            status="unknown"
            error_message="no_test_tools"
            debug_log "WARNING: Cannot test DNS server accessibility - no suitable tools available"
        fi
    fi
    
    # Build accessibility result
    accessibility_result="status=${status};server=${docker_dns_server}"
    
    if [ -n "$response_time" ]; then
        accessibility_result="${accessibility_result};response_time=${response_time}"
    fi
    
    if [ -n "$error_message" ]; then
        accessibility_result="${accessibility_result};error=${error_message}"
    fi
    
    echo "$accessibility_result"
}

# Function to validate DNS search domains and configuration
validate_dns_search_domains() {
    local validation_result=""
    local search_domains=()
    local validation_status="valid"
    local validation_issues=()
    
    debug_log "Validating DNS search domains configuration"
    
    # Get search domains from resolv.conf validation
    local resolv_validation
    resolv_validation=$(validate_resolv_conf)
    local domains_str
    domains_str=$(echo "$resolv_validation" | sed -n 's/.*domains=\([^;]*\).*/\1/p' || echo "")
    
    if [ -n "$domains_str" ]; then
        IFS=',' read -ra search_domains <<< "$domains_str"
        debug_log "Found ${#search_domains[@]} search domains"
        
        # Validate each search domain format
        for domain in "${search_domains[@]}"; do
            # Basic domain name validation (simplified)
            if [[ "$domain" =~ ^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
                debug_log "Valid search domain: $domain"
            else
                validation_issues+=("invalid_domain_format:$domain")
                validation_status="warning"
                debug_log "WARNING: Invalid search domain format: $domain"
            fi
        done
    else
        validation_issues+=("no_search_domains")
        validation_status="warning"
        debug_log "WARNING: No search domains configured"
    fi
    
    # Build validation result
    validation_result="status=${validation_status}"
    
    if [ ${#search_domains[@]} -gt 0 ]; then
        validation_result="${validation_result};domains=${domains_str}"
        validation_result="${validation_result};count=${#search_domains[@]}"
    fi
    
    if [ ${#validation_issues[@]} -gt 0 ]; then
        local issues_str
        issues_str=$(IFS=','; echo "${validation_issues[*]}")
        validation_result="${validation_result};issues=${issues_str}"
    fi
    
    echo "$validation_result"
}

# Function to perform comprehensive DNS configuration validation
validate_dns_configuration() {
    local overall_status="valid"
    local validation_summary=""
    local all_issues=()
    
    debug_log "Starting comprehensive DNS configuration validation"
    
    # Validate /etc/resolv.conf
    local resolv_validation
    resolv_validation=$(validate_resolv_conf)
    local resolv_status
    resolv_status=$(echo "$resolv_validation" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    local resolv_issues
    resolv_issues=$(echo "$resolv_validation" | sed -n 's/.*issues=\([^;]*\).*/\1/p' || echo "")
    
    if [ "$resolv_status" != "valid" ]; then
        overall_status="$resolv_status"
    fi
    
    if [ -n "$resolv_issues" ]; then
        IFS=',' read -ra resolv_issues_array <<< "$resolv_issues"
        all_issues+=("${resolv_issues_array[@]}")
    fi
    
    # Check Docker DNS server accessibility
    local dns_accessibility
    dns_accessibility=$(check_docker_dns_accessibility)
    local dns_access_status
    dns_access_status=$(echo "$dns_accessibility" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    local dns_access_error
    dns_access_error=$(echo "$dns_accessibility" | sed -n 's/.*error=\([^;]*\).*/\1/p' || echo "")
    
    if [ "$dns_access_status" != "accessible" ]; then
        if [ "$overall_status" = "valid" ]; then
            overall_status="warning"
        fi
        if [ -n "$dns_access_error" ]; then
            all_issues+=("docker_dns_$dns_access_error")
        fi
    fi
    
    # Validate search domains
    local domains_validation
    domains_validation=$(validate_dns_search_domains)
    local domains_status
    domains_status=$(echo "$domains_validation" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    local domains_issues
    domains_issues=$(echo "$domains_validation" | sed -n 's/.*issues=\([^;]*\).*/\1/p' || echo "")
    
    if [ "$domains_status" != "valid" ] && [ "$overall_status" = "valid" ]; then
        overall_status="warning"
    fi
    
    if [ -n "$domains_issues" ]; then
        IFS=',' read -ra domains_issues_array <<< "$domains_issues"
        all_issues+=("${domains_issues_array[@]}")
    fi
    
    # Build comprehensive validation summary
    validation_summary="status=${overall_status}"
    validation_summary="${validation_summary};resolv_conf=${resolv_status}"
    validation_summary="${validation_summary};docker_dns=${dns_access_status}"
    validation_summary="${validation_summary};search_domains=${domains_status}"
    
    if [ ${#all_issues[@]} -gt 0 ]; then
        local all_issues_str
        all_issues_str=$(IFS=','; echo "${all_issues[*]}")
        validation_summary="${validation_summary};issues=${all_issues_str}"
    fi
    
    # Log validation summary
    log_dns "DNS configuration validation completed: $overall_status"
    if [ ${#all_issues[@]} -gt 0 ]; then
        log_dns "DNS configuration issues found: ${#all_issues[@]}"
    fi
    
    echo "$validation_summary"
}

# Function to check if DNS cache is valid
is_dns_cache_valid() {
    local cache_key="$1"
    local cache_entry_file="${DNS_CACHE_FILE}.${cache_key}"
    
    if [ ! -f "$cache_entry_file" ]; then
        debug_log "DNS cache entry does not exist for: $cache_key"
        return 1
    fi
    
    local cache_timestamp
    cache_timestamp=$(stat -c %Y "$cache_entry_file" 2>/dev/null || echo 0)
    local current_timestamp
    current_timestamp=$(date +%s)
    local cache_age=$((current_timestamp - cache_timestamp))
    
    if [ $cache_age -gt $DNS_CACHE_TTL ]; then
        debug_log "DNS cache expired for $cache_key (age: ${cache_age}s, TTL: ${DNS_CACHE_TTL}s)"
        return 1
    fi
    
    debug_log "DNS cache is valid for $cache_key (age: ${cache_age}s)"
    return 0
}

# Function to cache DNS resolution result
cache_dns_result() {
    local cache_key="$1"
    local resolution_result="$2"
    local cache_entry_file="${DNS_CACHE_FILE}.${cache_key}"
    
    # Create cache directory if it doesn't exist
    mkdir -p "$(dirname "$cache_entry_file")"
    
    echo "$resolution_result" > "$cache_entry_file"
    debug_log "DNS result cached for: $cache_key"
}

# Function to get cached DNS resolution result
get_cached_dns_result() {
    local cache_key="$1"
    local cache_entry_file="${DNS_CACHE_FILE}.${cache_key}"
    
    if is_dns_cache_valid "$cache_key"; then
        cat "$cache_entry_file"
        return 0
    fi
    
    return 1
}

# Function to resolve hostname using nslookup
resolve_with_nslookup() {
    local hostname="$1"
    local dns_server="${2:-}"
    local resolution_result=""
    local status="failed"
    local resolved_ip=""
    local response_time=""
    local error_message=""
    
    debug_log "Attempting DNS resolution using nslookup for: $hostname"
    
    if ! command -v nslookup >/dev/null 2>&1; then
        error_message="nslookup_not_available"
        debug_log "ERROR: nslookup command not available"
    else
        local start_time
        start_time=$(date +%s.%N)
        
        local nslookup_output
        local nslookup_exit_code=0
        
        if [ -n "$dns_server" ]; then
            nslookup_output=$(timeout "$DNS_TIMEOUT" nslookup "$hostname" "$dns_server" 2>&1) || nslookup_exit_code=$?
            debug_log "Using DNS server: $dns_server"
        else
            nslookup_output=$(timeout "$DNS_TIMEOUT" nslookup "$hostname" 2>&1) || nslookup_exit_code=$?
        fi
        
        local end_time
        end_time=$(date +%s.%N)
        response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        
        if [ $nslookup_exit_code -eq 0 ]; then
            # Extract IP address from nslookup output
            resolved_ip=$(echo "$nslookup_output" | grep -A 1 "Name:" | grep "Address:" | awk '{print $2}' | head -1 || echo "")
            
            # Alternative parsing for different nslookup output formats
            if [ -z "$resolved_ip" ]; then
                resolved_ip=$(echo "$nslookup_output" | grep "^Address:" | awk '{print $2}' | grep -v "#" | head -1 || echo "")
            fi
            
            if [ -n "$resolved_ip" ] && [[ "$resolved_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                status="success"
                debug_log "nslookup resolved $hostname to $resolved_ip (${response_time}s)"
            else
                error_message="no_ip_found"
                debug_log "ERROR: nslookup completed but no valid IP found in output"
            fi
        else
            error_message="nslookup_failed"
            debug_log "ERROR: nslookup failed with exit code $nslookup_exit_code"
        fi
    fi
    
    # Build resolution result
    resolution_result="method=nslookup;status=${status}"
    
    if [ -n "$resolved_ip" ]; then
        resolution_result="${resolution_result};ip=${resolved_ip}"
    fi
    
    if [ -n "$response_time" ]; then
        resolution_result="${resolution_result};time=${response_time}"
    fi
    
    if [ -n "$dns_server" ]; then
        resolution_result="${resolution_result};server=${dns_server}"
    fi
    
    if [ -n "$error_message" ]; then
        resolution_result="${resolution_result};error=${error_message}"
    fi
    
    echo "$resolution_result"
}

# Function to resolve hostname using getent
resolve_with_getent() {
    local hostname="$1"
    local resolution_result=""
    local status="failed"
    local resolved_ip=""
    local response_time=""
    local error_message=""
    
    debug_log "Attempting DNS resolution using getent for: $hostname"
    
    if ! command -v getent >/dev/null 2>&1; then
        error_message="getent_not_available"
        debug_log "ERROR: getent command not available"
    else
        local start_time
        start_time=$(date +%s.%N)
        
        local getent_output
        local getent_exit_code=0
        
        getent_output=$(timeout "$DNS_TIMEOUT" getent hosts "$hostname" 2>&1) || getent_exit_code=$?
        
        local end_time
        end_time=$(date +%s.%N)
        response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        
        if [ $getent_exit_code -eq 0 ] && [ -n "$getent_output" ]; then
            # Extract IP address from getent output (first field)
            resolved_ip=$(echo "$getent_output" | awk '{print $1}' | head -1)
            
            if [ -n "$resolved_ip" ] && [[ "$resolved_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                status="success"
                debug_log "getent resolved $hostname to $resolved_ip (${response_time}s)"
            else
                error_message="no_ip_found"
                debug_log "ERROR: getent completed but no valid IP found in output"
            fi
        else
            error_message="getent_failed"
            debug_log "ERROR: getent failed with exit code $getent_exit_code"
        fi
    fi
    
    # Build resolution result
    resolution_result="method=getent;status=${status}"
    
    if [ -n "$resolved_ip" ]; then
        resolution_result="${resolution_result};ip=${resolved_ip}"
    fi
    
    if [ -n "$response_time" ]; then
        resolution_result="${resolution_result};time=${response_time}"
    fi
    
    if [ -n "$error_message" ]; then
        resolution_result="${resolution_result};error=${error_message}"
    fi
    
    echo "$resolution_result"
}

# Function to resolve hostname using dig
resolve_with_dig() {
    local hostname="$1"
    local dns_server="${2:-}"
    local resolution_result=""
    local status="failed"
    local resolved_ip=""
    local response_time=""
    local error_message=""
    
    debug_log "Attempting DNS resolution using dig for: $hostname"
    
    if ! command -v dig >/dev/null 2>&1; then
        error_message="dig_not_available"
        debug_log "ERROR: dig command not available"
    else
        local start_time
        start_time=$(date +%s.%N)
        
        local dig_output
        local dig_exit_code=0
        local dig_cmd="dig +short +time=$DNS_TIMEOUT"
        
        if [ -n "$dns_server" ]; then
            dig_cmd="$dig_cmd @$dns_server"
            debug_log "Using DNS server: $dns_server"
        fi
        
        dig_output=$(timeout "$DNS_TIMEOUT" $dig_cmd "$hostname" A 2>&1) || dig_exit_code=$?
        
        local end_time
        end_time=$(date +%s.%N)
        response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        
        if [ $dig_exit_code -eq 0 ] && [ -n "$dig_output" ]; then
            # Extract IP address from dig output (should be just the IP with +short)
            resolved_ip=$(echo "$dig_output" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
            
            if [ -n "$resolved_ip" ]; then
                status="success"
                debug_log "dig resolved $hostname to $resolved_ip (${response_time}s)"
            else
                error_message="no_ip_found"
                debug_log "ERROR: dig completed but no valid IP found in output: $dig_output"
            fi
        else
            error_message="dig_failed"
            debug_log "ERROR: dig failed with exit code $dig_exit_code"
        fi
    fi
    
    # Build resolution result
    resolution_result="method=dig;status=${status}"
    
    if [ -n "$resolved_ip" ]; then
        resolution_result="${resolution_result};ip=${resolved_ip}"
    fi
    
    if [ -n "$response_time" ]; then
        resolution_result="${resolution_result};time=${response_time}"
    fi
    
    if [ -n "$dns_server" ]; then
        resolution_result="${resolution_result};server=${dns_server}"
    fi
    
    if [ -n "$error_message" ]; then
        resolution_result="${resolution_result};error=${error_message}"
    fi
    
    echo "$resolution_result"
}

# Function to test service name resolution using multiple methods
test_service_name_resolution() {
    local service_name="$1"
    local dns_server="${2:-}"
    local cache_key="${service_name}_${dns_server:-default}"
    local resolution_summary=""
    local successful_methods=()
    local failed_methods=()
    local best_result=""
    local best_time="999"
    
    debug_log "Testing service name resolution for: $service_name"
    
    # Check cache first
    if get_cached_dns_result "$cache_key" >/dev/null 2>&1; then
        local cached_result
        cached_result=$(get_cached_dns_result "$cache_key")
        debug_log "Using cached DNS result for: $service_name"
        echo "$cached_result"
        return 0
    fi
    
    # Try nslookup
    local nslookup_result
    nslookup_result=$(resolve_with_nslookup "$service_name" "$dns_server")
    local nslookup_status
    nslookup_status=$(echo "$nslookup_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
    
    if [ "$nslookup_status" = "success" ]; then
        successful_methods+=("nslookup")
        local nslookup_time
        nslookup_time=$(echo "$nslookup_result" | sed -n 's/.*time=\([^;]*\).*/\1/p' || echo "999")
        if (( $(echo "$nslookup_time < $best_time" | bc -l 2>/dev/null || echo 0) )); then
            best_result="$nslookup_result"
            best_time="$nslookup_time"
        fi
    else
        failed_methods+=("nslookup")
    fi
    
    # Try getent
    local getent_result
    getent_result=$(resolve_with_getent "$service_name")
    local getent_status
    getent_status=$(echo "$getent_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
    
    if [ "$getent_status" = "success" ]; then
        successful_methods+=("getent")
        local getent_time
        getent_time=$(echo "$getent_result" | sed -n 's/.*time=\([^;]*\).*/\1/p' || echo "999")
        if (( $(echo "$getent_time < $best_time" | bc -l 2>/dev/null || echo 0) )); then
            best_result="$getent_result"
            best_time="$getent_time"
        fi
    else
        failed_methods+=("getent")
    fi
    
    # Try dig
    local dig_result
    dig_result=$(resolve_with_dig "$service_name" "$dns_server")
    local dig_status
    dig_status=$(echo "$dig_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
    
    if [ "$dig_status" = "success" ]; then
        successful_methods+=("dig")
        local dig_time
        dig_time=$(echo "$dig_result" | sed -n 's/.*time=\([^;]*\).*/\1/p' || echo "999")
        if (( $(echo "$dig_time < $best_time" | bc -l 2>/dev/null || echo 0) )); then
            best_result="$dig_result"
            best_time="$dig_time"
        fi
    else
        failed_methods+=("dig")
    fi
    
    # Build resolution summary
    if [ ${#successful_methods[@]} -gt 0 ]; then
        local successful_str
        successful_str=$(IFS=','; echo "${successful_methods[*]}")
        resolution_summary="${best_result};successful_methods=${successful_str}"
        
        # Cache successful result
        cache_dns_result "$cache_key" "$resolution_summary"
        
        log_dns "Service name resolution successful for $service_name using ${#successful_methods[@]} method(s)"
    else
        local failed_str
        failed_str=$(IFS=','; echo "${failed_methods[*]}")
        resolution_summary="status=failed;service=${service_name};failed_methods=${failed_str}"
        
        log_dns "Service name resolution failed for $service_name - all methods failed"
    fi
    
    if [ ${#failed_methods[@]} -gt 0 ]; then
        local failed_str
        failed_str=$(IFS=','; echo "${failed_methods[*]}")
        resolution_summary="${resolution_summary};failed_methods=${failed_str}"
    fi
    
    echo "$resolution_summary"
}

# Function to measure DNS resolution performance
measure_dns_performance() {
    local service_name="$1"
    local iterations="${2:-5}"
    local dns_server="${3:-}"
    local performance_result=""
    local total_time=0
    local successful_resolutions=0
    local failed_resolutions=0
    local min_time="999"
    local max_time="0"
    
    debug_log "Measuring DNS performance for $service_name over $iterations iterations"
    
    for ((i=1; i<=iterations; i++)); do
        local resolution_result
        resolution_result=$(resolve_with_nslookup "$service_name" "$dns_server")
        local status
        status=$(echo "$resolution_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
        local response_time
        response_time=$(echo "$resolution_result" | sed -n 's/.*time=\([^;]*\).*/\1/p' || echo "0")
        
        if [ "$status" = "success" ]; then
            successful_resolutions=$((successful_resolutions + 1))
            total_time=$(echo "$total_time + $response_time" | bc -l 2>/dev/null || echo "$total_time")
            
            if (( $(echo "$response_time < $min_time" | bc -l 2>/dev/null || echo 0) )); then
                min_time="$response_time"
            fi
            
            if (( $(echo "$response_time > $max_time" | bc -l 2>/dev/null || echo 0) )); then
                max_time="$response_time"
            fi
        else
            failed_resolutions=$((failed_resolutions + 1))
        fi
        
        debug_log "Performance test iteration $i: $status (${response_time}s)"
    done
    
    # Calculate average time
    local avg_time="0"
    if [ $successful_resolutions -gt 0 ]; then
        avg_time=$(echo "scale=3; $total_time / $successful_resolutions" | bc -l 2>/dev/null || echo "0")
    fi
    
    # Calculate success rate
    local success_rate
    success_rate=$(echo "scale=2; $successful_resolutions * 100 / $iterations" | bc -l 2>/dev/null || echo "0")
    
    # Build performance result
    performance_result="service=${service_name};iterations=${iterations};successful=${successful_resolutions};failed=${failed_resolutions};success_rate=${success_rate}%;avg_time=${avg_time}s;min_time=${min_time}s;max_time=${max_time}s"
    
    log_dns "DNS performance test completed for $service_name: ${success_rate}% success rate, avg ${avg_time}s"
    
    echo "$performance_result"
}

# Function to clear DNS cache
clear_dns_cache() {
    local cache_pattern="${DNS_CACHE_FILE}.*"
    
    if ls $cache_pattern >/dev/null 2>&1; then
        rm -f $cache_pattern
        debug_log "DNS cache cleared"
        log_dns "DNS resolution cache cleared"
    else
        debug_log "No DNS cache files to clear"
    fi
}

# Function to display DNS cache status
display_dns_cache_status() {
    local cache_files=0
    if ls "${DNS_CACHE_FILE}".* >/dev/null 2>&1; then
        cache_files=$(ls "${DNS_CACHE_FILE}".* 2>/dev/null | wc -l)
    fi
    
    echo "=== DNS Cache Status ==="
    echo "Cache files: $cache_files"
    echo "Cache TTL: ${DNS_CACHE_TTL}s"
    echo "Cache location: $DNS_CACHE_FILE.*"
    
    if [ "$cache_files" -gt 0 ]; then
        echo "Cached entries:"
        for cache_file in "${DNS_CACHE_FILE}".*; do
            if [ -f "$cache_file" ]; then
                local cache_key
                cache_key=$(basename "$cache_file" | sed "s/$(basename "$DNS_CACHE_FILE")\.//")
                local cache_age
                cache_age=$(( $(date +%s) - $(stat -c %Y "$cache_file" 2>/dev/null || echo 0) ))
                local cache_status="valid"
                if [ $cache_age -gt $DNS_CACHE_TTL ]; then
                    cache_status="expired"
                fi
                echo "  $cache_key: ${cache_age}s old ($cache_status)"
            fi
        done
    fi
    echo "========================"
}

# Main function for testing/debugging
main() {
    case "${1:-help}" in
        "validate-resolv")
            validate_resolv_conf
            ;;
        "check-docker-dns")
            check_docker_dns_accessibility
            ;;
        "validate-domains")
            validate_dns_search_domains
            ;;
        "validate-config")
            validate_dns_configuration
            ;;
        "resolve")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 resolve <hostname> [dns_server]"
                exit 1
            fi
            test_service_name_resolution "$2" "${3:-}"
            ;;
        "performance")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 performance <hostname> [iterations] [dns_server]"
                exit 1
            fi
            measure_dns_performance "$2" "${3:-5}" "${4:-}"
            ;;
        "clear-cache")
            clear_dns_cache
            ;;
        "cache-status")
            display_dns_cache_status
            ;;
        "help"|*)
            echo "Usage: $0 {validate-resolv|check-docker-dns|validate-domains|validate-config|resolve|performance|clear-cache|cache-status}"
            echo "  validate-resolv    - Validate /etc/resolv.conf configuration"
            echo "  check-docker-dns   - Check Docker DNS server (127.0.0.11) accessibility"
            echo "  validate-domains   - Validate DNS search domains configuration"
            echo "  validate-config    - Perform comprehensive DNS configuration validation"
            echo "  resolve <hostname> [dns_server] - Test service name resolution"
            echo "  performance <hostname> [iterations] [dns_server] - Measure DNS performance"
            echo "  clear-cache        - Clear DNS resolution cache"
            echo "  cache-status       - Display DNS cache status"
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi