#!/bin/bash
# Enhanced REST Container Management Script
# Requirements: 13.1, 13.2, 13.3, 13.4, 13.5

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$DOCKER_DIR/docker-compose.yml"
PROD_COMPOSE_FILE="$DOCKER_DIR/docker-compose.prod.yml"
ENV_FILE="$DOCKER_DIR/.env"

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
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] ${message}${NC}"
}

# Function to check if container is running
is_container_running() {
    local container_name="$1"
    docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"
}

# Function to check container health
check_container_health() {
    local container_name="$1"
    local health_status
    
    if ! is_container_running "$container_name"; then
        echo "stopped"
        return 1
    fi
    
    health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "unknown")
    echo "$health_status"
    
    case "$health_status" in
        "healthy")
            return 0
            ;;
        "unhealthy")
            return 1
            ;;
        "starting")
            return 2
            ;;
        *)
            return 3
            ;;
    esac
}

# Function to wait for container to be healthy
wait_for_healthy() {
    local container_name="$1"
    local timeout="${2:-300}"  # 5 minutes default
    local interval=10
    local elapsed=0
    
    print_status "$BLUE" "Waiting for $container_name to become healthy..."
    
    while [ $elapsed -lt $timeout ]; do
        local health_status
        health_status=$(check_container_health "$container_name")
        local health_code=$?
        
        case $health_code in
            0)
                print_status "$GREEN" "$container_name is healthy"
                return 0
                ;;
            1)
                print_status "$RED" "$container_name is unhealthy"
                return 1
                ;;
            2)
                print_status "$YELLOW" "$container_name is starting... (${elapsed}s/${timeout}s)"
                ;;
            3)
                print_status "$YELLOW" "$container_name health status unknown (${elapsed}s/${timeout}s)"
                ;;
        esac
        
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    print_status "$RED" "Timeout waiting for $container_name to become healthy"
    return 1
}

# Function to build the enhanced REST container
build_container() {
    print_status "$BLUE" "Building enhanced REST container..."
    
    cd "$DOCKER_DIR"
    
    if [ "${1:-}" = "--production" ]; then
        docker compose -f "$COMPOSE_FILE" -f "$PROD_COMPOSE_FILE" build rest
    else
        docker compose build rest
    fi
    
    if [ $? -eq 0 ]; then
        print_status "$GREEN" "Enhanced REST container built successfully"
    else
        print_status "$RED" "Failed to build enhanced REST container"
        return 1
    fi
}

# Function to start the enhanced REST container
start_container() {
    local production_mode="${1:-false}"
    
    print_status "$BLUE" "Starting enhanced REST container..."
    
    cd "$DOCKER_DIR"
    
    # Create necessary directories
    mkdir -p volumes/rest-cache volumes/rest-logs
    
    if [ "$production_mode" = "true" ]; then
        docker compose -f "$COMPOSE_FILE" -f "$PROD_COMPOSE_FILE" up -d rest
    else
        docker compose up -d rest
    fi
    
    if [ $? -eq 0 ]; then
        print_status "$GREEN" "Enhanced REST container started"
        
        # Wait for container to be healthy
        if wait_for_healthy "supabase-rest" 300; then
            print_status "$GREEN" "Enhanced REST container is ready"
            show_container_info
        else
            print_status "$RED" "Enhanced REST container failed to become healthy"
            show_container_logs
            return 1
        fi
    else
        print_status "$RED" "Failed to start enhanced REST container"
        return 1
    fi
}

# Function to stop the enhanced REST container
stop_container() {
    print_status "$BLUE" "Stopping enhanced REST container..."
    
    cd "$DOCKER_DIR"
    
    # Graceful shutdown with timeout
    docker compose stop -t 30 rest
    
    if [ $? -eq 0 ]; then
        print_status "$GREEN" "Enhanced REST container stopped gracefully"
    else
        print_status "$YELLOW" "Graceful stop failed, forcing stop..."
        docker compose kill rest
        print_status "$GREEN" "Enhanced REST container force stopped"
    fi
}

# Function to restart the enhanced REST container
restart_container() {
    local production_mode="${1:-false}"
    
    print_status "$BLUE" "Restarting enhanced REST container..."
    
    stop_container
    sleep 5
    start_container "$production_mode"
}

