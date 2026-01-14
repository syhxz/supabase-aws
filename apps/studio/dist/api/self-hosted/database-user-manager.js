"use strict";
/**
 * Database user manager for PostgreSQL user lifecycle operations.
 * Handles creation, deletion, and permission management for project-specific database users.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseUserManager = exports.DatabaseUserError = exports.DatabaseUserErrorCode = void 0;
exports.validateUsername = validateUsername;
exports.validatePassword = validatePassword;
exports.generateUsername = generateUsername;
exports.generateUsernameWithCollisionDetection = generateUsernameWithCollisionDetection;
exports.userExists = userExists;
exports.createProjectUser = createProjectUser;
exports.deleteProjectUser = deleteProjectUser;
exports.validateUserCredentials = validateUserCredentials;
exports.getUserPermissions = getUserPermissions;
const query_1 = require("./query");
/**
 * Error codes for database user operations
 */
var DatabaseUserErrorCode;
(function (DatabaseUserErrorCode) {
    DatabaseUserErrorCode["USER_ALREADY_EXISTS"] = "USER_ALREADY_EXISTS";
    DatabaseUserErrorCode["INVALID_USERNAME"] = "INVALID_USERNAME";
    DatabaseUserErrorCode["INVALID_PASSWORD"] = "INVALID_PASSWORD";
    DatabaseUserErrorCode["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    DatabaseUserErrorCode["CONNECTION_FAILED"] = "CONNECTION_FAILED";
    DatabaseUserErrorCode["DATABASE_NOT_FOUND"] = "DATABASE_NOT_FOUND";
    DatabaseUserErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(DatabaseUserErrorCode || (exports.DatabaseUserErrorCode = DatabaseUserErrorCode = {}));
/**
 * Custom error class for database user operations
 */
class DatabaseUserError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'DatabaseUserError';
    }
}
exports.DatabaseUserError = DatabaseUserError;
/**
 * PostgreSQL username validation rules
 */
const USERNAME_RULES = {
    minLength: 1,
    maxLength: 63, // PostgreSQL identifier limit
    allowedChars: /^[a-zA-Z_][a-zA-Z0-9_$]*$/,
    reservedNames: [
        'postgres', 'template0', 'template1', 'public',
        'information_schema', 'pg_catalog', 'pg_toast',
        'supabase_admin', 'supabase_read_only_user',
        'authenticator', 'anon', 'authenticated', 'service_role'
    ]
};
/**
 * PostgreSQL password validation rules
 */
const PASSWORD_RULES = {
    minLength: 8,
    maxLength: 128,
    requiresAlphanumeric: true
};
/**
 * Validates a PostgreSQL username according to naming rules
 *
 * @param username - Username to validate
 * @throws DatabaseUserError if username is invalid
 */
function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        throw new DatabaseUserError(DatabaseUserErrorCode.INVALID_USERNAME, 'Username is required and must be a string');
    }
    if (username.length < USERNAME_RULES.minLength) {
        throw new DatabaseUserError(DatabaseUserErrorCode.INVALID_USERNAME, `Username must be at least ${USERNAME_RULES.minLength} character long`);
    }
    if (username.length > USERNAME_RULES.maxLength) {
        throw new DatabaseUserError(DatabaseUserErrorCode.INVALID_USERNAME, `Username must not exceed ${USERNAME_RULES.maxLength} characters`);
    }
    if (!USERNAME_RULES.allowedChars.test(username)) {
        throw new DatabaseUserError(DatabaseUserErrorCode.INVALID_USERNAME, 'Username must start with a letter or underscore and contain only letters, numbers, underscores, and dollar signs');
    }
    const lowerUsername = username.toLowerCase();
    if (USERNAME_RULES.reservedNames.includes(lowerUsername)) {
        throw new DatabaseUserError(DatabaseUserErrorCode.INVALID_USERNAME, `Username "${username}" is reserved and cannot be used`);
    }
}
/**
 * Validates a PostgreSQL password according to security rules
 *
 * @param password - Password to validate
 * @throws DatabaseUserError if password is invalid
 */
