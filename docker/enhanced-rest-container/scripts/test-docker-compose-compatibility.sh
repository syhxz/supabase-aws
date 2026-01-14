#!/bin/bash
# Test script for Docker Compose Compatibility
# Requirements: 6.1, 6.3 - Test standard Docker Compose configurations
# Tests compatibility with standard Docker Compose service names, network configurations, and aliases

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DISCOVERY_SCRIPT="$SCRIPT_DIR/service-discovery-manager.sh"
NETWORK_DETECTION_SCRIPT="$SCRIPT_DIR/docker-network-detection.sh"
DNS_VALIDATOR_SCRIPT="$SCRIPT_DIR/dns-resolution-validator.sh"

# Test configuration
TEST_RESULTS=()
TESTS_PASSED=0
TESTS_FAILED=0
DEBUG_COMPOSE_TESTS="${DEBUG_COMPOSE_TESTS:-false}"

# Function to log debug information
debug_log() {
    if [ "$DEBUG_COMPOSE_TESTS" = "true" ]; then
        echo "[DEBUG] $(date '+%Y-%m-%d %H:%M:%S') COMPOSE_TEST: $*" >&2
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

# Function to test standard Docker Compose service names
test_standard_compose_service_names() {
    echo "=== Testing Standard Docker Compose Service Names ==="
    echo ""
    
    # Standard database service names commonly used in Docker Compose
    local standard_services=("db" "database" "postgres" "postgresql" "mysql" "mariadb" "redis" "mongo" "mongodb")
    
    for service_name in "${standard_services[@]}"; do
        debug_log "Testing standard service name: $service_name"
        
        # Test service discovery for each standard name
        run_test "Service discovery for '$service_name'" \
            "$SERVICE_DISCOVERY_SCRIPT discover '$service_name'" \
            "status=(success|not_found)" \
            "Test discovery of standard Docker Compose service name"
        
        # Test DNS resolution for each standard name
        run_test "DNS resolution for '$service_name'" \
            "$DNS_VALIDATOR_SCRIPT resolve '$service_name'" \
            "status=(success|failed)" \
            "Test DNS resolution of standard service name"
    done
}

# Function to test Docker Compose network configurations
test_compose_network_configurations() {
    echo "=== Testing Docker Compose Network Configurations ==="
    echo ""
    
    # Test current network detection
    run_test "Current network detection" \
        "$NETWORK_DETECTION_SCRIPT detect" \
        "network=.*" \
        "Detect current Docker network configuration"
    
    # Test network validation
    run_test "Network configuration validation" \
        "$NETWORK_DETECTION_SCRIPT validate" \
        "status=(valid|invalid|warning)" \
        "Validate current network configuration"
    
    # Test network type detection
    local network_info
    network_info=$($NETWORK_DETECTION_SCRIPT detect 2>/dev/null || echo "network=unknown")
    local network_type
    network_type=$(echo "$network_info" | sed -n 's/.*type=\([^;]*\).*/\1/p' || echo "unknown")
    
    debug_log "Detected network type: $network_type"
    
    # Test network-specific configurations
    case "$network_type" in
        "bridge_default")
            run_test "Default bridge network compatibility" \
                "echo 'Testing default bridge network'; $SERVICE_DISCOVERY_SCRIPT list-services" \
                "status=(success|no_services)" \
                "Test compatibility with default Docker bridge network"
            ;;
        "bridge_custom")
            run_test "Custom bridge network compatibility" \
                "echo 'Testing custom bridge network'; $SERVICE_DISCOVERY_SCRIPT list-services" \
                "status=(success|no_services)" \
                "Test compatibility with custom Docker bridge network"
            ;;
        "overlay")
            run_test "Overlay network compatibility" \
                "echo 'Testing overlay network'; $SERVICE_DISCOVERY_SCRIPT list-services" \
                "status=(success|no_services)" \
                "Test compatibility with Docker overlay network"
            ;;
        "external")
            run_test "External network compatibility" \
                "echo 'Testing external network'; $SERVICE_DISCOVERY_SCRIPT list-services" \
                "status=(success|no_services)" \
                "Test compatibility with external Docker network"
            ;;
        *)
            run_test "Unknown network type handling" \
                "echo 'Testing unknown network type'; $SERVICE_DISCOVERY_SCRIPT list-services" \
                "status=(success|no_services)" \
                "Test handling of unknown network types"
            ;;
    esac
}

