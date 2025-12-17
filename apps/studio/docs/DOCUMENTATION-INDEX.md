# Supabase Studio Documentation Index

Complete guide to all Studio documentation organized by topic and use case.

## 🚀 Quick Start Guides

### New to Studio?
1. **[Studio README](../README.md)** - Overview and quick start
2. **[User Guide](./USER-GUIDE.md)** - Using Studio features
3. **[Developer Guide](./DEVELOPER-GUIDE.md)** - Development workflow

### Deploying to Production?
1. **[Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)** ⭐ Start here
2. **[Required Environment Variables](./REQUIRED-ENV-VARS.md)** - Quick reference
3. **[Configuration Examples](./CONFIGURATION-EXAMPLES.md)** - Working examples
4. **[Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)** - Pre-deployment verification
5. **[Diagnostic Scripts Guide](./DIAGNOSTIC-SCRIPTS-GUIDE.md)** - Verification commands

### Having Issues?
1. **[Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md)** ⭐ Start here
2. **[Authentication Troubleshooting](./AUTHENTICATION-TROUBLESHOOTING.md)** - Auth issues
3. **[Runtime Configuration Error Handling](./RUNTIME-CONFIG-ERROR-HANDLING.md)** - Error types

## 📚 Documentation by Category

### Runtime Configuration

**Essential Reading:**
- **[Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)** - Complete guide to runtime configuration
- **[Required Environment Variables](./REQUIRED-ENV-VARS.md)** - All environment variables explained
- **[Configuration Examples](./CONFIGURATION-EXAMPLES.md)** - Working examples for all environments
- **[Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md)** - Step-by-step troubleshooting

**Technical Details:**
- [Runtime Configuration Error Handling](./RUNTIME-CONFIG-ERROR-HANDLING.md) - Error types and handling
- [Configuration Logging](./CONFIGURATION-LOGGING.md) - Understanding logs
- [Environment Detection](./ENVIRONMENT-DETECTION.md) - How environments are detected
- [API Client Runtime Config](./API-CLIENT-RUNTIME-CONFIG.md) - Client-side usage

**Deployment:**
- [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md) - Pre-deployment verification
- **[Production Deployment Verification](./PRODUCTION-DEPLOYMENT-VERIFICATION.md)** ⭐ NEW - Comprehensive deployment verification
- [Diagnostic Scripts Guide](./DIAGNOSTIC-SCRIPTS-GUIDE.md) - Verification and troubleshooting commands

### Authentication

**Setup Guides:**
- **[GoTrue Deployment Guide](./GOTRUE-DEPLOYMENT-GUIDE.md)** - Complete GoTrue setup
- [Authentication Migration Guide](./AUTHENTICATION-MIGRATION-GUIDE.md) - Migrating to GoTrue

**Troubleshooting:**
- [Authentication Troubleshooting](./AUTHENTICATION-TROUBLESHOOTING.md) - Common issues

### Multi-Database & Project Management

**Getting Started:**
- [Multi-Database Quick Reference](./multi-database-quick-reference.md) - Quick reference
- [Multi-Database Configuration](./multi-database-configuration.md) - Complete guide

**Advanced:**
- [Template Database Connections](./template-database-connections.md) - Managing templates
- [Project Isolation Quick Reference](./PROJECT-ISOLATION-QUICK-REFERENCE.md) - Project isolation

### Credential Management

**Essential Reading:**
- **[Credential Management Runbook](./CREDENTIAL-MANAGEMENT-RUNBOOK.md)** - Complete operational procedures
- **[Credential Fallback Behavior](./CREDENTIAL-FALLBACK-BEHAVIOR.md)** - Understanding fallback mechanisms
- **[Credential Migration Procedures](./CREDENTIAL-MIGRATION-PROCEDURES.md)** - Migrating legacy projects
- **[Credential Troubleshooting Guide](./CREDENTIAL-TROUBLESHOOTING-GUIDE.md)** - Issue resolution
- **[Credential Monitoring and Alerting](./CREDENTIAL-MONITORING-ALERTING.md)** - Monitoring setup

### Service Isolation

**Implementation:**
- [Service Isolation UI Integration](./SERVICE-ISOLATION-UI-INTEGRATION.md) - UI integration
- [UI Service Isolation Verification](./UI-SERVICE-ISOLATION-VERIFICATION.md) - Verification

### Operations & Maintenance

**Guides:**
- [Operations Guide](./OPERATIONS-GUIDE.md) - Deployment and operations
- [Migration Tools Implementation](./MIGRATION-TOOLS-IMPLEMENTATION.md) - Migration utilities

## 🎯 Documentation by Use Case

### "I want to deploy Studio to production"

**Step-by-step:**
1. Read [Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)
2. Review [Required Environment Variables](./REQUIRED-ENV-VARS.md)
3. Choose your deployment from [Configuration Examples](./CONFIGURATION-EXAMPLES.md):
   - Docker Compose with Public IP
   - Docker Compose with Domain Name
   - Kubernetes
   - AWS ECS
   - Google Cloud Run
   - Azure Container Instances
4. Follow [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)
5. **Run [Production Deployment Verification](./PRODUCTION-DEPLOYMENT-VERIFICATION.md)** ⭐ NEW
6. Verify deployment with troubleshooting guide if needed

**Key Documents:**
- ⭐ [Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)
- ⭐ [Configuration Examples](./CONFIGURATION-EXAMPLES.md)
- ⭐ [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)
- ⭐ [Production Deployment Verification](./PRODUCTION-DEPLOYMENT-VERIFICATION.md) - NEW!

### "Studio is using localhost URLs in production"

**Quick Fix:**
1. Go to [Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md)
2. Find "Issue 1: Frontend Using Localhost URLs in Production"
3. Follow the solution steps
4. Verify with [Required Environment Variables](./REQUIRED-ENV-VARS.md)

**Key Documents:**
- ⭐ [Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md)
- [Required Environment Variables](./REQUIRED-ENV-VARS.md)
- [Runtime Configuration Error Handling](./RUNTIME-CONFIG-ERROR-HANDLING.md)

### "I need to set up authentication"

**Step-by-step:**
1. Read [GoTrue Deployment Guide](./GOTRUE-DEPLOYMENT-GUIDE.md)
2. Choose your deployment method:
   - Docker Compose (local or production)
   - Vercel
   - AWS
   - Kubernetes
3. Follow the setup steps
4. If issues arise, check [Authentication Troubleshooting](./AUTHENTICATION-TROUBLESHOOTING.md)

**Key Documents:**
- ⭐ [GoTrue Deployment Guide](./GOTRUE-DEPLOYMENT-GUIDE.md)
- [Authentication Migration Guide](./AUTHENTICATION-MIGRATION-GUIDE.md)
- [Authentication Troubleshooting](./AUTHENTICATION-TROUBLESHOOTING.md)

### "I want to manage multiple projects"

**Step-by-step:**
1. Start with [Multi-Database Quick Reference](./multi-database-quick-reference.md)
2. Read [Multi-Database Configuration](./multi-database-configuration.md) for details
3. Review [Project Isolation Quick Reference](./PROJECT-ISOLATION-QUICK-REFERENCE.md)
4. Set up template databases with [Template Database Connections](./template-database-connections.md)

**Key Documents:**
- ⭐ [Multi-Database Quick Reference](./multi-database-quick-reference.md)
- [Multi-Database Configuration](./multi-database-configuration.md)
- [Project Isolation Quick Reference](./PROJECT-ISOLATION-QUICK-REFERENCE.md)

### "I'm having credential-related issues"

**Step-by-step:**
1. Check [Credential Troubleshooting Guide](./CREDENTIAL-TROUBLESHOOTING-GUIDE.md) first
2. Understand [Credential Fallback Behavior](./CREDENTIAL-FALLBACK-BEHAVIOR.md)
3. If legacy projects need migration, follow [Credential Migration Procedures](./CREDENTIAL-MIGRATION-PROCEDURES.md)
4. For operational procedures, use [Credential Management Runbook](./CREDENTIAL-MANAGEMENT-RUNBOOK.md)
5. Set up monitoring with [Credential Monitoring and Alerting](./CREDENTIAL-MONITORING-ALERTING.md)

**Key Documents:**
- ⭐ [Credential Troubleshooting Guide](./CREDENTIAL-TROUBLESHOOTING-GUIDE.md)
- [Credential Fallback Behavior](./CREDENTIAL-FALLBACK-BEHAVIOR.md)
- [Credential Migration Procedures](./CREDENTIAL-MIGRATION-PROCEDURES.md)

### "I'm getting configuration errors"

**Troubleshooting:**
1. Check [Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md) first
2. Review [Runtime Configuration Error Handling](./RUNTIME-CONFIG-ERROR-HANDLING.md) for error types
3. Check [Configuration Logging](./CONFIGURATION-LOGGING.md) to understand logs
4. Verify environment variables with [Required Environment Variables](./REQUIRED-ENV-VARS.md)

**Key Documents:**
- ⭐ [Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md)
- [Runtime Configuration Error Handling](./RUNTIME-CONFIG-ERROR-HANDLING.md)
- [Configuration Logging](./CONFIGURATION-LOGGING.md)

