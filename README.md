# Supabase AWS

A customized version of Supabase optimized for AWS deployment.

## Version 1.1.0 - Latest Release

### Major Updates

- **Edge Functions Support**: Local and S3 storage backends for serverless functions
- **Data API**: Direct database access with enhanced query capabilities
- **REST API Refactor**: Improved architecture for better performance and scalability
- **Enhanced Security**: Advanced user isolation and access control
- **Configuration Management**: Streamlined setup and deployment process

## Quick Start

```bash
# Start with external database (default)
./quick-start.sh

# Start with built-in PostgreSQL database
./quick-start.sh --with-db
```

## Features

- Edge Functions with flexible storage options (local/S3)
- Direct Data API for database operations
- Enhanced user isolation and security
- AWS-optimized configuration
- Docker-based deployment
- Multi-environment support
- Performance monitoring and optimization

## Documentation

For detailed setup and configuration instructions, please refer to the original Supabase documentation at [supabase.com/docs](https://supabase.com/docs).

## License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.
