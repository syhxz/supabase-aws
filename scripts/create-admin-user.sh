#!/bin/bash

# Script to create an admin user via GoTrue API
# Usage: ./scripts/create-admin-user.sh <email> <password>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
}

print_success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
}

print_info() {
    echo -e "${YELLOW}INFO: $1${NC}"
}

# Check if required arguments are provided
if [ $# -lt 2 ]; then
    print_error "Missing required arguments"
    echo "Usage: $0 <email> <password>"
    echo ""
    echo "Example:"
    echo "  $0 admin@example.com SecurePassword123"
    exit 1
fi

EMAIL="$1"
PASSWORD="$2"

# Validate email format (basic validation)
if ! echo "$EMAIL" | grep -qE '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'; then
    print_error "Invalid email format: $EMAIL"
    exit 1
fi

# Validate password length (minimum 6 characters as per GoTrue default)
if [ ${#PASSWORD} -lt 6 ]; then
    print_error "Password must be at least 6 characters long"
    exit 1
fi

# Load environment variables from docker/.env if it exists
if [ -f "docker/.env" ]; then
    print_info "Loading configuration from docker/.env"
    export $(grep -v '^#' docker/.env | grep -v '^$' | xargs)
else
    print_error "docker/.env file not found"
    exit 1
fi

# Set GoTrue URL (default to localhost if not set)
GOTRUE_URL="${GOTRUE_URL:-http://127.0.0.1:54321/auth/v1}"
ANON_KEY="${ANON_KEY}"

if [ -z "$ANON_KEY" ]; then
    print_error "ANON_KEY not found in docker/.env"
    exit 1
fi

print_info "Creating user with email: $EMAIL"
print_info "Using GoTrue URL: $GOTRUE_URL"

# Create the user via GoTrue signup endpoint
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${GOTRUE_URL}/signup" \
    -H "apikey: ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"${EMAIL}\",
        \"password\": \"${PASSWORD}\"
    }")

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extract response body (all but last line)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check if request was successful
if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    print_success "User created successfully!"
    
    # Parse and display user ID if jq is available
    if command -v jq &> /dev/null; then
        USER_ID=$(echo "$BODY" | jq -r '.id // .user.id // "unknown"')
        USER_EMAIL=$(echo "$BODY" | jq -r '.email // .user.email // "unknown"')
        print_info "User ID: $USER_ID"
        print_info "Email: $USER_EMAIL"
        
        # Check if email confirmation is required
        EMAIL_CONFIRMED=$(echo "$BODY" | jq -r '.email_confirmed_at // .user.email_confirmed_at // "null"')
        if [ "$EMAIL_CONFIRMED" = "null" ]; then
            print_info "Email confirmation required. Check your email or set ENABLE_EMAIL_AUTOCONFIRM=true in docker/.env"
        else
            print_success "Email auto-confirmed"
        fi
    else
        print_info "Install 'jq' for formatted output"
        echo "$BODY"
    fi
    
    exit 0
elif [ "$HTTP_CODE" -eq 422 ]; then
    print_error "User creation failed - user may already exist or validation error"
    if command -v jq &> /dev/null; then
        ERROR_MSG=$(echo "$BODY" | jq -r '.msg // .message // "Unknown error"')
        print_error "Details: $ERROR_MSG"
    else
        echo "$BODY"
    fi
    exit 1
elif [ "$HTTP_CODE" -eq 000 ]; then
    print_error "Could not connect to GoTrue service at $GOTRUE_URL"
    print_info "Make sure GoTrue service is running: docker-compose up -d gotrue"
    exit 1
else
    print_error "User creation failed with HTTP status: $HTTP_CODE"
    echo "$BODY"
    exit 1
fi
