#!/bin/bash
# Example integration of Docker Network Detection Module
# This shows how the module would be integrated into the enhanced startup script

set -euo pipefail

# Source the docker network detection module
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/docker-network-detection.sh"

# Function to demonstrate network detection integration
demonstrate_network_detection() {
    echo "=== Docker Network Detection Integration Example ==="
    echo
    
    # Step 1: Detect Docker network configuration
    echo "Step 1: Detecting Docker network configuration..."
    local network_info
    network_info=$(detect_docker_network)
    echo "Network info: $network_info"
    echo
    
    # Step 2: Display human-readable network information
    echo "Step 2: Network information summary:"
    display_network_info
    echo
    
    # Step 3: Validate network configuration
    echo "Step 3: Validating network configuration..."
    local validation_result
    validation_result=$(validate_network_configuration)
    echo "Validation result: $validation_result"
    echo
    
    # Step 4: Extract specific network information for use in startup
    echo "Step 4: Extracting network information for startup configuration..."
    local network_name
    network_name=$(get_network_info_field network)
    echo "Network name: $network_name"
    
    local network_type
    network_type=$(get_network_info_field type)
    echo "Network type: $network_type"
    
    local container_ip
    container_ip=$(get_network_info_field ip)
    echo "Container IP: $container_ip"
    
    local gateway_ip
    gateway_ip=$(get_network_info_field gateway)
    echo "Gateway IP: $gateway_ip"
    echo
    
    # Step 5: Demonstrate how this would be used in database connection logic
    echo "Step 5: Database connection configuration based on network detection..."
    
    if [ "$network_type" = "host" ]; then
        echo "Host network detected - using localhost for database connections"
        echo "Database host mapping: db -> localhost"
    elif [[ "$network_type" =~ bridge ]]; then
        echo "Docker bridge network detected - using Docker DNS resolution"
        echo "Database host: db (will be resolved via Docker DNS)"
        echo "Expected resolution: db -> container IP in network $network_name"
    elif [ "$network_type" = "overlay" ]; then
        echo "Docker overlay network detected - using Docker service discovery"
        echo "Database host: db (will be resolved via Docker overlay DNS)"
    else
        echo "Custom/external network detected - using Docker DNS resolution"
        echo "Database host: db (will be resolved via custom network DNS)"
    fi
    echo
    
    # Step 6: Show how network information would be logged
    echo "Step 6: Network information logging for troubleshooting..."
    echo "[STARTUP] Docker network configuration:"
    echo "[STARTUP]   Network: $network_name ($network_type)"
    if [ -n "$container_ip" ]; then
        echo "[STARTUP]   Container IP: $container_ip"
    fi
    if [ -n "$gateway_ip" ]; then
        echo "[STARTUP]   Gateway: $gateway_ip"
    fi
    
    local dns_config
    dns_config=$(get_network_info_field dns)
    if [ -n "$dns_config" ]; then
        echo "[STARTUP]   DNS: $dns_config"
    fi
    echo
}

# Function to demonstrate error scenarios
demonstrate_error_scenarios() {
    echo "=== Error Scenario Demonstrations ==="
    echo
    
    echo "Scenario 1: Invalid network configuration"
    # This would be detected by the validation function
    local validation_result
    validation_result=$(validate_network_configuration)
    if [[ "$validation_result" =~ invalid ]]; then
        echo "❌ Network configuration issues detected: $validation_result"
        echo "   Recommended action: Check Docker network setup"
    else
        echo "✅ Network configuration is valid"
    fi
    echo
    
    echo "Scenario 2: Network type specific handling"
    local network_type
    network_type=$(get_network_info_field type)
    
    case "$network_type" in
        "host")
            echo "ℹ️  Host network mode - database connections will use localhost"
            ;;
        "bridge_default"|"bridge_custom")
            echo "ℹ️  Bridge network mode - database connections will use Docker DNS"
            ;;
        "overlay")
            echo "ℹ️  Overlay network mode - database connections will use service discovery"
            ;;
        "external")
            echo "ℹ️  External network mode - database connections will use custom DNS"
            ;;
        "unknown")
            echo "⚠️  Unknown network type - may need manual configuration"
            ;;
    esac
    echo
}

# Function to demonstrate caching behavior
demonstrate_caching() {
    echo "=== Caching Behavior Demonstration ==="
    echo
    
    echo "Clearing cache..."
    clear_network_cache
    
    echo "First detection (will populate cache):"
    time detect_docker_network >/dev/null
    
    echo "Second detection (will use cache):"
    time detect_docker_network >/dev/null
    
    echo "Cache file location: $NETWORK_CACHE_FILE"
    if [ -f "$NETWORK_CACHE_FILE" ]; then
        echo "Cache file size: $(wc -c < "$NETWORK_CACHE_FILE") bytes"
        echo "Cache age: $(( $(date +%s) - $(stat -c %Y "$NETWORK_CACHE_FILE" 2>/dev/null || echo 0) )) seconds"
    fi
    echo
}

# Main demonstration
main() {
    echo "Docker Network Detection Module Integration Example"
    echo "=================================================="
    echo
    
    demonstrate_network_detection
    demonstrate_error_scenarios
    demonstrate_caching
    
    echo "=== Integration Complete ==="
    echo "This demonstrates how the Docker Network Detection Module"
    echo "would be integrated into the enhanced startup script to:"
    echo "  1. Detect Docker network configuration"
    echo "  2. Validate network setup"
    echo "  3. Configure database connections appropriately"
    echo "  4. Provide detailed logging for troubleshooting"
    echo "  5. Handle different network types correctly"
}

# Run demonstration
main "$@"