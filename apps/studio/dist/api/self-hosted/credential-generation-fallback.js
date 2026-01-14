"use strict";
/**
 * Fallback strategies for credential generation failures.
 * Implements alternative approaches when primary generation methods fail.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FALLBACK_CONFIG = exports.FallbackStrategy = void 0;
exports.generateCredentialWithFallback = generateCredentialWithFallback;
exports.generateCredentialWithFallbackSupport = generateCredentialWithFallbackSupport;
exports.getFallbackStrategyDescription = getFallbackStrategyDescription;
const crypto_1 = require("crypto");
const enhanced_credential_generation_1 = require("./enhanced-credential-generation");
const database_naming_1 = require("./database-naming");
const database_user_manager_1 = require("./database-user-manager");
/**
 * Fallback strategy types
 */
var FallbackStrategy;
(function (FallbackStrategy) {
    FallbackStrategy["SIMPLIFIED_NAMING"] = "SIMPLIFIED_NAMING";
    FallbackStrategy["EXTENDED_RETRY"] = "EXTENDED_RETRY";
    FallbackStrategy["OFFLINE_GENERATION"] = "OFFLINE_GENERATION";
    FallbackStrategy["TIMESTAMP_BASED"] = "TIMESTAMP_BASED";
    FallbackStrategy["UUID_BASED"] = "UUID_BASED";
})(FallbackStrategy || (exports.FallbackStrategy = FallbackStrategy = {}));
/**
 * Default fallback configuration
 */
exports.DEFAULT_FALLBACK_CONFIG = {
    enabledStrategies: [
        FallbackStrategy.SIMPLIFIED_NAMING,
        FallbackStrategy.EXTENDED_RETRY,
        FallbackStrategy.TIMESTAMP_BASED,
        FallbackStrategy.UUID_BASED,
    ],
    maxFallbackAttempts: 3,
    extendedRetryMultiplier: 2,
    offlineGenerationEnabled: true,
};
/**
 * Generates a simplified database name using timestamp-based approach
 */
function generateSimplifiedDatabaseName(basePrefix = 'proj') {
    const timestamp = Date.now().toString(36);
    const random = (0, enhanced_credential_generation_1.generateSecureRandomString)(6);
    return `${basePrefix}_${timestamp}_${random}`;
}
/**
 * Generates a simplified username using timestamp-based approach
 */
function generateSimplifiedUsername(basePrefix = 'user') {
    const timestamp = Date.now().toString(36);
    const random = (0, enhanced_credential_generation_1.generateSecureRandomString)(6);
    return `${basePrefix}_${timestamp}_${random}`;
}
/**
 * Generates a UUID-based database name
 */