### "I'm migrating from build-time to runtime configuration"

**Migration Steps:**
1. Read [Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md) - "Migration from Build-time Configuration" section
2. Review [Configuration Examples](./CONFIGURATION-EXAMPLES.md) for your environment
3. Update your docker-compose.yml following the examples
4. Test with [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)
5. Verify with [Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md) if needed

**Key Documents:**
- ⭐ [Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)
- [Configuration Examples](./CONFIGURATION-EXAMPLES.md)
- [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)

### "I need examples for my deployment platform"

**Platform-Specific Examples:**

All examples are in [Configuration Examples](./CONFIGURATION-EXAMPLES.md):

- **Docker Compose**: Development, Staging, Production
- **Kubernetes**: ConfigMap, Secret, Deployment, Service
- **AWS ECS**: Task definition with Secrets Manager
- **Google Cloud Run**: Service definition with secrets
- **Azure Container Instances**: Container group definition
- **Multi-Environment**: Directory structure and deployment scripts

**Key Documents:**
- ⭐ [Configuration Examples](./CONFIGURATION-EXAMPLES.md)
- [Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)

## 📖 Complete Document List

### Configuration & Deployment
- [Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)
- [Required Environment Variables](./REQUIRED-ENV-VARS.md)
- [Configuration Examples](./CONFIGURATION-EXAMPLES.md)
- [Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md)
- [Runtime Configuration Error Handling](./RUNTIME-CONFIG-ERROR-HANDLING.md)
- [Configuration Logging](./CONFIGURATION-LOGGING.md)
- [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)
- **[Production Deployment Verification](./PRODUCTION-DEPLOYMENT-VERIFICATION.md)** ⭐ NEW
- [Diagnostic Scripts Guide](./DIAGNOSTIC-SCRIPTS-GUIDE.md)
- [Environment Detection](./ENVIRONMENT-DETECTION.md)
- [API Client Runtime Config](./API-CLIENT-RUNTIME-CONFIG.md)

### Authentication
- [GoTrue Deployment Guide](./GOTRUE-DEPLOYMENT-GUIDE.md)
- [Authentication Migration Guide](./AUTHENTICATION-MIGRATION-GUIDE.md)
- [Authentication Troubleshooting](./AUTHENTICATION-TROUBLESHOOTING.md)

### Credential Management
- [Credential Management Runbook](./CREDENTIAL-MANAGEMENT-RUNBOOK.md)
- [Credential Fallback Behavior](./CREDENTIAL-FALLBACK-BEHAVIOR.md)
- [Credential Migration Procedures](./CREDENTIAL-MIGRATION-PROCEDURES.md)
- [Credential Troubleshooting Guide](./CREDENTIAL-TROUBLESHOOTING-GUIDE.md)
- [Credential Monitoring and Alerting](./CREDENTIAL-MONITORING-ALERTING.md)

### Multi-Database & Projects
- [Multi-Database Configuration](./multi-database-configuration.md)
- [Multi-Database Quick Reference](./multi-database-quick-reference.md)
- [Template Database Connections](./template-database-connections.md)
- [Project Isolation Quick Reference](./PROJECT-ISOLATION-QUICK-REFERENCE.md)

### Service Isolation
- [Service Isolation UI Integration](./SERVICE-ISOLATION-UI-INTEGRATION.md)
- [UI Service Isolation Verification](./UI-SERVICE-ISOLATION-VERIFICATION.md)

### General Guides
- [User Guide](./USER-GUIDE.md)
- [Developer Guide](./DEVELOPER-GUIDE.md)
- [Operations Guide](./OPERATIONS-GUIDE.md)
- [Migration Tools Implementation](./MIGRATION-TOOLS-IMPLEMENTATION.md)

## 🔍 Finding What You Need

### By Experience Level

**Beginner:**
- Start with [Studio README](../README.md)
- Read [User Guide](./USER-GUIDE.md)
- Follow [Configuration Examples](./CONFIGURATION-EXAMPLES.md)

**Intermediate:**
- [Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)
- [GoTrue Deployment Guide](./GOTRUE-DEPLOYMENT-GUIDE.md)
- [Multi-Database Configuration](./multi-database-configuration.md)

**Advanced:**
- [Developer Guide](./DEVELOPER-GUIDE.md)
- [Operations Guide](./OPERATIONS-GUIDE.md)
- [Runtime Configuration Error Handling](./RUNTIME-CONFIG-ERROR-HANDLING.md)

### By Role

