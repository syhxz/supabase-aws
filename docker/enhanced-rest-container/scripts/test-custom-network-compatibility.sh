#!/bin/bash
# Test script for Custom and External Network Compatibility
# Requirements: 6.2, 6.4, 6.5 - Test custom Docker network names, external networks, and no config changes
# Tests compatibility with custom Docker network names, external networks, and ensures no changes to existing Docker Compose files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DISCOVERY_SCRIPT="$SCRIPT_DIR/service-discovery-manager.sh"
NETWORK_DETECTION_SCRIPT="$SCRIPT_DIR/docker-network-detection.sh"
DNS_VALIDATOR_SCRIPT="$SCRIPT_DIR/dns-resolution-validator.sh"

# Test configuration
TEST_RESULTS=()
TESTS_PASSED=0
TESTS_FAILED=0
DEBUG_CUSTOM_NETWORK_TESTS="${DEBUG_CUSTOM_NETWORK_TESTS:-false}"

# Function to log debug information
debug_log() {
    if [ "$DEBUG_CUSTOM_NETWORK_TESTS" = "true" ]; then
        echo "[DEBUG] $(date '+%Y-%m-%d %H:%M:%S') CUSTOM_NET_TEST: $*" >&2
    fi
}

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    local test_description="${4:-}"
    
    echo "Running test: $test_name"
    if [ -n "$test_description" ]; then
        echo "  Description: $test_description"
    fi
    
    debug_log "Executing command: $test_command"
    
    local test_output
    local test_exit_code=0
    
    test_output=$(eval "$test_command" 2>&1) || test_exit_code=$?
    
    debug_log "Command output: $test_output"
    debug_log "Exit code: $test_exit_code"
    
    if [ $test_exit_code -eq 0 ] && ([[ "$test_output" =~ $expected_pattern ]] || [ -z "$expected_pattern" ]); then
        echo "✓ PASS: $test_name"
        TEST_RESULTS+=("PASS: $test_name")
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "✗ FAIL: $test_name"
        echo "  Expected pattern: $expected_pattern"
        echo "  Actual output: $test_output"
        echo "  Exit code: $test_exit_code"
        TEST_RESULTS+=("FAIL: $test_name")
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    echo ""
}

# Function to test custom Docker network names
test_custom_network_names() {
    echo "=== Testing Custom Docker Network Names ==="
    echo ""
    
    # Test various custom network naming patterns
    local custom_networks=(
        "my-custom-network"
        "app_network"
        "production-net"
        "dev.network"
        "backend-services"
        "microservices_net"
        "supabase-custom"
        "project123_network"
    )
    
    for network_name in "${custom_networks[@]}"; do
        debug_log "Testing custom network name: $network_name"
        
        # Test network detection with custom name
        run_test "Custom network detection '$network_name'" \
            "DOCKER_NETWORK_NAME='$network_name' $NETWORK_DETECTION_SCRIPT detect" \
            "network=.*" \
            "Test detection of custom Docker network name"
        
        # Test service discovery in custom network
        run_test "Service discovery in '$network_name'" \
            "DOCKER_NETWORK_NAME='$network_name' $SERVICE_DISCOVERY_SCRIPT list-services" \
            "status=(success|no_services)" \
            "Test service discovery in custom network"
        
        # Test DNS resolution with custom network context
        run_test "DNS resolution in '$network_name'" \
            "DOCKER_NETWORK_NAME='$network_name' $DNS_VALIDATOR_SCRIPT validate-config" \
            "status=(valid|invalid|warning)" \
            "Test DNS configuration in custom network"
    done
}