function generateUuidBasedDatabaseName() {
    // Generate a UUID-like string using crypto.randomBytes
    const bytes = (0, crypto_1.randomBytes)(16);
    const hex = bytes.toString('hex');
    // Format as UUID-like string but database-safe
    const uuid = [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join('_');
    return `db_${uuid}`;
}
/**
 * Generates a UUID-based username
 */
function generateUuidBasedUsername() {
    // Generate a UUID-like string using crypto.randomBytes
    const bytes = (0, crypto_1.randomBytes)(16);
    const hex = bytes.toString('hex');
    // Format as UUID-like string but database-safe
    const uuid = [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join('_');
    return `usr_${uuid}`;
}
/**
 * Sanitizes a project name for fallback generation
 */
function sanitizeProjectNameForFallback(projectName) {
    if (!projectName || typeof projectName !== 'string') {
        return 'proj';
    }
    let sanitized = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_')
        .slice(0, 10); // Limit length for fallback
    // Ensure it doesn't start with a number
    if (/^[0-9]/.test(sanitized)) {
        sanitized = 'p_' + sanitized;
    }
    // If sanitization resulted in empty string, use default
    if (!sanitized) {
        sanitized = 'proj';
    }
    return sanitized;
}
/**
 * Implements simplified naming fallback strategy
 */
async function applySimplifiedNamingStrategy(projectName, type, attempts = 1) {
    try {
        const sanitizedName = sanitizeProjectNameForFallback(projectName);
        let generatedName;
        if (type === 'database') {
            generatedName = generateSimplifiedDatabaseName(sanitizedName);
            (0, database_naming_1.validateDatabaseName)(generatedName);
        }
        else {
            generatedName = generateSimplifiedUsername(sanitizedName);
            (0, database_user_manager_1.validateUsername)(generatedName);
        }
        return {
            success: true,
            name: generatedName,
            strategy: FallbackStrategy.SIMPLIFIED_NAMING,
            attempts,
        };
    }
    catch (error) {
        return {
            success: false,
            strategy: FallbackStrategy.SIMPLIFIED_NAMING,
            attempts,
            error: error instanceof enhanced_credential_generation_1.CredentialGenerationError ? error : new enhanced_credential_generation_1.CredentialGenerationError(enhanced_credential_generation_1.CredentialGenerationErrorCode.GENERATION_FAILED, `Simplified naming strategy failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { strategy: FallbackStrategy.SIMPLIFIED_NAMING, attempts }),
        };
    }
}
/**
 * Implements timestamp-based fallback strategy
 */
async function applyTimestampBasedStrategy(type, attempts = 1) {
    try {
        let generatedName;
        if (type === 'database') {
            generatedName = generateSimplifiedDatabaseName('db');
            (0, database_naming_1.validateDatabaseName)(generatedName);
        }
        else {
            generatedName = generateSimplifiedUsername('usr');
            (0, database_user_manager_1.validateUsername)(generatedName);
        }
        return {
            success: true,
            name: generatedName,
            strategy: FallbackStrategy.TIMESTAMP_BASED,
            attempts,
        };
    }
    catch (error) {
        return {
            success: false,
            strategy: FallbackStrategy.TIMESTAMP_BASED,
            attempts,
            error: error instanceof enhanced_credential_generation_1.CredentialGenerationError ? error : new enhanced_credential_generation_1.CredentialGenerationError(enhanced_credential_generation_1.CredentialGenerationErrorCode.GENERATION_FAILED, `Timestamp-based strategy failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { strategy: FallbackStrategy.TIMESTAMP_BASED, attempts }),
        };
    }
}
/**
 * Implements UUID-based fallback strategy
 */
async function applyUuidBasedStrategy(type, attempts = 1) {
    try {
        let generatedName;
        if (type === 'database') {
            generatedName = generateUuidBasedDatabaseName();
            (0, database_naming_1.validateDatabaseName)(generatedName);
        }
        else {
            generatedName = generateUuidBasedUsername();
            (0, database_user_manager_1.validateUsername)(generatedName);
        }
        return {
            success: true,
            name: generatedName,
            strategy: FallbackStrategy.UUID_BASED,
            attempts,
        };
    }
    catch (error) {
        return {
            success: false,
            strategy: FallbackStrategy.UUID_BASED,
            attempts,
            error: error instanceof enhanced_credential_generation_1.CredentialGenerationError ? error : new enhanced_credential_generation_1.CredentialGenerationError(enhanced_credential_generation_1.CredentialGenerationErrorCode.GENERATION_FAILED, `UUID-based strategy failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { strategy: FallbackStrategy.UUID_BASED, attempts }),
        };
    }
}
/**
 * Applies a specific fallback strategy
 */
async function applyFallbackStrategy(strategy, projectName, type, attempts = 1) {
    console.log(`Applying fallback strategy: ${strategy} for ${type} (attempt ${attempts})`);
    switch (strategy) {
        case FallbackStrategy.SIMPLIFIED_NAMING:
            return applySimplifiedNamingStrategy(projectName, type, attempts);
        case FallbackStrategy.TIMESTAMP_BASED:
            return applyTimestampBasedStrategy(type, attempts);
        case FallbackStrategy.UUID_BASED:
            return applyUuidBasedStrategy(type, attempts);
        case FallbackStrategy.EXTENDED_RETRY:
            // Extended retry is handled by the main generation function
            // This is just a placeholder
            return {
                success: false,
                strategy: FallbackStrategy.EXTENDED_RETRY,
                attempts,
                error: new enhanced_credential_generation_1.CredentialGenerationError(enhanced_credential_generation_1.CredentialGenerationErrorCode.GENERATION_FAILED, 'Extended retry strategy should be handled by main generation function', { strategy: FallbackStrategy.EXTENDED_RETRY }),
            };
        case FallbackStrategy.OFFLINE_GENERATION:
            // Offline generation uses simplified naming without uniqueness checks
            return applySimplifiedNamingStrategy(projectName, type, attempts);
        default:
            return {
                success: false,
                strategy,
                attempts,
                error: new enhanced_credential_generation_1.CredentialGenerationError(enhanced_credential_generation_1.CredentialGenerationErrorCode.GENERATION_FAILED, `Unknown fallback strategy: ${strategy}`, { strategy }),
            };
    }
}
/**
 * Main fallback generation function that tries multiple strategies
 */
async function generateCredentialWithFallback(projectName, type, originalError, config = exports.DEFAULT_FALLBACK_CONFIG) {
    console.log(`Starting fallback generation for ${type} due to error: ${originalError.code}`);
    // Determine which strategies to try based on the original error
    let strategiesToTry = [];
    switch (originalError.code) {
        case enhanced_credential_generation_1.CredentialGenerationErrorCode.INVALID_PROJECT_NAME:
            strategiesToTry = [
                FallbackStrategy.SIMPLIFIED_NAMING,
                FallbackStrategy.TIMESTAMP_BASED,
                FallbackStrategy.UUID_BASED,
            ];
            break;
        case enhanced_credential_generation_1.CredentialGenerationErrorCode.RETRY_EXHAUSTED:
            strategiesToTry = [
                FallbackStrategy.UUID_BASED,
                FallbackStrategy.TIMESTAMP_BASED,
            ];
            break;
        case enhanced_credential_generation_1.CredentialGenerationErrorCode.UNIQUENESS_CHECK_FAILED:
            if (config.offlineGenerationEnabled) {
                strategiesToTry = [FallbackStrategy.OFFLINE_GENERATION];
            }
            else {
                strategiesToTry = [
                    FallbackStrategy.UUID_BASED,
                    FallbackStrategy.TIMESTAMP_BASED,
                ];
            }
            break;
        case enhanced_credential_generation_1.CredentialGenerationErrorCode.GENERATION_FAILED:
            strategiesToTry = [
                FallbackStrategy.SIMPLIFIED_NAMING,
                FallbackStrategy.TIMESTAMP_BASED,
                FallbackStrategy.UUID_BASED,
            ];
            break;
        default:
            strategiesToTry = config.enabledStrategies;
    }
    // Filter strategies to only those that are enabled
    strategiesToTry = strategiesToTry.filter(strategy => config.enabledStrategies.includes(strategy));
    let lastError = originalError;
    let totalAttempts = 0;
    // Try each strategy
    for (const strategy of strategiesToTry) {
        if (totalAttempts >= config.maxFallbackAttempts) {
            console.log(`Reached maximum fallback attempts (${config.maxFallbackAttempts})`);
            break;
        }
        totalAttempts++;
        const result = await applyFallbackStrategy(strategy, projectName, type, totalAttempts);
        if (result.success) {
            console.log(`Fallback generation succeeded with strategy: ${strategy}`);
            return result;
        }
        if (result.error) {
            lastError = result.error;
        }
        console.log(`Fallback strategy ${strategy} failed, trying next strategy`);
    }
    // All fallback strategies failed
    console.error(`All fallback strategies failed for ${type} generation`);
    return {
        success: false,
        attempts: totalAttempts,
        error: new enhanced_credential_generation_1.CredentialGenerationError(enhanced_credential_generation_1.CredentialGenerationErrorCode.GENERATION_FAILED, `All fallback strategies failed. Last error: ${lastError.message}`, {
            originalError: originalError.code,
            strategiesTried: strategiesToTry,
            totalAttempts,
            lastError: lastError.message,
        }),
    };
}
/**
 * Enhanced credential generation with integrated fallback support
 */
async function generateCredentialWithFallbackSupport(projectName, type, primaryGenerationFn, config = exports.DEFAULT_FALLBACK_CONFIG) {
    try {
        // Try primary generation first
        const name = await primaryGenerationFn();
        return { name, usedFallback: false };
    }
    catch (error) {
        console.log(`Primary ${type} generation failed, attempting fallback`);
        if (!(error instanceof enhanced_credential_generation_1.CredentialGenerationError)) {
            // Convert unknown errors to CredentialGenerationError
            const credentialError = new enhanced_credential_generation_1.CredentialGenerationError(enhanced_credential_generation_1.CredentialGenerationErrorCode.GENERATION_FAILED, error instanceof Error ? error.message : 'Unknown error during primary generation', { originalError: error });
            const fallbackResult = await generateCredentialWithFallback(projectName, type, credentialError, config);
            if (fallbackResult.success && fallbackResult.name) {
                return {
                    name: fallbackResult.name,
                    usedFallback: true,
                    strategy: fallbackResult.strategy
                };
            }
            throw fallbackResult.error || credentialError;
        }
        // Try fallback generation
        const fallbackResult = await generateCredentialWithFallback(projectName, type, error, config);
        if (fallbackResult.success && fallbackResult.name) {
            return {
                name: fallbackResult.name,
                usedFallback: true,
                strategy: fallbackResult.strategy
            };
        }
        // Both primary and fallback failed
        throw fallbackResult.error || error;
    }
}
/**
 * Gets a description of what a fallback strategy does
 */
function getFallbackStrategyDescription(strategy) {
    switch (strategy) {
        case FallbackStrategy.SIMPLIFIED_NAMING:
            return 'Uses a simplified version of the project name with timestamp and random components';
        case FallbackStrategy.EXTENDED_RETRY:
            return 'Increases retry attempts with longer random strings to avoid conflicts';
        case FallbackStrategy.OFFLINE_GENERATION:
            return 'Generates credentials without checking uniqueness (used when database is unavailable)';
        case FallbackStrategy.TIMESTAMP_BASED:
            return 'Uses current timestamp with random components for maximum uniqueness';
        case FallbackStrategy.UUID_BASED:
            return 'Uses UUID-like identifiers for guaranteed uniqueness';
        default:
            return 'Unknown fallback strategy';
    }
}
