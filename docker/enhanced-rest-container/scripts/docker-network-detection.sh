#!/bin/bash
# Docker Network Detection Module
# Requirements: 5.1, 5.4, 6.2, 6.4
# Provides functions to detect Docker network membership, configuration, and type

set -euo pipefail

# Configuration
NETWORK_CACHE_FILE="/tmp/docker-network-cache"
NETWORK_CACHE_TTL=300  # 5 minutes
DEBUG_NETWORK_DETECTION="${DEBUG_NETWORK_DETECTION:-false}"

# Function to log debug information
debug_log() {
    if [ "$DEBUG_NETWORK_DETECTION" = "true" ]; then
        echo "[DEBUG] $(date '+%Y-%m-%d %H:%M:%S') NETWORK: $*" >&2
    fi
}

# Function to log network detection information
log_network() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] NETWORK: $*"
}

# Function to check if network cache is valid
is_cache_valid() {
    if [ ! -f "$NETWORK_CACHE_FILE" ]; then
        debug_log "Cache file does not exist"
        return 1
    fi
    
    local cache_timestamp
    cache_timestamp=$(stat -c %Y "$NETWORK_CACHE_FILE" 2>/dev/null || echo 0)
    local current_timestamp
    current_timestamp=$(date +%s)
    local cache_age=$((current_timestamp - cache_timestamp))
    
    if [ $cache_age -gt $NETWORK_CACHE_TTL ]; then
        debug_log "Cache expired (age: ${cache_age}s, TTL: ${NETWORK_CACHE_TTL}s)"
        return 1
    fi
    
    debug_log "Cache is valid (age: ${cache_age}s)"
    return 0
}

