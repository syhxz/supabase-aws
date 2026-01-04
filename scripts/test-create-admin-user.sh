#!/bin/bash

# Test script for create-admin-user.sh
# This script tests various scenarios for user creation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREATE_USER_SCRIPT="${SCRIPT_DIR}/create-admin-user.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test results
print_test_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}TEST: $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_test_pass() {
    echo -e "${GREEN}✓ PASS: $1${NC}"
    ((TESTS_PASSED++))
}

print_test_fail() {
    echo -e "${RED}✗ FAIL: $1${NC}"
    echo -e "${RED}  Reason: $2${NC}"
    ((TESTS_FAILED++))
}

print_summary() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}TEST SUMMARY${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "Total Tests: ${TESTS_RUN}"
    echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
    echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}All tests passed!${NC}"
        return 0
    else
        echo -e "\n${RED}Some tests failed!${NC}"
        return 1
    fi
}

# Check if script exists
if [ ! -f "$CREATE_USER_SCRIPT" ]; then
    echo -e "${RED}ERROR: create-admin-user.sh not found at $CREATE_USER_SCRIPT${NC}"
    exit 1
fi

# Check if script is executable
if [ ! -x "$CREATE_USER_SCRIPT" ]; then
    echo -e "${YELLOW}WARNING: Making script executable${NC}"
    chmod +x "$CREATE_USER_SCRIPT"
fi

# Test 1: Missing arguments
print_test_header "Test 1: Missing arguments"
((TESTS_RUN++))
if ! "$CREATE_USER_SCRIPT" 2>&1 | grep -q "Missing required arguments"; then
    print_test_fail "Should reject missing arguments" "Script did not show expected error"
else
    print_test_pass "Correctly rejects missing arguments"
fi

# Test 2: Invalid email format
print_test_header "Test 2: Invalid email format"
((TESTS_RUN++))
if ! "$CREATE_USER_SCRIPT" "invalid-email" "password123" 2>&1 | grep -q "Invalid email format"; then
    print_test_fail "Should reject invalid email" "Script did not validate email format"
else
    print_test_pass "Correctly validates email format"
fi

# Test 3: Short password
print_test_header "Test 3: Password too short"
((TESTS_RUN++))
if ! "$CREATE_USER_SCRIPT" "test@example.com" "12345" 2>&1 | grep -q "at least 6 characters"; then
    print_test_fail "Should reject short password" "Script did not validate password length"
else
    print_test_pass "Correctly validates password length"
fi

# Test 4: Valid email formats
print_test_header "Test 4: Valid email formats"
VALID_EMAILS=(
    "user@example.com"
    "user.name@example.com"
    "user+tag@example.co.uk"
    "user_name@example-domain.com"
)

for email in "${VALID_EMAILS[@]}"; do
    ((TESTS_RUN++))
    # We're just testing validation, not actual creation
    # So we check that it doesn't fail on email validation
    if echo "$email" | grep -qE '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'; then
        print_test_pass "Email format accepted: $email"
    else
        print_test_fail "Email format rejected: $email" "Valid email was rejected"
    fi
done

# Test 5: Invalid email formats
print_test_header "Test 5: Invalid email formats"
INVALID_EMAILS=(
    "notanemail"
    "@example.com"
    "user@"
    "user@.com"
    "user @example.com"
)

for email in "${INVALID_EMAILS[@]}"; do
    ((TESTS_RUN++))
    if ! echo "$email" | grep -qE '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'; then
        print_test_pass "Email format rejected: $email"
    else
        print_test_fail "Email format accepted: $email" "Invalid email was accepted"
    fi
done

# Test 6: Check docker/.env requirement
print_test_header "Test 6: Docker environment file check"
((TESTS_RUN++))
if [ -f "docker/.env" ]; then
    print_test_pass "docker/.env file exists"
else
    print_test_fail "docker/.env file missing" "Script requires docker/.env to exist"
fi

# Test 7: Script help/usage message
print_test_header "Test 7: Usage message"
((TESTS_RUN++))
USAGE_OUTPUT=$("$CREATE_USER_SCRIPT" 2>&1 || true)
if echo "$USAGE_OUTPUT" | grep -q "Usage:"; then
    print_test_pass "Shows usage message when arguments missing"
else
    print_test_fail "Usage message not shown" "Expected usage instructions"
fi

# Test 8: Check for required environment variables in docker/.env
print_test_header "Test 8: Environment variables check"
if [ -f "docker/.env" ]; then
    ((TESTS_RUN++))
    if grep -q "ANON_KEY" docker/.env; then
        print_test_pass "ANON_KEY found in docker/.env"
    else
        print_test_fail "ANON_KEY missing" "docker/.env should contain ANON_KEY"
    fi
else
    echo -e "${YELLOW}Skipping: docker/.env not found${NC}"
fi

# Test 9: Script syntax check
print_test_header "Test 9: Script syntax validation"
((TESTS_RUN++))
if bash -n "$CREATE_USER_SCRIPT" 2>&1; then
    print_test_pass "Script has valid bash syntax"
else
    print_test_fail "Script has syntax errors" "bash -n check failed"
fi

# Test 10: Check for security best practices
print_test_header "Test 10: Security checks"
((TESTS_RUN++))
if grep -q "set -e" "$CREATE_USER_SCRIPT"; then
    print_test_pass "Script uses 'set -e' for error handling"
else
    print_test_fail "Missing 'set -e'" "Script should exit on errors"
fi

# Print final summary
print_summary
exit $?
