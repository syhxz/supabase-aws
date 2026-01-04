#!/bin/bash
# Script to view Studio container logs with filtering options

CONTAINER_NAME="supabase-studio"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -f, --follow          Follow log output (like tail -f)"
    echo "  -n, --lines NUM       Number of lines to show (default: 100)"
    echo "  -e, --endpoint PATH   Filter by endpoint path (e.g., api-keys)"
    echo "  -u, --user ID         Filter by user ID"
    echo "  -p, --project REF     Filter by project ref"
    echo "  -l, --level LEVEL     Filter by log level (error, warn, info)"
    echo "  -a, --all             Show all logs (no filtering)"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -n 50                          # Show last 50 lines"
    echo "  $0 -f                             # Follow logs in real-time"
    echo "  $0 -e api-keys                    # Show only api-keys endpoint logs"
    echo "  $0 -p bfqxh8mjxtrgk7              # Show logs for specific project"
    echo "  $0 -l error                       # Show only error logs"
    echo "  $0 -e api-keys -f                 # Follow api-keys logs"
}

# Default values
LINES=100
FOLLOW=false
FILTER=""
SHOW_ALL=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        -e|--endpoint)
            FILTER="$2"
            shift 2
            ;;
        -u|--user)
            FILTER="$2"
            shift 2
            ;;
        -p|--project)
            FILTER="$2"
            shift 2
            ;;
        -l|--level)
            FILTER="$2"
            shift 2
            ;;
        -a|--all)
            SHOW_ALL=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}Error: Container '${CONTAINER_NAME}' is not running${NC}"
    exit 1
fi

echo -e "${BLUE}=== Studio Container Logs ===${NC}"
echo -e "${YELLOW}Container: ${CONTAINER_NAME}${NC}"
echo ""

# Build docker logs command
CMD="docker logs ${CONTAINER_NAME}"

if [ "$FOLLOW" = true ]; then
    CMD="${CMD} --follow"
else
    CMD="${CMD} --tail ${LINES}"
fi

# Execute command with or without filter
if [ "$SHOW_ALL" = true ]; then
    eval $CMD
elif [ -n "$FILTER" ]; then
    echo -e "${YELLOW}Filter: ${FILTER}${NC}"
    echo ""
    eval $CMD 2>&1 | grep --color=always -i "$FILTER"
else
    # Default: show important logs (errors, warnings, and API access)
    echo -e "${YELLOW}Showing: Errors, Warnings, and API Access logs${NC}"
    echo ""
    eval $CMD 2>&1 | grep --color=always -E "(error|Error|ERROR|warn|Warn|WARN|Secure API access|DATA_ISOLATION|Project API|Project Delete)"
fi