**Application Developer:**
- [User Guide](./USER-GUIDE.md)
- [Multi-Database Quick Reference](./multi-database-quick-reference.md)
- [Authentication Troubleshooting](./AUTHENTICATION-TROUBLESHOOTING.md)

**DevOps Engineer:**
- [Docker Runtime Configuration Guide](./DOCKER-RUNTIME-CONFIG.md)
- [Configuration Examples](./CONFIGURATION-EXAMPLES.md)
- [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)
- [Operations Guide](./OPERATIONS-GUIDE.md)

**System Administrator:**
- [Operations Guide](./OPERATIONS-GUIDE.md)
- [Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md)
- [GoTrue Deployment Guide](./GOTRUE-DEPLOYMENT-GUIDE.md)

**Studio Contributor:**
- [Developer Guide](./DEVELOPER-GUIDE.md)
- [Service Isolation UI Integration](./SERVICE-ISOLATION-UI-INTEGRATION.md)
- [Migration Tools Implementation](./MIGRATION-TOOLS-IMPLEMENTATION.md)

## 🆘 Emergency Quick Reference

### Production is Down
1. Check [Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md) - "Quick Diagnostics"
2. Run: `curl http://your-server:3000/api/runtime-config`
3. Check: `docker logs supabase-studio | grep "Runtime Config"`
4. Verify: [Required Environment Variables](./REQUIRED-ENV-VARS.md)

### Authentication Not Working
1. Check [Authentication Troubleshooting](./AUTHENTICATION-TROUBLESHOOTING.md)
2. Verify GoTrue is running: `docker ps | grep gotrue`
3. Test health: `curl http://localhost:54321/auth/v1/health`
4. Review [GoTrue Deployment Guide](./GOTRUE-DEPLOYMENT-GUIDE.md)

### Configuration Changes Not Taking Effect
1. See [Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md) - "Issue 5"
2. Recreate container: `docker compose down studio && docker compose up -d studio`
3. Verify: `docker exec supabase-studio env | grep SUPABASE_PUBLIC_URL`

### Health Check Failing
1. See [Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md) - "Issue 3"
2. Test manually: `docker exec supabase-studio curl http://localhost:3000/api/runtime-config`
3. Check logs: `docker logs supabase-studio`

### Database Connection Errors (500 Internal Server Error)
1. Check [Credential Troubleshooting Guide](./CREDENTIAL-TROUBLESHOOTING-GUIDE.md) - "500 Internal Server Error"
2. Verify project credentials: `node scripts/inspect-project-credentials.js <PROJECT_REF>`
3. Enable fallback: `export CREDENTIAL_FALLBACK_ENABLED=true && systemctl restart supabase-studio`
4. Migrate project: `node scripts/migrate-project-credentials.js --project-ref <PROJECT_REF>`

### Credential System Failure
1. Enable emergency mode: `export CREDENTIAL_EMERGENCY_MODE=true && systemctl restart supabase-studio`
2. Check [Credential Management Runbook](./CREDENTIAL-MANAGEMENT-RUNBOOK.md) - "Emergency Procedures"
3. Run health check: `./scripts/credential-health-monitor.sh`
4. Notify stakeholders: `./scripts/send-emergency-notification.sh --type credential-failure`

## 📝 Documentation Standards

All Studio documentation follows these standards:

- **Clear structure**: Table of contents, sections, subsections
- **Practical examples**: Working code snippets and commands
- **Troubleshooting**: Common issues and solutions
- **Cross-references**: Links to related documentation
- **Up-to-date**: Regularly reviewed and updated

## 🤝 Contributing to Documentation

To improve this documentation:

1. **Found an error?** Submit an issue or PR
2. **Missing information?** Suggest additions
3. **Unclear sections?** Request clarification
4. **New features?** Add documentation

See [Contributing Guidelines](../../../CONTRIBUTING.md) for details.

## 📞 Getting Help

If you can't find what you need:

1. **Search the documentation**: Use Ctrl+F or search GitHub
2. **Check troubleshooting guides**: Most issues are covered
3. **Review examples**: Working examples for common scenarios
4. **Ask the community**: Discord, GitHub Discussions
5. **Report issues**: GitHub Issues for bugs

## 🔗 External Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase GitHub](https://github.com/supabase/supabase)
- [Supabase Discord](https://discord.supabase.com)
- [Production Deployment Guide](../../../PRODUCTION-DEPLOYMENT-GUIDE.md)

---

**Last Updated**: 2025-12-03  
**Maintained By**: Supabase Team

**Note**: This index is automatically updated when new documentation is added. If you find outdated information, please submit an issue or PR.
