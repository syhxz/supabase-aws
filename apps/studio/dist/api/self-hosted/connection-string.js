"use strict";
/**
 * Connection string generator for PostgreSQL databases.
 * Supports dynamic database names for multi-database project management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateConnectionStringWithFallback = generateConnectionStringWithFallback;
exports.generateConnectionString = generateConnectionString;
exports.generateDisplayConnectionString = generateDisplayConnectionString;
exports.generateDisplayConnectionStringWithFallback = generateDisplayConnectionStringWithFallback;
exports.generateProjectConnectionString = generateProjectConnectionString;
exports.generateProjectConnectionStringWithVisibility = generateProjectConnectionStringWithVisibility;
exports.validateConnectionStringFormat = validateConnectionStringFormat;
exports.parseConnectionStringWithFallback = parseConnectionStringWithFallback;
exports.parseConnectionString = parseConnectionString;
const constants_1 = require("./constants");
const environment_config_handler_1 = require("../../environment-config-handler");
const credential_fallback_manager_1 = require("./credential-fallback-manager");
const credential_error_handling_1 = require("./credential-error-handling");
/**
 * Validates connection parameters
 */
function validateConnectionParameters(params) {
    const errors = [];
    if (!params.host || params.host.trim() === '') {
        errors.push('Host cannot be empty');
    }
    if (!params.port) {
        errors.push('Port cannot be empty');
    }
    else {
        const portNum = typeof params.port === 'string' ? parseInt(params.port, 10) : params.port;
        if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
            errors.push('Port must be a valid number between 1 and 65535');
        }
    }
    if (!params.user || params.user.trim() === '') {
        errors.push('User cannot be empty');
    }
    if (!params.password || params.password.trim() === '') {
        errors.push('Password cannot be empty');
    }
    if (!params.databaseName || params.databaseName.trim() === '') {
        errors.push('Database name cannot be empty');
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
/**
 * Determines the appropriate username based on permission level and environment
 *
 * @param readOnly - Whether to use read-only credentials
 * @param customUser - Custom user override
 * @param useEnvironmentDefaults - Whether to use environment defaults
 * @returns The appropriate username for the connection
 */
function determineUsername(readOnly, customUser, useEnvironmentDefaults = true) {
    // If a custom user is provided, use it directly
    if (customUser !== undefined) {
        return customUser;
    }
    // If not using environment defaults, return undefined to indicate missing parameter
    if (!useEnvironmentDefaults) {
        return undefined;
    }
    // Select appropriate user based on permission level
    const selectedUser = readOnly ? constants_1.POSTGRES_USER_READ_ONLY : constants_1.POSTGRES_USER_READ_WRITE;
    // Validate that the selected user is not empty or just whitespace
    if (!selectedUser || selectedUser.trim() === '') {
        throw new Error(`Invalid username configuration: ${readOnly ? 'read-only' : 'read-write'} user cannot be empty`);
    }
    return selectedUser;
}
/**
 * Enhanced username determination with environment-specific configuration
 *
 * @param readOnly - Whether to use read-only credentials
 * @param customUser - Custom user override
 * @param useEnvironmentDefaults - Whether to use environment defaults
 * @param envConfig - Environment configuration from handler
 * @returns The appropriate username for the connection
 */
function determineUsernameWithEnvironment(readOnly, customUser, useEnvironmentDefaults = true, envConfig) {
    // If a custom user is provided, use it directly
    if (customUser !== undefined) {
        return customUser;
    }
    // If not using environment defaults, return undefined to indicate missing parameter
    if (!useEnvironmentDefaults) {
        return undefined;
    }
    // Use environment configuration if available, otherwise fall back to constants
    let selectedUser;
    if (envConfig) {
        selectedUser = readOnly ? envConfig.POSTGRES_USER_READ_ONLY : envConfig.POSTGRES_USER_READ_WRITE;
    }
    else {
        selectedUser = readOnly ? constants_1.POSTGRES_USER_READ_ONLY : constants_1.POSTGRES_USER_READ_WRITE;
    }
    // Validate that the selected user is not empty or just whitespace
    if (!selectedUser || selectedUser.trim() === '') {
        throw new Error(`Invalid username configuration: ${readOnly ? 'read-only' : 'read-write'} user cannot be empty`);
    }
    return selectedUser;
}
/**
 * Validates username format according to PostgreSQL rules
 *
 * @param username - The username to validate
 * @returns True if valid, false otherwise
 */
function isValidUsername(username) {
    if (!username || username.trim() === '') {
        return false;
    }
    const trimmedUsername = username.trim();
    // PostgreSQL username rules: start with letter or underscore, contain letters, numbers, underscores, and hyphens
    return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(trimmedUsername);
}
/**
 * Formats username for display in connection strings, ensuring proper format for different permission levels
 *
 * @param username - The username to format
 * @param readOnly - Whether this is for read-only access
 * @returns Formatted username with appropriate indicators
 */
function formatUsernameForDisplay(username, readOnly) {
    // Ensure username is properly formatted and not empty
    if (!username || username.trim() === '') {
        throw new Error('Username cannot be empty for connection string display');
    }
    const trimmedUsername = username.trim();
    // Validate username format
    if (!isValidUsername(trimmedUsername)) {
        throw new Error(`Invalid username format: ${trimmedUsername}. Username must start with a letter or underscore and contain only letters, numbers, underscores, and hyphens.`);
    }
    // For read-only users, ensure the username clearly indicates read-only permissions
    if (readOnly && !trimmedUsername.includes('read_only') && !trimmedUsername.includes('readonly')) {
        // If it's a generic username like 'postgres' or 'supabase_admin', 
        // but we're in read-only mode, we should use the proper read-only user
        if (trimmedUsername === 'postgres' || trimmedUsername === 'supabase_admin') {
            return constants_1.POSTGRES_USER_READ_ONLY || 'supabase_read_only_user';
        }
    }
    return trimmedUsername;
}
/**
 * Generates a PostgreSQL connection string with fallback support and comprehensive error handling
 * Uses project-specific credentials first, then falls back to system credentials
 *
 * @param options - Enhanced connection string options with fallback support
 * @returns ConnectionStringResult with fallback information
 */
async function generateConnectionStringWithFallback(options) {
    const errorHandler = (0, credential_error_handling_1.getCredentialErrorHandler)();
    return errorHandler.executeWithErrorHandling(async () => {
        const { projectRef, allowFallback = true, logFallbackUsage = true, projectCredentials, ...baseOptions } = options;
        const fallbackManager = (0, credential_fallback_manager_1.getCredentialFallbackManager)();
        let usedFallback = false;
        let fallbackReason;
        let fallbackType;
        // Resolve credentials with fallback logic
        let finalUser = baseOptions.user;
        let finalPassword = baseOptions.password;
        // If project credentials are provided or projectRef is available, try to use them
        if (allowFallback && (projectCredentials || projectRef)) {
            let projectCreds;
            if (projectCredentials) {
                // Use provided project credentials
                projectCreds = fallbackManager.getProjectCredentials(projectRef || 'unknown', projectCredentials.user, projectCredentials.passwordHash);
            }
            else if (projectRef) {
                // For now, we'll assume project credentials are passed via projectCredentials parameter
                // In a real implementation, this would fetch from the database
                projectCreds = { user: null, passwordHash: null, isComplete: false };
            }
            else {
                projectCreds = { user: null, passwordHash: null, isComplete: false };
            }
            // Check if we need to use fallback credentials
            if (fallbackManager.shouldUseFallback(projectCreds)) {
                const systemCreds = await fallbackManager.getFallbackCredentials(baseOptions.readOnly);
                // Determine what's missing and use fallback accordingly
                const missingUser = !projectCreds.user && !finalUser;
                const missingPassword = !projectCreds.passwordHash && !finalPassword;
                if (missingUser && missingPassword) {
                    finalUser = systemCreds.user;
                    finalPassword = systemCreds.password;
                    usedFallback = true;
                    fallbackReason = 'Both user and password missing from project credentials';
                    fallbackType = 'both';
                }
                else if (missingUser) {
                    finalUser = systemCreds.user;
                    finalPassword = finalPassword || projectCreds.passwordHash || systemCreds.password;
                    usedFallback = true;
                    fallbackReason = 'User missing from project credentials';
                    fallbackType = 'user';
                }
                else if (missingPassword) {
                    finalUser = finalUser || projectCreds.user || systemCreds.user;
                    finalPassword = systemCreds.password;
                    usedFallback = true;
                    fallbackReason = 'Password missing from project credentials';
                    fallbackType = 'password';
                }
                else {
                    // Use project credentials
                    finalUser = finalUser || projectCreds.user || undefined;
                    finalPassword = finalPassword || projectCreds.passwordHash || undefined;
                }
                // Log fallback usage if enabled
                if (usedFallback && logFallbackUsage && projectRef) {
                    fallbackManager.logFallbackUsage(projectRef, fallbackReason, fallbackType);
                }
            }
            else {
                // Use complete project credentials
                finalUser = finalUser || projectCreds.user || undefined;
                finalPassword = finalPassword || projectCreds.passwordHash || undefined;
            }
        }
        // Generate the connection string using the resolved credentials
        const connectionString = await generateConnectionStringWithErrorHandling({
            ...baseOptions,
            user: finalUser,
            password: finalPassword,
        });
        return {
            connectionString,
            usedFallback,
            fallbackReason,
            fallbackType,
        };
    }, {
        serviceName: 'connection-string-generation',
        context: `generateConnectionStringWithFallback-${options.projectRef || 'unknown'}`,
        enableRetry: true,
        enableCircuitBreaker: true,
        enableGracefulDegradation: true,
        fallbackFn: async () => {
            // Fallback: generate basic connection string with environment defaults
            console.warn('[Connection String] Using fallback connection string generation');
            const basicConnectionString = generateConnectionString({
                databaseName: options.databaseName,
                host: options.host,
                port: options.port,
                user: options.user,
                password: options.password,
                readOnly: options.readOnly,
                maskPassword: options.maskPassword,
                useEnvironmentDefaults: true
            });
            return {
                connectionString: basicConnectionString,
                usedFallback: true,
                fallbackReason: 'Primary connection string generation failed, using environment defaults',
                fallbackType: 'both'
            };
        }
    });
}
/**
 * Generates a PostgreSQL connection string with comprehensive error handling
 *
 * @param options - Connection string options
 * @returns A PostgreSQL connection string
 */
async function generateConnectionStringWithErrorHandling(options) {
    const errorHandler = (0, credential_error_handling_1.getCredentialErrorHandler)();
    return errorHandler.executeWithErrorHandling(async () => generateConnectionString(options), {
        serviceName: 'connection-string-basic',
        context: `generateConnectionString-${options.databaseName}`,
        enableRetry: true,
        enableCircuitBreaker: false, // Basic string generation shouldn't need circuit breaker
        enableGracefulDegradation: true,
        fallbackFn: async () => {
            // Fallback: try with minimal validation
            console.warn('[Connection String] Using minimal validation fallback');
            return generateConnectionStringMinimal(options);
        }
    });
}
/**
 * Generates a PostgreSQL connection string with minimal validation (fallback)
 */
function generateConnectionStringMinimal(options) {
    const { databaseName, readOnly = false, host = constants_1.POSTGRES_HOST, port = constants_1.POSTGRES_PORT, user = readOnly ? constants_1.POSTGRES_USER_READ_ONLY : constants_1.POSTGRES_USER_READ_WRITE, password = constants_1.POSTGRES_PASSWORD, maskPassword = false, } = options;
    // Use defaults for any missing values
    const finalHost = host || 'localhost';
    const finalPort = port || 5432;
    const finalUser = user || 'postgres';
    const finalPassword = password || 'password';
    const finalDatabase = databaseName || 'postgres';
    const displayPassword = maskPassword ? '[YOUR_PASSWORD]' : finalPassword;
    return `postgresql://${finalUser}:${displayPassword}@${finalHost}:${finalPort}/${finalDatabase}`;
}
/**
 * Generates a PostgreSQL connection string with auto-generated credentials
 * Uses environment-specific configuration when available
 * Requirements 2.1, 2.2, 2.3, 2.5: Generate connection strings with auto-generated credentials
 *
 * @param options - Connection string options
 * @returns A PostgreSQL connection string with auto-generated credentials
 * @throws Error if required parameters are missing and no fallback is available
 */
function generateConnectionString(options) {
    const { databaseName, readOnly = false, host, port, user, password, useEnvironmentDefaults = true, maskPassword = false, } = options;
    // Try to use environment configuration handler for environment-specific values
    let envConfig = null;
    try {
        // Only use environment config handler if it's explicitly requested or available
        if (useEnvironmentDefaults) {
            const configHandler = (0, environment_config_handler_1.getEnvironmentConfigHandler)();
            envConfig = configHandler.getCurrentConfig();
        }
    }
    catch (error) {
        // Fall back to direct environment variables if handler is not available
        // This ensures backward compatibility with existing code
        envConfig = null;
    }
    // Use provided values or fall back to environment configuration, then to direct environment variables
    const finalHost = host !== undefined ? host :
        (envConfig?.POSTGRES_HOST || (useEnvironmentDefaults ? constants_1.POSTGRES_HOST : undefined));
    const finalPort = port !== undefined ? port :
        (envConfig?.POSTGRES_PORT || (useEnvironmentDefaults ? constants_1.POSTGRES_PORT : undefined));
    const finalPassword = password !== undefined ? password :
        (envConfig?.POSTGRES_PASSWORD || (useEnvironmentDefaults ? constants_1.POSTGRES_PASSWORD : undefined));
    // Use enhanced username determination logic with environment-specific configuration
    const finalUser = determineUsernameWithEnvironment(readOnly, user, useEnvironmentDefaults, envConfig);
    // Check for missing parameters (undefined or null)
    if (finalHost === undefined || finalHost === null ||
        finalPort === undefined || finalPort === null ||
        finalUser === undefined || finalUser === null ||
        finalPassword === undefined || finalPassword === null) {
        const missing = [];
        if (finalHost === undefined || finalHost === null)
            missing.push('host');
        if (finalPort === undefined || finalPort === null)
            missing.push('port');
        if (finalUser === undefined || finalUser === null)
            missing.push('user');
        if (finalPassword === undefined || finalPassword === null)
            missing.push('password');
        throw credential_error_handling_1.CredentialError.configuration(`Missing required connection parameters: ${missing.join(', ')}. ` +
            `Either provide these values directly or ensure environment variables are set.`, { missing, useEnvironmentDefaults, readOnly });
    }
    // Validate connection parameters (including empty strings)
    const validation = validateConnectionParameters({
        host: finalHost,
        port: finalPort,
        user: finalUser,
        password: finalPassword,
        databaseName
    });
    if (!validation.isValid) {
        throw credential_error_handling_1.CredentialError.validation(`Invalid connection parameters: ${validation.errors.join(', ')}`, {
            validationErrors: validation.errors,
            host: finalHost,
            port: finalPort,
            user: finalUser,
            databaseName,
            readOnly
        });
    }
    // Format username appropriately for the connection string
    const formattedUser = formatUsernameForDisplay(finalUser, readOnly);
    // Use masked password for display purposes if requested
    const displayPassword = maskPassword ? '[YOUR_PASSWORD]' : finalPassword;
    return `postgresql://${formattedUser}:${displayPassword}@${finalHost}:${finalPort}/${databaseName}`;
}
/**
 * Generates a PostgreSQL connection string for display purposes with masked password
 * This function should be used when showing connection strings to users in the UI
 *
 * @param options - Connection string options
 * @returns A PostgreSQL connection string with masked password
 */
function generateDisplayConnectionString(options) {
    return generateConnectionString({ ...options, maskPassword: true });
}
/**
 * Generates a display connection string with fallback support
 *
 * @param options - Enhanced connection string options
 * @returns ConnectionStringResult with masked password
 */
async function generateDisplayConnectionStringWithFallback(options) {
    return generateConnectionStringWithFallback({ ...options, maskPassword: true });
}
/**
 * Validates project-specific connection parameters
 */
function validateProjectConnectionParameters(params) {
    const errors = [];
    if (!params.host || params.host.trim() === '') {
        errors.push('Host cannot be empty');
    }
    if (!params.port) {
        errors.push('Port cannot be empty');
    }
    else {
        const portNum = typeof params.port === 'string' ? parseInt(params.port, 10) : params.port;
        if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
            errors.push('Port must be a valid number between 1 and 65535');
        }
    }
    if (!params.projectUser || params.projectUser.trim() === '') {
        errors.push('Project user cannot be empty');
    }
    else if (!isValidUsername(params.projectUser)) {
        errors.push('Invalid project username format');
    }
    if (!params.projectPassword || params.projectPassword.trim() === '') {
        errors.push('Project password cannot be empty');
    }
    if (!params.projectDatabase || params.projectDatabase.trim() === '') {
        errors.push('Project database cannot be empty');
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
/**
 * Generates project-specific connection strings with both masked and actual password versions
 *
 * @param options - Project connection options
 * @returns Object containing both masked and actual connection strings
 * @throws Error if required parameters are missing or invalid
 */
function generateProjectConnectionString(options) {
    const { projectUser, projectPassword, projectDatabase, host, port, revealPassword = false, useEnvironmentDefaults = true, } = options;
    // Get environment configuration for host and port defaults
    let envConfig = null;
    try {
        if (useEnvironmentDefaults) {
            const configHandler = (0, environment_config_handler_1.getEnvironmentConfigHandler)();
            envConfig = configHandler.getCurrentConfig();
        }
    }
    catch (error) {
        envConfig = null;
    }
    // Use provided values or fall back to environment configuration
    const finalHost = host !== undefined ? host :
        (envConfig?.POSTGRES_HOST || (useEnvironmentDefaults ? constants_1.POSTGRES_HOST : undefined));
    const finalPort = port !== undefined ? port :
        (envConfig?.POSTGRES_PORT || (useEnvironmentDefaults ? constants_1.POSTGRES_PORT : undefined));
    // Check for missing host/port parameters
    if (finalHost === undefined || finalHost === null ||
        finalPort === undefined || finalPort === null) {
        const missing = [];
        if (finalHost === undefined || finalHost === null)
            missing.push('host');
        if (finalPort === undefined || finalPort === null)
            missing.push('port');
        throw new Error(`Missing required connection parameters: ${missing.join(', ')}. ` +
            `Either provide these values directly or ensure environment variables are set.`);
    }
    // Validate project-specific parameters
    const validation = validateProjectConnectionParameters({
        projectUser,
        projectPassword,
        projectDatabase,
        host: finalHost,
        port: finalPort
    });
    if (!validation.isValid) {
        throw new Error(`Invalid project connection parameters: ${validation.errors.join(', ')}`);
    }
    // Generate both masked and actual connection strings
    const maskedConnectionString = `postgresql://${projectUser}:[YOUR_PASSWORD]@${finalHost}:${finalPort}/${projectDatabase}`;
    const actualConnectionString = `postgresql://${projectUser}:${projectPassword}@${finalHost}:${finalPort}/${projectDatabase}`;
    return {
        masked: maskedConnectionString,
        actual: actualConnectionString
    };
}
/**
 * Generates a project-specific connection string with password visibility control
 *
 * @param options - Project connection options
 * @returns A PostgreSQL connection string with password masked or revealed based on revealPassword option
 */
function generateProjectConnectionStringWithVisibility(options) {
    const { revealPassword = false } = options;
    const connectionStrings = generateProjectConnectionString(options);
    return revealPassword ? connectionStrings.actual : connectionStrings.masked;
}
/**
 * Validates connection string format and parameter substitution
 *
 * @param connectionString - The connection string to validate
 * @returns Validation result with details
 */
function validateConnectionStringFormat(connectionString) {
    const errors = [];
    if (!connectionString || connectionString.trim() === '') {
        errors.push('Connection string cannot be empty');
        return { isValid: false, errors };
    }
    try {
        const url = new URL(connectionString);
        // Check protocol
        if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
            errors.push('Connection string must use postgresql:// or postgres:// protocol');
        }
        // Check required components
        if (!url.hostname) {
            errors.push('Connection string must include a hostname');
        }
        if (!url.username) {
            errors.push('Connection string must include a username');
        }
        if (!url.pathname || url.pathname === '/') {
            errors.push('Connection string must include a database name');
        }
        // Validate username format if present
        if (url.username && !isValidUsername(url.username)) {
            errors.push(`Invalid username format in connection string: ${url.username}`);
        }
        // Check for masked password placeholder
        const hasMaskedPassword = url.password === '[YOUR_PASSWORD]';
        const hasActualPassword = url.password && url.password !== '[YOUR_PASSWORD]';
        if (!hasMaskedPassword && !hasActualPassword) {
            errors.push('Connection string must include either a password or [YOUR_PASSWORD] placeholder');
        }
        // Validate port if present
        if (url.port) {
            const portNum = parseInt(url.port, 10);
            if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
                errors.push('Port must be a valid number between 1 and 65535');
            }
        }
        const components = {
            user: url.username || undefined,
            password: url.password || undefined,
            host: url.hostname || undefined,
            port: url.port ? parseInt(url.port, 10) : undefined,
            database: url.pathname.slice(1) || undefined,
        };
        return {
            isValid: errors.length === 0,
            errors,
            components
        };
    }
    catch (error) {
        errors.push('Invalid connection string format');
        return { isValid: false, errors };
    }
}
/**
 * Parses a PostgreSQL connection string with enhanced fallback scenario handling
 *
 * @param connectionString - The connection string to parse
 * @param options - Parsing options
 * @returns Enhanced parsed connection string components with validation
 */
