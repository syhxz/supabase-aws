#!/bin/bash

# Database Mode Toggle Script
# Easily switch between built-in and external database modes

set -e

ENV_FILE="docker/.env"

# Function to show current status
show_status() {
    if [ -f "$ENV_FILE" ] && grep -q "ENABLE_SUPABASE_DB=true" "$ENV_FILE"; then
        echo "📊 Current mode: Built-in PostgreSQL database (ENABLED)"
    else
        echo "🔗 Current mode: External database (built-in PostgreSQL DISABLED)"
    fi
}

# Function to enable built-in database
enable_builtin() {
    if [ -f "$ENV_FILE" ]; then
        if grep -q "ENABLE_SUPABASE_DB=" "$ENV_FILE"; then
            # Replace existing line
            sed -i.bak 's/ENABLE_SUPABASE_DB=.*/ENABLE_SUPABASE_DB=true/' "$ENV_FILE"
        else
            # Add new line
            echo "ENABLE_SUPABASE_DB=true" >> "$ENV_FILE"
        fi
    else
        echo "❌ Error: $ENV_FILE not found"
        exit 1
    fi
    echo "✅ Built-in PostgreSQL database ENABLED"
    echo "💡 Restart services with: ./quick-start.sh"
}

# Function to disable built-in database
disable_builtin() {
    if [ -f "$ENV_FILE" ]; then
        if grep -q "ENABLE_SUPABASE_DB=" "$ENV_FILE"; then
            # Replace existing line
            sed -i.bak 's/ENABLE_SUPABASE_DB=.*/ENABLE_SUPABASE_DB=false/' "$ENV_FILE"
        else
            # Add new line
            echo "ENABLE_SUPABASE_DB=false" >> "$ENV_FILE"
        fi
    else
        echo "❌ Error: $ENV_FILE not found"
        exit 1
    fi
    echo "✅ Built-in PostgreSQL database DISABLED (using external database)"
    echo "💡 Make sure to configure external database connection in $ENV_FILE"
    echo "💡 Restart services with: ./quick-start.sh"
}

# Function to show help
show_help() {
    echo "Database Mode Toggle Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  enable     Enable built-in PostgreSQL database"
    echo "  disable    Disable built-in PostgreSQL database (use external)"
    echo "  status     Show current database mode"
    echo "  help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 enable    # Enable built-in database"
    echo "  $0 disable   # Use external database"
    echo "  $0 status    # Check current mode"
}

# Main script logic
case "${1:-status}" in
    "enable")
        echo "🔄 Enabling built-in PostgreSQL database..."
        enable_builtin
        ;;
    "disable")
        echo "🔄 Disabling built-in PostgreSQL database..."
        disable_builtin
        ;;
    "status")
        show_status
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac