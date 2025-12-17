# Studio Diagnostic Scripts

This directory contains diagnostic and verification scripts for the Supabase Studio runtime configuration system.

## Available Scripts

### 1. Verify Runtime Configuration

Verifies that the runtime configuration system is working correctly.

```bash
# Basic verification
pnpm tsx apps/studio/scripts/verify-runtime-config.ts

# Verbose output with detailed information
pnpm tsx apps/studio/scripts/verify-runtime-config.ts --verbose

# JSON output for programmatic use
pnpm tsx apps/studio/scripts/verify-runtime-config.ts --json
```

**What it checks:**
- Runtime configuration API accessibility
- Configuration structure validity
- URL format validation
- Environment-specific configuration correctness

**Exit codes:**
- `0`: Verification passed
- `1`: Verification failed

---

### 2. Test Health Checks

Tests the configuration health check system and reports service reachability.

```bash
# Comprehensive health check
pnpm tsx apps/studio/scripts/test-health-checks.ts

# Verbose output with detailed analysis
pnpm tsx apps/studio/scripts/test-health-checks.ts --verbose

# Quick health check (runtime config only)
pnpm tsx apps/studio/scripts/test-health-checks.ts --quick

# JSON output
pnpm tsx apps/studio/scripts/test-health-checks.ts --json
```

**What it checks:**
- Runtime configuration availability
- GoTrue service reachability
- API gateway reachability
- Response times and health status

**Exit codes:**
- `0`: All health checks passed
- `1`: One or more health checks failed

---

### 3. Validate Environment Variables

Validates that all required environment variables are properly set and formatted.

```bash
# Basic validation
pnpm tsx apps/studio/scripts/validate-env-vars.ts

# Verbose output showing all variables
pnpm tsx apps/studio/scripts/validate-env-vars.ts --verbose

# Strict mode (fail on warnings)
pnpm tsx apps/studio/scripts/validate-env-vars.ts --strict

# JSON output
pnpm tsx apps/studio/scripts/validate-env-vars.ts --json
```

**What it checks:**
- Environment variable presence
- URL format validation
- Production-specific requirements
- Configuration completeness

**Exit codes:**
- `0`: Validation passed
- `1`: Validation failed (or warnings in strict mode)

---

### 4. Check Active Configuration

Displays the currently active runtime configuration and shows how it was derived.

```bash
# Show active configuration
pnpm tsx apps/studio/scripts/check-active-config.ts

# Verbose output with environment variables
pnpm tsx apps/studio/scripts/check-active-config.ts --verbose

# Show only URLs
pnpm tsx apps/studio/scripts/check-active-config.ts --urls-only

# JSON output
pnpm tsx apps/studio/scripts/check-active-config.ts --json
```

**What it shows:**
- Active URLs (GoTrue, Supabase, API)
- Configuration source (explicit, derived, default)
- URL derivation details
- Environment variables used
- Configuration analysis

**Exit codes:**
- `0`: Configuration retrieved successfully
- `1`: Failed to retrieve configuration

---

### 5. Verify Deployment (NEW)

**Comprehensive deployment verification** that checks all correctness properties and deployment checklist items before production deployment.

```bash
# Basic deployment verification
pnpm tsx apps/studio/scripts/verify-deployment.ts

# Verify remote deployment
pnpm tsx apps/studio/scripts/verify-deployment.ts --host 192.0.2.1 --port 3000

# Verbose output with detailed property checks
pnpm tsx apps/studio/scripts/verify-deployment.ts --verbose

# Custom host and port
pnpm tsx apps/studio/scripts/verify-deployment.ts --host your-server-ip --port 8082
```

**What it verifies:**
- Property 1: Runtime configuration loading
- Property 2: Production URL usage (no localhost in production)
- Property 3: Runtime config API correctness
- Property 10: Configuration source logging
- Deployment checklist items:
  - Runtime config API accessible
  - Environment variables configured
  - No localhost URLs in production
  - All URLs properly formatted
  - Anon key configured

**Exit codes:**
- `0`: All verifications passed - Ready for production!
- `1`: One or more verifications failed

