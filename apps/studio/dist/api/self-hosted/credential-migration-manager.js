"use strict";
/**
 * Credential Migration System for handling missing project credentials.
 * Provides functionality to detect, migrate, and generate project-specific credentials for legacy projects.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CredentialMigrationManager = void 0;
exports.getCredentialMigrationManager = getCredentialMigrationManager;
exports.resetCredentialMigrationManager = resetCredentialMigrationManager;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const project_store_1 = require("./project-store");
const credential_fallback_manager_1 = require("./credential-fallback-manager");
const credential_validation_1 = require("./credential-validation");
const credential_error_handling_1 = require("./credential-error-handling");
/**
 * Default credential generation configuration
 */
const DEFAULT_GENERATION_OPTIONS = {
    userPrefix: 'proj_',
    userSuffix: '_user',
    passwordLength: 24,
    includeSpecialChars: true,
    excludeSimilarChars: true
};
/**
 * Credential Migration Manager class
 * Handles detection, generation, and migration of project credentials
 */
class CredentialMigrationManager {
    constructor() {
        this.fallbackManager = (0, credential_fallback_manager_1.getCredentialFallbackManager)();
    }
    /**
     * Detects projects with missing credentials with comprehensive error handling
     *
     * @returns Array of project references that have missing credentials
     */
    async detectProjectsWithMissingCredentials() {
        const errorHandler = (0, credential_error_handling_1.getCredentialErrorHandler)();
        try {
            const result = await errorHandler.executeWithErrorHandling(async () => {
                const projectsResult = await (0, project_store_1.findAll)();
                if (projectsResult.error) {
                    throw credential_error_handling_1.CredentialError.database(`Failed to fetch projects: ${projectsResult.error.message}`, { operation: 'detectProjectsWithMissingCredentials' }, projectsResult.error);
                }
                const projectsWithMissingCredentials = [];
                for (const project of projectsResult.data) {
                    const credentials = this.fallbackManager.getProjectCredentials(project.ref, project.database_user, project.database_password_hash);
                    if (this.fallbackManager.shouldUseFallback(credentials)) {
                        projectsWithMissingCredentials.push(project.ref);
                    }
                }
                return projectsWithMissingCredentials;
            }, {
                serviceName: 'credential-migration',
                context: 'detectProjectsWithMissingCredentials',
                enableRetry: true,
                enableCircuitBreaker: true,
                enableGracefulDegradation: true,
                fallbackFn: async () => {
                    console.warn('[Credential Migration] Using fallback detection method');
                    // Fallback: return empty array if we can't detect projects
                    return [];
                }
            });
            return { data: result, error: undefined };
        }
        catch (error) {
            const credentialError = credential_error_handling_1.CredentialError.fromError(error instanceof Error ? error : new Error(String(error)), { operation: 'detectProjectsWithMissingCredentials' });
            return {
                data: undefined,
                error: credentialError
            };
        }
    }
    /**
     * Gets detailed migration statistics
     *
     * @returns Detailed statistics about project credential status
     */
    async getMigrationStats() {
        try {
            const projectsResult = await (0, project_store_1.findAll)();
            if (projectsResult.error) {
                return { data: undefined, error: projectsResult.error };
            }
            const stats = {
                totalProjects: projectsResult.data.length,
                projectsWithMissingCredentials: 0,
                projectsWithMissingUser: 0,
                projectsWithMissingPassword: 0,
                projectsWithBothMissing: 0,
                projectsComplete: 0
            };
            for (const project of projectsResult.data) {
                const credentials = this.fallbackManager.getProjectCredentials(project.ref, project.database_user, project.database_password_hash);
                if (credentials.isComplete) {
                    stats.projectsComplete++;
                }
                else {
                    stats.projectsWithMissingCredentials++;
                    const missingUser = !credentials.user;
                    const missingPassword = !credentials.passwordHash;
                    if (missingUser && missingPassword) {
                        stats.projectsWithBothMissing++;
                    }
                    else if (missingUser) {
                        stats.projectsWithMissingUser++;
                    }
                    else if (missingPassword) {
                        stats.projectsWithMissingPassword++;
                    }
                }
            }
            return { data: stats, error: undefined };
        }
        catch (error) {
            return {
                data: undefined,
                error: new Error(`Failed to get migration statistics: ${error instanceof Error ? error.message : 'Unknown error'}`)
            };
        }
    }
    /**
     * Generates secure project-specific credentials
     *
     * @param projectRef - Project reference identifier
     * @param options - Credential generation options
     * @returns Generated project credentials
     */
    async generateProjectCredentials(projectRef, options = {}) {
        try {
            const finalOptions = { ...DEFAULT_GENERATION_OPTIONS, ...options };
            // Generate username
            const sanitizedRef = projectRef.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const username = `${finalOptions.userPrefix}${sanitizedRef}${finalOptions.userSuffix}`;
            // Generate secure password
            const password = this.generateSecurePassword(finalOptions);
            // Hash the password for storage
            const saltRounds = 12;
            const passwordHash = bcryptjs_1.default.hashSync(password, saltRounds);
            const credentials = {
                user: username,
                passwordHash: passwordHash,
                isComplete: true
            };
            // Validate generated credentials
            const validation = await (0, credential_validation_1.validateProjectCredentials)(credentials, {
                requireComplete: true
            });
            if (!validation.isValid) {
                const errorMessages = [
                    ...validation.userValidation.errors,
                    ...validation.passwordValidation.errors,
                    ...validation.overallErrors
                ];
                return {
                    data: undefined,
                    error: new Error(`Generated credentials failed validation: ${errorMessages.join(', ')}`)
                };
            }
            return { data: credentials, error: undefined };
        }
        catch (error) {
            return {
                data: undefined,
                error: new Error(`Failed to generate project credentials: ${error instanceof Error ? error.message : 'Unknown error'}`)
            };
        }
    }
    /**
     * Migrates credentials for a single project
     *
     * @param projectRef - Project reference identifier
     * @param options - Credential generation options
     * @returns Migration result for the project
     */
    async migrateProjectCredentials(projectRef, options = {}) {
        try {
            // First, check if the project exists and needs migration
            const projectsResult = await (0, project_store_1.findAll)();
            if (projectsResult.error) {
                return {
                    data: undefined,
                    error: projectsResult.error
                };
            }
            const project = projectsResult.data.find(p => p.ref === projectRef);
            if (!project) {
                const result = {
                    success: false,
                    projectRef,
                    error: `Project with ref "${projectRef}" not found`
                };
                return { data: result, error: undefined };
            }
            // Check if project already has complete credentials
            const existingCredentials = this.fallbackManager.getProjectCredentials(project.ref, project.database_user, project.database_password_hash);
            if (existingCredentials.isComplete) {
                const result = {
                    success: true,
                    projectRef,
                    generatedCredentials: existingCredentials,
                    error: 'Project already has complete credentials'
                };
                return { data: result, error: undefined };
            }
            // Generate new credentials
            const credentialsResult = await this.generateProjectCredentials(projectRef, options);
            if (credentialsResult.error) {
                const result = {
                    success: false,
                    projectRef,
                    error: credentialsResult.error.message
                };
                return { data: result, error: undefined };
            }
            const newCredentials = credentialsResult.data;
            // Update the project with new credentials
            const updateResult = await (0, project_store_1.update)(project.id, {
                database_user: newCredentials.user,
                database_password_hash: newCredentials.passwordHash
            });
            if (updateResult.error) {
                const result = {
                    success: false,
                    projectRef,
                    error: `Failed to update project: ${updateResult.error.message}`
                };
                return { data: result, error: undefined };
            }
            // Validate the migration was successful
            const validation = (0, credential_validation_1.validateProjectCredentials)(newCredentials, {
                requireComplete: true
            });
            const result = {
                success: validation.isValid,
                projectRef,
                generatedCredentials: newCredentials,
                validationResult: validation,
                error: validation.isValid ? undefined : 'Generated credentials failed validation'
            };
            // Log validation failures if any
            if (!validation.isValid) {
                (0, credential_validation_1.logValidationFailure)(validation, {
                    projectRef,
                    operation: 'credential migration'
                });
            }
            // Log successful migration
            if (result.success) {
                console.log(`[Credential Migration] Successfully migrated credentials for project: ${projectRef}`);
            }
            return { data: result, error: undefined };
        }
        catch (error) {
            const result = {
                success: false,
                projectRef,
                error: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
            return { data: result, error: undefined };
        }
    }
    /**
     * Migrates credentials for all projects with missing credentials
     *
     * @param options - Credential generation options
     * @param dryRun - If true, only simulate the migration without making changes
     * @returns Batch migration result
     */
    async migrateAllProjectCredentials(options = {}, dryRun = false) {
        try {
            // Get all projects that need migration
            const detectionResult = await this.detectProjectsWithMissingCredentials();
            if (detectionResult.error) {
                return { data: undefined, error: detectionResult.error };
            }
            const projectsToMigrate = detectionResult.data;
            const results = [];
            const migrationErrors = [];
            let successfulMigrations = 0;
            let failedMigrations = 0;
            // Get total project count for statistics
            const allProjectsResult = await (0, project_store_1.findAll)();
            if (allProjectsResult.error) {
                return { data: undefined, error: allProjectsResult.error };
            }
            const totalProjects = allProjectsResult.data.length;
            const projectsAlreadyComplete = totalProjects - projectsToMigrate.length;
            console.log(`[Credential Migration] Starting ${dryRun ? 'dry run' : 'migration'} for ${projectsToMigrate.length} projects`);
            // Migrate each project
            for (const projectRef of projectsToMigrate) {
                if (dryRun) {
                    // For dry run, just generate credentials without saving
                    const credentialsResult = await this.generateProjectCredentials(projectRef, options);
                    const result = {
                        success: !credentialsResult.error,
                        projectRef,
                        generatedCredentials: credentialsResult.data,
                        error: credentialsResult.error?.message
                    };
                    results.push(result);
                    if (result.success) {
                        successfulMigrations++;
                    }
                    else {
                        failedMigrations++;
                        if (result.error) {
                            migrationErrors.push(`${projectRef}: ${result.error}`);
                        }
                    }
                }
                else {
                    // Actual migration
                    const migrationResult = await this.migrateProjectCredentials(projectRef, options);
                    if (migrationResult.error) {
                        const result = {
                            success: false,
                            projectRef,
                            error: migrationResult.error.message
                        };
                        results.push(result);
                        failedMigrations++;
                        migrationErrors.push(`${projectRef}: ${migrationResult.error.message}`);
                    }
                    else {
                        results.push(migrationResult.data);
                        if (migrationResult.data.success) {
                            successfulMigrations++;
                        }
                        else {
                            failedMigrations++;
                            if (migrationResult.data.error) {
                                migrationErrors.push(`${projectRef}: ${migrationResult.data.error}`);
                            }
                        }
                    }
                }
            }
            const batchResult = {
                totalProjects,
                successfulMigrations,
                failedMigrations,
                results,
                summary: {
                    projectsWithMissingCredentials: projectsToMigrate.length,
                    projectsAlreadyComplete,
                    migrationErrors
                }
            };
            console.log(`[Credential Migration] ${dryRun ? 'Dry run' : 'Migration'} completed: ${successfulMigrations} successful, ${failedMigrations} failed`);
            return { data: batchResult, error: undefined };
        }
        catch (error) {
            return {
                data: undefined,
                error: new Error(`Batch migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
            };
        }
    }
    /**
     * Validates existing project credentials
     *
     * @param projectRef - Project reference identifier
     * @returns Validation result for the project's credentials
     */
    async validateExistingCredentials(projectRef) {
        try {
            const projectsResult = await (0, project_store_1.findAll)();
            if (projectsResult.error) {
                return { data: undefined, error: projectsResult.error };
            }
            const project = projectsResult.data.find(p => p.ref === projectRef);
            if (!project) {
                return {
                    data: undefined,
                    error: new Error(`Project with ref "${projectRef}" not found`)
                };
            }
            const credentials = this.fallbackManager.getProjectCredentials(project.ref, project.database_user, project.database_password_hash);
            const validation = (0, credential_validation_1.validateProjectCredentials)(credentials, {
                requireComplete: true
            });
            return { data: validation, error: undefined };
        }
        catch (error) {
            return {
                data: undefined,
                error: new Error(`Failed to validate existing credentials: ${error instanceof Error ? error.message : 'Unknown error'}`)
            };
        }
    }
    /**
     * Generates a secure password with specified options
     *
     * @param options - Password generation options
     * @returns Generated secure password
     */
    generateSecurePassword(options) {
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        // Characters to exclude if excludeSimilarChars is true
        const similarChars = '0O1lI';
        let charset = lowercase + uppercase + numbers;
        if (options.includeSpecialChars) {
            charset += specialChars;
        }
        if (options.excludeSimilarChars) {
            charset = charset.split('').filter(char => !similarChars.includes(char)).join('');
        }
        // Ensure we have at least one character from each required category
        let password = '';
        // Add at least one lowercase
        password += this.getRandomChar(lowercase.split('').filter(char => !options.excludeSimilarChars || !similarChars.includes(char)).join(''));
        // Add at least one uppercase
        password += this.getRandomChar(uppercase.split('').filter(char => !options.excludeSimilarChars || !similarChars.includes(char)).join(''));
        // Add at least one number
        password += this.getRandomChar(numbers.split('').filter(char => !options.excludeSimilarChars || !similarChars.includes(char)).join(''));
        // Add at least one special character if required
        if (options.includeSpecialChars) {
            password += this.getRandomChar(specialChars);
        }
        // Fill the rest of the password length with random characters
        const remainingLength = options.passwordLength - password.length;
        for (let i = 0; i < remainingLength; i++) {
            password += this.getRandomChar(charset);
        }
        // Shuffle the password to avoid predictable patterns
        return this.shuffleString(password);
    }
    /**
     * Gets a cryptographically secure random character from a charset
     *
     * @param charset - Character set to choose from
     * @returns Random character from the charset
     */
    getRandomChar(charset) {
        const randomBytes = crypto_1.default.randomBytes(1);
        const randomIndex = randomBytes[0] % charset.length;
        return charset[randomIndex];
    }
    /**
     * Shuffles a string using cryptographically secure randomness
     *
     * @param str - String to shuffle
     * @returns Shuffled string
     */
    shuffleString(str) {
        const chars = str.split('');
        for (let i = chars.length - 1; i > 0; i--) {
            const randomBytes = crypto_1.default.randomBytes(4);
            const randomIndex = randomBytes.readUInt32BE(0) % (i + 1);
            // Swap characters
            const temp = chars[i];
            chars[i] = chars[randomIndex];
            chars[randomIndex] = temp;
        }
        return chars.join('');
    }
}
exports.CredentialMigrationManager = CredentialMigrationManager;
/**
 * Singleton instance of the CredentialMigrationManager
 */
let credentialMigrationManagerInstance = null;
/**
 * Gets the singleton instance of CredentialMigrationManager
 *
 * @returns CredentialMigrationManager instance
 */
function getCredentialMigrationManager() {
    if (!credentialMigrationManagerInstance) {
        credentialMigrationManagerInstance = new CredentialMigrationManager();
    }
    return credentialMigrationManagerInstance;
}
/**
 * Resets the singleton instance (useful for testing)
 */
function resetCredentialMigrationManager() {
    credentialMigrationManagerInstance = null;
}
