#!/bin/bash
# Configuration validation script for enhanced PostgREST container
# Requirements: 13.1, 13.2, 13.3, 13.4, 13.5

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}[VALIDATION] ${message}${NC}"
}

# Function to validate environment variables
validate_environment() {
    print_status "$BLUE" "Validating environment variables..."
    
    local errors=0
    
    # Required variables
    local required_vars=(
        "PGRST_DB_URI"
        "PGRST_DB_SCHEMAS"
        "PGRST_DB_ANON_ROLE"
        "PGRST_JWT_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            print_status "$RED" "Required variable $var is not set"
            errors=$((errors + 1))
        else
            print_status "$GREEN" "$var is set"
        fi
    done
    
    # Enhanced feature variables
    local feature_vars=(
        "ENHANCED_RPC_ENABLED"
        "ENHANCED_JSON_OPS_ENABLED"
        "ENHANCED_FTS_ENABLED"
        "ENHANCED_AGGREGATES_ENABLED"
        "ENHANCED_BULK_OPS_ENABLED"
        "ENHANCED_TRANSACTIONS_ENABLED"
        "ENHANCED_ARRAY_OPS_ENABLED"
    )
    
    for var in "${feature_vars[@]}"; do
        local value="${!var:-true}"
        if [[ "$value" =~ ^(true|false)$ ]]; then
            print_status "$GREEN" "$var = $value"
        else
            print_status "$YELLOW" "$var has invalid value: $value (should be true/false)"
        fi
    done
    
    return $errors
}

# Function to validate numeric settings
validate_numeric_settings() {
    print_status "$BLUE" "Validating numeric settings..."
    
    local errors=0
    
    # Numeric variables with their expected ranges
    declare -A numeric_vars=(
        ["PGRST_DB_POOL"]="1:100"
        ["PGRST_DB_MAX_ROWS"]="1:10000"
        ["PGRST_SERVER_PORT"]="1024:65535"
        ["ENHANCED_METRICS_PORT"]="1024:65535"
        ["ENHANCED_RESPONSE_CACHE_TTL"]="0:86400"
        ["ENHANCED_MAX_QUERY_COMPLEXITY"]="1:10000"
        ["ENHANCED_MAX_NESTED_DEPTH"]="1:20"
        ["ENHANCED_MAX_BULK_SIZE"]="1:10000"
    )
    
    for var in "${!numeric_vars[@]}"; do
        local value="${!var:-}"
        local range="${numeric_vars[$var]}"
        local min_val="${range%:*}"
        local max_val="${range#*:}"
        
        if [ -n "$value" ]; then
            if [[ "$value" =~ ^[0-9]+$ ]]; then
                if [ "$value" -ge "$min_val" ] && [ "$value" -le "$max_val" ]; then
                    print_status "$GREEN" "$var = $value (valid range: $min_val-$max_val)"
                else
                    print_status "$RED" "$var = $value (out of range: $min_val-$max_val)"
                    errors=$((errors + 1))
                fi
            else
                print_status "$RED" "$var = $value (not a valid number)"
                errors=$((errors + 1))
            fi
        else
            print_status "$YELLOW" "$var is not set (using default)"
        fi
    done
    
    return $errors
}

# Function to validate directories
validate_directories() {
    print_status "$BLUE" "Validating directories..."
    
    local errors=0
    local directories=(
        "/etc/postgrest/enhanced"
        "/var/log/postgrest"
        "/tmp/postgrest-cache"
    )
    
    for dir in "${directories[@]}"; do
        if [ -d "$dir" ]; then
            if [ -w "$dir" ]; then
                print_status "$GREEN" "Directory $dir exists and is writable"
            else
                print_status "$RED" "Directory $dir exists but is not writable"
                errors=$((errors + 1))
            fi
        else
            print_status "$RED" "Directory $dir does not exist"
            errors=$((errors + 1))
        fi
    done
    
    return $errors
}

# Function to validate scripts
validate_scripts() {
    print_status "$BLUE" "Validating scripts..."
    
    local errors=0
    local scripts=(
        "/usr/local/bin/enhanced-startup.sh"
        "/usr/local/bin/health-check.sh"
        "/usr/local/bin/monitoring-service.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [ -f "$script" ]; then
            if [ -x "$script" ]; then
                print_status "$GREEN" "Script $script exists and is executable"
            else
                print_status "$RED" "Script $script exists but is not executable"
                errors=$((errors + 1))
            fi
        else
            print_status "$RED" "Script $script does not exist"
            errors=$((errors + 1))
        fi
    done
    
    return $errors
}

# Function to validate configuration template
validate_config_template() {
    print_status "$BLUE" "Validating configuration template..."
    
    local template_file="/etc/postgrest/enhanced/postgrest.conf.template"
    local errors=0
    
    if [ -f "$template_file" ]; then
        print_status "$GREEN" "Configuration template exists"
        
        # Check for required placeholders
        local placeholders=(
            "PGRST_DB_URI"
            "PGRST_DB_SCHEMAS"
            "PGRST_JWT_SECRET"
        )
        
        for placeholder in "${placeholders[@]}"; do
            if grep -q "\${$placeholder}" "$template_file"; then
                print_status "$GREEN" "Template contains placeholder: $placeholder"
            else
                print_status "$RED" "Template missing placeholder: $placeholder"
                errors=$((errors + 1))
            fi
        done
    else
        print_status "$RED" "Configuration template does not exist"
        errors=$((errors + 1))
    fi
    
    return $errors
}

# Function to validate database connection (if possible)
validate_database_connection() {
    print_status "$BLUE" "Validating database connection..."
    
    if [ -n "${PGRST_DB_URI:-}" ]; then
        if command -v pg_isready >/dev/null 2>&1; then
            if pg_isready -d "$PGRST_DB_URI" -t 5 >/dev/null 2>&1; then
                print_status "$GREEN" "Database connection successful"
                return 0
            else
                print_status "$YELLOW" "Database connection failed (may not be available yet)"
                return 1
            fi
        else
            print_status "$YELLOW" "pg_isready not available, skipping database connection test"
            return 0
        fi
    else
        print_status "$RED" "PGRST_DB_URI not set, cannot test database connection"
        return 1
    fi
}

# Main validation function
main() {
    print_status "$BLUE" "Starting Enhanced PostgREST Container Configuration Validation"
    print_status "$BLUE" "============================================================"
    
    local total_errors=0
    
    # Run all validations
    validate_environment || total_errors=$((total_errors + $?))
    echo ""
    
    validate_numeric_settings || total_errors=$((total_errors + $?))
    echo ""
    
    validate_directories || total_errors=$((total_errors + $?))
    echo ""
    
    validate_scripts || total_errors=$((total_errors + $?))
    echo ""
    
    validate_config_template || total_errors=$((total_errors + $?))
    echo ""
    
    validate_database_connection || true  # Don't fail on database connection issues
    echo ""
    
    # Summary
    print_status "$BLUE" "============================================================"
    if [ $total_errors -eq 0 ]; then
        print_status "$GREEN" "Configuration validation completed successfully!"
        print_status "$GREEN" "Enhanced PostgREST container is ready for deployment."
        exit 0
    else
        print_status "$RED" "Configuration validation failed with $total_errors error(s)."
        print_status "$RED" "Please fix the issues above before deploying."
        exit 1
    fi
}

# Run main function
main "$@"