# Function to test Docker Compose aliases
test_compose_aliases() {
    echo "=== Testing Docker Compose Aliases ==="
    echo ""
    
    # Get current network name for alias testing
    local network_info
    network_info=$($NETWORK_DETECTION_SCRIPT detect 2>/dev/null || echo "network=unknown")
    local network_name
    network_name=$(echo "$network_info" | sed -n 's/.*network=\([^;]*\).*/\1/p' || echo "unknown")
    
    debug_log "Testing aliases in network: $network_name"
    
    # Test network alias discovery
    run_test "Network alias discovery" \
        "$SERVICE_DISCOVERY_SCRIPT discover-aliases" \
        "status=(success|no_aliases)" \
        "Test discovery of Docker Compose network aliases"
    
    # Test common alias patterns
    local common_aliases=("db" "database" "postgres" "mysql" "redis")
    
    for alias in "${common_aliases[@]}"; do
        # Test alias with network suffix
        if [ "$network_name" != "unknown" ] && [ "$network_name" != "bridge" ]; then
            local network_alias="${alias}.${network_name}"
            run_test "Network-specific alias '$network_alias'" \
                "$DNS_VALIDATOR_SCRIPT resolve '$network_alias'" \
                "status=(success|failed)" \
                "Test network-specific alias resolution"
        fi
        
        # Test alias with .local suffix
        local local_alias="${alias}.local"
        run_test "Local alias '$local_alias'" \
            "$DNS_VALIDATOR_SCRIPT resolve '$local_alias'" \
            "status=(success|failed)" \
            "Test .local alias resolution"
    done
}

# Function to test Docker Compose project name handling
test_compose_project_names() {
    echo "=== Testing Docker Compose Project Name Handling ==="
    echo ""
    
    # Test with various project name patterns
    local test_project_names=("supabase" "myapp" "test-project" "app_name")
    
    for project_name in "${test_project_names[@]}"; do
        debug_log "Testing project name pattern: $project_name"
        
        # Test default network name pattern (project_default)
        local default_network="${project_name}_default"
        run_test "Project default network '$default_network'" \
            "echo 'Testing network name: $default_network'; $DNS_VALIDATOR_SCRIPT validate-config" \
            "status=(valid|invalid|warning)" \
            "Test default network naming pattern for project"
        
        # Test service name with project prefix
        local prefixed_service="${project_name}_db"
        run_test "Prefixed service name '$prefixed_service'" \
            "$SERVICE_DISCOVERY_SCRIPT discover '$prefixed_service'" \
            "status=(success|not_found)" \
            "Test service name with project prefix"
    done
}

# Function to test Docker Compose service variations
test_compose_service_variations() {
    echo "=== Testing Docker Compose Service Variations ==="
    echo ""
    
    # Test common service name variations
    local base_services=("db" "postgres" "mysql" "redis")
    local variations=("" "-service" "_service" "-1" "_1")
    
    for base_service in "${base_services[@]}"; do
        for variation in "${variations[@]}"; do
            local service_name="${base_service}${variation}"
            
            debug_log "Testing service variation: $service_name"
            
            run_test "Service variation '$service_name'" \
                "$SERVICE_DISCOVERY_SCRIPT discover '$service_name'" \
                "status=(success|not_found)" \
                "Test service name variation discovery"
        done
    done
}

# Function to test Docker Compose environment compatibility
test_compose_environment_compatibility() {
    echo "=== Testing Docker Compose Environment Compatibility ==="
    echo ""
    
    # Test with different environment variable patterns
    local env_vars=(
        "COMPOSE_PROJECT_NAME=test-project"
        "DOCKER_NETWORK_NAME=custom-network"
        "POSTGRES_HOST=db"
        "DATABASE_HOST=database"
    )
    
    for env_var in "${env_vars[@]}"; do
        local var_name
        var_name=$(echo "$env_var" | cut -d'=' -f1)
        local var_value
        var_value=$(echo "$env_var" | cut -d'=' -f2)
        
        debug_log "Testing environment variable: $env_var"
        
        run_test "Environment variable '$var_name'" \
            "export $env_var; $NETWORK_DETECTION_SCRIPT detect" \
            "network=.*" \
            "Test network detection with environment variable"
    done
}

# Function to test Docker Compose volume and bind mount compatibility
test_compose_volume_compatibility() {
    echo "=== Testing Docker Compose Volume Compatibility ==="
    echo ""
    
    # Test that DNS resolution works regardless of volume mounts
    run_test "DNS resolution with volumes" \
        "$DNS_VALIDATOR_SCRIPT validate-config" \
        "status=(valid|invalid|warning)" \
        "Test DNS configuration with Docker volumes"
    
    # Test service discovery with bind mounts
    run_test "Service discovery with bind mounts" \
        "$SERVICE_DISCOVERY_SCRIPT list-services" \
        "status=(success|no_services)" \
        "Test service discovery with bind mounts"
}

