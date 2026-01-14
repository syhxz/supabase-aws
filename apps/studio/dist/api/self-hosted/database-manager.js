"use strict";
/**
 * Database manager for PostgreSQL database operations.
 * Handles creation, deletion, listing, and existence checks for databases.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseError = exports.DatabaseErrorCode = void 0;
exports.getTemplateDatabaseName = getTemplateDatabaseName;
exports.createDatabase = createDatabase;
exports.createDatabaseWithRetry = createDatabaseWithRetry;
exports.terminateConnections = terminateConnections;
exports.terminateConnectionsAndWait = terminateConnectionsAndWait;
exports.databaseExists = databaseExists;
exports.listDatabases = listDatabases;
exports.deleteDatabase = deleteDatabase;
const query_1 = require("./query");
const database_naming_1 = require("./database-naming");
const constants_1 = require("./constants");
/**
 * Error codes for database operations
 */
var DatabaseErrorCode;
(function (DatabaseErrorCode) {
    DatabaseErrorCode["DATABASE_ALREADY_EXISTS"] = "DATABASE_ALREADY_EXISTS";
    DatabaseErrorCode["TEMPLATE_NOT_FOUND"] = "TEMPLATE_NOT_FOUND";
    DatabaseErrorCode["INVALID_DATABASE_NAME"] = "INVALID_DATABASE_NAME";
    DatabaseErrorCode["INSUFFICIENT_PERMISSIONS"] = "INSUFFICIENT_PERMISSIONS";
    DatabaseErrorCode["DISK_SPACE_FULL"] = "DISK_SPACE_FULL";
    DatabaseErrorCode["CONNECTION_FAILED"] = "CONNECTION_FAILED";
    DatabaseErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(DatabaseErrorCode || (exports.DatabaseErrorCode = DatabaseErrorCode = {}));
/**
 * Custom error class for database operations
 */
class DatabaseError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
/**
 * Gets the template database name from environment or defaults
 *
 * @returns The template database name
 */
function getTemplateDatabaseName() {
    // Priority: TEMPLATE_DATABASE_NAME > POSTGRES_DB > 'postgres'
    return (process.env.TEMPLATE_DATABASE_NAME ||
        constants_1.POSTGRES_DATABASE ||
        'postgres');
}
/**
 * Creates a new PostgreSQL database using a template
 *
 * @param options - Database creation options
 * @returns Result indicating success or error
 */
async function createDatabase(options) {
    const { name, template, owner } = options;
    try {
        // Validate database name
        (0, database_naming_1.validateDatabaseName)(name);
    }
    catch (error) {
        return {
            data: undefined,
            error: new DatabaseError(DatabaseErrorCode.INVALID_DATABASE_NAME, error instanceof Error ? error.message : 'Invalid database name', { name }),
        };
    }
    // Check if database already exists
    const existsResult = await databaseExists(name);
    if (existsResult.error) {
        return { data: undefined, error: existsResult.error };
    }
    if (existsResult.data) {
        return {
            data: undefined,
            error: new DatabaseError(DatabaseErrorCode.DATABASE_ALREADY_EXISTS, `Database "${name}" already exists`, { name }),
        };
    }
    // Check if template exists
    const templateExistsResult = await databaseExists(template);
    if (templateExistsResult.error) {
        return { data: undefined, error: templateExistsResult.error };
    }
    if (!templateExistsResult.data) {
        return {
            data: undefined,
            error: new DatabaseError(DatabaseErrorCode.TEMPLATE_NOT_FOUND, `Template database "${template}" not found`, { template }),
        };
    }
    // Terminate all connections to the template database to allow creation
    // This is necessary because PostgreSQL cannot use a database as a template
    // if there are active connections to it
    console.log(`Terminating connections to template database "${template}"...`);
    const terminateResult = await terminateConnections(template);
    if (terminateResult.error) {
        console.warn(`Warning: Could not terminate connections:`, terminateResult.error.message);
    }
    else {
        console.log(`Terminated ${terminateResult.data} connections`);
    }
    // Build CREATE DATABASE query
    // Note: Database names and template names are validated, so they're safe to use
    let query = `CREATE DATABASE "${name}" WITH TEMPLATE "${template}"`;
    if (owner) {
        query += ` OWNER "${owner}"`;
    }
    console.log('Executing SQL:', query);
    const result = await (0, query_1.executeQuery)({
        query,
        readOnly: false,
    });
    if (result.error) {
        // Map PostgreSQL errors to our error codes
        const pgError = result.error;
        const errorMessage = pgError.message || 'Unknown error';
        if (errorMessage.includes('already exists')) {
            return {
                data: undefined,
                error: new DatabaseError(DatabaseErrorCode.DATABASE_ALREADY_EXISTS, `Database "${name}" already exists`, { name, originalError: errorMessage }),
            };
        }
        if (errorMessage.includes('does not exist') || errorMessage.includes('template')) {
            return {
                data: undefined,
                error: new DatabaseError(DatabaseErrorCode.TEMPLATE_NOT_FOUND, `Template database "${template}" not found`, { template, originalError: errorMessage }),
            };
        }
        if (errorMessage.includes('permission denied')) {
            return {
                data: undefined,
                error: new DatabaseError(DatabaseErrorCode.INSUFFICIENT_PERMISSIONS, 'Insufficient permissions to create database', { originalError: errorMessage }),
            };
        }
        if (errorMessage.includes('disk') || errorMessage.includes('space')) {
            return {
                data: undefined,
                error: new DatabaseError(DatabaseErrorCode.DISK_SPACE_FULL, 'Insufficient disk space to create database', { originalError: errorMessage }),
            };
        }
        const dbError = new DatabaseError(DatabaseErrorCode.UNKNOWN_ERROR, `Failed to create database: ${errorMessage}`, { originalError: errorMessage });
        console.error('Creating DatabaseError:', {
            code: dbError.code,
            message: dbError.message,
            details: dbError.details,
        });
        return {
            data: undefined,
            error: dbError,
        };
    }
    return { data: undefined, error: undefined };
}
/**
 * Creates a new PostgreSQL database with retry logic for template lock errors
 *
 * @param options - Database creation options including retry configuration
 * @returns Result indicating success or error
 */
async function createDatabaseWithRetry(options) {
    const { name, template, owner } = options;
    // Get retry configuration from options or environment variables
    const maxRetries = options.maxRetries ?? parseInt(process.env.DATABASE_CREATION_MAX_RETRIES || '3', 10);
    const baseRetryDelayMs = options.retryDelayMs ?? parseInt(process.env.DATABASE_CREATION_RETRY_DELAY_MS || '500', 10);
    // Validate database name
    try {
        (0, database_naming_1.validateDatabaseName)(name);
    }
    catch (error) {
        return {
            data: undefined,
            error: new DatabaseError(DatabaseErrorCode.INVALID_DATABASE_NAME, error instanceof Error ? error.message : 'Invalid database name', { name }),
        };
    }
    // Check if database already exists
    const existsResult = await databaseExists(name);
    if (existsResult.error) {
        return { data: undefined, error: existsResult.error };
    }
    if (existsResult.data) {
        return {
            data: undefined,
            error: new DatabaseError(DatabaseErrorCode.DATABASE_ALREADY_EXISTS, `Database "${name}" already exists`, { name }),
        };
    }
    // Check if template exists
    const templateExistsResult = await databaseExists(template);
    if (templateExistsResult.error) {
        return { data: undefined, error: templateExistsResult.error };
    }
    if (!templateExistsResult.data) {
        return {
            data: undefined,
            error: new DatabaseError(DatabaseErrorCode.TEMPLATE_NOT_FOUND, `Template database "${template}" not found`, { template }),
        };
    }
    // Terminate connections and wait before attempting creation
    const terminateResult = await terminateConnectionsAndWait(template);
    if (terminateResult.error) {
        // Log warning but continue - we'll retry if creation fails
        console.warn(`Warning: Could not terminate connections:`, terminateResult.error.message);
    }
    // Attempt database creation with retry logic
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Build CREATE DATABASE query
        let query = `CREATE DATABASE "${name}" WITH TEMPLATE "${template}"`;
        if (owner) {
            query += ` OWNER "${owner}"`;
        }
        if (attempt === 0) {
            console.log(`Creating database "${name}" from template "${template}"...`);
        }
        else {
            console.log(`Retry attempt ${attempt}/${maxRetries} for database "${name}"...`);
        }
        const result = await (0, query_1.executeQuery)({
            query,
            readOnly: false,
        });
        // Success!
        if (!result.error) {
            if (attempt > 0) {
                console.log(`Database "${name}" created successfully after ${attempt} retry attempt(s)`);
            }
            else {
                console.log(`Database "${name}" created successfully`);
            }
            return { data: undefined, error: undefined };
        }
        // Handle error
        const pgError = result.error;
        const errorMessage = pgError.message || 'Unknown error';
        lastError = result.error;
        // Check if this is a template lock error
        const isTemplateLockError = errorMessage.includes('source database') &&
            errorMessage.includes('being accessed by other users');
        if (isTemplateLockError && attempt < maxRetries) {
            // Calculate exponential backoff delay
            const delayMs = baseRetryDelayMs * Math.pow(2, attempt);
            console.log(`Template database "${template}" is locked. Waiting ${delayMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            // Try terminating connections again before retry
            const retryTerminateResult = await terminateConnectionsAndWait(template);
            if (retryTerminateResult.error) {
                console.warn(`Warning: Could not terminate connections on retry:`, retryTerminateResult.error.message);
            }
            continue; // Retry
        }
        // Not a template lock error, or we've exhausted retries
        // Map PostgreSQL errors to our error codes
        if (errorMessage.includes('already exists')) {
            return {
                data: undefined,
                error: new DatabaseError(DatabaseErrorCode.DATABASE_ALREADY_EXISTS, `Database "${name}" already exists`, { name, originalError: errorMessage }),
            };
        }
        if (errorMessage.includes('does not exist') || errorMessage.includes('template')) {
            return {
                data: undefined,
                error: new DatabaseError(DatabaseErrorCode.TEMPLATE_NOT_FOUND, `Template database "${template}" not found`, { template, originalError: errorMessage }),
            };
        }
        if (errorMessage.includes('permission denied')) {
            return {
                data: undefined,
                error: new DatabaseError(DatabaseErrorCode.INSUFFICIENT_PERMISSIONS, 'Insufficient permissions to create database', { originalError: errorMessage }),
            };
        }
        if (errorMessage.includes('disk') || errorMessage.includes('space')) {
            return {
                data: undefined,
                error: new DatabaseError(DatabaseErrorCode.DISK_SPACE_FULL, 'Insufficient disk space to create database', { originalError: errorMessage }),
            };
        }
        // If we get here with a template lock error, we've exhausted retries
        if (isTemplateLockError) {
            console.error(`Failed to create database "${name}" after ${maxRetries} retry attempts: template database is locked`);
            return {
                data: undefined,
                error: new DatabaseError(DatabaseErrorCode.UNKNOWN_ERROR, `Failed to create database: template database "${template}" is being accessed by other users. Exhausted ${maxRetries} retry attempts.`, { template, originalError: errorMessage, retriesAttempted: maxRetries }),
            };
        }
        // Unknown error
        break;
    }
    // If we get here, we have an unknown error
    const errorMessage = lastError?.message || 'Unknown error';
    console.error(`Failed to create database "${name}":`, errorMessage);
    return {
        data: undefined,
        error: new DatabaseError(DatabaseErrorCode.UNKNOWN_ERROR, `Failed to create database: ${errorMessage}`, { originalError: errorMessage }),
    };
}
/**
 * Terminates all connections to a specific database
 * This is useful when you need to use a database as a template
 *
 * @param name - Name of the database to terminate connections for
 * @returns Result indicating success or error
 */
async function terminateConnections(name) {
    // Don't terminate connections to system databases or the current database
    const protectedDatabases = ['postgres', 'template0', 'template1'];
    // Query to terminate all connections except our own
    const query = `
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = $1
      AND pid <> pg_backend_pid()
  `;
    const result = await (0, query_1.executeQuery)({
        query,
        parameters: [name],
        readOnly: false,
    });
    if (result.error) {
        return {
            data: undefined,
            error: new DatabaseError(DatabaseErrorCode.UNKNOWN_ERROR, `Failed to terminate connections to database "${name}"`, { name, originalError: result.error })
        };
    }
    // Count how many connections were terminated
    const terminatedCount = result.data?.filter(row => row.pg_terminate_backend).length || 0;
    return { data: terminatedCount, error: undefined };
}
/**
 * Terminates all connections to a specific database and waits for them to close
 * This is useful when you need to use a database as a template
 *
 * @param name - Name of the database to terminate connections for
 * @param waitMs - Time to wait in milliseconds after terminating connections (default: from env or 500ms)
 * @returns Result with count of terminated connections or error
 */
async function terminateConnectionsAndWait(name, waitMs) {
    // Get wait time from parameter, environment variable, or default
    const waitTime = waitMs ?? parseInt(process.env.TEMPLATE_CONNECTION_WAIT_MS || '500', 10);
    console.log(`Terminating connections to database "${name}"...`);
    // Terminate connections
    const terminateResult = await terminateConnections(name);
    if (terminateResult.error) {
        console.warn(`Warning: Could not terminate connections to "${name}":`, terminateResult.error.message);
        return terminateResult;
    }
    const terminatedCount = terminateResult.data || 0;
    console.log(`Terminated ${terminatedCount} connection(s) to database "${name}"`);
    // Wait for connections to fully close
    if (terminatedCount > 0 && waitTime > 0) {
        console.log(`Waiting ${waitTime}ms for connections to fully close...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    return { data: terminatedCount, error: undefined };
}
/**
 * Checks if a database exists
 *
 * @param name - Name of the database to check
 * @returns Result with boolean indicating existence
 */
async function databaseExists(name) {
    const query = `
    SELECT EXISTS(
      SELECT 1 FROM pg_database WHERE datname = $1
    ) as exists
  `;
    const result = await (0, query_1.executeQuery)({
        query,
        parameters: [name],
        readOnly: true,
    });
    if (result.error) {
        return { data: undefined, error: result.error };
    }
    const exists = result.data?.[0]?.exists ?? false;
    return { data: exists, error: undefined };
}
/**
 * Lists all databases in the PostgreSQL instance
 *
 * @returns Result with array of database information
 */
async function listDatabases() {
    const query = `
    SELECT 
      datname as name,
      pg_catalog.pg_get_userbyid(datdba) as owner,
      pg_encoding_to_char(encoding) as encoding,
      datcollate as collate,
      datctype as ctype
    FROM pg_database
    WHERE datistemplate = false
    ORDER BY datname
  `;
    const result = await (0, query_1.executeQuery)({
        query,
        readOnly: true,
    });
    if (result.error) {
        return { data: undefined, error: result.error };
    }
    return { data: result.data || [], error: undefined };
}
/**
 * Deletes a database
 *
 * @param name - Name of the database to delete
 * @returns Result indicating success or error
 */
async function deleteDatabase(name) {
    try {
        // Validate database name
        (0, database_naming_1.validateDatabaseName)(name);
    }
    catch (error) {
        return {
            data: undefined,
            error: new DatabaseError(DatabaseErrorCode.INVALID_DATABASE_NAME, error instanceof Error ? error.message : 'Invalid database name', { name }),
        };
    }
    // Check if database exists
    const existsResult = await databaseExists(name);
    if (existsResult.error) {
        return { data: undefined, error: existsResult.error };
    }
    if (!existsResult.data) {
        // Database doesn't exist, consider it a success
        return { data: undefined, error: undefined };
    }
    // Note: Database name is validated, so it's safe to use in query
    const query = `DROP DATABASE "${name}"`;
    const result = await (0, query_1.executeQuery)({
        query,
        readOnly: false,
    });
    if (result.error) {
        const pgError = result.error;
        const errorMessage = pgError.message || 'Unknown error';
        if (errorMessage.includes('permission denied')) {
            return {
                data: undefined,
                error: new DatabaseError(DatabaseErrorCode.INSUFFICIENT_PERMISSIONS, 'Insufficient permissions to delete database', { name, originalError: errorMessage }),
            };
        }
        return {
            data: undefined,
            error: new DatabaseError(DatabaseErrorCode.UNKNOWN_ERROR, `Failed to delete database: ${errorMessage}`, { name, originalError: errorMessage }),
        };
    }
    return { data: undefined, error: undefined };
}
