"use strict";
/**
 * Database naming utilities for PostgreSQL database name validation and generation.
 * Implements naming rules according to PostgreSQL standards and project requirements.
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
exports.DatabaseNamingError = exports.DATABASE_NAMING_RULES = void 0;
exports.validateDatabaseName = validateDatabaseName;
exports.isValidDatabaseName = isValidDatabaseName;
exports.sanitizeDatabaseName = sanitizeDatabaseName;
exports.generateDatabaseName = generateDatabaseName;
exports.generateDatabaseNameWithCollisionDetection = generateDatabaseNameWithCollisionDetection;
/**
 * PostgreSQL database naming rules
 */
exports.DATABASE_NAMING_RULES = {
    // Maximum length for PostgreSQL identifiers
    maxLength: 63,
    // Pattern: must start with lowercase letter, contain only lowercase letters, numbers, and underscores
    pattern: /^[a-z][a-z0-9_]*$/,
    // Reserved database names that cannot be used
    reserved: [
        'postgres',
        'template0',
        'template1',
        'supabase',
        'auth',
        'storage',
        'realtime',
    ],
};
/**
 * Error thrown when database name validation fails
 */
class DatabaseNamingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DatabaseNamingError';
    }
}
exports.DatabaseNamingError = DatabaseNamingError;
/**
 * Validates a database name according to PostgreSQL naming rules
 *
 * @param name - The database name to validate
 * @throws {DatabaseNamingError} If the name is invalid
 */
function validateDatabaseName(name) {
    if (!name || name.trim().length === 0) {
        throw new DatabaseNamingError('Database name cannot be empty');
    }
    if (name.length > exports.DATABASE_NAMING_RULES.maxLength) {
        throw new DatabaseNamingError(`Database name cannot exceed ${exports.DATABASE_NAMING_RULES.maxLength} characters`);
    }
    if (!exports.DATABASE_NAMING_RULES.pattern.test(name)) {
        throw new DatabaseNamingError('Database name must start with a lowercase letter and contain only lowercase letters, numbers, and underscores');
    }
    if (exports.DATABASE_NAMING_RULES.reserved.includes(name.toLowerCase())) {
        throw new DatabaseNamingError(`Database name "${name}" is reserved and cannot be used`);
    }
}
/**
 * Checks if a database name is valid without throwing an error
 *
 * @param name - The database name to check
 * @returns true if the name is valid, false otherwise
 */
function isValidDatabaseName(name) {
    try {
        validateDatabaseName(name);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Sanitizes a string to create a valid database name
 *
 * @param input - The input string to sanitize
 * @returns A sanitized database name
 */
function sanitizeDatabaseName(input) {
    let result = input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        .replace(/_+/g, '_'); // Replace multiple underscores with single
    // Prefix with 'db_' if starts with number
    if (/^[0-9]/.test(result)) {
        result = 'db_' + result;
    }
    return result;
}
/**
 * Generates a unique database name based on a project name
 * Uses format: db_projectname_xxxx
 *
 * @param projectName - The project name to base the database name on
 * @returns A unique, valid database name
 */
function generateDatabaseName(projectName) {
    const sanitized = sanitizeDatabaseName(projectName);
    // Generate short random suffix for uniqueness (4 characters)
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    // Calculate available space for project name
    // Format: db_projectname_xxxx
    // Total length limit: 63 characters
    // Used: 'db_' (3) + '_' (1) + random (4) = 8 characters
    const maxProjectNameLength = exports.DATABASE_NAMING_RULES.maxLength - 8;
    // Truncate project name if necessary
    const truncatedProjectName = sanitized.length > maxProjectNameLength
        ? sanitized.substring(0, maxProjectNameLength)
        : sanitized;
    // Create database name with new format
    const name = truncatedProjectName ? `db_${truncatedProjectName}_${randomSuffix}` : `db_proj_${randomSuffix}`;
    return name;
}
/**
 * Enhanced database name generation with collision detection
 * This is a wrapper around the enhanced credential generation service
 *
 * @param projectName - The project name to base the database name on
 * @param existingNames - Optional array of existing names to avoid
 * @returns Promise resolving to unique database name
 */
async function generateDatabaseNameWithCollisionDetection(projectName, existingNames) {
    const { generateDatabaseNameWithCollisionDetection } = await Promise.resolve().then(() => __importStar(require('./enhanced-credential-generation')));
    return generateDatabaseNameWithCollisionDetection(projectName, existingNames);
}
