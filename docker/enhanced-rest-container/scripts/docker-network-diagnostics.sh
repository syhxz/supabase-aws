#!/bin/bash
# Docker Network Diagnostics Module
# Requirements: 4.2, 5.1, 5.4, 1.4, 2.5, 4.1, 4.5
# Provides comprehensive Docker network diagnostics and troubleshooting

set -euo pipefail

# Source required modules
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/docker-network-detection.sh"
source "$SCRIPT_DIR/dns-resolution-validator.sh"

# Configuration
DEBUG_NETWORK_DIAGNOSTICS="${DEBUG_NETWORK_DIAGNOSTICS:-false}"
DIAGNOSTICS_LOG_FILE="/tmp/docker-network-diagnostics.log"

# Function to log debug information
debug_log() {
    if [ "$DEBUG_NETWORK_DIAGNOSTICS" = "true" ]; then
        echo "[DEBUG] $(date '+%Y-%m-%d %H:%M:%S') DIAGNOSTICS: $*" >&2
    fi
}

# Function to log diagnostics information
log_diagnostics() {
    local message="$*"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] DIAGNOSTICS: $message"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] DIAGNOSTICS: $message" >> "$DIAGNOSTICS_LOG_FILE"
}

# Function to verify container is in expected Docker network
verify_network_membership() {
    local expected_network="${1:-}"
    local verification_result=""
    local membership_status="unknown"
    local current_network=""
    local network_id=""
    local container_ip=""
    local verification_issues=()
    
    debug_log "Verifying Docker network membership"
    
    # Get current network information
    local network_info
    network_info=$(detect_docker_network)
    current_network=$(echo "$network_info" | sed -n 's/.*network=\([^;]*\).*/\1/p' || echo "")
    network_id=$(echo "$network_info" | sed -n 's/.*id=\([^;]*\).*/\1/p' || echo "")
    container_ip=$(echo "$network_info" | sed -n 's/.*ip=\([^;]*\).*/\1/p' || echo "")
    
    debug_log "Current network: $current_network, Expected: ${expected_network:-auto-detect}"
    
    # Verify network membership
    if [ -z "$current_network" ] || [ "$current_network" = "unknown" ]; then
        membership_status="unknown"
        verification_issues+=("cannot_determine_network")
        debug_log "ERROR: Cannot determine current Docker network"
    elif [ -n "$expected_network" ]; then
        # Check against expected network
        if [ "$current_network" = "$expected_network" ]; then
            membership_status="confirmed"
            debug_log "Network membership confirmed: $current_network"
        else
            membership_status="mismatch"
            verification_issues+=("network_mismatch:expected=$expected_network,actual=$current_network")
            debug_log "ERROR: Network mismatch - expected: $expected_network, actual: $current_network"
        fi
    else
        # Auto-detect mode - verify we're in a valid Docker network
        if [[ "$current_network" =~ ^[a-zA-Z0-9_-]+$ ]] && [ "$current_network" != "unknown" ]; then
            membership_status="confirmed"
            debug_log "Network membership auto-confirmed: $current_network"
        else
            membership_status="invalid"
            verification_issues+=("invalid_network_name:$current_network")
            debug_log "ERROR: Invalid network name detected: $current_network"
        fi
    fi
    
    # Additional network membership checks
    if [ "$membership_status" = "confirmed" ]; then
        # Verify container has valid IP in network
        if [ -z "$container_ip" ] || ! [[ "$container_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            membership_status="partial"
            verification_issues+=("invalid_container_ip:$container_ip")
            debug_log "WARNING: Container has invalid IP address: $container_ip"
        fi
        
        # Verify network ID is present
        if [ -z "$network_id" ]; then
            verification_issues+=("missing_network_id")
            debug_log "WARNING: Network ID could not be determined"
        fi
    fi
    
    # Build verification result
    verification_result="status=${membership_status};current_network=${current_network};container_ip=${container_ip}"
    
    if [ -n "$network_id" ]; then
        verification_result="${verification_result};network_id=${network_id}"
    fi
    
    if [ -n "$expected_network" ]; then
        verification_result="${verification_result};expected_network=${expected_network}"
    fi
    
    if [ ${#verification_issues[@]} -gt 0 ]; then
        local issues_str
        issues_str=$(IFS=','; echo "${verification_issues[*]}")
        verification_result="${verification_result};issues=${issues_str}"
    fi
    
    log_diagnostics "Network membership verification: $membership_status for network $current_network"
    
    echo "$verification_result"
}

# Function to check network routing and connectivity within Docker networks
check_network_routing() {
    local target_network="${1:-}"
    local routing_result=""
    local routing_status="unknown"
    local gateway_reachable="unknown"
    local routing_issues=()
    
    debug_log "Checking Docker network routing and connectivity"
    
    # Get network information
    local network_info
    network_info=$(detect_docker_network)
    local container_ip
    container_ip=$(echo "$network_info" | sed -n 's/.*ip=\([^;]*\).*/\1/p' || echo "")
    local gateway_ip
    gateway_ip=$(echo "$network_info" | sed -n 's/.*gateway=\([^;]*\).*/\1/p' || echo "")
    local network_type
    network_type=$(echo "$network_info" | sed -n 's/.*type=\([^;]*\).*/\1/p' || echo "")
    
    debug_log "Container IP: $container_ip, Gateway: $gateway_ip, Type: $network_type"
    
    # Validate basic network configuration
    if [ -z "$container_ip" ] || ! [[ "$container_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        routing_status="invalid"
        routing_issues+=("invalid_container_ip")
        debug_log "ERROR: Invalid container IP address"
    elif [ -z "$gateway_ip" ] || ! [[ "$gateway_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        if [ "$network_type" != "host" ]; then
            routing_status="warning"
            routing_issues+=("missing_gateway")
            debug_log "WARNING: No valid gateway IP found (network type: $network_type)"
        else
            routing_status="valid"
            debug_log "Host network mode - no gateway expected"
        fi
    else
        # Test gateway connectivity
        debug_log "Testing gateway connectivity: $gateway_ip"
        
        if command -v ping >/dev/null 2>&1; then
            if timeout 3 ping -c 1 "$gateway_ip" >/dev/null 2>&1; then
                gateway_reachable="yes"
                routing_status="valid"
                debug_log "Gateway is reachable: $gateway_ip"
            else
                gateway_reachable="no"
                routing_status="warning"
                routing_issues+=("gateway_unreachable")
                debug_log "WARNING: Gateway is not reachable: $gateway_ip"
            fi
        else
            # Fallback: try to connect to gateway using nc
            if command -v nc >/dev/null 2>&1; then
                # Test common ports (SSH, HTTP) on gateway
                if timeout 2 nc -z "$gateway_ip" 22 >/dev/null 2>&1 || timeout 2 nc -z "$gateway_ip" 80 >/dev/null 2>&1; then
                    gateway_reachable="partial"
                    routing_status="valid"
                    debug_log "Gateway partially reachable (some ports): $gateway_ip"
                else
                    gateway_reachable="unknown"
                    routing_status="warning"
                    routing_issues+=("cannot_test_gateway")
                    debug_log "WARNING: Cannot test gateway connectivity - no suitable tools"
                fi
            else
                gateway_reachable="unknown"
                routing_status="warning"
                routing_issues+=("no_connectivity_tools")
                debug_log "WARNING: No tools available to test network connectivity"
            fi
        fi
    fi
    
    # Check routing table consistency
    local routing_info
    routing_info=$(echo "$network_info" | sed -n 's/.*routing=\([^;]*\).*/\1/p' || echo "")
    if [ -n "$routing_info" ]; then
        local routes_str
        routes_str=$(echo "$routing_info" | sed -n 's/.*routes=\([^;]*\).*/\1/p' || echo "")
        if [ -n "$routes_str" ]; then
            local route_count
            route_count=$(echo "$routes_str" | tr ',' '\n' | wc -l)
            debug_log "Found $route_count network routes"
        else
            routing_issues+=("no_network_routes")
            debug_log "WARNING: No network routes found"
        fi
    fi
    
    # Build routing result
    routing_result="status=${routing_status};container_ip=${container_ip};gateway_ip=${gateway_ip};gateway_reachable=${gateway_reachable};network_type=${network_type}"
    
    if [ ${#routing_issues[@]} -gt 0 ]; then
        local issues_str
        issues_str=$(IFS=','; echo "${routing_issues[*]}")
        routing_result="${routing_result};issues=${issues_str}"
    fi
    
    log_diagnostics "Network routing check: $routing_status (gateway: $gateway_reachable)"
    
    echo "$routing_result"
}

# Function to validate Docker network isolation and access permissions
validate_network_isolation() {
    local validation_result=""
    local isolation_status="unknown"
    local access_level="unknown"
    local isolation_issues=()
    
    debug_log "Validating Docker network isolation and access permissions"
    
    # Get network information
    local network_info
    network_info=$(detect_docker_network)
    local network_type
    network_type=$(echo "$network_info" | sed -n 's/.*type=\([^;]*\).*/\1/p' || echo "")
    local container_ip
    container_ip=$(echo "$network_info" | sed -n 's/.*ip=\([^;]*\).*/\1/p' || echo "")
    
    debug_log "Network type: $network_type, Container IP: $container_ip"
    
    # Analyze network isolation based on network type
    case "$network_type" in
        "bridge_default")
            isolation_status="minimal"
            access_level="full"
            debug_log "Default bridge network - minimal isolation"
            ;;
        "bridge_custom")
            isolation_status="moderate"
            access_level="network_scoped"
            debug_log "Custom bridge network - moderate isolation"
            ;;
        "overlay")
            isolation_status="high"
            access_level="service_scoped"
            debug_log "Overlay network - high isolation"
            ;;
        "host")
            isolation_status="none"
            access_level="host_level"
            isolation_issues+=("no_network_isolation")
            debug_log "Host network - no isolation"
            ;;
        "external")
            isolation_status="unknown"
            access_level="unknown"
            isolation_issues+=("external_network_unknown_isolation")
            debug_log "External network - isolation level unknown"
            ;;
        *)
            isolation_status="unknown"
            access_level="unknown"
            isolation_issues+=("unknown_network_type")
            debug_log "Unknown network type - cannot determine isolation"
            ;;
    esac
    
    # Test network access permissions
    debug_log "Testing network access permissions"
    
    # Check if container can access Docker daemon (security concern)
    if [ -S /var/run/docker.sock ]; then
        isolation_issues+=("docker_socket_accessible")
        debug_log "WARNING: Docker socket is accessible - potential security risk"
    fi
    
    # Check for privileged capabilities
    if [ -f /proc/self/status ]; then
        local cap_eff
        cap_eff=$(grep "CapEff:" /proc/self/status 2>/dev/null | awk '{print $2}' || echo "")
        if [ -n "$cap_eff" ] && [ "$cap_eff" != "0000000000000000" ]; then
            # Container has some capabilities - check if it's excessive
            if [ "$cap_eff" = "0000003fffffffff" ] || [ "$cap_eff" = "ffffffffffffffff" ]; then
                isolation_issues+=("excessive_capabilities")
                debug_log "WARNING: Container has excessive capabilities"
            fi
        fi
    fi
    
    # Check network namespace isolation
    if [ -f /proc/self/ns/net ]; then
        local net_ns
        net_ns=$(readlink /proc/self/ns/net 2>/dev/null || echo "")
        if [ -n "$net_ns" ]; then
            debug_log "Network namespace: $net_ns"
        else
            isolation_issues+=("cannot_read_network_namespace")
            debug_log "WARNING: Cannot read network namespace information"
        fi
    fi
    
    # Build validation result
    validation_result="isolation_status=${isolation_status};access_level=${access_level};network_type=${network_type}"
    
    if [ ${#isolation_issues[@]} -gt 0 ]; then
        local issues_str
        issues_str=$(IFS=','; echo "${isolation_issues[*]}")
        validation_result="${validation_result};issues=${issues_str}"
    fi
    
    log_diagnostics "Network isolation validation: $isolation_status (access: $access_level)"
    
    echo "$validation_result"
}

# Function to create detailed DNS resolution logging and error reporting
create_dns_resolution_report() {
    local service_name="$1"
    local dns_server="${2:-}"
    local report_result=""
    local report_status="unknown"
    local resolution_details=""
    local error_details=""
    
    debug_log "Creating detailed DNS resolution report for: $service_name"
    
    # Perform comprehensive DNS resolution test
    local resolution_result
    resolution_result=$(test_service_name_resolution "$service_name" "$dns_server")
    local resolution_status
    resolution_status=$(echo "$resolution_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "failed")
    
    debug_log "DNS resolution status: $resolution_status"
    
    if [ "$resolution_status" = "success" ]; then
        report_status="success"
        
        # Extract resolution details
        local resolved_ip
        resolved_ip=$(echo "$resolution_result" | sed -n 's/.*ip=\([^;]*\).*/\1/p' || echo "")
        local response_time
        response_time=$(echo "$resolution_result" | sed -n 's/.*time=\([^;]*\).*/\1/p' || echo "")
        local method_used
        method_used=$(echo "$resolution_result" | sed -n 's/.*method=\([^;]*\).*/\1/p' || echo "")
        local successful_methods
        successful_methods=$(echo "$resolution_result" | sed -n 's/.*successful_methods=\([^;]*\).*/\1/p' || echo "")
        
        resolution_details="ip=${resolved_ip};time=${response_time};method=${method_used};successful_methods=${successful_methods}"
        
        log_diagnostics "DNS resolution successful for $service_name: $resolved_ip (${response_time}s via $method_used)"
    else
        report_status="failed"
        
        # Extract error details
        local failed_methods
        failed_methods=$(echo "$resolution_result" | sed -n 's/.*failed_methods=\([^;]*\).*/\1/p' || echo "")
        local error_message
        error_message=$(echo "$resolution_result" | sed -n 's/.*error=\([^;]*\).*/\1/p' || echo "")
        
        error_details="failed_methods=${failed_methods}"
        if [ -n "$error_message" ]; then
            error_details="${error_details};error=${error_message}"
        fi
        
        log_diagnostics "DNS resolution failed for $service_name: $failed_methods"
    fi
    
    # Get DNS configuration validation
    local dns_config_validation
    dns_config_validation=$(validate_dns_configuration)
    local dns_config_status
    dns_config_status=$(echo "$dns_config_validation" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    local dns_config_issues
    dns_config_issues=$(echo "$dns_config_validation" | sed -n 's/.*issues=\([^;]*\).*/\1/p' || echo "")
    
    # Build comprehensive report
    report_result="status=${report_status};service=${service_name};dns_config_status=${dns_config_status}"
    
    if [ -n "$resolution_details" ]; then
        report_result="${report_result};${resolution_details}"
    fi
    
    if [ -n "$error_details" ]; then
        report_result="${report_result};${error_details}"
    fi
    
    if [ -n "$dns_config_issues" ]; then
        report_result="${report_result};dns_config_issues=${dns_config_issues}"
    fi
    
    if [ -n "$dns_server" ]; then
        report_result="${report_result};dns_server=${dns_server}"
    fi
    
    echo "$report_result"
}

# Function to add Docker network configuration analysis and reporting
analyze_docker_network_configuration() {
    local analysis_result=""
    local analysis_status="unknown"
    local configuration_issues=()
    local recommendations=()
    
    debug_log "Analyzing Docker network configuration"
    
    # Get comprehensive network information
    local network_info
    network_info=$(detect_docker_network)
    local network_name
    network_name=$(echo "$network_info" | sed -n 's/.*network=\([^;]*\).*/\1/p' || echo "")
    local network_type
    network_type=$(echo "$network_info" | sed -n 's/.*type=\([^;]*\).*/\1/p' || echo "")
    local container_ip
    container_ip=$(echo "$network_info" | sed -n 's/.*ip=\([^;]*\).*/\1/p' || echo "")
    local gateway_ip
    gateway_ip=$(echo "$network_info" | sed -n 's/.*gateway=\([^;]*\).*/\1/p' || echo "")
    
    debug_log "Analyzing network: $network_name (type: $network_type)"
    
    # Validate network configuration
    local network_validation
    network_validation=$(validate_network_configuration)
    local validation_status
    validation_status=$(echo "$network_validation" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    local validation_issues
    validation_issues=$(echo "$network_validation" | sed -n 's/.*issues=\([^;]*\).*/\1/p' || echo "")
    
    if [ "$validation_status" = "valid" ]; then
        analysis_status="optimal"
        debug_log "Network configuration is optimal"
    elif [ "$validation_status" = "warning" ]; then
        analysis_status="suboptimal"
        debug_log "Network configuration has warnings"
    else
        analysis_status="problematic"
        configuration_issues+=("network_validation_failed")
        debug_log "Network configuration has problems"
    fi
    
    # Add validation issues to configuration issues
    if [ -n "$validation_issues" ]; then
        IFS=',' read -ra validation_issues_array <<< "$validation_issues"
        configuration_issues+=("${validation_issues_array[@]}")
    fi
    
    # Analyze network type appropriateness
    case "$network_type" in
        "bridge_default")
            recommendations+=("consider_custom_network")
            debug_log "Recommendation: Consider using custom bridge network for better isolation"
            ;;
        "host")
            configuration_issues+=("host_network_security_risk")
            recommendations+=("use_bridge_network")
            debug_log "Warning: Host network mode has security implications"
            ;;
        "unknown")
            configuration_issues+=("unknown_network_type")
            recommendations+=("verify_network_setup")
            debug_log "Issue: Unknown network type detected"
            ;;
    esac
    
    # Check DNS configuration
    local dns_validation
    dns_validation=$(validate_dns_configuration)
    local dns_status
    dns_status=$(echo "$dns_validation" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    
    if [ "$dns_status" != "valid" ]; then
        configuration_issues+=("dns_configuration_issues")
        recommendations+=("fix_dns_configuration")
        debug_log "Issue: DNS configuration problems detected"
    fi
    
    # Check network routing
    local routing_check
    routing_check=$(check_network_routing)
    local routing_status
    routing_status=$(echo "$routing_check" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    
    if [ "$routing_status" != "valid" ]; then
        configuration_issues+=("routing_issues")
        recommendations+=("check_network_routing")
        debug_log "Issue: Network routing problems detected"
    fi
    
    # Build analysis result
    analysis_result="status=${analysis_status};network=${network_name};type=${network_type};validation=${validation_status};dns=${dns_status};routing=${routing_status}"
    
    if [ ${#configuration_issues[@]} -gt 0 ]; then
        local issues_str
        issues_str=$(IFS=','; echo "${configuration_issues[*]}")
        analysis_result="${analysis_result};issues=${issues_str}"
    fi
    
    if [ ${#recommendations[@]} -gt 0 ]; then
        local recommendations_str
        recommendations_str=$(IFS=','; echo "${recommendations[*]}")
        analysis_result="${analysis_result};recommendations=${recommendations_str}"
    fi
    
    log_diagnostics "Docker network configuration analysis: $analysis_status"
    
    echo "$analysis_result"
}

# Function to implement actionable troubleshooting information generation
generate_troubleshooting_info() {
    local service_name="${1:-}"
    local troubleshooting_result=""
    local problem_category="unknown"
    local troubleshooting_steps=()
    local diagnostic_commands=()
    
    debug_log "Generating troubleshooting information for service: ${service_name:-general}"
    
    # Gather diagnostic information
    local network_membership
    network_membership=$(verify_network_membership)
    local membership_status
    membership_status=$(echo "$network_membership" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    local membership_issues
    membership_issues=$(echo "$network_membership" | sed -n 's/.*issues=\([^;]*\).*/\1/p' || echo "")
    
    local network_routing
    network_routing=$(check_network_routing)
    local routing_status
    routing_status=$(echo "$network_routing" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    local routing_issues
    routing_issues=$(echo "$network_routing" | sed -n 's/.*issues=\([^;]*\).*/\1/p' || echo "")
    
    local dns_validation
    dns_validation=$(validate_dns_configuration)
    local dns_status
    dns_status=$(echo "$dns_validation" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    local dns_issues
    dns_issues=$(echo "$dns_validation" | sed -n 's/.*issues=\([^;]*\).*/\1/p' || echo "")
    
    debug_log "Diagnostic status - Membership: $membership_status, Routing: $routing_status, DNS: $dns_status"
    
    # Determine problem category and generate specific troubleshooting steps
    if [ "$membership_status" != "confirmed" ]; then
        problem_category="network_membership"
        troubleshooting_steps+=("1. Verify container is running in correct Docker network")
        troubleshooting_steps+=("2. Check Docker Compose network configuration")
        troubleshooting_steps+=("3. Restart container with correct network settings")
        diagnostic_commands+=("docker network ls")
        diagnostic_commands+=("docker inspect <container_name>")
        
        if [[ "$membership_issues" =~ network_mismatch ]]; then
            troubleshooting_steps+=("4. Update Docker Compose file to use correct network name")
            troubleshooting_steps+=("5. Recreate containers with: docker-compose down && docker-compose up")
        fi
    elif [ "$routing_status" != "valid" ]; then
        problem_category="network_routing"
        troubleshooting_steps+=("1. Check Docker network routing configuration")
        troubleshooting_steps+=("2. Verify gateway connectivity within Docker network")
        troubleshooting_steps+=("3. Test network connectivity between containers")
        diagnostic_commands+=("ip route show")
        diagnostic_commands+=("ping <gateway_ip>")
        
        if [[ "$routing_issues" =~ gateway_unreachable ]]; then
            troubleshooting_steps+=("4. Restart Docker daemon if gateway is unreachable")
            troubleshooting_steps+=("5. Check Docker network driver configuration")
        fi
    elif [ "$dns_status" != "valid" ]; then
        problem_category="dns_configuration"
        troubleshooting_steps+=("1. Check /etc/resolv.conf for correct DNS servers")
        troubleshooting_steps+=("2. Verify Docker DNS server (127.0.0.11) is accessible")
        troubleshooting_steps+=("3. Test DNS resolution manually")
        diagnostic_commands+=("cat /etc/resolv.conf")
        diagnostic_commands+=("nslookup <service_name> 127.0.0.11")
        
        if [[ "$dns_issues" =~ no_docker_dns_server ]]; then
            troubleshooting_steps+=("4. Restart container to refresh DNS configuration")
            troubleshooting_steps+=("5. Check Docker daemon DNS settings")
        fi
    elif [ -n "$service_name" ]; then
        # Service-specific troubleshooting
        local dns_report
        dns_report=$(create_dns_resolution_report "$service_name")
        local report_status
        report_status=$(echo "$dns_report" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
        
        if [ "$report_status" != "success" ]; then
            problem_category="service_resolution"
            troubleshooting_steps+=("1. Verify service '$service_name' is running and healthy")
            troubleshooting_steps+=("2. Check service is in the same Docker network")
            troubleshooting_steps+=("3. Test service connectivity using IP address")
            diagnostic_commands+=("docker ps | grep $service_name")
            diagnostic_commands+=("docker logs $service_name")
            diagnostic_commands+=("nslookup $service_name")
        else
            problem_category="no_issues_detected"
            troubleshooting_steps+=("No issues detected with Docker network configuration")
            troubleshooting_steps+=("Service resolution is working correctly")
        fi
    else
        problem_category="general_network"
        troubleshooting_steps+=("1. Run comprehensive network diagnostics")
        troubleshooting_steps+=("2. Check Docker daemon status and logs")
        troubleshooting_steps+=("3. Verify Docker Compose configuration")
        diagnostic_commands+=("docker system info")
        diagnostic_commands+=("docker-compose config")
    fi
    
    # Add general diagnostic commands
    diagnostic_commands+=("docker network inspect <network_name>")
    diagnostic_commands+=("docker exec <container> ip addr show")
    
    # Build troubleshooting result
    troubleshooting_result="category=${problem_category};membership=${membership_status};routing=${routing_status};dns=${dns_status}"
    
    if [ ${#troubleshooting_steps[@]} -gt 0 ]; then
        local steps_str
        steps_str=$(IFS='|'; echo "${troubleshooting_steps[*]}")
        troubleshooting_result="${troubleshooting_result};steps=${steps_str}"
    fi
    
    if [ ${#diagnostic_commands[@]} -gt 0 ]; then
        local commands_str
        commands_str=$(IFS='|'; echo "${diagnostic_commands[*]}")
        troubleshooting_result="${troubleshooting_result};commands=${commands_str}"
    fi
    
    log_diagnostics "Troubleshooting info generated for category: $problem_category"
    
    echo "$troubleshooting_result"
}

# Function to perform comprehensive Docker network diagnostics
perform_comprehensive_diagnostics() {
    local service_name="${1:-}"
    local expected_network="${2:-}"
    local diagnostics_result=""
    local overall_status="unknown"
    local diagnostics_summary=""
    
    debug_log "Performing comprehensive Docker network diagnostics"
    log_diagnostics "Starting comprehensive Docker network diagnostics"
    
    # Network membership verification
    local membership_result
    membership_result=$(verify_network_membership "$expected_network")
    local membership_status
    membership_status=$(echo "$membership_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    
    # Network routing check
    local routing_result
    routing_result=$(check_network_routing)
    local routing_status
    routing_status=$(echo "$routing_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    
    # Network isolation validation
    local isolation_result
    isolation_result=$(validate_network_isolation)
    local isolation_status
    isolation_status=$(echo "$isolation_result" | sed -n 's/.*isolation_status=\([^;]*\).*/\1/p' || echo "unknown")
    
    # DNS configuration validation
    local dns_result
    dns_result=$(validate_dns_configuration)
    local dns_status
    dns_status=$(echo "$dns_result" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    
    # Network configuration analysis
    local config_analysis
    config_analysis=$(analyze_docker_network_configuration)
    local config_status
    config_status=$(echo "$config_analysis" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
    
    # Service-specific DNS resolution (if service name provided)
    local service_resolution=""
    if [ -n "$service_name" ]; then
        local dns_report
        dns_report=$(create_dns_resolution_report "$service_name")
        local service_status
        service_status=$(echo "$dns_report" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
        service_resolution="service_resolution=${service_status}"
    fi
    
    # Determine overall status
    if [ "$membership_status" = "confirmed" ] && [ "$routing_status" = "valid" ] && [ "$dns_status" = "valid" ]; then
        if [ -n "$service_name" ]; then
            local service_status
            service_status=$(echo "$dns_report" | sed -n 's/.*status=\([^;]*\).*/\1/p' || echo "unknown")
            if [ "$service_status" = "success" ]; then
                overall_status="healthy"
            else
                overall_status="service_issues"
            fi
        else
            overall_status="healthy"
        fi
    elif [ "$membership_status" = "confirmed" ] && [ "$routing_status" = "valid" ]; then
        overall_status="dns_issues"
    elif [ "$membership_status" = "confirmed" ]; then
        overall_status="connectivity_issues"
    else
        overall_status="network_issues"
    fi
    
    # Generate troubleshooting information
    local troubleshooting_info
    troubleshooting_info=$(generate_troubleshooting_info "$service_name")
    
    # Build comprehensive diagnostics result
    diagnostics_result="overall_status=${overall_status};membership=${membership_status};routing=${routing_status};isolation=${isolation_status};dns=${dns_status};config=${config_status}"
    
    if [ -n "$service_resolution" ]; then
        diagnostics_result="${diagnostics_result};${service_resolution}"
    fi
    
    if [ -n "$service_name" ]; then
        diagnostics_result="${diagnostics_result};service=${service_name}"
    fi
    
    if [ -n "$expected_network" ]; then
        diagnostics_result="${diagnostics_result};expected_network=${expected_network}"
    fi
    
    # Add troubleshooting category
    local troubleshooting_category
    troubleshooting_category=$(echo "$troubleshooting_info" | sed -n 's/.*category=\([^;]*\).*/\1/p' || echo "unknown")
    diagnostics_result="${diagnostics_result};troubleshooting_category=${troubleshooting_category}"
    
    log_diagnostics "Comprehensive diagnostics completed: $overall_status"
    
    echo "$diagnostics_result"
}

# Function to display comprehensive diagnostics report in human-readable format
display_diagnostics_report() {
    local service_name="${1:-}"
    local expected_network="${2:-}"
    
    echo "=== Docker Network Diagnostics Report ==="
    echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    if [ -n "$service_name" ]; then
        echo "Target Service: $service_name"
    fi
    if [ -n "$expected_network" ]; then
        echo "Expected Network: $expected_network"
    fi
    echo ""
    
    # Perform comprehensive diagnostics
    local diagnostics_result
    diagnostics_result=$(perform_comprehensive_diagnostics "$service_name" "$expected_network")
    
    local overall_status
    overall_status=$(echo "$diagnostics_result" | sed -n 's/.*overall_status=\([^;]*\).*/\1/p' || echo "unknown")
    
    echo "Overall Status: $overall_status"
    echo ""
    
    # Display individual component status
    echo "Component Status:"
    local membership_status
    membership_status=$(echo "$diagnostics_result" | sed -n 's/.*membership=\([^;]*\).*/\1/p' || echo "unknown")
    echo "  Network Membership: $membership_status"
    
    local routing_status
    routing_status=$(echo "$diagnostics_result" | sed -n 's/.*routing=\([^;]*\).*/\1/p' || echo "unknown")
    echo "  Network Routing: $routing_status"
    
    local dns_status
    dns_status=$(echo "$diagnostics_result" | sed -n 's/.*dns=\([^;]*\).*/\1/p' || echo "unknown")
    echo "  DNS Configuration: $dns_status"
    
    local isolation_status
    isolation_status=$(echo "$diagnostics_result" | sed -n 's/.*isolation=\([^;]*\).*/\1/p' || echo "unknown")
    echo "  Network Isolation: $isolation_status"
    
    if [ -n "$service_name" ]; then
        local service_resolution
        service_resolution=$(echo "$diagnostics_result" | sed -n 's/.*service_resolution=\([^;]*\).*/\1/p' || echo "unknown")
        echo "  Service Resolution: $service_resolution"
    fi
    
    echo ""
    
    # Display network information
    echo "Network Information:"
    local network_info
    network_info=$(detect_docker_network)
    display_network_info
    
    echo ""
    
    # Display troubleshooting information if issues detected
    if [ "$overall_status" != "healthy" ]; then
        echo "Troubleshooting Information:"
        local troubleshooting_info
        troubleshooting_info=$(generate_troubleshooting_info "$service_name")
        
        local troubleshooting_steps
        troubleshooting_steps=$(echo "$troubleshooting_info" | sed -n 's/.*steps=\([^;]*\).*/\1/p' || echo "")
        if [ -n "$troubleshooting_steps" ]; then
            echo "Recommended Steps:"
            echo "$troubleshooting_steps" | tr '|' '\n' | sed 's/^/  /'
            echo ""
        fi
        
        local diagnostic_commands
        diagnostic_commands=$(echo "$troubleshooting_info" | sed -n 's/.*commands=\([^;]*\).*/\1/p' || echo "")
        if [ -n "$diagnostic_commands" ]; then
            echo "Diagnostic Commands:"
            echo "$diagnostic_commands" | tr '|' '\n' | sed 's/^/  /'
            echo ""
        fi
    fi
    
    echo "=========================================="
}

# Main function for testing/debugging
main() {
    case "${1:-help}" in
        "verify-membership")
            verify_network_membership "${2:-}"
            ;;
        "check-routing")
            check_network_routing "${2:-}"
            ;;
        "validate-isolation")
            validate_network_isolation
            ;;
        "dns-report")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 dns-report <service_name> [dns_server]"
                exit 1
            fi
            create_dns_resolution_report "$2" "${3:-}"
            ;;
        "analyze-config")
            analyze_docker_network_configuration
            ;;
        "troubleshoot")
            generate_troubleshooting_info "${2:-}"
            ;;
        "comprehensive")
            perform_comprehensive_diagnostics "${2:-}" "${3:-}"
            ;;
        "report")
            display_diagnostics_report "${2:-}" "${3:-}"
            ;;
        "help"|*)
            echo "Usage: $0 {verify-membership|check-routing|validate-isolation|dns-report|analyze-config|troubleshoot|comprehensive|report}"
            echo "  verify-membership [expected_network] - Verify container network membership"
            echo "  check-routing [target_network]       - Check network routing and connectivity"
            echo "  validate-isolation                   - Validate network isolation and permissions"
            echo "  dns-report <service> [dns_server]    - Create detailed DNS resolution report"
            echo "  analyze-config                       - Analyze Docker network configuration"
            echo "  troubleshoot [service]               - Generate troubleshooting information"
            echo "  comprehensive [service] [network]    - Perform comprehensive diagnostics"
            echo "  report [service] [network]           - Display human-readable diagnostics report"
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi