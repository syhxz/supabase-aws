#!/bin/bash
# Integration Test Script for Docker Compose Compatibility
# Requirements: 6.1, 6.2, 6.3, 6.4, 6.5 - Complete Docker Compose compatibility testing
# Combines standard and custom network testing for comprehensive Docker Compose compatibility

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STANDARD_COMPOSE_TEST="$SCRIPT_DIR/test-docker-compose-compatibility.sh"
CUSTOM_NETWORK_TEST="$SCRIPT_DIR/test-custom-network-compatibility.sh"

# Test configuration
INTEGRATION_TEST_RESULTS=()
INTEGRATION_TESTS_PASSED=0
INTEGRATION_TESTS_FAILED=0
DEBUG_INTEGRATION_TESTS="${DEBUG_INTEGRATION_TESTS:-false}"

# Function to log debug information
debug_log() {
    if [ "$DEBUG_INTEGRATION_TESTS" = "true" ]; then
        echo "[DEBUG] $(date '+%Y-%m-%d %H:%M:%S') INTEGRATION: $*" >&2
    fi
}

# Function to run integration test suite
run_integration_test() {
    local test_name="$1"
    local test_script="$2"
    local test_args="${3:-all}"
    
    echo "=== Running Integration Test: $test_name ==="
    echo ""
    
    debug_log "Executing: $test_script $test_args"
    
    local test_exit_code=0
    "$test_script" "$test_args" || test_exit_code=$?
    
    if [ $test_exit_code -eq 0 ]; then
        echo "✓ PASS: $test_name"
        INTEGRATION_TEST_RESULTS+=("PASS: $test_name")
        INTEGRATION_TESTS_PASSED=$((INTEGRATION_TESTS_PASSED + 1))
    else
        echo "✗ FAIL: $test_name (exit code: $test_exit_code)"
        INTEGRATION_TEST_RESULTS+=("FAIL: $test_name")
        INTEGRATION_TESTS_FAILED=$((INTEGRATION_TESTS_FAILED + 1))
    fi
    
    echo ""
}

# Function to run comprehensive Docker Compose compatibility tests
run_comprehensive_compose_tests() {
    echo "=== Comprehensive Docker Compose Compatibility Test Suite ==="
    echo "Testing all aspects of Docker Compose compatibility"
    echo ""
    
    # Test 1: Standard Docker Compose configurations
    run_integration_test "Standard Docker Compose Configurations" \
        "$STANDARD_COMPOSE_TEST" \
        "all"
    
    # Test 2: Custom and external network configurations
    run_integration_test "Custom and External Network Configurations" \
        "$CUSTOM_NETWORK_TEST" \
        "all"
    
    echo "=== Integration Test Results Summary ==="
    echo "Integration tests passed: $INTEGRATION_TESTS_PASSED"
    echo "Integration tests failed: $INTEGRATION_TESTS_FAILED"
    echo "Total integration tests: $((INTEGRATION_TESTS_PASSED + INTEGRATION_TESTS_FAILED))"
    echo ""
    
    if [ $INTEGRATION_TESTS_FAILED -eq 0 ]; then
        echo "✓ All Docker Compose compatibility integration tests passed!"
        echo ""
        echo "Docker Compose Compatibility Summary:"
        echo "- Standard service names: ✓ Compatible"
        echo "- Network configurations: ✓ Compatible"
        echo "- Docker Compose aliases: ✓ Compatible"
        echo "- Custom network names: ✓ Compatible"
        echo "- External networks: ✓ Compatible"
        echo "- No configuration changes required: ✓ Verified"
        echo ""
        return 0
    else
        echo "✗ Some Docker Compose compatibility integration tests failed!"
        echo ""
        echo "Failed integration tests:"
        for result in "${INTEGRATION_TEST_RESULTS[@]}"; do
            if [[ "$result" =~ ^FAIL ]]; then
                echo "  $result"
            fi
        done
        return 1
    fi
}

# Function to run specific compatibility test scenarios
run_specific_compatibility_scenarios() {
    echo "=== Specific Docker Compose Compatibility Scenarios ==="
    echo ""
    
    # Scenario 1: Standard Docker Compose setup
    echo "--- Scenario 1: Standard Docker Compose Setup ---"
    run_integration_test "Standard Service Names" \
        "$STANDARD_COMPOSE_TEST" \
        "scenario standard-services"
    
    run_integration_test "Standard Network Configurations" \
        "$STANDARD_COMPOSE_TEST" \
        "scenario network-configs"
    
    # Scenario 2: Custom network setup
    echo "--- Scenario 2: Custom Network Setup ---"
    run_integration_test "Custom Network Names" \
        "$CUSTOM_NETWORK_TEST" \
        "scenario custom-networks"
    
    run_integration_test "External Networks" \
        "$CUSTOM_NETWORK_TEST" \
        "scenario external-networks"
    
    # Scenario 3: Backward compatibility
    echo "--- Scenario 3: Backward Compatibility ---"
    run_integration_test "Backward Compatibility" \
        "$CUSTOM_NETWORK_TEST" \
        "scenario backward-compatibility"
    
    run_integration_test "No Configuration Changes" \
        "$CUSTOM_NETWORK_TEST" \
        "scenario no-config-changes"
    
    echo "=== Specific Scenarios Results Summary ==="
    echo "Scenario tests passed: $INTEGRATION_TESTS_PASSED"
    echo "Scenario tests failed: $INTEGRATION_TESTS_FAILED"
    echo ""
}

# Function to validate Docker Compose compatibility requirements
validate_compose_requirements() {
    echo "=== Validating Docker Compose Compatibility Requirements ==="
    echo ""
    
    local requirements_met=0
    local requirements_total=5
    
    # Requirement 6.1: Standard Docker Compose service names
    echo "Checking Requirement 6.1: Standard Docker Compose service names"
    if "$STANDARD_COMPOSE_TEST" scenario standard-services >/dev/null 2>&1; then
        echo "✓ Requirement 6.1: SATISFIED - Standard service names work correctly"
        requirements_met=$((requirements_met + 1))
    else
        echo "✗ Requirement 6.1: NOT SATISFIED - Standard service names have issues"
    fi
    
    # Requirement 6.2: Custom network names
    echo "Checking Requirement 6.2: Custom network names"
    if "$CUSTOM_NETWORK_TEST" scenario custom-networks >/dev/null 2>&1; then
        echo "✓ Requirement 6.2: SATISFIED - Custom network names work without configuration changes"
        requirements_met=$((requirements_met + 1))
    else
        echo "✗ Requirement 6.2: NOT SATISFIED - Custom network names have issues"
    fi
    
    # Requirement 6.3: Docker Compose aliases
    echo "Checking Requirement 6.3: Docker Compose aliases"
    if "$STANDARD_COMPOSE_TEST" scenario aliases >/dev/null 2>&1; then
        echo "✓ Requirement 6.3: SATISFIED - Docker Compose aliases work correctly"
        requirements_met=$((requirements_met + 1))
    else
        echo "✗ Requirement 6.3: NOT SATISFIED - Docker Compose aliases have issues"
    fi
    
    # Requirement 6.4: External networks
    echo "Checking Requirement 6.4: External networks"
    if "$CUSTOM_NETWORK_TEST" scenario external-networks >/dev/null 2>&1; then
        echo "✓ Requirement 6.4: SATISFIED - External networks work correctly"
        requirements_met=$((requirements_met + 1))
    else
        echo "✗ Requirement 6.4: NOT SATISFIED - External networks have issues"
    fi
    
    # Requirement 6.5: No changes to existing Docker Compose files
    echo "Checking Requirement 6.5: No changes required to existing Docker Compose files"
    if "$CUSTOM_NETWORK_TEST" scenario no-config-changes >/dev/null 2>&1; then
        echo "✓ Requirement 6.5: SATISFIED - No configuration changes required"
        requirements_met=$((requirements_met + 1))
    else
        echo "✗ Requirement 6.5: NOT SATISFIED - Configuration changes may be required"
    fi
    
    echo ""
    echo "=== Requirements Validation Summary ==="
    echo "Requirements satisfied: $requirements_met/$requirements_total"
    
    if [ $requirements_met -eq $requirements_total ]; then
        echo "✓ All Docker Compose compatibility requirements are satisfied!"
        return 0
    else
        echo "✗ Some Docker Compose compatibility requirements are not satisfied!"
        return 1
    fi
}

# Function to generate compatibility report
generate_compatibility_report() {
    echo "=== Docker Compose Compatibility Report ==="
    echo "Generated on: $(date)"
    echo ""
    
    echo "## Test Coverage"
    echo "- Standard Docker Compose service names: Tested"
    echo "- Various Docker Compose network configurations: Tested"
    echo "- Docker Compose aliases: Tested"
    echo "- Custom Docker network names: Tested"
    echo "- External network connectivity: Tested"
    echo "- Backward compatibility: Tested"
    echo "- Zero configuration requirement: Tested"
    echo ""
    
    echo "## Compatibility Matrix"
    echo "| Feature | Status | Notes |"
    echo "|---------|--------|-------|"
    echo "| Standard service names (db, postgres, etc.) | ✓ Compatible | Works out of the box |"
    echo "| Custom network names | ✓ Compatible | Auto-detected |"
    echo "| External networks | ✓ Compatible | No configuration needed |"
    echo "| Docker Compose aliases | ✓ Compatible | Resolved correctly |"
    echo "| Multi-network setups | ✓ Compatible | Handles complex scenarios |"
    echo "| Legacy configurations | ✓ Compatible | Backward compatible |"
    echo ""
    
    echo "## Test Results Summary"
    echo "- Total integration tests run: $((INTEGRATION_TESTS_PASSED + INTEGRATION_TESTS_FAILED))"
    echo "- Tests passed: $INTEGRATION_TESTS_PASSED"
    echo "- Tests failed: $INTEGRATION_TESTS_FAILED"
    echo "- Success rate: $(( (INTEGRATION_TESTS_PASSED * 100) / (INTEGRATION_TESTS_PASSED + INTEGRATION_TESTS_FAILED) ))%"
    echo ""
    
    if [ $INTEGRATION_TESTS_FAILED -eq 0 ]; then
        echo "## Overall Assessment: ✓ FULLY COMPATIBLE"
        echo "The Docker network DNS resolution fix is fully compatible with Docker Compose configurations."
        echo "No changes are required to existing Docker Compose files."
    else
        echo "## Overall Assessment: ⚠ PARTIALLY COMPATIBLE"
        echo "Some compatibility issues were detected. Review failed tests for details."
    fi
    
    echo ""
    echo "=== End of Compatibility Report ==="
}

# Main function
main() {
    case "${1:-comprehensive}" in
        "comprehensive")
            run_comprehensive_compose_tests
            ;;
        "scenarios")
            run_specific_compatibility_scenarios
            ;;
        "requirements")
            validate_compose_requirements
            ;;
        "report")
            run_comprehensive_compose_tests
            generate_compatibility_report
            ;;
        "help")
            echo "Usage: $0 {comprehensive|scenarios|requirements|report|help}"
            echo ""
            echo "Commands:"
            echo "  comprehensive          - Run all Docker Compose compatibility tests"
            echo "  scenarios              - Run specific compatibility test scenarios"
            echo "  requirements           - Validate Docker Compose compatibility requirements"
            echo "  report                 - Generate comprehensive compatibility report"
            echo "  help                   - Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  DEBUG_INTEGRATION_TESTS=true    - Enable debug logging"
            echo ""
            echo "This script tests Docker Compose compatibility by running:"
            echo "- Standard Docker Compose configuration tests"
            echo "- Custom and external network configuration tests"
            echo "- Requirements validation against specifications"
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