#!/bin/bash
# Test script for DNS Resolution Validator
# This script tests the DNS resolution validator functionality

set -euo pipefail

# Source the DNS resolution validator
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/dns-resolution-validator.sh"

# Test configuration
TEST_HOSTNAME="localhost"
TEST_DNS_SERVER="8.8.8.8"

echo "=== DNS Resolution Validator Test Suite ==="
echo "Testing DNS configuration validation and service name resolution"
echo

# Test 1: Validate /etc/resolv.conf
echo "Test 1: Validating /etc/resolv.conf configuration"
resolv_result=$(validate_resolv_conf)
echo "Result: $resolv_result"
echo

# Test 2: Check Docker DNS server accessibility
echo "Test 2: Checking Docker DNS server accessibility"
docker_dns_result=$(check_docker_dns_accessibility)
echo "Result: $docker_dns_result"
echo

# Test 3: Validate DNS search domains
echo "Test 3: Validating DNS search domains"
domains_result=$(validate_dns_search_domains)
echo "Result: $domains_result"
echo

# Test 4: Comprehensive DNS configuration validation
echo "Test 4: Comprehensive DNS configuration validation"
config_result=$(validate_dns_configuration)
echo "Result: $config_result"
echo

# Test 5: Test service name resolution (using external DNS)
echo "Test 5: Testing service name resolution with external DNS"
resolution_result=$(test_service_name_resolution "$TEST_HOSTNAME" "$TEST_DNS_SERVER")
echo "Result: $resolution_result"
echo

# Test 6: DNS performance measurement
echo "Test 6: DNS performance measurement (3 iterations)"
performance_result=$(measure_dns_performance "$TEST_HOSTNAME" 3 "$TEST_DNS_SERVER")
echo "Result: $performance_result"
echo

# Test 7: Cache functionality
echo "Test 7: Testing DNS cache functionality"
echo "Cache status before:"
display_dns_cache_status
echo
echo "Clearing cache..."
clear_dns_cache
echo "Cache status after clear:"
display_dns_cache_status
echo

echo "=== DNS Resolution Validator Test Suite Complete ==="