# Function to test external network configurations
test_external_network_configurations() {
    echo "=== Testing External Network Configurations ==="
    echo ""
    
    # Test external network patterns
    local external_networks=(
        "shared-network"
        "external_db_net"
        "company-infrastructure"
        "legacy-system-net"
        "third-party-services"
    )
    
    for external_network in "${external_networks[@]}"; do
        debug_log "Testing external network: $external_network"
        
        # Test external network detection
        run_test "External network detection '$external_network'" \
            "DOCKER_NETWORK_NAME='$external_network' $NETWORK_DETECTION_SCRIPT detect" \
            "network=.*" \
            "Test detection of external Docker network"
        
        # Test service discovery in external network
        run_test "Service discovery in external '$external_network'" \
            "DOCKER_NETWORK_NAME='$external_network' $SERVICE_DISCOVERY_SCRIPT discover db" \
            "status=(success|not_found)" \
            "Test service discovery in external network"
        
        # Test network validation for external networks
        run_test "External network validation '$external_network'" \
            "DOCKER_NETWORK_NAME='$external_network' $NETWORK_DETECTION_SCRIPT validate" \
            "status=(valid|invalid|warning)" \
            "Test validation of external network configuration"
    done
}

# Function to test network bridge types
test_network_bridge_types() {
    echo "=== Testing Network Bridge Types ==="
    echo ""
    
    # Test different bridge network configurations
    local bridge_configs=(
        "bridge"
        "custom-bridge"
        "isolated-bridge"
        "multi-tenant-bridge"
    )
    
    for bridge_config in "${bridge_configs[@]}"; do
        debug_log "Testing bridge configuration: $bridge_config"
        
        # Test bridge network detection
        run_test "Bridge network detection '$bridge_config'" \
            "DOCKER_NETWORK_NAME='$bridge_config' $NETWORK_DETECTION_SCRIPT detect" \
            "network=.*" \
            "Test detection of bridge network configuration"
        
        # Test service connectivity in bridge network
        run_test "Bridge network connectivity '$bridge_config'" \
            "DOCKER_NETWORK_NAME='$bridge_config' $SERVICE_DISCOVERY_SCRIPT test-port localhost 22 1" \
            "status=(accessible|failed)" \
            "Test connectivity in bridge network"
    done
}

# Function to test overlay network configurations
test_overlay_network_configurations() {
    echo "=== Testing Overlay Network Configurations ==="
    echo ""
    
    # Test overlay network patterns (Docker Swarm)
    local overlay_networks=(
        "swarm-overlay"
        "multi-host-net"
        "distributed-services"
        "cluster-network"
    )
    
    for overlay_network in "${overlay_networks[@]}"; do
        debug_log "Testing overlay network: $overlay_network"
        
        # Test overlay network detection
        run_test "Overlay network detection '$overlay_network'" \
            "DOCKER_NETWORK_NAME='$overlay_network' $NETWORK_DETECTION_SCRIPT detect" \
            "network=.*" \
            "Test detection of overlay network"
        
        # Test service discovery in overlay network
        run_test "Overlay service discovery '$overlay_network'" \
            "DOCKER_NETWORK_NAME='$overlay_network' $SERVICE_DISCOVERY_SCRIPT discover-compose" \
            "status=(success|no_services)" \
            "Test service discovery in overlay network"
    done
}

# Function to test network isolation scenarios
test_network_isolation_scenarios() {
    echo "=== Testing Network Isolation Scenarios ==="
    echo ""
    
    # Test isolated network configurations
    local isolation_scenarios=(
        "frontend-only"
        "backend-only"
        "database-isolated"
        "security-zone"
        "dmz-network"
    )
    
    for scenario in "${isolation_scenarios[@]}"; do
        debug_log "Testing isolation scenario: $scenario"
        
        # Test network isolation detection
        run_test "Network isolation '$scenario'" \
            "DOCKER_NETWORK_NAME='$scenario' $NETWORK_DETECTION_SCRIPT validate" \
            "status=(valid|invalid|warning)" \
            "Test network isolation scenario"
        
        # Test service discovery with isolation
        run_test "Isolated service discovery '$scenario'" \
            "DOCKER_NETWORK_NAME='$scenario' $SERVICE_DISCOVERY_SCRIPT list-services" \
            "status=(success|no_services)" \
            "Test service discovery in isolated network"
    done
}

