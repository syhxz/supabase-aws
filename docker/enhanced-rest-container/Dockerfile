# Enhanced Supabase REST Container
# Based on PostgREST with additional features for advanced REST API functionality
# Requirements: 13.1, 13.2, 13.3, 13.4, 13.5

FROM postgrest/postgrest:v13.0.7 as base

# Install additional dependencies for enhanced features
USER root
RUN apt-get update && apt-get install -y \
    curl \
    jq \
    netcat-openbsd \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Create enhanced configuration directory
RUN mkdir -p /etc/postgrest/enhanced \
    && mkdir -p /var/log/postgrest \
    && mkdir -p /tmp/postgrest-cache

# Copy enhanced configuration files
COPY enhanced-rest-container/config/ /etc/postgrest/enhanced/
COPY enhanced-rest-container/scripts/ /usr/local/bin/

# Make scripts executable
RUN chmod +x /usr/local/bin/*.sh

# Create postgrest user and set permissions
RUN useradd -r -s /bin/false postgrest || true \
    && chown -R postgrest:postgrest /etc/postgrest \
    && chown -R postgrest:postgrest /var/log/postgrest \
    && chown -R postgrest:postgrest /tmp/postgrest-cache

# Switch back to postgrest user
USER postgrest

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /usr/local/bin/health-check.sh --simple

# Expose PostgREST port and monitoring port
EXPOSE 3000 9090

# Use enhanced startup script
ENTRYPOINT ["/usr/local/bin/enhanced-startup.sh"]
CMD ["/bin/postgrest"]