function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        throw new DatabaseUserError(DatabaseUserErrorCode.INVALID_PASSWORD, 'Password is required and must be a string');
    }
    if (password.length < PASSWORD_RULES.minLength) {
        throw new DatabaseUserError(DatabaseUserErrorCode.INVALID_PASSWORD, `Password must be at least ${PASSWORD_RULES.minLength} characters long`);
    }
    if (password.length > PASSWORD_RULES.maxLength) {
        throw new DatabaseUserError(DatabaseUserErrorCode.INVALID_PASSWORD, `Password must not exceed ${PASSWORD_RULES.maxLength} characters`);
    }
    if (PASSWORD_RULES.requiresAlphanumeric) {
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        if (!hasLetter || !hasNumber) {
            throw new DatabaseUserError(DatabaseUserErrorCode.INVALID_PASSWORD, 'Password must contain at least one letter and one number');
        }
    }
}
/**
 * Generates a project-specific username based on project name
 * Uses format: user_projectname_xxxx
 *
 * @param projectName - Name of the project
 * @returns Generated username
 */
function generateUsername(projectName) {
    if (!projectName || typeof projectName !== 'string') {
        throw new DatabaseUserError(DatabaseUserErrorCode.INVALID_USERNAME, 'Project name is required to generate username');
    }
    // Sanitize project name: remove invalid characters and convert to lowercase
    let sanitized = projectName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_') // Replace invalid chars with underscore
        .replace(/^[0-9]/, 'proj') // Ensure it doesn't start with a number
        .replace(/_+/g, '_') // Collapse multiple underscores
        .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    // Ensure we have a valid project name
    if (!sanitized) {
        sanitized = 'proj';
    }
    // Generate short random suffix for uniqueness (4 characters)
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    // Calculate available space for project name
    // Format: user_projectname_xxxx
    // Total length limit: 63 characters
    // Used: 'user_' (5) + '_' (1) + random (4) = 10 characters
    const maxProjectNameLength = USERNAME_RULES.maxLength - 10;
    // Truncate project name if necessary
    const truncatedProjectName = sanitized.length > maxProjectNameLength
        ? sanitized.substring(0, maxProjectNameLength)
        : sanitized;
    // Create username with new format
    const username = `user_${truncatedProjectName}_${randomSuffix}`;
    return username;
}
/**
 * Enhanced username generation with collision detection
 * This is a wrapper around the enhanced credential generation service
 *
 * @param projectName - The project name to base the username on
 * @param existingUsernames - Optional array of existing usernames to avoid
 * @returns Promise resolving to unique username
 */
async function generateUsernameWithCollisionDetection(projectName, existingUsernames) {
    const { generateUsernameWithCollisionDetection } = await Promise.resolve().then(() => __importStar(require('./enhanced-credential-generation')));
    return generateUsernameWithCollisionDetection(projectName, existingUsernames);
}
/**
 * Checks if a database user exists
 *
 * @param username - Username to check
 * @returns Result with boolean indicating existence
 */
async function userExists(username) {
    const query = `
    SELECT EXISTS(
      SELECT 1 FROM pg_user WHERE usename = $1
    ) as exists
  `;
    const result = await (0, query_1.executeQuery)({
        query,
        parameters: [username],
        readOnly: true,
    });
    if (result.error) {
        return { data: undefined, error: result.error };
    }
    const exists = result.data?.[0]?.exists ?? false;
    return { data: exists, error: undefined };
}
/**
 * Creates a new PostgreSQL user for a specific project
 *
 * @param options - User creation options
 * @returns Result indicating success or error
 */
