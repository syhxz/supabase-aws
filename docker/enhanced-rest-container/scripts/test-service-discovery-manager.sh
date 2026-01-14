#!/bin/bash
# Test script for Service Discovery Manager
# Tests integration with Docker network detection and DNS resolution modules

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DISCOVERY_SCRIPT="$SCRIPT_DIR/service-discovery-manager.sh"

# Test configuration
TEST_RESULTS=()
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    echo "Running test: $test_name"
    
    local test_output
    local test_exit_code=0
    
    test_output=$($test_command 2>&1) || test_exit_code=$?
    
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

# Function to run all tests
run_all_tests() {
    echo "=== Service Discovery Manager Integration Tests ==="
    echo ""
    
    # Test 1: Help command
    run_test "Help command" \
        "$SERVICE_DISCOVERY_SCRIPT help" \
        "Service Discovery Commands:"
    
    # Test 2: List services (should work even if no services found)
    run_test "List services" \
        "$SERVICE_DISCOVERY_SCRIPT list-services" \
        "status=(success|no_services)"
    
    # Test 3: Cache status (should work)
    run_test "Cache status" \
        "$SERVICE_DISCOVERY_SCRIPT cache-status" \
        "Service Discovery Cache Status"
    
    # Test 4: Port connectivity test (should fail for non-existent service)
    run_test "Port connectivity test" \
        "$SERVICE_DISCOVERY_SCRIPT test-port localhost 99999 1" \
        "status=failed"
    
    # Test 5: Service discovery (should handle non-existent service gracefully)
    run_test "Service discovery for non-existent service" \
        "$SERVICE_DISCOVERY_SCRIPT discover nonexistent-service" \
        "status=not_found"
    
    # Test 6: Validate endpoint (should handle DNS resolution)
    run_test "Validate endpoint" \
        "$SERVICE_DISCOVERY_SCRIPT validate-endpoint localhost:99999 database 2" \
        "status=(dns_failed|port_unreachable)"
    
    # Test 7: Clear cache (should work)
    run_test "Clear cache" \
        "$SERVICE_DISCOVERY_SCRIPT clear-cache" \
        ""  # No specific output expected, just should not fail
    
    echo "=== Test Results Summary ==="
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"
    echo "Total tests: $((TESTS_PASSED + TESTS_FAILED))"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo "✓ All tests passed!"
        return 0
    else
        echo "✗ Some tests failed!"
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

# Function to test integration with other modules
test_module_integration() {
    echo "=== Module Integration Tests ==="
    echo ""
    
    # Test Docker network detection integration
    echo "Testing Docker network detection integration..."
    if [ -f "$SCRIPT_DIR/docker-network-detection.sh" ]; then
        local network_info
        network_info=$("$SCRIPT_DIR/docker-network-detection.sh" detect 2>/dev/null || echo "failed")
        if [[ "$network_info" =~ network= ]]; then
            echo "✓ Docker network detection integration working"
        else
            echo "✗ Docker network detection integration failed"
        fi
    else
        echo "⚠ Docker network detection module not found"
    fi
    
    # Test DNS resolution integration
    echo "Testing DNS resolution integration..."
    if [ -f "$SCRIPT_DIR/dns-resolution-validator.sh" ]; then
        local dns_validation
        dns_validation=$("$SCRIPT_DIR/dns-resolution-validator.sh" validate-config 2>/dev/null || echo "failed")
        if [[ "$dns_validation" =~ status= ]]; then
            echo "✓ DNS resolution integration working"
        else
            echo "✗ DNS resolution integration failed"
        fi
    else
        echo "⚠ DNS resolution validator module not found"
    fi
    
    echo ""
}

# Main function
main() {
    case "${1:-all}" in
        "integration")
            test_module_integration
            ;;
        "all"|*)
            test_module_integration
            run_all_tests
            ;;
    esac
}

# Run main function
main "$@"