**Use this script before every production deployment!**

---

## Common Use Cases

### Pre-Deployment Verification

Before deploying to production, run all verification scripts:

```bash
# Validate environment variables
pnpm tsx apps/studio/scripts/validate-env-vars.ts --verbose

# Verify runtime configuration
pnpm tsx apps/studio/scripts/verify-runtime-config.ts --verbose

# Test health checks
pnpm tsx apps/studio/scripts/test-health-checks.ts --verbose
```

### Troubleshooting Configuration Issues

When experiencing configuration problems:

```bash
# Check what configuration is active
pnpm tsx apps/studio/scripts/check-active-config.ts --verbose

# Verify the configuration is correct
pnpm tsx apps/studio/scripts/verify-runtime-config.ts --verbose

# Test service connectivity
pnpm tsx apps/studio/scripts/test-health-checks.ts --verbose
```

### CI/CD Integration

Use JSON output for automated checks:

```bash
# In CI/CD pipeline
pnpm tsx apps/studio/scripts/validate-env-vars.ts --json --strict
pnpm tsx apps/studio/scripts/verify-runtime-config.ts --json
pnpm tsx apps/studio/scripts/test-health-checks.ts --json --quick
```

### Quick Status Check

Get a quick overview of the current configuration:

```bash
# Show active URLs
pnpm tsx apps/studio/scripts/check-active-config.ts --urls-only

# Quick health check
pnpm tsx apps/studio/scripts/test-health-checks.ts --quick
```

---

## Script Options Reference

### Common Options

All scripts support these common options:

- `--verbose`: Show detailed output with additional information
- `--json`: Output results as JSON for programmatic use

### Script-Specific Options

**verify-runtime-config.ts:**
- No additional options

**test-health-checks.ts:**
- `--quick`: Perform quick health check (runtime config only)

**validate-env-vars.ts:**
- `--strict`: Fail on warnings (not just errors)

**check-active-config.ts:**
- `--urls-only`: Show only the resolved URLs

---

## Exit Codes

All scripts follow a consistent exit code convention:

- `0`: Success (all checks passed)
- `1`: Failure (one or more checks failed)

This makes them suitable for use in CI/CD pipelines and automated testing.

---

## Troubleshooting

### Script Fails to Run

If you encounter errors running the scripts:

1. Ensure you're in the correct directory:
   ```bash
   cd apps/studio
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Check that TypeScript is available:
   ```bash
   pnpm tsx --version
   ```

### Configuration Not Found

If scripts report that configuration cannot be found:

1. Ensure the runtime configuration API is running
2. Check that environment variables are set
3. Verify the API endpoint is accessible

### Health Checks Fail

If health checks consistently fail:

1. Verify services are running (GoTrue, Kong)
2. Check network connectivity
3. Review firewall rules
4. Check service logs for errors

---

## Related Documentation

- [Runtime Configuration Troubleshooting](../docs/RUNTIME-CONFIG-TROUBLESHOOTING.md)
- [Required Environment Variables](../docs/REQUIRED-ENV-VARS.md)
- [Docker Deployment Checklist](../docs/DOCKER-DEPLOYMENT-CHECKLIST.md)
- [Configuration Examples](../docs/CONFIGURATION-EXAMPLES.md)

---

## Development

### Adding New Scripts

When adding new diagnostic scripts:

1. Follow the existing naming convention: `verb-noun.ts`
2. Include a comprehensive header comment
3. Support `--verbose` and `--json` options
4. Use consistent exit codes (0 for success, 1 for failure)
5. Provide helpful error messages
6. Update this README

### Testing Scripts

Test scripts in different environments:

```bash
# Development environment
NODE_ENV=development pnpm tsx apps/studio/scripts/verify-runtime-config.ts

# Production environment
NODE_ENV=production pnpm tsx apps/studio/scripts/verify-runtime-config.ts
```

---

## Support

For issues or questions about these scripts:

1. Check the troubleshooting section above
2. Review the related documentation
3. Check server logs for detailed error information
4. Consult the main Studio README at `apps/studio/README.md`