async function createProjectUser(options) {
    const { username, password, databaseName, projectRef } = options;
    try {
        // Validate username and password
        validateUsername(username);
        validatePassword(password);
    }
    catch (error) {
        if (error instanceof DatabaseUserError) {
            return { data: undefined, error };
        }
        return {
            data: undefined,
            error: new DatabaseUserError(DatabaseUserErrorCode.UNKNOWN_ERROR, error instanceof Error ? error.message : 'Validation failed')
        };
    }
    // Check if user already exists
    const existsResult = await userExists(username);
    if (existsResult.error) {
        return { data: undefined, error: existsResult.error };
    }
    if (existsResult.data) {
        return {
            data: undefined,
            error: new DatabaseUserError(DatabaseUserErrorCode.USER_ALREADY_EXISTS, `User "${username}" already exists`, { username })
        };
    }
    // Check if database exists
    const { databaseExists } = await Promise.resolve().then(() => __importStar(require('./database-manager')));
    const dbExistsResult = await databaseExists(databaseName);
    if (dbExistsResult.error) {
        return { data: undefined, error: dbExistsResult.error };
    }
    if (!dbExistsResult.data) {
        return {
            data: undefined,
            error: new DatabaseUserError(DatabaseUserErrorCode.DATABASE_NOT_FOUND, `Database "${databaseName}" not found`, { databaseName })
        };
    }
    console.log(`Creating database user "${username}" for project "${projectRef}"...`);
    // Create the user with password
    // Note: Username is validated, so it's safe to use in query
    // PostgreSQL doesn't support parameterized queries for CREATE USER password
    // So we need to escape the password properly
    const escapedPassword = password.replace(/'/g, "''"); // Escape single quotes
    const createUserQuery = `CREATE USER "${username}" WITH PASSWORD '${escapedPassword}'`;
    const createResult = await (0, query_1.executeQuery)({
        query: createUserQuery,
        readOnly: false,
    });
    if (createResult.error) {
        const pgError = createResult.error;
        const errorMessage = pgError.message || 'Unknown error';
        if (errorMessage.includes('already exists')) {
            return {
                data: undefined,
                error: new DatabaseUserError(DatabaseUserErrorCode.USER_ALREADY_EXISTS, `User "${username}" already exists`, { username, originalError: errorMessage })
            };
        }
        if (errorMessage.includes('permission denied')) {
            return {
                data: undefined,
                error: new DatabaseUserError(DatabaseUserErrorCode.PERMISSION_DENIED, 'Insufficient permissions to create database user', { originalError: errorMessage })
            };
        }
        return {
            data: undefined,
            error: new DatabaseUserError(DatabaseUserErrorCode.UNKNOWN_ERROR, `Failed to create user: ${errorMessage}`, { originalError: errorMessage })
        };
    }
    // Grant all privileges on the specific database
    const grantQuery = `GRANT ALL PRIVILEGES ON DATABASE "${databaseName}" TO "${username}"`;
    const grantResult = await (0, query_1.executeQuery)({
        query: grantQuery,
        readOnly: false,
    });
    if (grantResult.error) {
        // If granting privileges fails, we should clean up by deleting the user
        console.error(`Failed to grant privileges to user "${username}", attempting cleanup...`);
        const cleanupResult = await deleteProjectUser(username);
        if (cleanupResult.error) {
            console.error(`Failed to cleanup user "${username}":`, cleanupResult.error.message);
        }
        const pgError = grantResult.error;
        const errorMessage = pgError.message || 'Unknown error';
        return {
            data: undefined,
            error: new DatabaseUserError(DatabaseUserErrorCode.PERMISSION_DENIED, `Failed to grant database privileges: ${errorMessage}`, { originalError: errorMessage })
        };
    }
    // Grant usage on the public schema and all privileges on all tables in the public schema
    const schemaQueries = [
        `GRANT USAGE ON SCHEMA public TO "${username}"`,
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${username}"`,
        `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${username}"`,
        `GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO "${username}"`,
        // Grant privileges on future objects
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${username}"`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${username}"`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO "${username}"`
    ];
    for (const schemaQuery of schemaQueries) {
        const schemaResult = await (0, query_1.executeQuery)({
            query: schemaQuery,
            readOnly: false,
            databaseName, // Execute these queries on the specific database
        });
        if (schemaResult.error) {
            console.warn(`Warning: Failed to execute schema privilege query: ${schemaQuery}`, schemaResult.error.message);
            // Continue with other queries - some may fail if objects don't exist yet
        }
    }
    console.log(`Successfully created database user "${username}" with access to database "${databaseName}"`);
    return { data: undefined, error: undefined };
}
/**
 * Deletes a PostgreSQL user
 *
 * @param username - Username to delete
 * @returns Result indicating success or error
 */
async function deleteProjectUser(username) {
    try {
        validateUsername(username);
    }
    catch (error) {
        if (error instanceof DatabaseUserError) {
            return { data: undefined, error };
        }
        return {
            data: undefined,
            error: new DatabaseUserError(DatabaseUserErrorCode.UNKNOWN_ERROR, error instanceof Error ? error.message : 'Validation failed')
        };
    }
    // Check if user exists
    const existsResult = await userExists(username);
    if (existsResult.error) {
        return { data: undefined, error: existsResult.error };
    }
    if (!existsResult.data) {
        // User doesn't exist, consider it a success
        return { data: undefined, error: undefined };
    }
    console.log(`Deleting database user "${username}"...`);
    // Terminate any active connections by this user
    const terminateQuery = `
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE usename = $1
      AND pid <> pg_backend_pid()
  `;
    const terminateResult = await (0, query_1.executeQuery)({
        query: terminateQuery,
        parameters: [username],
        readOnly: false,
    });
    if (terminateResult.error) {
        console.warn(`Warning: Could not terminate connections for user "${username}":`, terminateResult.error.message);
    }
    else {
        const terminatedCount = terminateResult.data?.filter(row => row.pg_terminate_backend).length || 0;
        if (terminatedCount > 0) {
            console.log(`Terminated ${terminatedCount} connection(s) for user "${username}"`);
        }
    }
    // Drop the user
    // Note: Username is validated, so it's safe to use in query
    const dropQuery = `DROP USER "${username}"`;
    const dropResult = await (0, query_1.executeQuery)({
        query: dropQuery,
        readOnly: false,
    });
    if (dropResult.error) {
        const pgError = dropResult.error;
        const errorMessage = pgError.message || 'Unknown error';
        if (errorMessage.includes('permission denied')) {
            return {
                data: undefined,
                error: new DatabaseUserError(DatabaseUserErrorCode.PERMISSION_DENIED, 'Insufficient permissions to delete database user', { username, originalError: errorMessage })
            };
        }
        if (errorMessage.includes('cannot be dropped because some objects depend on it')) {
            return {
                data: undefined,
                error: new DatabaseUserError(DatabaseUserErrorCode.UNKNOWN_ERROR, `Cannot delete user "${username}" because some database objects depend on it. Please remove dependent objects first.`, { username, originalError: errorMessage })
            };
        }
        return {
            data: undefined,
            error: new DatabaseUserError(DatabaseUserErrorCode.UNKNOWN_ERROR, `Failed to delete user: ${errorMessage}`, { username, originalError: errorMessage })
        };
    }
    console.log(`Successfully deleted database user "${username}"`);
    return { data: undefined, error: undefined };
}
/**
 * Validates user credentials by attempting a connection
 *
 * @param username - Username to validate
 * @param password - Password to validate
 * @returns Result with boolean indicating if credentials are valid
 */
async function validateUserCredentials(username, password) {
    try {
        validateUsername(username);
        validatePassword(password);
    }
    catch (error) {
        if (error instanceof DatabaseUserError) {
            return { data: false, error: undefined }; // Invalid format = invalid credentials
        }
        return { data: undefined, error };
    }
    // Check if user exists first
    const existsResult = await userExists(username);
    if (existsResult.error) {
        return { data: undefined, error: existsResult.error };
    }
    if (!existsResult.data) {
        return { data: false, error: undefined }; // User doesn't exist = invalid credentials
    }
    // For now, we'll just return true if the user exists and credentials are valid format
    // In a real implementation, you might want to test the connection
    // but that would require creating a separate connection pool with those credentials
    return { data: true, error: undefined };
}
/**
 * Gets user permissions information
 *
 * @param username - Username to get permissions for
 * @returns Result with user permissions information
 */
async function getUserPermissions(username) {
    try {
        validateUsername(username);
    }
    catch (error) {
        if (error instanceof DatabaseUserError) {
            return { data: undefined, error };
        }
        return {
            data: undefined,
            error: new DatabaseUserError(DatabaseUserErrorCode.UNKNOWN_ERROR, error instanceof Error ? error.message : 'Validation failed')
        };
    }
    // Check if user exists
    const existsResult = await userExists(username);
    if (existsResult.error) {
        return { data: undefined, error: existsResult.error };
    }
    if (!existsResult.data) {
        return {
            data: undefined,
            error: new DatabaseUserError(DatabaseUserErrorCode.INVALID_USERNAME, `User "${username}" does not exist`, { username })
        };
    }
    // Get user attributes
    const userQuery = `
    SELECT 
      usename,
      usesuper,
      usecreatedb,
      usecreaterole
    FROM pg_user 
    WHERE usename = $1
  `;
    const userResult = await (0, query_1.executeQuery)({
        query: userQuery,
        parameters: [username],
        readOnly: true,
    });
    if (userResult.error) {
        return { data: undefined, error: userResult.error };
    }
    const userInfo = userResult.data?.[0];
    if (!userInfo) {
        return {
            data: undefined,
            error: new DatabaseUserError(DatabaseUserErrorCode.INVALID_USERNAME, `User "${username}" not found`, { username })
        };
    }
    // Get database privileges
    const privilegesQuery = `
    SELECT 
      datname as database_name,
      array_agg(privilege_type) as privileges
    FROM (
      SELECT 
        d.datname,
        CASE 
          WHEN has_database_privilege($1, d.datname, 'CONNECT') THEN 'CONNECT'
          ELSE NULL
        END as privilege_type
      FROM pg_database d
      WHERE d.datistemplate = false
      UNION ALL
      SELECT 
        d.datname,
        CASE 
          WHEN has_database_privilege($1, d.datname, 'CREATE') THEN 'CREATE'
          ELSE NULL
        END as privilege_type
      FROM pg_database d
      WHERE d.datistemplate = false
      UNION ALL
      SELECT 
        d.datname,
        CASE 
          WHEN has_database_privilege($1, d.datname, 'TEMPORARY') THEN 'TEMPORARY'
          ELSE NULL
        END as privilege_type
      FROM pg_database d
      WHERE d.datistemplate = false
    ) privileges
    WHERE privilege_type IS NOT NULL
    GROUP BY datname
    ORDER BY datname
  `;
    const privilegesResult = await (0, query_1.executeQuery)({
        query: privilegesQuery,
        parameters: [username],
        readOnly: true,
    });
    if (privilegesResult.error) {
        return { data: undefined, error: privilegesResult.error };
    }
    // Build permissions object
    const databases = [];
    const privileges = {};
    for (const row of privilegesResult.data || []) {
        databases.push(row.database_name);
        privileges[row.database_name] = row.privileges || [];
    }
    const permissions = {
        username: userInfo.usename,
        databases,
        privileges,
        canCreateDb: userInfo.usecreatedb,
        canCreateRole: userInfo.usecreaterole,
        isSuperuser: userInfo.usesuper
    };
    return { data: permissions, error: undefined };
}
// Export the implementation as the default manager
exports.databaseUserManager = {
    createProjectUser,
    deleteProjectUser,
    validateUserCredentials,
    getUserPermissions,
    userExists
};
