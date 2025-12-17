# User Management Guide

This guide explains how to create and manage users for Supabase Studio authentication in self-hosted mode.

## Prerequisites

- Docker services running (PostgreSQL, GoTrue, Kong)
- `docker/.env` file configured with proper credentials
- GoTrue service accessible at `http://127.0.0.1:54321/auth/v1`

## Creating Users

### Method 1: Using the Admin User Script (Recommended)

The easiest way to create users is using the provided script:

```bash
./scripts/create-admin-user.sh <email> <password>
```

**Example:**
```bash
./scripts/create-admin-user.sh admin@example.com SecurePassword123
```

**Features:**
- ✅ Automatic email format validation
- ✅ Password length validation (minimum 6 characters)
- ✅ Loads configuration from `docker/.env`
- ✅ Clear success/error messages
- ✅ Displays user ID and confirmation status
- ✅ Handles duplicate user errors gracefully

**Output Example:**
```
INFO: Loading configuration from docker/.env
INFO: Creating user with email: admin@example.com
INFO: Using GoTrue URL: http://127.0.0.1:54321/auth/v1
SUCCESS: User created successfully!
INFO: User ID: 12345678-1234-1234-1234-123456789abc
INFO: Email: admin@example.com
SUCCESS: Email auto-confirmed
```

### Method 2: Using GoTrue API Directly

You can also create users by calling the GoTrue API directly:

```bash
# Set your API key
export SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Create user
curl -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure-password"
  }'
```

**Response (Success):**
```json
{
  "id": "12345678-1234-1234-1234-123456789abc",
  "email": "user@example.com",
  "email_confirmed_at": "2024-01-01T00:00:00Z",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Response (Error - User Exists):**
```json
{
  "msg": "User already registered",
  "code": 422
}
```

### Method 3: Using SQL (Advanced)

For direct database access, you can insert users via SQL:

```bash
# Connect to PostgreSQL
psql -h localhost -p 54322 -U postgres -d postgres
```

```sql
-- Create a new user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmed_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@example.com',
  crypt('your-password', gen_salt('bf')),
  now(),
  now(),
  now(),
  now()
);
```

**Important Notes:**
- Requires `pgcrypto` extension (usually enabled by default)
- Password is encrypted using bcrypt
- Setting `email_confirmed_at` and `confirmed_at` bypasses email verification
- This method bypasses GoTrue's validation logic

## Email Confirmation

### Auto-Confirm Emails

To skip email verification (useful for development), configure in `docker/.env`:

```properties
ENABLE_EMAIL_AUTOCONFIRM=true
```

Then restart GoTrue:

```bash
cd docker
docker-compose restart gotrue
```

### Manual Email Confirmation

If auto-confirm is disabled, users will receive a confirmation email. You can manually confirm users via SQL:

```sql
UPDATE auth.users 
SET email_confirmed_at = now(), 
    confirmed_at = now() 
WHERE email = 'user@example.com';
```

## Listing Users

### Using SQL

```sql
-- List all users
SELECT id, email, created_at, email_confirmed_at, last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;
```

### Using GoTrue Admin API

```bash
# Requires SERVICE_ROLE_KEY
export SUPABASE_SERVICE_KEY="your-service-role-key"

curl 'http://127.0.0.1:54321/auth/v1/admin/users' \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}"
```

## Deleting Users

### Using SQL

```sql
-- Soft delete (recommended)
UPDATE auth.users 
SET deleted_at = now() 
WHERE email = 'user@example.com';

-- Hard delete (permanent)
DELETE FROM auth.users 
WHERE email = 'user@example.com';
```

### Using GoTrue Admin API

```bash
export SUPABASE_SERVICE_KEY="your-service-role-key"
export USER_ID="user-uuid-here"

curl -X DELETE "http://127.0.0.1:54321/auth/v1/admin/users/${USER_ID}" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}"
```

## Password Reset

### Generate Password Reset Token

```bash
curl -X POST 'http://127.0.0.1:54321/auth/v1/recover' \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

### Reset Password via SQL

```sql
-- Update password directly
UPDATE auth.users 
SET encrypted_password = crypt('new-password', gen_salt('bf')),
    updated_at = now()
WHERE email = 'user@example.com';
```

## Troubleshooting

