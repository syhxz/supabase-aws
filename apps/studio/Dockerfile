# To be run in the root of the turbo monorepo
# NOTE: It's highly recommended to use the new builder, Buildkit. https://docs.docker.com/build/buildkit/
## USAGE:
# Build:        docker build . -f apps/studio/Dockerfile --target production -t studio:latest
# Run:          docker run -p 3000:3000 supabase/studio
# Deploy:       docker push supabase/studio:latest
# Clean build:
#    docker builder prune
#    docker build . -f apps/studio/Dockerfile --target production -t studio:latest --no-cache

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Fixes issues with Sentry CLI and SSL certificates during build
# TODO: Git is added because it's needed to build libpg, remove it once they publish a binary on the S3 bucket
RUN apt-get update -qq && \
  apt-get install -y --no-install-recommends \
  git \
  python3 \ 
  ca-certificates \
  build-essential \
  curl && \ 
  rm -rf /var/lib/apt/lists/* && \
  update-ca-certificates

RUN npm install -g pnpm@10.16.1

WORKDIR /app

# Prune unneeded dependencies with turbo (from apps/ for example)
FROM base AS turbo
COPY . .

RUN pnpm dlx turbo@2.3.3 prune studio --docker

# Install dev dependencies (only if needed)
FROM base AS deps
COPY --from=turbo /app/out/json ./
COPY --from=turbo /app/out/pnpm-lock.yaml ./

# No need to clean cache because production uses standalone build
RUN pnpm install --frozen-lockfile

# dev contains dependencies and source code not compiled
FROM deps AS dev
COPY --from=turbo /app/out/full ./
ENTRYPOINT ["docker-entrypoint.sh"]
EXPOSE 8082
CMD ["pnpm", "dev:studio"]

# Compile Next.js
FROM dev AS builder

# Build-time environment variables for proper environment detection
# Requirements 1.1, 1.3: Ensure ENVIRONMENT and NODE_ENV are properly passed to Docker builds
# These variables are critical for environment detection during the build process

# Core environment detection variables (HIGHEST PRIORITY)
ARG ENVIRONMENT=development
ARG NODE_ENV=production

# Platform configuration variables
ARG NEXT_PUBLIC_REQUIRE_LOGIN=true
ARG NEXT_PUBLIC_IS_PLATFORM=false
ARG NEXT_PUBLIC_ENVIRONMENT=development

# Supabase configuration variables for authentication
# Requirements 1.3, 1.4: Add ARG declarations for Supabase environment variables
ARG NEXT_PUBLIC_GOTRUE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Set environment variables from build arguments
# ENVIRONMENT takes highest priority over NODE_ENV for environment detection
ENV ENVIRONMENT=${ENVIRONMENT}
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_PUBLIC_REQUIRE_LOGIN=${NEXT_PUBLIC_REQUIRE_LOGIN}
ENV NEXT_PUBLIC_IS_PLATFORM=${NEXT_PUBLIC_IS_PLATFORM}
ENV NEXT_PUBLIC_ENVIRONMENT=${NEXT_PUBLIC_ENVIRONMENT}

# Requirements 1.3, 1.4: Set Supabase environment variables from build arguments
# These variables are embedded in the client-side code during build
ENV NEXT_PUBLIC_GOTRUE_URL=${NEXT_PUBLIC_GOTRUE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

ENV NODE_OPTIONS="--max-old-space-size=4096"

# Test and log build-time environment variables for debugging
# Requirements 1.1, 1.3: Test environment variable availability during Docker builds
COPY apps/studio/test-docker-env.sh /tmp/test-docker-env.sh
RUN chmod +x /tmp/test-docker-env.sh && \
    /tmp/test-docker-env.sh && \
    rm /tmp/test-docker-env.sh

RUN pnpm --filter studio exec next build

# Copy only compiled code and dependencies
FROM base AS production
COPY --from=builder /app/apps/studio/public ./apps/studio/public
COPY --from=builder /app/apps/studio/.next/standalone ./
COPY --from=builder /app/apps/studio/.next/static ./apps/studio/.next/static

# Runtime environment variables (set these when running the container)
# These variables are read by the /api/runtime-config endpoint at runtime
# and allow the same Docker image to work in multiple environments
#
# USAGE: Set these variables when running the container:
#   docker run -e SUPABASE_URL="your-url" -e SUPABASE_ANON_KEY="your-key" ...
#   or use docker-compose.yml with environment section
#
# See .env.example for a complete list of all required environment variables
#
# Core runtime configuration variables:
#   SUPABASE_PUBLIC_URL - Public Supabase URL for client connections
#   API_EXTERNAL_URL - External API URL for the application
#   NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase anonymous key (public)
#   NEXT_PUBLIC_GOTRUE_URL - GoTrue authentication service URL
#
# Additional runtime configuration for multi-environment support:
#   SUPABASE_URL - Supabase project URL
#   SUPABASE_ANON_KEY - Supabase anonymous key (SENSITIVE)
#   SUPABASE_SERVICE_KEY - Supabase service role key (SENSITIVE)
#   POSTGRES_HOST - PostgreSQL database host
#   POSTGRES_PORT - PostgreSQL database port
#   POSTGRES_DB - PostgreSQL database name
#   POSTGRES_PASSWORD - PostgreSQL database password (SENSITIVE)
#   STUDIO_PG_META_URL - PG Meta service URL
#   PG_META_CRYPTO_KEY - PG Meta encryption key (SENSITIVE)
#   TEMPLATE_DATABASE_NAME - Name of the template database
#   DEFAULT_ORGANIZATION_NAME - Default organization name
#   DEFAULT_PROJECT_NAME - Default project name
#   ENVIRONMENT - Runtime environment (development/staging/production)
#
# Authentication and security (SENSITIVE):
#   AUTH_JWT_SECRET - JWT secret for authentication
#   JWT_SECRET - Alternative JWT secret
#
# Logging and analytics:
#   LOGFLARE_URL - Logflare logging service URL
#   LOGFLARE_PUBLIC_ACCESS_TOKEN - Logflare public access token
#   LOGFLARE_PRIVATE_ACCESS_TOKEN - Logflare private access token (SENSITIVE)

# Platform configuration (non-sensitive defaults)
ENV NEXT_PUBLIC_IS_PLATFORM="false"
ENV NEXT_PUBLIC_REQUIRE_LOGIN="true"

EXPOSE 3000

# Copy the docker entrypoint script
COPY apps/studio/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]

# Enhanced health check using runtime-config endpoint
# This validates that the application is running and can resolve configuration
# Uses curl for better error handling and timeout control
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "apps/studio/server.js"]