# Function to show container information
show_container_info() {
    local container_name="supabase-rest"
    
    if ! is_container_running "$container_name"; then
        print_status "$RED" "Container $container_name is not running"
        return 1
    fi
    
    print_status "$BLUE" "Enhanced REST Container Information:"
    echo ""
    
    # Container status
    local health_status
    health_status=$(check_container_health "$container_name")
    echo "Status: $health_status"
    
    # Container ports
    echo "Ports:"
    docker port "$container_name" 2>/dev/null || echo "  No exposed ports"
    
    # Container resource usage
    echo ""
    echo "Resource Usage:"
    docker stats "$container_name" --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    
    # Enhanced features status
    echo ""
    echo "Enhanced Features:"
    docker exec "$container_name" printenv | grep "^ENHANCED_" | sort || echo "  Unable to retrieve feature status"
    
    # Metrics endpoint
    local metrics_port
    metrics_port=$(docker port "$container_name" 9090 2>/dev/null | cut -d: -f2 || echo "N/A")
    if [ "$metrics_port" != "N/A" ]; then
        echo ""
        echo "Metrics endpoint: http://localhost:$metrics_port/metrics"
    fi
}

# Function to show container logs
show_container_logs() {
    local lines="${1:-50}"
    local container_name="supabase-rest"
    
    print_status "$BLUE" "Enhanced REST Container Logs (last $lines lines):"
    echo ""
    
    if is_container_running "$container_name"; then
        docker logs --tail "$lines" "$container_name"
    else
        print_status "$RED" "Container $container_name is not running"
        return 1
    fi
}

# Function to run health check
run_health_check() {
    local container_name="supabase-rest"
    
    print_status "$BLUE" "Running comprehensive health check..."
    
    if ! is_container_running "$container_name"; then
        print_status "$RED" "Container $container_name is not running"
        return 1
    fi
    
    # Run comprehensive health check
    docker exec "$container_name" /usr/local/bin/health-check.sh
}

# Function to show metrics
show_metrics() {
    local container_name="supabase-rest"
    
    if ! is_container_running "$container_name"; then
        print_status "$RED" "Container $container_name is not running"
        return 1
    fi
    
    # Get metrics port
    local metrics_port
    metrics_port=$(docker port "$container_name" 9090 2>/dev/null | cut -d: -f2)
    
    if [ -n "$metrics_port" ]; then
        print_status "$BLUE" "Enhanced REST Container Metrics:"
        echo ""
        curl -s "http://localhost:$metrics_port/metrics" || print_status "$RED" "Failed to retrieve metrics"
    else
        print_status "$RED" "Metrics port not exposed"
        return 1
    fi
}

# Function to clean up container resources
cleanup() {
    print_status "$BLUE" "Cleaning up enhanced REST container resources..."
    
    cd "$DOCKER_DIR"
    
    # Stop and remove container
    docker compose down rest
    
    # Remove unused images
    docker image prune -f --filter "label=com.docker.compose.service=rest"
    
    # Clean up volumes (optional)
    if [ "${1:-}" = "--volumes" ]; then
        print_status "$YELLOW" "Removing volumes..."
        docker volume rm docker_rest-cache docker_rest-logs 2>/dev/null || true
        rm -rf volumes/rest-cache volumes/rest-logs
    fi
    
    print_status "$GREEN" "Cleanup completed"
}

# Function to show usage
show_usage() {
    cat << EOF
Enhanced REST Container Management Script

Usage: $0 <command> [options]

Commands:
    build [--production]     Build the enhanced REST container
    start [--production]     Start the enhanced REST container
    stop                     Stop the enhanced REST container
    restart [--production]   Restart the enhanced REST container
    status                   Show container status and information
    logs [lines]            Show container logs (default: 50 lines)
    health                  Run comprehensive health check
    metrics                 Show container metrics
    cleanup [--volumes]     Clean up container resources
    help                    Show this help message

Options:
    --production            Use production configuration
    --volumes              Include volumes in cleanup (use with cleanup command)

Examples:
    $0 build                    # Build container for development
    $0 build --production       # Build container for production
    $0 start                    # Start container in development mode
    $0 start --production       # Start container in production mode
    $0 logs 100                 # Show last 100 log lines
    $0 cleanup --volumes        # Clean up including volumes

EOF
}

# Main function
main() {
    local command="${1:-help}"
    
    case "$command" in
        "build")
            if [ "${2:-}" = "--production" ]; then
                build_container --production
            else
                build_container
            fi
            ;;
        "start")
            if [ "${2:-}" = "--production" ]; then
                start_container true
            else
                start_container false
            fi
            ;;
        "stop")
            stop_container
            ;;
        "restart")
            if [ "${2:-}" = "--production" ]; then
                restart_container true
            else
                restart_container false
            fi
            ;;
        "status")
            show_container_info
            ;;
        "logs")
            show_container_logs "${2:-50}"
            ;;
        "health")
            run_health_check
            ;;
        "metrics")
            show_metrics
            ;;
        "cleanup")
            if [ "${2:-}" = "--volumes" ]; then
                cleanup --volumes
            else
                cleanup
            fi
            ;;
        "help"|"--help"|"-h")
            show_usage
            ;;
        *)
            print_status "$RED" "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"