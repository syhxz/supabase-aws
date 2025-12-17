# Project-Level Service Isolation - User Guide

## Introduction

Welcome to the Supabase Studio with project-level service isolation! This guide will help you understand and use the isolated services feature, which ensures that each of your projects has completely independent Authentication, Storage, Realtime, Edge Functions, Webhooks, Logs, and Analytics services.

## Table of Contents

1. [Understanding Service Isolation](#understanding-service-isolation)
2. [Creating Projects with Isolated Services](#creating-projects-with-isolated-services)
3. [Managing Project Users](#managing-project-users)
4. [Configuring Webhooks](#configuring-webhooks)
5. [Deploying Functions](#deploying-functions)
6. [Viewing Logs and Analytics](#viewing-logs-and-analytics)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Understanding Service Isolation

### What is Service Isolation?

Service isolation means that each project you create has its own independent set of services. This ensures:

- **Data Privacy**: Users in Project A cannot access data in Project B
- **Security**: Authentication credentials are project-specific
- **Independence**: Changes to one project don't affect others
- **Clarity**: Each project has its own logs, analytics, and configuration

### Two Types of Users

It's important to understand the difference between two types of users in the system:

#### Studio Users (Developers)
- **Who**: You, the developer using Studio
- **Purpose**: Log in to Studio, create and manage projects
- **Example**: `developer@company.com`
- **Storage**: Stored in the main Studio database

#### Project Users (Application Users)
- **Who**: End users of your application
- **Purpose**: Use your application's features
- **Example**: `customer@myapp.com`
- **Storage**: Stored in each project's own database

**Key Point**: These are completely separate! Your Studio login credentials are different from your project's user credentials.

## Creating Projects with Isolated Services

### Step 1: Create a New Project

1. Log in to Studio at `http://localhost:8082`
2. Navigate to your organization
3. Click **"New Project"**
4. Fill in the project details:
   - **Name**: Your project name (e.g., "My App")
   - **Database Password**: A secure password for the project database
   - **Region**: Select your preferred region

5. Click **"Create Project"**

### Step 2: Automatic Service Initialization

When you create a project, Studio automatically:

✅ Creates an independent database for your project
✅ Initializes the authentication schema (auth.users, auth.sessions, etc.)
✅ Initializes the storage schema (storage.buckets, storage.objects, etc.)
✅ Sets up webhooks tables
✅ Sets up analytics tables
✅ Creates project directories for functions, storage, and logs
✅ Configures logical replication for Realtime

This process takes about 30-60 seconds. You'll see a progress indicator.

### Step 3: Verify Project Creation

Once created, you can verify your project has all services:

1. Go to **Authentication** → You should see an empty users list (ready for your app users)
2. Go to **Storage** → You should see no buckets yet (ready to create)
3. Go to **Database** → Your project database is ready
4. Go to **Edge Functions** → Ready to deploy functions
5. Go to **Logs** → Ready to capture logs

## Managing Project Users

### Understanding Project Users

Project users are the end users of your application. They are completely separate from Studio users.

### Adding Users via API

Your application can register users using the project's Auth API:

```javascript
// In your application code
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'http://localhost:8000', // Your project URL
  'your-project-anon-key'
)

// Sign up a new user
const { data, error } = await supabase.auth.signUp({
  email: 'customer@myapp.com',
  password: 'secure-password'
})
```

### Viewing Project Users in Studio

1. Select your project from the project dropdown
2. Navigate to **Authentication** → **Users**
3. You'll see all users registered in **this project only**

**Important**: Users from other projects will NOT appear here. Each project's users are completely isolated.

### Managing User Permissions

1. Click on a user to view details
2. You can:
   - View user metadata
   - Reset passwords
   - Delete users
   - View user sessions

### User Isolation Guarantee

- Users in Project A **cannot** authenticate to Project B
- User data is stored in separate databases
- No cross-project user access is possible

## Configuring Webhooks

### What are Webhooks?

Webhooks allow your project to send HTTP requests to external URLs when specific events occur (e.g., new user signup, database changes).

### Creating a Webhook

1. Select your project
2. Navigate to **Database** → **Webhooks**
3. Click **"Create Webhook"**
4. Configure the webhook:

```yaml
Name: User Signup Notification
Events: 
  - INSERT on auth.users
URL: https://your-app.com/api/webhooks/user-signup
HTTP Method: POST
Headers:
  Authorization: Bearer your-secret-token
```

5. Click **"Create"**

### Webhook Isolation

- Webhooks configured in Project A only trigger for events in Project A
- Events in Project B will NOT trigger Project A's webhooks
- Each project has its own webhook configuration

### Testing Webhooks

1. Go to **Database** → **Webhooks**
2. Click on your webhook
3. Click **"Send Test Event"**
4. Check the webhook logs to verify delivery

### Webhook Logs

View webhook execution history:

1. Navigate to **Database** → **Webhooks**
2. Click on a webhook
3. View the **Logs** tab to see:
   - Timestamp
   - Event type
   - Response status
   - Response body
   - Any errors

### Webhook Retry Logic

Failed webhooks are automatically retried:
- 1st retry: After 1 minute
- 2nd retry: After 5 minutes
- 3rd retry: After 15 minutes
- 4th retry: After 1 hour

## Deploying Functions

### What are Edge Functions?

Edge Functions are serverless functions that run on the edge, close to your users. Each project has its own isolated functions.

### Creating a Function

1. Create a function locally:

```typescript
// functions/hello-world/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { name } = await req.json()
  
  return new Response(
    JSON.stringify({ message: `Hello ${name}!` }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

2. Deploy using the Supabase CLI:

```bash
supabase functions deploy hello-world --project-ref your-project-ref
```

### Function Isolation

- Functions deployed to Project A are stored in Project A's directory
- Functions in Project A **cannot** be invoked from Project B
- Each project has its own function environment variables

### Setting Environment Variables

1. Navigate to **Edge Functions** → **Settings**
2. Click **"Add Variable"**
3. Enter:
   - **Name**: `API_KEY`
   - **Value**: `your-secret-key`
4. Click **"Save"**

**Important**: Environment variables are project-specific. Variables set in Project A are NOT accessible to Project B's functions.

### Invoking Functions

From your application:

```javascript
const { data, error } = await supabase.functions.invoke('hello-world', {
  body: { name: 'World' }
})
```

From Studio:
1. Navigate to **Edge Functions**
2. Click on a function
3. Click **"Invoke"**
4. Enter test payload
5. View response

### Function Database Access

Functions automatically connect to their project's database:

```typescript
import { createClient } from '@supabase/supabase-js'

serve(async (req) => {
  // This automatically connects to the current project's database
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )
  
  const { data } = await supabase.from('users').select('*')
  
  return new Response(JSON.stringify(data))
})
```

## Viewing Logs and Analytics

### Accessing Logs

1. Select your project
2. Navigate to **Logs**
3. Choose log type:
   - **API Logs**: All API requests
   - **Error Logs**: Errors and exceptions
   - **Function Logs**: Edge function execution logs

### Log Isolation

- Logs in Project A only show events from Project A
- You cannot see logs from other projects
- Each project has separate log files

### Filtering Logs

Use the filter options:
- **Time Range**: Last hour, day, week, or custom
- **Log Level**: Info, Warning, Error
- **Search**: Search log messages
- **Service**: Filter by service (API, Functions, etc.)

### Exporting Logs

1. Navigate to **Logs**
2. Apply desired filters
3. Click **"Export"**
4. Choose format: JSON or CSV
5. Download the file

**Note**: Exports only include logs from the current project.

### Viewing Analytics

1. Select your project
2. Navigate to **Analytics**
3. View metrics:
   - **API Calls**: Number of API requests over time
   - **Active Users**: Number of active users
   - **Database Size**: Current database size
   - **Storage Usage**: File storage usage
   - **Function Invocations**: Edge function calls

### Analytics Isolation

- Analytics data is project-specific
- Metrics from Project A do not include data from Project B
- Each project has independent usage tracking

### Custom Reports

Generate custom reports:
1. Navigate to **Analytics** → **Reports**
2. Click **"Create Report"**
3. Select metrics and time range
4. Click **"Generate"**
5. Download or share the report

## Best Practices

### 1. Project Organization

- **One project per application**: Create separate projects for different applications
- **Use descriptive names**: Name projects clearly (e.g., "Production App", "Staging App")
- **Separate environments**: Create different projects for development, staging, and production

### 2. User Management

- **Never share Studio credentials**: Studio login is for developers only
- **Use project-specific auth**: Let your application users authenticate through the project's Auth API
- **Implement proper RLS**: Use Row Level Security policies in your database

### 3. Security

- **Rotate secrets regularly**: Update API keys and webhook secrets periodically
- **Use environment variables**: Store sensitive data in function environment variables
- **Monitor logs**: Regularly check logs for suspicious activity
- **Set up webhooks for alerts**: Configure webhooks to notify you of important events

### 4. Performance

- **Monitor database size**: Keep an eye on your database growth
- **Optimize queries**: Use the Advisors feature to identify slow queries
- **Use indexes**: Add indexes for frequently queried columns
- **Clean up old data**: Archive or delete old logs and analytics data

### 5. Backup and Recovery

- **Regular backups**: Enable automatic backups for your project
- **Test restores**: Periodically test backup restoration
- **Document configuration**: Keep notes on webhook URLs, function environment variables, etc.

## Troubleshooting

### Issue: Cannot see users in Authentication

**Symptom**: The Users list is empty even though users have signed up.

**Solution**:
1. Verify you're viewing the correct project (check project dropdown)
2. Ensure users are signing up through the project's Auth API, not Studio login
3. Check API logs for authentication errors

### Issue: Webhook not triggering

**Symptom**: Webhook doesn't fire when expected event occurs.

**Solution**:
1. Check webhook is enabled (Database → Webhooks)
2. Verify the event type matches (e.g., INSERT vs UPDATE)
3. Check webhook logs for delivery errors
4. Test the webhook URL manually with curl
5. Verify the target URL is accessible from your Studio instance

### Issue: Function cannot access database

**Symptom**: Edge function returns database connection errors.

**Solution**:
1. Verify environment variables are set (SUPABASE_URL, SUPABASE_ANON_KEY)
2. Check function logs for specific error messages
3. Ensure the function is deployed to the correct project
4. Verify database is running and accessible

### Issue: Logs not appearing

**Symptom**: Expected log entries are missing.

**Solution**:
1. Verify you're viewing the correct project
2. Check the time range filter
3. Verify log level filter includes the expected level
4. Check disk space on the server

### Issue: Cross-project access error

**Symptom**: Error message about accessing another project's resources.

**Solution**:
- This is expected behavior! Service isolation prevents cross-project access
- Ensure you're using the correct project_ref in API calls
- Switch to the correct project in Studio before performing operations

### Getting Help

If you encounter issues not covered here:

1. Check the **Developer Guide** for technical details
2. Check the **Operations Guide** for deployment and infrastructure issues
3. Review the logs for error messages
4. Contact your system administrator

## Summary

Project-level service isolation provides:

✅ Complete data isolation between projects
✅ Independent authentication systems per project
✅ Separate storage, functions, webhooks, logs, and analytics
✅ Enhanced security and privacy
✅ Clear project boundaries

Remember:
- **Studio users** (developers) manage projects
- **Project users** (app users) use your applications
- Each project is completely independent
- Services are isolated by default

Happy building! 🚀
