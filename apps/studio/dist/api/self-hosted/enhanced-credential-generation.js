"use strict";
/**
 * Enhanced credential generation service with collision detection and retry logic.
 * Implements cryptographically secure random string generation and uniqueness checking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedCredentialGenerationService = exports.EnhancedCredentialGenerationService = exports.CredentialGenerationError = exports.CredentialGenerationErrorCode = exports.DEFAULT_CREDENTIAL_CONFIG = void 0;
exports.generateSecureRandomString = generateSecureRandomString;
exports.validateUniqueness = validateUniqueness;
exports.generateDatabaseNameWithCollisionDetection = generateDatabaseNameWithCollisionDetection;
exports.generateUsernameWithCollisionDetection = generateUsernameWithCollisionDetection;
exports.getEnhancedCredentialGenerationService = getEnhancedCredentialGenerationService;
const crypto_1 = require("crypto");
const database_naming_1 = require("./database-naming");
const database_user_manager_1 = require("./database-user-manager");
const database_manager_1 = require("./database-manager");
/**
 * Default configuration for credential generation
 */
exports.DEFAULT_CREDENTIAL_CONFIG = {
    maxRetries: 5,
    randomStringLength: 4, // Shorter random strings for new naming format
    useTimestamp: false, // No timestamp needed with new format
    conflictCheckEnabled: true,
};
/**
 * Error codes for credential generation
 */
var CredentialGenerationErrorCode;
(function (CredentialGenerationErrorCode) {
    CredentialGenerationErrorCode["RETRY_EXHAUSTED"] = "RETRY_EXHAUSTED";
    CredentialGenerationErrorCode["INVALID_PROJECT_NAME"] = "INVALID_PROJECT_NAME";
    CredentialGenerationErrorCode["GENERATION_FAILED"] = "GENERATION_FAILED";
    CredentialGenerationErrorCode["UNIQUENESS_CHECK_FAILED"] = "UNIQUENESS_CHECK_FAILED";
})(CredentialGenerationErrorCode || (exports.CredentialGenerationErrorCode = CredentialGenerationErrorCode = {}));
/**
 * Custom error class for credential generation operations
 */
class CredentialGenerationError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'CredentialGenerationError';
    }
}
exports.CredentialGenerationError = CredentialGenerationError;
/**
 * Generates a cryptographically secure random string
 *
 * @param length - Length of the random string to generate
 * @returns Cryptographically secure random string using lowercase letters and numbers
 */
function generateSecureRandomString(length) {
    if (length <= 0) {
        throw new Error('Length must be positive');
    }
    // Use crypto.randomBytes for cryptographically secure randomness
    const bytes = (0, crypto_1.randomBytes)(Math.ceil(length * 0.75)); // Need more bytes than final length due to base36 encoding
    // Convert to base36 (0-9, a-z) and take only the required length
    const randomString = bytes.toString('hex').slice(0, length);
    // Ensure we have exactly the requested length by padding with secure random if needed
    if (randomString.length < length) {
        const additionalBytes = (0, crypto_1.randomBytes)(length - randomString.length);
        return randomString + additionalBytes.toString('hex').slice(0, length - randomString.length);
    }
    return randomString.slice(0, length);
}
/**
 * Sanitizes a project name for use in credential generation
 *
 * @param projectName - The project name to sanitize
 * @returns Sanitized project name suitable for credential generation
 */
function sanitizeProjectName(projectName) {
    if (!projectName || typeof projectName !== 'string') {
        throw new CredentialGenerationError(CredentialGenerationErrorCode.INVALID_PROJECT_NAME, 'Project name is required and must be a string');
    }
    let sanitized = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        .replace(/_+/g, '_'); // Replace multiple underscores with single
    // Ensure it doesn't start with a number
    if (/^[0-9]/.test(sanitized)) {
        sanitized = 'proj_' + sanitized;
    }
    // If sanitization resulted in empty string, use default
    if (!sanitized) {
        sanitized = 'proj';
    }
    return sanitized;
}
/**
 * Validates uniqueness of a credential name
 *
 * @param name - The name to check for uniqueness
 * @param type - Type of credential ('database' or 'username')
 * @returns Promise resolving to true if unique, false if conflict exists
 */