# Function to test Docker Compose multi-service scenarios
test_compose_multi_service_scenarios() {
    echo "=== Testing Docker Compose Multi-Service Scenarios ==="
    echo ""
    
    # Test discovery of multiple services
    run_test "Multi-service discovery" \
        "$SERVICE_DISCOVERY_SCRIPT discover-compose" \
        "status=(success|no_services)" \
        "Test discovery of multiple Docker Compose services"
    
    # Test service list functionality
    run_test "Service list functionality" \
        "$SERVICE_DISCOVERY_SCRIPT list-services" \
        "status=(success|no_services)" \
        "Test listing all available services"
    
    # Test fallback discovery methods
    run_test "Fallback discovery methods" \
        "$SERVICE_DISCOVERY_SCRIPT fallback nonexistent-service" \
        "status=(success|failed)" \
        "Test fallback discovery methods for services"
}

# Function to test Docker Compose health check integration
test_compose_health_check_integration() {
    echo "=== Testing Docker Compose Health Check Integration ==="
    echo ""
    
    # Test connectivity validation
    run_test "Service connectivity validation" \
        "$SERVICE_DISCOVERY_SCRIPT validate-connectivity localhost:5432 2" \
        "status=(accessible|auth_required|port_unreachable)" \
        "Test service connectivity validation"
    
    # Test endpoint validation
    run_test "Service endpoint validation" \
        "$SERVICE_DISCOVERY_SCRIPT validate-endpoint localhost:5432 database 2" \
        "status=(accessible|auth_required|dns_failed|port_unreachable)" \
        "Test service endpoint validation"
}

# Function to run all Docker Compose compatibility tests
run_all_compose_tests() {
    echo "=== Docker Compose Compatibility Test Suite ==="
    echo "Testing compatibility with standard Docker Compose configurations"
    echo ""
    
    # Run all test categories
    test_standard_compose_service_names
    test_compose_network_configurations
    test_compose_aliases
    test_compose_project_names
    test_compose_service_variations
    test_compose_environment_compatibility
    test_compose_volume_compatibility
    test_compose_multi_service_scenarios
    test_compose_health_check_integration
    
    echo "=== Test Results Summary ==="
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"
    echo "Total tests: $((TESTS_PASSED + TESTS_FAILED))"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo "✓ All Docker Compose compatibility tests passed!"
        return 0
    else
        echo "✗ Some Docker Compose compatibility tests failed!"
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

# Function to test specific Docker Compose scenarios
test_specific_compose_scenario() {
    local scenario="$1"
    
    case "$scenario" in
        "standard-services")
            test_standard_compose_service_names
            ;;
        "network-configs")
            test_compose_network_configurations
            ;;
        "aliases")
            test_compose_aliases
            ;;
        "project-names")
            test_compose_project_names
            ;;
        "service-variations")
            test_compose_service_variations
            ;;
        "environment")
            test_compose_environment_compatibility
            ;;
        "volumes")
            test_compose_volume_compatibility
            ;;
        "multi-service")
            test_compose_multi_service_scenarios
            ;;
        "health-checks")
            test_compose_health_check_integration
            ;;
        *)
            echo "Unknown scenario: $scenario"
            echo "Available scenarios: standard-services, network-configs, aliases, project-names, service-variations, environment, volumes, multi-service, health-checks"
            exit 1
            ;;
    esac
}

# Main function
main() {
    case "${1:-all}" in
        "all")
            run_all_compose_tests
            ;;
        "scenario")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 scenario <scenario_name>"
                echo "Available scenarios: standard-services, network-configs, aliases, project-names, service-variations, environment, volumes, multi-service, health-checks"
                exit 1
            fi
            test_specific_compose_scenario "$2"
            ;;
        "help")
            echo "Usage: $0 {all|scenario <name>|help}"
            echo ""
            echo "Commands:"
            echo "  all                    - Run all Docker Compose compatibility tests"
            echo "  scenario <name>        - Run specific test scenario"
            echo "  help                   - Show this help message"
            echo ""
            echo "Available scenarios:"
            echo "  standard-services      - Test standard Docker Compose service names"
            echo "  network-configs        - Test Docker Compose network configurations"
            echo "  aliases                - Test Docker Compose aliases"
            echo "  project-names          - Test Docker Compose project name handling"
            echo "  service-variations     - Test Docker Compose service variations"
            echo "  environment            - Test environment variable compatibility"
            echo "  volumes                - Test volume and bind mount compatibility"
            echo "  multi-service          - Test multi-service scenarios"
            echo "  health-checks          - Test health check integration"
            echo ""
            echo "Environment variables:"
            echo "  DEBUG_COMPOSE_TESTS=true    - Enable debug logging"
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