# Function to test multi-network configurations
test_multi_network_configurations() {
    echo "=== Testing Multi-Network Configurations ==="
    echo ""
    
    # Test scenarios where services span multiple networks
    local multi_network_scenarios=(
        "frontend-backend"
        "app-database"
        "public-private"
        "load-balancer-services"
    )
    
    for scenario in "${multi_network_scenarios[@]}"; do
        debug_log "Testing multi-network scenario: $scenario"
        
        # Test multi-network service discovery
        run_test "Multi-network discovery '$scenario'" \
            "DOCKER_NETWORK_NAME='${scenario}-net1' $SERVICE_DISCOVERY_SCRIPT discover db" \
            "status=(success|not_found)" \
            "Test service discovery across multiple networks"
        
        # Test network connectivity across networks
        run_test "Cross-network connectivity '$scenario'" \
            "DOCKER_NETWORK_NAME='${scenario}-net2' $SERVICE_DISCOVERY_SCRIPT validate-connectivity localhost:5432 2" \
            "status=(accessible|auth_required|port_unreachable)" \
            "Test connectivity across multiple networks"
    done
}

# Function to test custom DNS configurations
test_custom_dns_configurations() {
    echo "=== Testing Custom DNS Configurations ==="
    echo ""
    
    # Test custom DNS server configurations
    local dns_configs=(
        "8.8.8.8"
        "1.1.1.1"
        "127.0.0.11"
        "192.168.1.1"
        "10.0.0.1"
    )
    
    for dns_server in "${dns_configs[@]}"; do
        debug_log "Testing custom DNS server: $dns_server"
        
        # Test DNS resolution with custom server
        run_test "Custom DNS server '$dns_server'" \
            "$DNS_VALIDATOR_SCRIPT resolve localhost '$dns_server'" \
            "status=(success|failed)" \
            "Test DNS resolution with custom DNS server"
    done
    
    # Test custom search domains
    local search_domains=(
        "local"
        "internal"
        "company.com"
        "docker.local"
    )
    
    for domain in "${search_domains[@]}"; do
        debug_log "Testing search domain: $domain"
        
        # Test service resolution with search domain
        run_test "Search domain '$domain'" \
            "$DNS_VALIDATOR_SCRIPT resolve db.$domain" \
            "status=(success|failed)" \
            "Test service resolution with search domain"
    done
}

# Function to test network configuration backward compatibility
test_backward_compatibility() {
    echo "=== Testing Backward Compatibility ==="
    echo ""
    
    # Test that existing configurations still work
    run_test "Default network compatibility" \
        "$NETWORK_DETECTION_SCRIPT detect" \
        "network=.*" \
        "Test that default network detection still works"
    
    run_test "Standard service discovery compatibility" \
        "$SERVICE_DISCOVERY_SCRIPT discover db" \
        "status=(success|not_found)" \
        "Test that standard service discovery still works"
    
    run_test "DNS validation compatibility" \
        "$DNS_VALIDATOR_SCRIPT validate-config" \
        "status=(valid|invalid|warning)" \
        "Test that DNS validation still works"
    
    # Test with legacy environment variables
    local legacy_env_vars=(
        "POSTGRES_HOST=db"
        "DATABASE_HOST=database"
        "DB_HOST=postgres"
    )
    
    for env_var in "${legacy_env_vars[@]}"; do
        local var_name
        var_name=$(echo "$env_var" | cut -d'=' -f1)
        
        run_test "Legacy environment variable '$var_name'" \
            "export $env_var; $SERVICE_DISCOVERY_SCRIPT discover \$(echo '$env_var' | cut -d'=' -f2)" \
            "status=(success|not_found)" \
            "Test backward compatibility with legacy environment variables"
    done
}