# Function to get container network interfaces
get_container_network_interfaces() {
    local interfaces=()
    local interface_info=""
    
    debug_log "Detecting container network interfaces"
    
    # Parse /proc/net/dev for network interfaces
    if [ -f /proc/net/dev ]; then
        while IFS= read -r line; do
            # Skip header lines
            if [[ "$line" =~ ^[[:space:]]*[a-zA-Z] ]]; then
                local interface_name
                interface_name=$(echo "$line" | awk -F: '{print $1}' | tr -d ' ')
                
                # Skip loopback interface
                if [ "$interface_name" != "lo" ]; then
                    interfaces+=("$interface_name")
                    debug_log "Found network interface: $interface_name"
                fi
            fi
        done < /proc/net/dev
    fi
    
    # Get IP addresses for each interface
    if [ ${#interfaces[@]} -gt 0 ]; then
        for interface in "${interfaces[@]}"; do
            local ip_addr=""
            if command -v ip >/dev/null 2>&1; then
                ip_addr=$(ip addr show "$interface" 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1 | head -1 || echo "")
            elif command -v ifconfig >/dev/null 2>&1; then
                ip_addr=$(ifconfig "$interface" 2>/dev/null | grep 'inet ' | awk '{print $2}' | head -1 || echo "")
            fi
            
            if [ -n "$ip_addr" ]; then
                if [ -n "$interface_info" ]; then
                    interface_info="${interface_info},"
                fi
                interface_info="${interface_info}${interface}:${ip_addr}"
                debug_log "Interface $interface has IP: $ip_addr"
            fi
        done
    fi
    
    echo "$interface_info"
}

# Function to parse network routing information
parse_network_routing() {
    local routing_info=""
    local default_gateway=""
    local network_routes=()
    
    debug_log "Parsing network routing information"
    
    # Parse /proc/net/route for routing information
    if [ -f /proc/net/route ]; then
        while IFS= read -r line; do
            # Skip header line
            if [[ "$line" =~ ^Iface ]]; then
                continue
            fi
            
            local fields
            read -ra fields <<< "$line"
            
            if [ ${#fields[@]} -ge 8 ]; then
                local iface="${fields[0]}"
                local destination="${fields[1]}"
                local gateway="${fields[2]}"
                local flags="${fields[3]}"
                
                # Convert hex to decimal IP
                if [ "$destination" = "00000000" ] && [ "$gateway" != "00000000" ]; then
                    # Default route
                    local gw_ip
                    gw_ip=$(printf "%d.%d.%d.%d" \
                        $((0x${gateway:6:2})) \
                        $((0x${gateway:4:2})) \
                        $((0x${gateway:2:2})) \
                        $((0x${gateway:0:2})))
                    default_gateway="$gw_ip"
                    debug_log "Default gateway: $gw_ip via $iface"
                elif [ "$destination" != "00000000" ]; then
                    # Network route
                    local dest_ip
                    dest_ip=$(printf "%d.%d.%d.%d" \
                        $((0x${destination:6:2})) \
                        $((0x${destination:4:2})) \
                        $((0x${destination:2:2})) \
                        $((0x${destination:0:2})))
                    network_routes+=("${dest_ip}:${iface}")
                    debug_log "Network route: $dest_ip via $iface"
                fi
            fi
        done < /proc/net/route
    fi
    
    # Build routing info string
    routing_info="gateway=${default_gateway}"
    if [ ${#network_routes[@]} -gt 0 ]; then
        local routes_str
        routes_str=$(IFS=','; echo "${network_routes[*]}")
        routing_info="${routing_info};routes=${routes_str}"
    fi
    
    echo "$routing_info"
}

# Function to detect Docker network type
detect_docker_network_type() {
    local container_ip="$1"
    local gateway_ip="$2"
    local network_type="unknown"
    
    debug_log "Detecting Docker network type for IP: $container_ip, Gateway: $gateway_ip"
    
    # Validate IP format first
    if ! [[ "$container_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        debug_log "Invalid container IP format: $container_ip"
        echo "$network_type"
        return 0
    fi
    
    # Check for Docker default bridge network (172.17.x.x)
    if [[ "$container_ip" =~ ^172\.17\. ]]; then
        network_type="bridge_default"
        debug_log "Detected default Docker bridge network"
    # Check for Docker custom bridge networks (172.18-31.x.x)
    elif [[ "$container_ip" =~ ^172\.(1[8-9]|2[0-9]|3[0-1])\. ]]; then
        network_type="bridge_custom"
        debug_log "Detected custom Docker bridge network"
    # Check for Docker overlay networks (10.0.x.x)
    elif [[ "$container_ip" =~ ^10\.0\. ]]; then
        network_type="overlay"
        debug_log "Detected Docker overlay network"
    # Check for host network (same as host IP ranges)
    elif [ "$container_ip" = "$gateway_ip" ] || [ -z "$gateway_ip" ]; then
        network_type="host"
        debug_log "Detected host network mode"
    # Check for external/custom networks
    else
        network_type="external"
        debug_log "Detected external/custom network"
    fi
    
    echo "$network_type"
}

# Function to get Docker network name from environment or inspection
get_docker_network_name() {
    local network_name=""
    
    debug_log "Attempting to determine Docker network name"
    
    # Try to get network name from Docker environment variables
    if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then
        network_name="${COMPOSE_PROJECT_NAME}_default"
        debug_log "Using Compose project network: $network_name"
    elif [ -n "${DOCKER_NETWORK_NAME:-}" ]; then
        network_name="$DOCKER_NETWORK_NAME"
        debug_log "Using explicit network name: $network_name"
    else
        # Try to inspect container if docker command is available
        if command -v docker >/dev/null 2>&1; then
            local hostname
            hostname=$(hostname 2>/dev/null || echo "")
            if [ -n "$hostname" ]; then
                network_name=$(docker inspect "$hostname" 2>/dev/null | \
                    grep '"NetworkMode":' | sed 's/.*"NetworkMode":[[:space:]]*"\([^"]*\)".*/\1/' | head -1 || echo "")
                if [ -n "$network_name" ] && [ "$network_name" != "default" ]; then
                    debug_log "Detected network from container inspection: $network_name"
                else
                    network_name="bridge"
                    debug_log "Using default bridge network name"
                fi
            fi
        else
            network_name="unknown"
            debug_log "Cannot determine network name - docker command not available"
        fi
    fi
    
    echo "$network_name"
}

# Function to get DNS configuration
get_dns_configuration() {
    local dns_servers=()
    local search_domains=()
    local dns_config=""
    
    debug_log "Reading DNS configuration"
    
    # Parse /etc/resolv.conf
    if [ -f /etc/resolv.conf ]; then
        while IFS= read -r line; do
            # Skip comments and empty lines
            if [[ "$line" =~ ^[[:space:]]*# ]] || [[ "$line" =~ ^[[:space:]]*$ ]]; then
                continue
            fi
            
            if [[ "$line" =~ ^nameserver[[:space:]]+ ]]; then
                local dns_server
                dns_server=$(echo "$line" | awk '{print $2}')
                dns_servers+=("$dns_server")
                debug_log "Found DNS server: $dns_server"
            elif [[ "$line" =~ ^search[[:space:]]+ ]]; then
                local domains
                domains=$(echo "$line" | cut -d' ' -f2-)
                IFS=' ' read -ra domain_array <<< "$domains"
                if [ ${#domain_array[@]} -gt 0 ]; then
                    search_domains+=("${domain_array[@]}")
                fi
                debug_log "Found search domains: $domains"
            fi
        done < /etc/resolv.conf
    fi
    
    # Build DNS configuration string
    if [ ${#dns_servers[@]} -gt 0 ]; then
        local servers_str
        servers_str=$(IFS=','; echo "${dns_servers[*]}")
        dns_config="servers=${servers_str}"
    fi
    
    if [ ${#search_domains[@]} -gt 0 ]; then
        local domains_str
        domains_str=$(IFS=','; echo "${search_domains[*]}")
        if [ -n "$dns_config" ]; then
            dns_config="${dns_config};domains=${domains_str}"
        else
            dns_config="domains=${domains_str}"
        fi
    fi
    
    echo "$dns_config"
}

# Function to detect Docker network membership and configuration
detect_docker_network() {
    debug_log "Starting Docker network detection"
    
    # Check cache first
    if is_cache_valid; then
        debug_log "Using cached network information"
        cat "$NETWORK_CACHE_FILE"
        return 0
    fi
    
    # Get container network interfaces
    local interfaces_info
    interfaces_info=$(get_container_network_interfaces)
    
    # Get primary container IP (first non-loopback interface)
    local container_ip=""
    local primary_interface=""
    if [ -n "$interfaces_info" ]; then
        local first_interface
        first_interface=$(echo "$interfaces_info" | cut -d',' -f1)
        primary_interface=$(echo "$first_interface" | cut -d':' -f1)
        container_ip=$(echo "$first_interface" | cut -d':' -f2)
        debug_log "Primary interface: $primary_interface, IP: $container_ip"
    fi
    
    # Parse network routing
    local routing_info
    routing_info=$(parse_network_routing)
    local gateway_ip
    gateway_ip=$(echo "$routing_info" | sed -n 's/.*gateway=\([^;]*\).*/\1/p' || echo "")
    
    # Detect network type
    local network_type
    network_type=$(detect_docker_network_type "$container_ip" "$gateway_ip")
    
    # Get network name
    local network_name
    network_name=$(get_docker_network_name)
    
    # Get DNS configuration
    local dns_config
    dns_config=$(get_dns_configuration)
    
    # Generate network ID (simplified hash of key network parameters)
    local network_id
    network_id=$(echo "${network_name}${container_ip}${gateway_ip}" | sha256sum | cut -d' ' -f1 | head -c 12)
    
    # Build comprehensive network information
    local network_info
    network_info="network=${network_name};id=${network_id};ip=${container_ip};gateway=${gateway_ip};type=${network_type};interface=${primary_interface};interfaces=${interfaces_info};routing=${routing_info};dns=${dns_config}"
    
    # Cache the result
    echo "$network_info" > "$NETWORK_CACHE_FILE"
    debug_log "Network information cached"
    
    # Log network detection summary
    log_network "Docker network detected: $network_name (type: $network_type, IP: $container_ip)"
    
    echo "$network_info"
}

# Function to get specific network information field
get_network_info_field() {
    local field="$1"
    local network_info
    
    network_info=$(detect_docker_network)
    echo "$network_info" | sed -n "s/.*${field}=\([^;]*\).*/\1/p" || echo ""
}

# Function to validate network configuration
validate_network_configuration() {
    local network_info
    network_info=$(detect_docker_network)
    
    local network_name
    network_name=$(echo "$network_info" | sed -n 's/.*network=\([^;]*\).*/\1/p' || echo "")
    local container_ip
    container_ip=$(echo "$network_info" | sed -n 's/.*ip=\([^;]*\).*/\1/p' || echo "")
    local network_type
    network_type=$(echo "$network_info" | sed -n 's/.*type=\([^;]*\).*/\1/p' || echo "")
    local dns_servers
    dns_servers=$(echo "$network_info" | sed -n 's/.*dns=servers=\([^;]*\).*/\1/p' || echo "")
    
    local validation_status="valid"
    local validation_issues=()
    
    # Validate network name
    if [ -z "$network_name" ] || [ "$network_name" = "unknown" ]; then
        validation_issues+=("network_name_unknown")
        validation_status="invalid"
    fi
    
    # Validate container IP
    if [ -z "$container_ip" ] || ! [[ "$container_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        validation_issues+=("invalid_container_ip")
        validation_status="invalid"
    fi
    
    # Validate network type
    if [ "$network_type" = "unknown" ]; then
        validation_issues+=("unknown_network_type")
        validation_status="warning"
    fi
    
    # Validate DNS configuration
    if [ -z "$dns_servers" ]; then
        validation_issues+=("no_dns_servers")
        validation_status="warning"
    fi
    
    # Build validation result
    local validation_result="status=${validation_status}"
    if [ ${#validation_issues[@]} -gt 0 ]; then
        local issues_str
        issues_str=$(IFS=','; echo "${validation_issues[*]}")
        validation_result="${validation_result};issues=${issues_str}"
    fi
    
    echo "$validation_result"
}

# Function to clear network cache
clear_network_cache() {
    if [ -f "$NETWORK_CACHE_FILE" ]; then
        rm -f "$NETWORK_CACHE_FILE"
        debug_log "Network cache cleared"
        log_network "Network cache cleared"
    fi
}

# Function to display network information in human-readable format
display_network_info() {
    local network_info
    network_info=$(detect_docker_network)
    
    echo "=== Docker Network Information ==="
    echo "Network Name: $(echo "$network_info" | sed -n 's/.*network=\([^;]*\).*/\1/p' || echo 'Unknown')"
    echo "Network ID: $(echo "$network_info" | sed -n 's/.*id=\([^;]*\).*/\1/p' || echo 'Unknown')"
    echo "Network Type: $(echo "$network_info" | sed -n 's/.*type=\([^;]*\).*/\1/p' || echo 'Unknown')"
    echo "Container IP: $(echo "$network_info" | sed -n 's/.*ip=\([^;]*\).*/\1/p' || echo 'Unknown')"
    echo "Gateway IP: $(echo "$network_info" | sed -n 's/.*gateway=\([^;]*\).*/\1/p' || echo 'Unknown')"
    echo "Primary Interface: $(echo "$network_info" | sed -n 's/.*interface=\([^;]*\).*/\1/p' || echo 'Unknown')"
    
    local interfaces
    interfaces=$(echo "$network_info" | sed -n 's/.*interfaces=\([^;]*\).*/\1/p' || echo '')
    if [ -n "$interfaces" ]; then
        echo "All Interfaces: $interfaces"
    fi
    
    local dns_config
    dns_config=$(echo "$network_info" | sed -n 's/.*dns=\([^;]*\).*/\1/p' || echo '')
    if [ -n "$dns_config" ]; then
        echo "DNS Configuration: $dns_config"
    fi
    
    echo "=================================="
}

# Main function for testing/debugging
main() {
    case "${1:-detect}" in
        "detect")
            detect_docker_network
            ;;
        "display")
            display_network_info
            ;;
        "validate")
            validate_network_configuration
            ;;
        "clear-cache")
            clear_network_cache
            ;;
        "field")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 field <field_name>"
                exit 1
            fi
            get_network_info_field "$2"
            ;;
        *)
            echo "Usage: $0 {detect|display|validate|clear-cache|field <field_name>}"
            echo "  detect      - Detect and return network information"
            echo "  display     - Display network information in human-readable format"
            echo "  validate    - Validate network configuration"
            echo "  clear-cache - Clear network information cache"
            echo "  field       - Get specific network information field"
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi