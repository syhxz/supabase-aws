#!/bin/bash
# Basic test script for Docker Network Detection Module
# This tests the core functionality of the docker-network-detection.sh module

set -euo pipefail

# Source the docker network detection module
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/docker-network-detection.sh"

# Test counter
TESTS_PASSED=0
TESTS_TOTAL=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo "Running test: $test_name"
    
    local result
    if result=$(eval "$test_command" 2>&1); then
        if [[ "$result" =~ $expected_pattern ]]; then
            echo "  ✓ PASS: $test_name"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo "  ✗ FAIL: $test_name - Expected pattern '$expected_pattern', got '$result'"
        fi
    else
        echo "  ✗ FAIL: $test_name - Command failed: $result"
    fi
    echo
}

# Function to test network detection
test_network_detection() {
    echo "=== Testing Docker Network Detection Module ==="
    echo
    
    # Test 1: Basic network detection
    run_test "Basic network detection" \
        "detect_docker_network" \
        "network=.*id=.*type="
    
    # Test 2: Network validation
    run_test "Network validation" \
        "validate_network_configuration" \
        "status="
    
    # Test 3: Get network name field
    run_test "Get network name field" \
        "get_network_info_field network" \
        ".*"
    
    # Test 4: Get network type field
    run_test "Get network type field" \
        "get_network_info_field type" \
        ".*"
    
    # Test 5: Container network interfaces detection
    run_test "Container network interfaces detection" \
        "get_container_network_interfaces" \
        ".*"
    
    # Test 6: Network routing parsing
    run_test "Network routing parsing" \
        "parse_network_routing" \
        "gateway="
    
    # Test 7: DNS configuration detection
    run_test "DNS configuration detection" \
        "get_dns_configuration" \
        ".*"
    
    # Test 8: Cache functionality
    run_test "Cache clear functionality" \
        "clear_network_cache; echo 'cache cleared'" \
        "cache cleared"
    
    # Test 9: Network type detection (with mock data)
    run_test "Network type detection - bridge" \
        "detect_docker_network_type '172.18.0.5' '172.18.0.1'" \
        "bridge_custom"
    
    run_test "Network type detection - default bridge" \
        "detect_docker_network_type '172.17.0.5' '172.17.0.1'" \
        "bridge_default"
    
    run_test "Network type detection - overlay" \
        "detect_docker_network_type '10.0.1.5' '10.0.1.1'" \
        "overlay"
    
    # Test 10: Docker network name detection
    run_test "Docker network name detection" \
        "get_docker_network_name" \
        ".*"
}

# Function to test error handling
test_error_handling() {
    echo "=== Testing Error Handling ==="
    echo
    
    # Test invalid field extraction
    run_test "Invalid field extraction" \
        "result=\$(get_network_info_field nonexistent_field); [ -z \"\$result\" ] && echo 'empty'" \
        "empty"
    
    # Test network type with invalid IP
    run_test "Network type with invalid IP" \
        "detect_docker_network_type 'invalid' 'invalid'" \
        "unknown"
}

# Function to test caching
test_caching() {
    echo "=== Testing Caching Functionality ==="
    echo
    
    # Clear cache first
    clear_network_cache
    
    # Test cache creation
    run_test "Cache creation" \
        "detect_docker_network >/dev/null; [ -f '$NETWORK_CACHE_FILE' ] && echo 'cache exists'" \
        "cache exists"
    
    # Test cache validity
    run_test "Cache validity check" \
        "is_cache_valid && echo 'valid' || echo 'invalid'" \
        "valid"
}

# Main test execution
main() {
    echo "Docker Network Detection Module Test Suite"
    echo "=========================================="
    echo
    
    # Run all test suites
    test_network_detection
    test_error_handling
    test_caching
    
    # Print summary
    echo "=== Test Summary ==="
    echo "Tests passed: $TESTS_PASSED/$TESTS_TOTAL"
    
    if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
        echo "All tests passed! ✓"
        exit 0
    else
        echo "Some tests failed! ✗"
        exit 1
    fi
}

# Run tests
main "$@"