function parseConnectionStringWithFallback(connectionString, options = {}) {
    const { validateFormat = true, allowMaskedPassword = true } = options;
    if (!connectionString || connectionString.trim() === '') {
        return {
            isValid: false,
            errors: ['Connection string cannot be empty']
        };
    }
    try {
        const url = new URL(connectionString);
        const decodedPassword = url.password ? decodeURIComponent(url.password) : undefined;
        const result = {
            user: url.username || undefined,
            password: decodedPassword,
            host: url.hostname || undefined,
            port: url.port ? parseInt(url.port, 10) : undefined,
            database: url.pathname.slice(1) || undefined, // Remove leading slash
            hasMaskedPassword: decodedPassword === '[YOUR_PASSWORD]',
            isValid: true,
            errors: []
        };
        // Perform validation if requested
        if (validateFormat) {
            const validation = validateConnectionStringFormat(connectionString);
            result.isValid = validation.isValid;
            result.errors = validation.errors;
            // Allow masked passwords if specified
            if (!validation.isValid && allowMaskedPassword && result.hasMaskedPassword) {
                // Remove password-related errors when masked password is allowed
                result.errors = validation.errors.filter(error => !error.includes('password') && !error.includes('PASSWORD'));
                result.isValid = result.errors.length === 0;
            }
        }
        return result;
    }
    catch (error) {
        return {
            isValid: false,
            errors: ['Invalid connection string format']
        };
    }
}
/**
 * Parses a PostgreSQL connection string to extract database name and other components
 *
 * @param connectionString - The connection string to parse
 * @returns Parsed connection string components
 */
function parseConnectionString(connectionString) {
    try {
        const url = new URL(connectionString);
        return {
            user: url.username || undefined,
            password: url.password || undefined,
            host: url.hostname || undefined,
            port: url.port ? parseInt(url.port, 10) : undefined,
            database: url.pathname.slice(1) || undefined, // Remove leading slash
        };
    }
    catch {
        return {};
    }
}
