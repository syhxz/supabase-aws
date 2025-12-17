# Project-Level Service Isolation Documentation

## Overview

This directory contains comprehensive documentation for the project-level service isolation feature in Supabase Studio. The feature ensures that each project has completely independent Authentication, Storage, Realtime, Edge Functions, Webhooks, Logs, and Analytics services.

## Documentation Structure

### 📘 [User Guide](./USER-GUIDE.md)
**Audience**: End users, project owners, application developers

**Contents**:
- Understanding service isolation
- Creating projects with isolated services
- Managing project users
- Configuring webhooks
- Deploying functions
- Viewing logs and analytics
- Best practices and troubleshooting

**When to use**: If you're using Studio to build applications and manage projects.

### 👨‍💻 [Developer Guide](./DEVELOPER-GUIDE.md)
**Audience**: Developers working on or extending the Studio codebase

**Contents**:
- Architecture overview
- Service integration guide
- API reference
- Testing guide
- Development workflow
- Extending the system

**When to use**: If you're contributing to the Studio codebase or integrating with the service isolation system.

### 🔧 [Operations Guide](./OPERATIONS-GUIDE.md)
**Audience**: System administrators, DevOps engineers, SREs

**Contents**:
- Deployment guide
- Migration guide
- Monitoring guide
- Troubleshooting guide
- Backup and recovery
- Performance tuning
- Security operations

**When to use**: If you're deploying, maintaining, or troubleshooting the Studio infrastructure.

## Quick Start

### For Users
1. Read the [User Guide](./USER-GUIDE.md) introduction
2. Follow the "Creating Projects with Isolated Services" section
3. Refer to specific sections as needed for your use case

### For Developers
1. Read the [Developer Guide](./DEVELOPER-GUIDE.md) architecture overview
2. Review the service integration guide
3. Check the API reference for implementation details
4. Follow the testing guide when adding new features

### For Operations
1. Review the [Operations Guide](./OPERATIONS-GUIDE.md) deployment section
2. Set up monitoring using the monitoring guide
3. Familiarize yourself with troubleshooting procedures
4. Implement backup and recovery procedures

## Key Concepts

### Two-Tier User System

The system has two completely separate user systems:

1. **Studio Users** (Developers)
   - Log in to Studio interface
   - Create and manage projects
   - Stored in main `postgres` database

2. **Project Users** (Application Users)
   - End users of your applications
   - Authenticate through project-specific Auth API
   - Stored in each project's own database

### Service Isolation

Each project has:
- ✅ Independent authentication system
- ✅ Separate file storage
- ✅ Isolated real-time subscriptions
- ✅ Private Edge Functions
- ✅ Dedicated webhooks
- ✅ Separate logs
- ✅ Independent analytics

### Shared Service Architecture

- **Shared**: Single instances of GoTrue, Storage, Realtime services
- **Isolated**: Each project uses its own database and schemas
- **Routing**: Service Router directs requests to correct project database

## Common Tasks

### Creating a New Project
See: [User Guide - Creating Projects](./USER-GUIDE.md#creating-projects-with-isolated-services)

### Adding a New Service Adapter
See: [Developer Guide - Extending the System](./DEVELOPER-GUIDE.md#adding-a-new-service-adapter)

### Deploying to Production
See: [Operations Guide - Deployment](./OPERATIONS-GUIDE.md#deployment-guide)

### Migrating Existing Projects
See: [Operations Guide - Migration](./OPERATIONS-GUIDE.md#migration-guide)

### Troubleshooting Issues
See: [Operations Guide - Troubleshooting](./OPERATIONS-GUIDE.md#troubleshooting-guide)

## Additional Resources

### Deployment Guides

- **[GoTrue Deployment Guide](./GOTRUE-DEPLOYMENT-GUIDE.md)**: Comprehensive guide for configuring GoTrue authentication service across different deployment environments (Docker, Vercel, AWS, Kubernetes)

### Specification Documents

Located in `.kiro/specs/project-level-service-isolation/`:

- **[requirements.md](../../../.kiro/specs/project-level-service-isolation/requirements.md)**: Formal requirements using EARS syntax
- **[design.md](../../../.kiro/specs/project-level-service-isolation/design.md)**: Detailed technical design with correctness properties
- **[tasks.md](../../../.kiro/specs/project-level-service-isolation/tasks.md)**: Implementation task list

### Implementation Documentation

Located in `apps/studio/lib/`:

- **service-router/README.md**: Service Router implementation details
- **auth-service/README.md**: Auth Service Adapter details
- **storage-service/README.md**: Storage Service Adapter details
- **realtime-service/README.md**: Realtime Service Adapter details
- **functions-service/README.md**: Functions Service Adapter details
- **webhook-service/README.md**: Webhook Service Adapter details
- **logs-service/README.md**: Logs Service Adapter details
- **analytics-service/README.md**: Analytics Service Adapter details
- **advisors-service/README.md**: Advisors Service Adapter details

### Verification Tools

Located in project root:

- **verify-service-isolation.sh**: Verify service isolation is working
- **test-auth-isolation.sh**: Test authentication isolation
- **test-storage-isolation.sh**: Test storage isolation
- **test-user-isolation.sh**: Test user isolation

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Studio UI Layer                      │
│  - Project Context Management                            │
│  - Service-specific UI Components                        │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   Service Router                         │
│  - Connection Pool Management                            │
│  - Project Configuration Storage                         │
│  - Access Validation                                     │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼──────┐ ┌───▼────────┐ ┌─▼──────────┐
│ Auth Service │ │  Storage   │ │  Realtime  │
│   Adapter    │ │  Adapter   │ │  Adapter   │
└───────┬──────┘ └───┬────────┘ └─┬──────────┘
        │            │              │
┌───────▼────────────▼──────────────▼───────────┐
│         Project-Specific Databases             │
│  - project_a: auth, storage, public schemas    │
│  - project_b: auth, storage, public schemas    │
└────────────────────────────────────────────────┘
```

## Support

### Getting Help

1. **Check the documentation**: Most questions are answered in the guides
2. **Review the troubleshooting section**: Common issues and solutions
3. **Check the logs**: Error messages often point to the issue
4. **Consult the design document**: For understanding system behavior

### Reporting Issues

When reporting issues, include:
- Which guide you were following
- What you were trying to do
- What happened vs. what you expected
- Relevant log excerpts
- System information (OS, versions, etc.)

### Contributing

To contribute to the documentation:
1. Follow the existing structure and style
2. Include practical examples
3. Test all commands and code snippets
4. Update the table of contents
5. Submit a pull request

## Version History

- **v1.0** (2025-01-27): Initial documentation release
  - User Guide
  - Developer Guide
  - Operations Guide

## License

This documentation is part of the Supabase project and follows the same license.

---

**Last Updated**: 2025-01-27  
**Maintained By**: Supabase Team
