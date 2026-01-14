"use strict";
/**
 * Self-hosted API utilities
 *
 * This module provides utilities for managing self-hosted Supabase instances,
 * including database management, connection string generation, and naming utilities.
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
exports.validateCredentialFormat = exports.validateProjectCredentials = exports.validateCredentialPassword = exports.validateCredentialUsername = exports.createCredentialMonitoringDatabase = exports.CredentialMonitoringDatabase = exports.resetCredentialMonitoringService = exports.getCredentialMonitoringService = exports.CredentialMonitoringService = exports.resetCredentialFallbackManager = exports.getCredentialFallbackManager = exports.CredentialFallbackManager = exports.validateConnectionStringFormat = exports.generateProjectConnectionStringWithVisibility = exports.generateProjectConnectionString = exports.parseConnectionStringWithFallback = exports.parseConnectionString = exports.generateDisplayConnectionStringWithFallback = exports.generateDisplayConnectionString = exports.generateConnectionStringWithFallback = exports.generateConnectionString = exports.DATABASE_NAMING_RULES = exports.DatabaseNamingError = exports.generateDatabaseNameWithCollisionDetection = exports.generateDatabaseName = exports.sanitizeDatabaseName = exports.isValidDatabaseName = exports.validateDatabaseName = exports.DatabaseUserErrorCode = exports.DatabaseUserError = exports.databaseUserManager = exports.generateUsernameWithCollisionDetection = exports.generateUsername = exports.validatePassword = exports.validateUsername = exports.userExists = exports.getUserPermissions = exports.validateUserCredentials = exports.deleteProjectUser = exports.createProjectUser = exports.DatabaseErrorCode = exports.DatabaseError = exports.terminateConnectionsAndWait = exports.terminateConnections = exports.getTemplateDatabaseName = exports.deleteDatabase = exports.listDatabases = exports.databaseExists = exports.createDatabaseWithRetry = exports.createDatabase = void 0;
exports.runIsolationVerification = exports.logUserAccess = exports.verifyUserPermissions = exports.verifyCrossProjectAccessDenial = exports.ProjectStoreErrorCode = exports.ProjectStoreError = exports.deleteProject = exports.updateProject = exports.findProjectsByOwnerUserId = exports.findProjectsByOrganizationId = exports.findProjectByDatabaseName = exports.findProjectByRef = exports.findProjectById = exports.findAllProjects = exports.saveProject = exports.executeQuery = exports.getConnectionString = exports.encryptString = exports.assertSelfHosted = exports.TEMPLATE_DATABASE_NAME = exports.POSTGRES_USER_READ_ONLY = exports.POSTGRES_USER_READ_WRITE = exports.POSTGRES_PASSWORD = exports.POSTGRES_DATABASE = exports.POSTGRES_HOST = exports.POSTGRES_PORT = exports.ENCRYPTION_KEY = exports.FALLBACK_STRATEGIES = exports.CREDENTIAL_GENERATION_STATUS_MESSAGES = exports.CREDENTIAL_GENERATION_ERROR_MESSAGES = exports.getRetryDelay = exports.isRetryableError = exports.getRecoverySuggestions = exports.formatCredentialGenerationError = exports.getCredentialGenerationErrorMessage = exports.getFallbackStrategyDescription = exports.FallbackStrategy = exports.DEFAULT_FALLBACK_CONFIG = exports.generateCredentialWithFallback = exports.generateCredentialWithFallbackSupport = exports.DEFAULT_CREDENTIAL_CONFIG = exports.CredentialGenerationError = exports.validateUniqueness = exports.generateSecureRandomString = exports.getEnhancedCredentialGenerationService = exports.CredentialMigrationManager = exports.resetCredentialMigrationManager = exports.getCredentialMigrationManager = exports.logValidationFailure = exports.generateValidationErrorReport = void 0;
exports.PgMetaDatabaseError = exports.generateIsolationVerificationScript = void 0;
// Database management
var database_manager_1 = require("./database-manager");
Object.defineProperty(exports, "createDatabase", { enumerable: true, get: function () { return database_manager_1.createDatabase; } });
Object.defineProperty(exports, "createDatabaseWithRetry", { enumerable: true, get: function () { return database_manager_1.createDatabaseWithRetry; } });
Object.defineProperty(exports, "databaseExists", { enumerable: true, get: function () { return database_manager_1.databaseExists; } });
Object.defineProperty(exports, "listDatabases", { enumerable: true, get: function () { return database_manager_1.listDatabases; } });
Object.defineProperty(exports, "deleteDatabase", { enumerable: true, get: function () { return database_manager_1.deleteDatabase; } });
Object.defineProperty(exports, "getTemplateDatabaseName", { enumerable: true, get: function () { return database_manager_1.getTemplateDatabaseName; } });
Object.defineProperty(exports, "terminateConnections", { enumerable: true, get: function () { return database_manager_1.terminateConnections; } });
Object.defineProperty(exports, "terminateConnectionsAndWait", { enumerable: true, get: function () { return database_manager_1.terminateConnectionsAndWait; } });
Object.defineProperty(exports, "DatabaseError", { enumerable: true, get: function () { return database_manager_1.DatabaseError; } });
Object.defineProperty(exports, "DatabaseErrorCode", { enumerable: true, get: function () { return database_manager_1.DatabaseErrorCode; } });
// Database user management
var database_user_manager_1 = require("./database-user-manager");
Object.defineProperty(exports, "createProjectUser", { enumerable: true, get: function () { return database_user_manager_1.createProjectUser; } });
Object.defineProperty(exports, "deleteProjectUser", { enumerable: true, get: function () { return database_user_manager_1.deleteProjectUser; } });
Object.defineProperty(exports, "validateUserCredentials", { enumerable: true, get: function () { return database_user_manager_1.validateUserCredentials; } });
Object.defineProperty(exports, "getUserPermissions", { enumerable: true, get: function () { return database_user_manager_1.getUserPermissions; } });
Object.defineProperty(exports, "userExists", { enumerable: true, get: function () { return database_user_manager_1.userExists; } });
Object.defineProperty(exports, "validateUsername", { enumerable: true, get: function () { return database_user_manager_1.validateUsername; } });
Object.defineProperty(exports, "validatePassword", { enumerable: true, get: function () { return database_user_manager_1.validatePassword; } });
Object.defineProperty(exports, "generateUsername", { enumerable: true, get: function () { return database_user_manager_1.generateUsername; } });
Object.defineProperty(exports, "generateUsernameWithCollisionDetection", { enumerable: true, get: function () { return database_user_manager_1.generateUsernameWithCollisionDetection; } });
Object.defineProperty(exports, "databaseUserManager", { enumerable: true, get: function () { return database_user_manager_1.databaseUserManager; } });
Object.defineProperty(exports, "DatabaseUserError", { enumerable: true, get: function () { return database_user_manager_1.DatabaseUserError; } });
Object.defineProperty(exports, "DatabaseUserErrorCode", { enumerable: true, get: function () { return database_user_manager_1.DatabaseUserErrorCode; } });
// Database naming utilities
var database_naming_1 = require("./database-naming");
Object.defineProperty(exports, "validateDatabaseName", { enumerable: true, get: function () { return database_naming_1.validateDatabaseName; } });
Object.defineProperty(exports, "isValidDatabaseName", { enumerable: true, get: function () { return database_naming_1.isValidDatabaseName; } });
Object.defineProperty(exports, "sanitizeDatabaseName", { enumerable: true, get: function () { return database_naming_1.sanitizeDatabaseName; } });
Object.defineProperty(exports, "generateDatabaseName", { enumerable: true, get: function () { return database_naming_1.generateDatabaseName; } });
Object.defineProperty(exports, "generateDatabaseNameWithCollisionDetection", { enumerable: true, get: function () { return database_naming_1.generateDatabaseNameWithCollisionDetection; } });
Object.defineProperty(exports, "DatabaseNamingError", { enumerable: true, get: function () { return database_naming_1.DatabaseNamingError; } });
Object.defineProperty(exports, "DATABASE_NAMING_RULES", { enumerable: true, get: function () { return database_naming_1.DATABASE_NAMING_RULES; } });
// Connection string utilities
var connection_string_1 = require("./connection-string");
Object.defineProperty(exports, "generateConnectionString", { enumerable: true, get: function () { return connection_string_1.generateConnectionString; } });
Object.defineProperty(exports, "generateConnectionStringWithFallback", { enumerable: true, get: function () { return connection_string_1.generateConnectionStringWithFallback; } });
Object.defineProperty(exports, "generateDisplayConnectionString", { enumerable: true, get: function () { return connection_string_1.generateDisplayConnectionString; } });
Object.defineProperty(exports, "generateDisplayConnectionStringWithFallback", { enumerable: true, get: function () { return connection_string_1.generateDisplayConnectionStringWithFallback; } });
Object.defineProperty(exports, "parseConnectionString", { enumerable: true, get: function () { return connection_string_1.parseConnectionString; } });
Object.defineProperty(exports, "parseConnectionStringWithFallback", { enumerable: true, get: function () { return connection_string_1.parseConnectionStringWithFallback; } });
Object.defineProperty(exports, "generateProjectConnectionString", { enumerable: true, get: function () { return connection_string_1.generateProjectConnectionString; } });
Object.defineProperty(exports, "generateProjectConnectionStringWithVisibility", { enumerable: true, get: function () { return connection_string_1.generateProjectConnectionStringWithVisibility; } });
Object.defineProperty(exports, "validateConnectionStringFormat", { enumerable: true, get: function () { return connection_string_1.validateConnectionStringFormat; } });
// Credential fallback management
var credential_fallback_manager_1 = require("./credential-fallback-manager");
Object.defineProperty(exports, "CredentialFallbackManager", { enumerable: true, get: function () { return credential_fallback_manager_1.CredentialFallbackManager; } });
Object.defineProperty(exports, "getCredentialFallbackManager", { enumerable: true, get: function () { return credential_fallback_manager_1.getCredentialFallbackManager; } });
Object.defineProperty(exports, "resetCredentialFallbackManager", { enumerable: true, get: function () { return credential_fallback_manager_1.resetCredentialFallbackManager; } });
var credential_monitoring_service_1 = require("./credential-monitoring-service");
Object.defineProperty(exports, "CredentialMonitoringService", { enumerable: true, get: function () { return credential_monitoring_service_1.CredentialMonitoringService; } });
Object.defineProperty(exports, "getCredentialMonitoringService", { enumerable: true, get: function () { return credential_monitoring_service_1.getCredentialMonitoringService; } });
Object.defineProperty(exports, "resetCredentialMonitoringService", { enumerable: true, get: function () { return credential_monitoring_service_1.resetCredentialMonitoringService; } });
var credential_monitoring_database_1 = require("./credential-monitoring-database");
Object.defineProperty(exports, "CredentialMonitoringDatabase", { enumerable: true, get: function () { return credential_monitoring_database_1.CredentialMonitoringDatabase; } });
Object.defineProperty(exports, "createCredentialMonitoringDatabase", { enumerable: true, get: function () { return credential_monitoring_database_1.createCredentialMonitoringDatabase; } });
// Credential validation
var credential_validation_1 = require("./credential-validation");
Object.defineProperty(exports, "validateCredentialUsername", { enumerable: true, get: function () { return credential_validation_1.validateUsername; } });
Object.defineProperty(exports, "validateCredentialPassword", { enumerable: true, get: function () { return credential_validation_1.validatePassword; } });
Object.defineProperty(exports, "validateProjectCredentials", { enumerable: true, get: function () { return credential_validation_1.validateProjectCredentials; } });
Object.defineProperty(exports, "validateCredentialFormat", { enumerable: true, get: function () { return credential_validation_1.validateCredentialFormat; } });
Object.defineProperty(exports, "generateValidationErrorReport", { enumerable: true, get: function () { return credential_validation_1.generateValidationErrorReport; } });
Object.defineProperty(exports, "logValidationFailure", { enumerable: true, get: function () { return credential_validation_1.logValidationFailure; } });
// Credential migration - server-side only
// These are exported as functions that return dynamic imports to avoid loading Node.js modules on client side
const getCredentialMigrationManager = async () => {
    const module = await Promise.resolve().then(() => __importStar(require('./credential-migration-manager')));
    return module.getCredentialMigrationManager();
};
exports.getCredentialMigrationManager = getCredentialMigrationManager;
const resetCredentialMigrationManager = async () => {
    const module = await Promise.resolve().then(() => __importStar(require('./credential-migration-manager')));
    return module.resetCredentialMigrationManager();
};
exports.resetCredentialMigrationManager = resetCredentialMigrationManager;
const CredentialMigrationManager = async () => {
    const module = await Promise.resolve().then(() => __importStar(require('./credential-migration-manager')));
    return module.CredentialMigrationManager;
};
exports.CredentialMigrationManager = CredentialMigrationManager;
// Enhanced credential generation - server-side only
const getEnhancedCredentialGenerationService = async () => {
    const module = await Promise.resolve().then(() => __importStar(require('./enhanced-credential-generation')));
    return module.getEnhancedCredentialGenerationService();
};
exports.getEnhancedCredentialGenerationService = getEnhancedCredentialGenerationService;
const generateSecureRandomString = async (...args) => {
    const module = await Promise.resolve().then(() => __importStar(require('./enhanced-credential-generation')));
    return module.generateSecureRandomString(...args);
};
exports.generateSecureRandomString = generateSecureRandomString;
const validateUniqueness = async (...args) => {
    const module = await Promise.resolve().then(() => __importStar(require('./enhanced-credential-generation')));
    return module.validateUniqueness(...args);
};
exports.validateUniqueness = validateUniqueness;
var enhanced_credential_generation_1 = require("./enhanced-credential-generation");
Object.defineProperty(exports, "CredentialGenerationError", { enumerable: true, get: function () { return enhanced_credential_generation_1.CredentialGenerationError; } });
Object.defineProperty(exports, "DEFAULT_CREDENTIAL_CONFIG", { enumerable: true, get: function () { return enhanced_credential_generation_1.DEFAULT_CREDENTIAL_CONFIG; } });
// Credential generation fallback strategies
var credential_generation_fallback_1 = require("./credential-generation-fallback");
Object.defineProperty(exports, "generateCredentialWithFallbackSupport", { enumerable: true, get: function () { return credential_generation_fallback_1.generateCredentialWithFallbackSupport; } });
Object.defineProperty(exports, "generateCredentialWithFallback", { enumerable: true, get: function () { return credential_generation_fallback_1.generateCredentialWithFallback; } });
Object.defineProperty(exports, "DEFAULT_FALLBACK_CONFIG", { enumerable: true, get: function () { return credential_generation_fallback_1.DEFAULT_FALLBACK_CONFIG; } });
Object.defineProperty(exports, "FallbackStrategy", { enumerable: true, get: function () { return credential_generation_fallback_1.FallbackStrategy; } });
Object.defineProperty(exports, "getFallbackStrategyDescription", { enumerable: true, get: function () { return credential_generation_fallback_1.getFallbackStrategyDescription; } });
// Credential generation error messages and user feedback
var credential_generation_error_messages_1 = require("./credential-generation-error-messages");
Object.defineProperty(exports, "getCredentialGenerationErrorMessage", { enumerable: true, get: function () { return credential_generation_error_messages_1.getCredentialGenerationErrorMessage; } });
Object.defineProperty(exports, "formatCredentialGenerationError", { enumerable: true, get: function () { return credential_generation_error_messages_1.formatCredentialGenerationError; } });
Object.defineProperty(exports, "getRecoverySuggestions", { enumerable: true, get: function () { return credential_generation_error_messages_1.getRecoverySuggestions; } });
Object.defineProperty(exports, "isRetryableError", { enumerable: true, get: function () { return credential_generation_error_messages_1.isRetryableError; } });
Object.defineProperty(exports, "getRetryDelay", { enumerable: true, get: function () { return credential_generation_error_messages_1.getRetryDelay; } });
Object.defineProperty(exports, "CREDENTIAL_GENERATION_ERROR_MESSAGES", { enumerable: true, get: function () { return credential_generation_error_messages_1.CREDENTIAL_GENERATION_ERROR_MESSAGES; } });
Object.defineProperty(exports, "CREDENTIAL_GENERATION_STATUS_MESSAGES", { enumerable: true, get: function () { return credential_generation_error_messages_1.CREDENTIAL_GENERATION_STATUS_MESSAGES; } });
Object.defineProperty(exports, "FALLBACK_STRATEGIES", { enumerable: true, get: function () { return credential_generation_error_messages_1.FALLBACK_STRATEGIES; } });
// Constants
var constants_1 = require("./constants");
Object.defineProperty(exports, "ENCRYPTION_KEY", { enumerable: true, get: function () { return constants_1.ENCRYPTION_KEY; } });
Object.defineProperty(exports, "POSTGRES_PORT", { enumerable: true, get: function () { return constants_1.POSTGRES_PORT; } });
Object.defineProperty(exports, "POSTGRES_HOST", { enumerable: true, get: function () { return constants_1.POSTGRES_HOST; } });
Object.defineProperty(exports, "POSTGRES_DATABASE", { enumerable: true, get: function () { return constants_1.POSTGRES_DATABASE; } });
Object.defineProperty(exports, "POSTGRES_PASSWORD", { enumerable: true, get: function () { return constants_1.POSTGRES_PASSWORD; } });
Object.defineProperty(exports, "POSTGRES_USER_READ_WRITE", { enumerable: true, get: function () { return constants_1.POSTGRES_USER_READ_WRITE; } });
Object.defineProperty(exports, "POSTGRES_USER_READ_ONLY", { enumerable: true, get: function () { return constants_1.POSTGRES_USER_READ_ONLY; } });
Object.defineProperty(exports, "TEMPLATE_DATABASE_NAME", { enumerable: true, get: function () { return constants_1.TEMPLATE_DATABASE_NAME; } });
// Utilities
var util_1 = require("./util");
Object.defineProperty(exports, "assertSelfHosted", { enumerable: true, get: function () { return util_1.assertSelfHosted; } });
Object.defineProperty(exports, "encryptString", { enumerable: true, get: function () { return util_1.encryptString; } });
Object.defineProperty(exports, "getConnectionString", { enumerable: true, get: function () { return util_1.getConnectionString; } });
// Query execution
var query_1 = require("./query");
Object.defineProperty(exports, "executeQuery", { enumerable: true, get: function () { return query_1.executeQuery; } });
// Project store - automatically selects JSON or PostgreSQL based on environment
// Default: JSON file storage (for development/existing environments)
// Set USE_PG_PROJECT_STORE=true to use PostgreSQL storage (for new deployments)
var project_store_adapter_1 = require("./project-store-adapter");
Object.defineProperty(exports, "saveProject", { enumerable: true, get: function () { return project_store_adapter_1.save; } });
Object.defineProperty(exports, "findAllProjects", { enumerable: true, get: function () { return project_store_adapter_1.findAll; } });
Object.defineProperty(exports, "findProjectById", { enumerable: true, get: function () { return project_store_adapter_1.findById; } });
Object.defineProperty(exports, "findProjectByRef", { enumerable: true, get: function () { return project_store_adapter_1.findByRef; } });
Object.defineProperty(exports, "findProjectByDatabaseName", { enumerable: true, get: function () { return project_store_adapter_1.findByDatabaseName; } });
Object.defineProperty(exports, "findProjectsByOrganizationId", { enumerable: true, get: function () { return project_store_adapter_1.findByOrganizationId; } });
Object.defineProperty(exports, "findProjectsByOwnerUserId", { enumerable: true, get: function () { return project_store_adapter_1.findByOwnerUserId; } });
Object.defineProperty(exports, "updateProject", { enumerable: true, get: function () { return project_store_adapter_1.update; } });
Object.defineProperty(exports, "deleteProject", { enumerable: true, get: function () { return project_store_adapter_1.deleteProject; } });
Object.defineProperty(exports, "ProjectStoreError", { enumerable: true, get: function () { return project_store_adapter_1.ProjectStoreError; } });
Object.defineProperty(exports, "ProjectStoreErrorCode", { enumerable: true, get: function () { return project_store_adapter_1.ProjectStoreErrorCode; } });
// User isolation and security
var user_isolation_security_1 = require("./user-isolation-security");
Object.defineProperty(exports, "verifyCrossProjectAccessDenial", { enumerable: true, get: function () { return user_isolation_security_1.verifyCrossProjectAccessDenial; } });
Object.defineProperty(exports, "verifyUserPermissions", { enumerable: true, get: function () { return user_isolation_security_1.verifyUserPermissions; } });
Object.defineProperty(exports, "logUserAccess", { enumerable: true, get: function () { return user_isolation_security_1.logUserAccess; } });
Object.defineProperty(exports, "runIsolationVerification", { enumerable: true, get: function () { return user_isolation_security_1.runIsolationVerification; } });
Object.defineProperty(exports, "generateIsolationVerificationScript", { enumerable: true, get: function () { return user_isolation_security_1.generateIsolationVerificationScript; } });
// Types
var types_1 = require("./types");
Object.defineProperty(exports, "PgMetaDatabaseError", { enumerable: true, get: function () { return types_1.PgMetaDatabaseError; } });