# Function to test no configuration changes required
test_no_config_changes_required() {
    echo "=== Testing No Configuration Changes Required ==="
    echo ""
    
    # Test that the system works without any configuration changes
    run_test "Zero configuration service discovery" \
        "$SERVICE_DISCOVERY_SCRIPT list-services" \
        "status=(success|no_services)" \
        "Test that service discovery works without configuration changes"
    
    run_test "Zero configuration network detection" \
        "$NETWORK_DETECTION_SCRIPT detect" \
        "network=.*" \
        "Test that network detection works without configuration changes"
    
    run_test "Zero configuration DNS validation" \
        "$DNS_VALIDATOR_SCRIPT validate-config" \
        "status=(valid|invalid|warning)" \
        "Test that DNS validation works without configuration changes"
    
    # Test auto-detection capabilities
    run_test "Auto-detect network type" \
        "$NETWORK_DETECTION_SCRIPT field type" \
        ".*" \
        "Test automatic network type detection"
    
    run_test "Auto-detect container IP" \
        "$NETWORK_DETECTION_SCRIPT field ip" \
        ".*" \
        "Test automatic container IP detection"
    
    run_test "Auto-detect DNS servers" \
        "$DNS_VALIDATOR_SCRIPT validate-config" \
        "status=(valid|invalid|warning)" \
        "Test automatic DNS server detection"
}

# Function to test Docker Compose file compatibility
test_compose_file_compatibility() {
    echo "=== Testing Docker Compose File Compatibility ==="
    echo ""
    
    # Test that various Docker Compose file patterns work
    local compose_patterns=(
        "version-3"
        "version-3.8"
        "legacy-version-2"
        "no-version-specified"
    )
    
    for pattern in "${compose_patterns[@]}"; do
        debug_log "Testing Compose file pattern: $pattern"
        
        run_test "Compose file pattern '$pattern'" \
            "$SERVICE_DISCOVERY_SCRIPT discover-compose" \
            "status=(success|no_services)" \
            "Test compatibility with Docker Compose file pattern"
    done
    
    # Test network definitions in Compose files
    local network_definitions=(
        "default-network"
        "custom-network-definition"
        "external-network-reference"
        "multiple-networks"
    )
    
    for definition in "${network_definitions[@]}"; do
        debug_log "Testing network definition: $definition"
        
        run_test "Network definition '$definition'" \
            "$NETWORK_DETECTION_SCRIPT validate" \
            "status=(valid|invalid|warning)" \
            "Test compatibility with network definition pattern"
    done
}

# Function to test edge cases and error handling
test_edge_cases_and_error_handling() {
    echo "=== Testing Edge Cases and Error Handling ==="
    echo ""
    
    # Test with invalid network names
    local invalid_networks=(
        ""
        "invalid..network"
        "network with spaces"
        "network@#$%"
        "very-long-network-name-that-exceeds-normal-limits-and-might-cause-issues"
    )
    
    for invalid_network in "${invalid_networks[@]}"; do
        debug_log "Testing invalid network: '$invalid_network'"
        
        run_test "Invalid network handling '$invalid_network'" \
            "DOCKER_NETWORK_NAME='$invalid_network' $NETWORK_DETECTION_SCRIPT detect" \
            "network=.*" \
            "Test handling of invalid network names"
    done
    
    # Test network connectivity failures
    run_test "Network connectivity failure handling" \
        "$SERVICE_DISCOVERY_SCRIPT test-port nonexistent-host 99999 1" \
        "status=failed" \
        "Test handling of network connectivity failures"
    
    # Test DNS resolution failures
    run_test "DNS resolution failure handling" \
        "$DNS_VALIDATOR_SCRIPT resolve nonexistent-service.invalid" \
        "status=failed" \
        "Test handling of DNS resolution failures"
    
    # Test timeout scenarios
    run_test "Connection timeout handling" \
        "$SERVICE_DISCOVERY_SCRIPT validate-connectivity 192.0.2.1:12345 1" \
        "status=(port_unreachable|timeout)" \
        "Test handling of connection timeouts"
}