async function validateUniqueness(name, type) {
    try {
        if (type === 'database') {
            const existsResult = await (0, database_manager_1.databaseExists)(name);
            if (existsResult.error) {
                throw new CredentialGenerationError(CredentialGenerationErrorCode.UNIQUENESS_CHECK_FAILED, `Failed to check database uniqueness: ${existsResult.error.message}`, { name, type });
            }
            return !existsResult.data;
        }
        else if (type === 'username') {
            const existsResult = await (0, database_user_manager_1.userExists)(name);
            if (existsResult.error) {
                throw new CredentialGenerationError(CredentialGenerationErrorCode.UNIQUENESS_CHECK_FAILED, `Failed to check username uniqueness: ${existsResult.error.message}`, { name, type });
            }
            return !existsResult.data;
        }
        return false;
    }
    catch (error) {
        if (error instanceof CredentialGenerationError) {
            throw error;
        }
        throw new CredentialGenerationError(CredentialGenerationErrorCode.UNIQUENESS_CHECK_FAILED, `Unexpected error during uniqueness check: ${error instanceof Error ? error.message : 'Unknown error'}`, { name, type });
    }
}
/**
 * Enhanced database name generation with collision detection and retry logic
 * Uses format: db_projectname_xxxx
 *
 * @param projectName - The project name to base the database name on
 * @param existingNames - Optional array of existing names to avoid (for additional conflict checking)
 * @param config - Configuration options for generation
 * @returns Promise resolving to unique database name
 */
async function generateDatabaseNameWithCollisionDetection(projectName, existingNames = [], config = exports.DEFAULT_CREDENTIAL_CONFIG) {
    const sanitizedProjectName = sanitizeProjectName(projectName);
    let attempts = 0;
    while (attempts < config.maxRetries) {
        attempts++;
        try {
            // Generate short random component (4-6 characters)
            const randomComponent = generateSecureRandomString(4);
            // Calculate available space for project name
            // Format: db_projectname_xxxx
            // Total length limit: 63 characters
            // Used: 'db_' (3) + '_' (1) + random (4) = 8 characters
            const maxProjectNameLength = 63 - 8;
            // Truncate project name if necessary
            const truncatedProjectName = sanitizedProjectName.length > maxProjectNameLength
                ? sanitizedProjectName.substring(0, maxProjectNameLength)
                : sanitizedProjectName;
            // Create database name with new format: db_projectname_xxxx
            const candidateName = `db_${truncatedProjectName}_${randomComponent}`;
            // Ensure the name meets PostgreSQL naming requirements
            (0, database_naming_1.validateDatabaseName)(candidateName);
            // Check against provided existing names
            if (existingNames.includes(candidateName)) {
                console.log(`Database name collision with provided list on attempt ${attempts}: ${candidateName}`);
                continue;
            }
            // Check uniqueness in the database if conflict checking is enabled
            if (config.conflictCheckEnabled) {
                const isUnique = await validateUniqueness(candidateName, 'database');
                if (!isUnique) {
                    console.log(`Database name collision detected on attempt ${attempts}: ${candidateName}`);
                    continue;
                }
            }
            console.log(`Generated unique database name on attempt ${attempts}: ${candidateName}`);
            return candidateName;
        }
        catch (error) {
            console.error(`Database name generation attempt ${attempts} failed:`, error);
            // If this is a validation error and we're on the last attempt, throw it
            if (attempts >= config.maxRetries) {
                if (error instanceof Error && error.message.includes('Database name')) {
                    throw new CredentialGenerationError(CredentialGenerationErrorCode.GENERATION_FAILED, `Failed to generate valid database name after ${attempts} attempts: ${error.message}`, { projectName, attempts });
                }
            }
            // Continue to next attempt for other errors
        }
    }
    // If we've exhausted all retries
    throw new CredentialGenerationError(CredentialGenerationErrorCode.RETRY_EXHAUSTED, `Failed to generate unique database name after ${config.maxRetries} attempts`, { projectName, attempts: config.maxRetries });
}
/**
 * Enhanced username generation with collision detection and retry logic
 * Uses format: user_projectname_xxxx
 *
 * @param projectName - The project name to base the username on
 * @param existingUsernames - Optional array of existing usernames to avoid (for additional conflict checking)
 * @param config - Configuration options for generation
 * @returns Promise resolving to unique username
 */
