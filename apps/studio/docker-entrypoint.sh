#!/usr/bin/env bash
set -Eeuo pipefail

# usage: file_env VAR [DEFAULT]
#    ie: file_env 'XYZ_DB_PASSWORD' 'example'
# (will allow for "$XYZ_DB_PASSWORD_FILE" to fill in the value of
#  "$XYZ_DB_PASSWORD" from a file, especially for Docker's secrets feature)
file_env() {
	local var="$1"
	local fileVar="${var}_FILE"
	local def="${2:-}"
	if [ "${!var:-}" ] && [ "${!fileVar:-}" ]; then
		echo >&2 "error: both $var and $fileVar are set (but are exclusive)"
		exit 1
	fi
	local val="$def"
	if [ "${!var:-}" ]; then
		val="${!var}"
	elif [ "${!fileVar:-}" ]; then
		val="$(< "${!fileVar}")"
	fi
	export "$var"="$val"
	unset "$fileVar"
}

# Load secrets either from environment variables or files
# Database credentials
file_env 'POSTGRES_PASSWORD'

# Supabase API keys
file_env 'SUPABASE_ANON_KEY'
file_env 'SUPABASE_SERVICE_KEY'
file_env 'NEXT_PUBLIC_SUPABASE_ANON_KEY'

# JWT secrets
file_env 'JWT_SECRET'
file_env 'AUTH_JWT_SECRET'

# Encryption keys
file_env 'PG_META_CRYPTO_KEY'

# Logflare tokens
file_env 'LOGFLARE_PUBLIC_ACCESS_TOKEN'
file_env 'LOGFLARE_PRIVATE_ACCESS_TOKEN'

# Log runtime configuration for debugging
# Requirements 1.3, 1.5, 2.1, 2.2: Enhanced logging for environment detection debugging
echo "=== RUNTIME ENVIRONMENT CONFIGURATION ==="
echo "Container startup time: $(date)"
echo ""
echo "Core Environment Detection Variables:"
echo "  ENVIRONMENT: ${ENVIRONMENT:-not set} (HIGHEST PRIORITY)"
echo "  NODE_ENV: ${NODE_ENV:-not set} (fallback)"
echo "  Platform Mode: ${NEXT_PUBLIC_IS_PLATFORM:-false}"
echo "  Require Login: ${NEXT_PUBLIC_REQUIRE_LOGIN:-true}"
echo ""
echo "Service URLs:"
echo "  Supabase Public URL: ${SUPABASE_PUBLIC_URL:-not set}"
echo "  API External URL: ${API_EXTERNAL_URL:-not set}"
echo "  GoTrue URL: ${NEXT_PUBLIC_GOTRUE_URL:-not set}"
echo ""
echo "Database Configuration:"
echo "  Postgres Host: ${POSTGRES_HOST:-not set}"
echo "  Postgres Port: ${POSTGRES_PORT:-not set}"
echo "  Template Database: ${TEMPLATE_DATABASE_NAME:-not set}"
echo ""
echo "Container Environment:"
echo "  Container Name: ${HOSTNAME:-not set}"
echo "  Docker Container: ${DOCKER_CONTAINER:-not detected}"
echo ""
echo "Environment Detection Priority Chain:"
echo "  1. ENVIRONMENT variable (${ENVIRONMENT:-not set})"
echo "  2. NODE_ENV variable (${NODE_ENV:-not set})"
echo "  3. URL pattern analysis (based on configured URLs)"
echo "  4. Platform flag (${NEXT_PUBLIC_IS_PLATFORM:-false})"
echo "  5. Default to production (safety fallback)"
echo ""
echo "Expected Environment Detection Result:"
if [ -n "${ENVIRONMENT}" ]; then
  echo "  → ${ENVIRONMENT} (via ENVIRONMENT variable - highest priority)"
elif [ "${NODE_ENV}" = "development" ]; then
  echo "  → development (via NODE_ENV=development)"
elif [ "${NEXT_PUBLIC_IS_PLATFORM}" = "true" ]; then
  echo "  → production (via platform flag)"
else
  echo "  → production (default fallback)"
fi
echo "============================================="

exec "${@}"
