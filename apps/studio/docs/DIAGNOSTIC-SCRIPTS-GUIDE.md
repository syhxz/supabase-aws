# Diagnostic Scripts Quick Reference Guide

This guide provides quick commands for diagnosing and verifying the runtime configuration system.

## Quick Start

### Run All Diagnostics

```bash
pnpm config:diagnose
```

This runs all diagnostic checks in sequence and provides a comprehensive report.

### Check Active Configuration

```bash
pnpm config:check:urls
```

Shows the currently active URLs being used by the application.

## Common Commands

### Pre-Deployment Checks

Before deploying to production, run these commands:

```bash
# 1. Validate environment variables
pnpm config:validate-env:verbose

# 2. Verify runtime configuration
pnpm config:verify:verbose

# 3. Test service connectivity
pnpm config:health:verbose
```

### Troubleshooting

When experiencing issues:

```bash
# Check what configuration is active
pnpm config:check:verbose

# Run comprehensive diagnostics
pnpm config:diagnose:verbose

# Test health checks
pnpm config:health:verbose
```

### Quick Status Check

```bash
# Show active URLs
pnpm config:check:urls

# Quick health check
pnpm config:health:quick
```

## Available Commands

### Configuration Verification

| Command | Description |
|---------|-------------|
| `pnpm config:verify` | Verify runtime configuration |
| `pnpm config:verify:verbose` | Verify with detailed output |

### Health Checks

| Command | Description |
|---------|-------------|
| `pnpm config:health` | Run comprehensive health checks |
| `pnpm config:health:verbose` | Health checks with detailed output |
| `pnpm config:health:quick` | Quick health check (config only) |

### Environment Variables

| Command | Description |
|---------|-------------|
| `pnpm config:validate-env` | Validate environment variables |
| `pnpm config:validate-env:verbose` | Validate with detailed output |
| `pnpm config:validate-env:strict` | Fail on warnings |

### Active Configuration

| Command | Description |
|---------|-------------|
| `pnpm config:check` | Show active configuration |
| `pnpm config:check:verbose` | Show with environment variables |
| `pnpm config:check:urls` | Show only URLs |

### Comprehensive Diagnostics

| Command | Description |
|---------|-------------|
| `pnpm config:diagnose` | Run all diagnostic checks |
| `pnpm config:diagnose:verbose` | Run with detailed output |
| `pnpm config:diagnose:continue` | Continue even if checks fail |

## Exit Codes

All scripts use consistent exit codes:

- `0`: Success (all checks passed)
- `1`: Failure (one or more checks failed)

This makes them suitable for CI/CD pipelines.

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Validate Configuration
  run: |
    cd apps/studio
    pnpm config:validate-env --strict
    pnpm config:verify
    pnpm config:health:quick
```

### Docker Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD pnpm config:health:quick || exit 1
```

## Troubleshooting Common Issues

### "Runtime configuration not available"

```bash
# Check environment variables
pnpm config:validate-env:verbose

# Check active configuration
pnpm config:check:verbose
```

### "Health checks failing"

```bash
# Run detailed health checks
pnpm config:health:verbose

# Check if services are running
docker ps
```

### "Invalid environment variables"

```bash
# Validate environment variables
pnpm config:validate-env:verbose

# Check what's currently set
pnpm config:check:verbose
```

## Script Locations

All diagnostic scripts are located in:
```
apps/studio/scripts/
├── verify-runtime-config.ts
├── test-health-checks.ts
├── validate-env-vars.ts
├── check-active-config.ts
├── diagnose-all.ts
└── README.md
```

## Related Documentation

- [Runtime Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md)
- [Required Environment Variables](./REQUIRED-ENV-VARS.md)
- [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)
- [Configuration Examples](./CONFIGURATION-EXAMPLES.md)

## Getting Help

If you encounter issues:

1. Run comprehensive diagnostics: `pnpm config:diagnose:verbose`
2. Check the troubleshooting guide: `apps/studio/docs/RUNTIME-CONFIG-TROUBLESHOOTING.md`
3. Review server logs for detailed error information
4. Check the scripts README: `apps/studio/scripts/README.md`