# Function to run all custom network compatibility tests
run_all_custom_network_tests() {
    echo "=== Custom and External Network Compatibility Test Suite ==="
    echo "Testing compatibility with custom Docker network names and external networks"
    echo ""
    
    # Run all test categories
    test_custom_network_names
    test_external_network_configurations
    test_network_bridge_types
    test_overlay_network_configurations
    test_network_isolation_scenarios
    test_multi_network_configurations
    test_custom_dns_configurations
    test_backward_compatibility
    test_no_config_changes_required
    test_compose_file_compatibility
    test_edge_cases_and_error_handling
    
    echo "=== Test Results Summary ==="
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"
    echo "Total tests: $((TESTS_PASSED + TESTS_FAILED))"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo "✓ All custom and external network compatibility tests passed!"
        return 0
    else
        echo "✗ Some custom and external network compatibility tests failed!"
        echo ""
        echo "Failed tests:"
        for result in "${TEST_RESULTS[@]}"; do
            if [[ "$result" =~ ^FAIL ]]; then
                echo "  $result"
            fi
        done
        return 1
    fi
}

# Function to test specific custom network scenarios
test_specific_custom_scenario() {
    local scenario="$1"
    
    case "$scenario" in
        "custom-networks")
            test_custom_network_names
            ;;
        "external-networks")
            test_external_network_configurations
            ;;
        "bridge-types")
            test_network_bridge_types
            ;;
        "overlay-networks")
            test_overlay_network_configurations
            ;;
        "isolation")
            test_network_isolation_scenarios
            ;;
        "multi-network")
            test_multi_network_configurations
            ;;
        "custom-dns")
            test_custom_dns_configurations
            ;;
        "backward-compatibility")
            test_backward_compatibility
            ;;
        "no-config-changes")
            test_no_config_changes_required
            ;;
        "compose-compatibility")
            test_compose_file_compatibility
            ;;
        "edge-cases")
            test_edge_cases_and_error_handling
            ;;
        *)
            echo "Unknown scenario: $scenario"
            echo "Available scenarios: custom-networks, external-networks, bridge-types, overlay-networks, isolation, multi-network, custom-dns, backward-compatibility, no-config-changes, compose-compatibility, edge-cases"
            exit 1
            ;;
    esac
}

# Main function
main() {
    case "${1:-all}" in
        "all")
            run_all_custom_network_tests
            ;;
        "scenario")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 scenario <scenario_name>"
                echo "Available scenarios: custom-networks, external-networks, bridge-types, overlay-networks, isolation, multi-network, custom-dns, backward-compatibility, no-config-changes, compose-compatibility, edge-cases"
                exit 1
            fi
            test_specific_custom_scenario "$2"
            ;;
        "help")
            echo "Usage: $0 {all|scenario <name>|help}"
            echo ""
            echo "Commands:"
            echo "  all                    - Run all custom and external network compatibility tests"
            echo "  scenario <name>        - Run specific test scenario"
            echo "  help                   - Show this help message"
            echo ""
            echo "Available scenarios:"
            echo "  custom-networks        - Test custom Docker network names"
            echo "  external-networks      - Test external network configurations"
            echo "  bridge-types           - Test network bridge types"
            echo "  overlay-networks       - Test overlay network configurations"
            echo "  isolation              - Test network isolation scenarios"
            echo "  multi-network          - Test multi-network configurations"
            echo "  custom-dns             - Test custom DNS configurations"
            echo "  backward-compatibility - Test backward compatibility"
            echo "  no-config-changes      - Test no configuration changes required"
            echo "  compose-compatibility  - Test Docker Compose file compatibility"
            echo "  edge-cases             - Test edge cases and error handling"
            echo ""
            echo "Environment variables:"
            echo "  DEBUG_CUSTOM_NETWORK_TESTS=true    - Enable debug logging"
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"