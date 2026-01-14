# Enhanced REST API Docker Deployment

This directory contains the complete Docker deployment setup for the Enhanced REST API with advanced PostgREST features.

## Quick Start

1. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

2. **Deploy Services**:
   ```bash
   ./scripts/deploy-enhanced-rest.sh
   ```

3. **Access Services**:
   - Studio: http://localhost:3000
   - REST API: http://localhost:8000/rest/v1/
   - Health Check: http://localhost:8000/health
   - Metrics: http://localhost:9090/metrics

## Directory Structure

```
docker/
├── docker-compose.yml              # Main compose configuration
├── .env                           # Environment variables
├── enhanced-rest-container/       # Enhanced PostgREST container
│   ├── Dockerfile                 # Container build configuration
│   ├── config/                    # Configuration templates
│   └── scripts/                   # Container scripts
├── integration-tests/             # Integration test suite
│   ├── enhanced-rest-api-integration.test.js
│   └── package.json
├── load-testing/                  # Load testing suite
│   ├── load-test-suite.js
│   └── package.json
├── scripts/                       # Deployment scripts
│   └── deploy-enhanced-rest.sh
├── k8s/                          # Kubernetes configurations
├── volumes/                       # Persistent data volumes
├── ENHANCED_REST_DEPLOYMENT.md    # Comprehensive deployment guide
├── ENHANCED_REST_API_REFERENCE.md # Complete API reference
└── README.md                      # This file
```

## Enhanced Features

The Enhanced REST API includes:

- ✅ **RPC Functions**: Call PostgreSQL functions via HTTP
- ✅ **Database Views**: Access views with full query capabilities
- ✅ **Advanced JSON Operations**: PostgreSQL JSON operators
- ✅ **Full-Text Search**: Text search capabilities
- ✅ **Aggregate Queries**: COUNT, SUM, AVG, MIN, MAX functions
- ✅ **Array Operations**: PostgreSQL array operators
- ✅ **Bulk Operations**: Optimized batch processing
- ✅ **Nested Resources**: Related data in single requests
- ✅ **Transactions**: Atomic operations
- ✅ **Content Negotiation**: Multiple response formats
- ✅ **Performance Monitoring**: Real-time metrics
- ✅ **Response Caching**: Intelligent caching

## Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Enhanced Features
ENHANCED_RPC_ENABLED=true
ENHANCED_JSON_OPS_ENABLED=true
ENHANCED_FTS_ENABLED=true
ENHANCED_AGGREGATES_ENABLED=true
ENHANCED_BULK_OPS_ENABLED=true
ENHANCED_TRANSACTIONS_ENABLED=true
ENHANCED_ARRAY_OPS_ENABLED=true

# Performance
ENHANCED_RESPONSE_CACHE_ENABLED=true
ENHANCED_RESPONSE_CACHE_TTL=300
ENHANCED_METRICS_ENABLED=true
ENHANCED_METRICS_PORT=9090

# Limits
ENHANCED_MAX_QUERY_COMPLEXITY=1000
ENHANCED_MAX_NESTED_DEPTH=5
ENHANCED_MAX_BULK_SIZE=1000
```

### Studio Integration

Configure enhanced features through Studio:
1. Open Studio: http://localhost:3000
2. Go to Settings → API → Enhanced REST API
3. Enable/disable features and adjust performance settings

## Testing

### Integration Tests

Run comprehensive integration tests:

```bash
cd integration-tests
npm install
npm test
```

### Load Testing

Perform load testing:

```bash
cd load-testing
npm install

# Light load test
npm run test:light

# Heavy load test
npm run test:heavy

# Stress test
npm run test:stress
```

## Monitoring

### Health Checks

```bash
# Basic health check
curl http://localhost:8000/health

# Enhanced features status
curl -H "apikey: your-anon-key" \
     http://localhost:8000/rest/v1/enhanced/status
```

### Metrics

```bash
# Prometheus metrics
curl http://localhost:9090/metrics

# Container metrics
docker stats supabase-rest
```

### Studio Dashboard

Access real-time monitoring:
1. Open Studio: http://localhost:3000
2. Go to Settings → API → Monitoring
3. View performance metrics and system health

## Deployment Options

### Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f rest
```

### Production

```bash
# Deploy with validation
./scripts/deploy-enhanced-rest.sh

# Deploy without tests (faster)
./scripts/deploy-enhanced-rest.sh --skip-tests --skip-performance
```

### Kubernetes

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/
```

## Troubleshooting

### Common Issues

1. **Container won't start**:
   - Check Docker daemon: `docker info`
   - Verify environment variables in `.env`
   - Check port conflicts (8000, 3000, 9090)

2. **Database connection issues**:
   - Verify `PGRST_DB_URI` format
   - Test connectivity: `pg_isready -d "your-db-uri"`
   - Check database permissions

3. **Performance issues**:
   - Monitor metrics: `curl http://localhost:9090/metrics`
   - Adjust connection pool: `PGRST_DB_POOL`
   - Enable caching: `ENHANCED_RESPONSE_CACHE_ENABLED=true`

### Debug Mode

Enable debug logging:

```bash
# Set in .env
PGRST_LOG_LEVEL=debug
ENHANCED_REQUEST_LOGGING=true
ENHANCED_ERROR_LOGGING=true

# Restart container
docker-compose restart rest
```

### Log Analysis

```bash
# View container logs
docker logs supabase-rest

# Filter for errors
docker logs supabase-rest 2>&1 | grep ERROR

# Monitor performance
docker logs supabase-rest 2>&1 | grep PERF
```

## Documentation

- **[Deployment Guide](ENHANCED_REST_DEPLOYMENT.md)**: Comprehensive deployment instructions
- **[API Reference](ENHANCED_REST_API_REFERENCE.md)**: Complete API documentation
- **[Configuration Guide](enhanced-rest-container/README.md)**: Container configuration details

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review container logs: `docker logs supabase-rest`
3. Run health checks: `curl http://localhost:8000/health`
4. Validate configuration: `./enhanced-rest-container/scripts/validate-config.sh`

## Contributing

When contributing to the Enhanced REST API:

1. Test changes with integration tests
2. Update documentation as needed
3. Ensure backward compatibility
4. Add appropriate monitoring and logging

## License

This Enhanced REST API implementation is part of the Supabase project and follows the same licensing terms.