### Error: "Could not connect to GoTrue service"

**Solution:**
```bash
# Check if GoTrue is running
docker-compose ps gotrue

# Start GoTrue if not running
cd docker
docker-compose up -d gotrue

# Check GoTrue logs
docker-compose logs gotrue
```

### Error: "User already registered"

**Solution:**
The user already exists. Either:
1. Use a different email address
2. Delete the existing user first
3. Reset the existing user's password

### Error: "Invalid email format"

**Solution:**
Ensure the email follows the format: `user@domain.com`

### Error: "Password must be at least 6 characters long"

**Solution:**
Use a password with at least 6 characters. For production, use strong passwords with:
- At least 12 characters
- Mix of uppercase and lowercase
- Numbers and special characters

### Error: "ANON_KEY not found in docker/.env"

**Solution:**
```bash
# Check if docker/.env exists
ls -la docker/.env

# Verify ANON_KEY is set
grep ANON_KEY docker/.env
```

## Security Best Practices

### Development Environment

1. **Use Auto-Confirm**: Enable `ENABLE_EMAIL_AUTOCONFIRM=true` for faster testing
2. **Simple Passwords**: Use simple passwords like `password123` for test accounts
3. **Test Users**: Create multiple test users with different roles

### Production Environment

1. **Strong Passwords**: Enforce minimum 12 characters with complexity requirements
2. **Email Verification**: Disable auto-confirm (`ENABLE_EMAIL_AUTOCONFIRM=false`)
3. **HTTPS Only**: Use HTTPS for all authentication endpoints
4. **Rate Limiting**: Enable rate limiting in Kong to prevent brute force attacks
5. **JWT Secret**: Use a strong, unique JWT secret (at least 32 characters)
6. **Regular Audits**: Regularly review user accounts and remove inactive users

### Password Policy Configuration

Configure in `docker/.env`:

```properties
# Minimum password length
PASSWORD_MIN_LENGTH=12

# Require special characters
PASSWORD_REQUIRED_CHARACTERS=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*
```

## Common Workflows

### Initial Setup

1. Start Docker services:
   ```bash
   cd docker
   docker-compose up -d
   ```

2. Create first admin user:
   ```bash
   ./scripts/create-admin-user.sh admin@example.com SecurePassword123
   ```

3. Test login:
   - Visit `http://localhost:8082`
   - Enter credentials
   - Verify successful login

### Adding New Team Members

1. Create user account:
   ```bash
   ./scripts/create-admin-user.sh newuser@example.com TempPassword123
   ```

2. Share credentials securely (use password manager)

3. User should change password on first login

### Bulk User Creation

Create a script for multiple users:

```bash
#!/bin/bash
# bulk-create-users.sh

USERS=(
  "user1@example.com:password1"
  "user2@example.com:password2"
  "user3@example.com:password3"
)

for user in "${USERS[@]}"; do
  email="${user%%:*}"
  password="${user##*:}"
  ./scripts/create-admin-user.sh "$email" "$password"
done
```

## API Reference

### GoTrue Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/v1/signup` | POST | Create new user |
| `/auth/v1/token` | POST | Sign in user |
| `/auth/v1/logout` | POST | Sign out user |
| `/auth/v1/recover` | POST | Request password reset |
| `/auth/v1/user` | GET | Get current user |
| `/auth/v1/user` | PUT | Update user |
| `/auth/v1/admin/users` | GET | List all users (admin) |
| `/auth/v1/admin/users/:id` | DELETE | Delete user (admin) |

### Required Headers

**Public Endpoints** (signup, signin):
```
apikey: <ANON_KEY>
Content-Type: application/json
```

**Admin Endpoints**:
```
apikey: <SERVICE_ROLE_KEY>
Authorization: Bearer <SERVICE_ROLE_KEY>
Content-Type: application/json
```

## Additional Resources

- [GoTrue Documentation](https://github.com/supabase/gotrue)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [PostgreSQL pgcrypto Extension](https://www.postgresql.org/docs/current/pgcrypto.html)

## Support

If you encounter issues:

1. Check GoTrue service logs: `docker-compose logs gotrue`
2. Verify environment variables in `docker/.env`
3. Test GoTrue health: `curl http://127.0.0.1:54321/auth/v1/health`
4. Review this documentation for common solutions