async function generateUsernameWithCollisionDetection(projectName, existingUsernames = [], config = exports.DEFAULT_CREDENTIAL_CONFIG) {
    const sanitizedProjectName = sanitizeProjectName(projectName);
    let attempts = 0;
    while (attempts < config.maxRetries) {
        attempts++;
        try {
            // Generate short random component (4-6 characters)
            const randomComponent = generateSecureRandomString(4);
            // Calculate available space for project name
            // Format: user_projectname_xxxx
            // Total length limit: 63 characters
            // Used: 'user_' (5) + '_' (1) + random (4) = 10 characters
            const maxProjectNameLength = 63 - 10;
            // Truncate project name if necessary
            const truncatedProjectName = sanitizedProjectName.length > maxProjectNameLength
                ? sanitizedProjectName.substring(0, maxProjectNameLength)
                : sanitizedProjectName;
            // Create username with new format: user_projectname_xxxx
            const candidateUsername = `user_${truncatedProjectName}_${randomComponent}`;
            // Ensure the username meets PostgreSQL naming requirements
            (0, database_user_manager_1.validateUsername)(candidateUsername);
            // Check against provided existing usernames
            if (existingUsernames.includes(candidateUsername)) {
                console.log(`Username collision with provided list on attempt ${attempts}: ${candidateUsername}`);
                continue;
            }
            // Check uniqueness in the database if conflict checking is enabled
            if (config.conflictCheckEnabled) {
                const isUnique = await validateUniqueness(candidateUsername, 'username');
                if (!isUnique) {
                    console.log(`Username collision detected on attempt ${attempts}: ${candidateUsername}`);
                    continue;
                }
            }
            console.log(`Generated unique username on attempt ${attempts}: ${candidateUsername}`);
            return candidateUsername;
        }
        catch (error) {
            console.error(`Username generation attempt ${attempts} failed:`, error);
            // If this is a validation error and we're on the last attempt, throw it
            if (attempts >= config.maxRetries) {
                if (error instanceof Error && error.message.includes('Username')) {
                    throw new CredentialGenerationError(CredentialGenerationErrorCode.GENERATION_FAILED, `Failed to generate valid username after ${attempts} attempts: ${error.message}`, { projectName, attempts });
                }
            }
            // Continue to next attempt for other errors
        }
    }
    // If we've exhausted all retries
    throw new CredentialGenerationError(CredentialGenerationErrorCode.RETRY_EXHAUSTED, `Failed to generate unique username after ${config.maxRetries} attempts`, { projectName, attempts: config.maxRetries });
}
/**
 * Enhanced credential generation service implementation
 */
class EnhancedCredentialGenerationService {
    constructor(config = exports.DEFAULT_CREDENTIAL_CONFIG) {
        this.config = config;
    }
    /**
     * Generates a unique database name with collision detection
     */
    async generateDatabaseName(projectName, existingNames) {
        return generateDatabaseNameWithCollisionDetection(projectName, existingNames, this.config);
    }
    /**
     * Generates a unique username with collision detection
     */
    async generateUsername(projectName, existingUsernames) {
        return generateUsernameWithCollisionDetection(projectName, existingUsernames, this.config);
    }
    /**
     * Validates uniqueness of a credential name
     */
    async validateUniqueness(name, type) {
        return validateUniqueness(name, type);
    }
    /**
     * Generates a cryptographically secure random string
     */
    generateSecureRandomString(length) {
        return generateSecureRandomString(length);
    }
}
exports.EnhancedCredentialGenerationService = EnhancedCredentialGenerationService;
/**
 * Default instance of the enhanced credential generation service
 */
exports.enhancedCredentialGenerationService = new EnhancedCredentialGenerationService();
/**
 * Convenience function to get the enhanced credential generation service
 */
function getEnhancedCredentialGenerationService(config) {
    if (config) {
        return new EnhancedCredentialGenerationService(config);
    }
    return exports.enhancedCredentialGenerationService;
}
