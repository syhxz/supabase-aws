"use strict";
/**
 * Credential Fallback Manager for handling missing project credentials.
 * Provides graceful fallback to system credentials when project-specific credentials are unavailable.
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
exports.CredentialFallbackManager = void 0;
exports.getCredentialFallbackManager = getCredentialFallbackManager;
exports.resetCredentialFallbackManager = resetCredentialFallbackManager;
const constants_1 = require("./constants");
const environment_config_handler_1 = require("../../environment-config-handler");
const credential_error_handling_1 = require("./credential-error-handling");
/**
 * Credential Fallback Manager class
 * Handles detection of missing credentials and provides fallback mechanisms
 */
class CredentialFallbackManager {
    constructor() {
        this.fallbackUsageLog = [];
    }
    /**
     * Gets project credentials and determines if they are complete
     *
     * @param projectRef - Project reference identifier
     * @param projectUser - Project-specific database user (may be null/undefined)
     * @param projectPasswordHash - Project-specific password hash (may be null/undefined)
     * @returns ProjectCredentials with completeness status
     */
    getProjectCredentials(projectRef, projectUser, projectPasswordHash) {
        // Normalize null/undefined/empty strings to null
        const normalizedUser = this.normalizeCredentialValue(projectUser);
        const normalizedPasswordHash = this.normalizeCredentialValue(projectPasswordHash);
        const isComplete = normalizedUser !== null && normalizedPasswordHash !== null;
        return {
            user: normalizedUser,
            passwordHash: normalizedPasswordHash,
            isComplete
        };
    }
    /**
     * Gets fallback credentials from environment variables with comprehensive error handling
     *
     * @param readOnly - Whether to get read-only credentials
     * @returns SystemCredentials with fallback values
     */
    async getFallbackCredentials(readOnly = false) {
        const errorHandler = (0, credential_error_handling_1.getCredentialErrorHandler)();
        return errorHandler.executeWithErrorHandling(async () => {
            let user;
            let password;
            let source = 'environment';
            try {
                // Try to use environment configuration handler for environment-specific values
                const configHandler = (0, environment_config_handler_1.getEnvironmentConfigHandler)();
                const envConfig = configHandler.getCurrentConfig();
                user = readOnly ?
                    (envConfig?.POSTGRES_USER_READ_ONLY || constants_1.POSTGRES_USER_READ_ONLY) :
                    (envConfig?.POSTGRES_USER_READ_WRITE || constants_1.POSTGRES_USER_READ_WRITE);
                password = envConfig?.POSTGRES_PASSWORD || constants_1.POSTGRES_PASSWORD;
            }
            catch (error) {
                // Fall back to direct environment variables if handler is not available
                console.warn('[Credential Fallback] Environment config handler unavailable, using direct environment variables');
                user = readOnly ? constants_1.POSTGRES_USER_READ_ONLY : constants_1.POSTGRES_USER_READ_WRITE;
                password = constants_1.POSTGRES_PASSWORD;
            }
            // Validate that we have valid fallback credentials
            if (!user || user.trim() === '') {
                throw credential_error_handling_1.CredentialError.configuration(`Invalid fallback user configuration: ${readOnly ? 'read-only' : 'read-write'} user cannot be empty`, { readOnly, userType: readOnly ? 'read-only' : 'read-write' });
            }
            if (!password || password.trim() === '') {
                throw credential_error_handling_1.CredentialError.configuration('Invalid fallback password configuration: password cannot be empty', { readOnly });
            }
            // If we're using the constants directly, mark as default source
            if (user === constants_1.POSTGRES_USER_READ_ONLY || user === constants_1.POSTGRES_USER_READ_WRITE) {
                if (password === constants_1.POSTGRES_PASSWORD) {
                    source = 'default';
                }
            }
            return {
                user: user.trim(),
                password: password.trim(),
                source
            };
        }, {
            serviceName: 'credential-fallback',
            context: `getFallbackCredentials-${readOnly ? 'readonly' : 'readwrite'}`,
            enableRetry: true,
            enableCircuitBreaker: false, // Configuration errors shouldn't use circuit breaker
            enableGracefulDegradation: true,
            fallbackFn: async () => {
                // Ultimate fallback: use hardcoded constants
                console.warn('[Credential Fallback] Using hardcoded fallback credentials as last resort');
                const user = readOnly ? constants_1.POSTGRES_USER_READ_ONLY : constants_1.POSTGRES_USER_READ_WRITE;
                const password = constants_1.POSTGRES_PASSWORD;
                if (!user || !password) {
                    throw credential_error_handling_1.CredentialError.configuration('Critical: No fallback credentials available. System configuration is incomplete.', { readOnly, criticalFailure: true });
                }
                return {
                    user: user.trim(),
                    password: password.trim(),
                    source: 'default'
                };
            }
        });
    }
    /**
     * Determines whether fallback credentials should be used
     *
     * @param credentials - Project credentials to check
     * @returns True if fallback should be used, false otherwise
     */
    shouldUseFallback(credentials) {
        // If credentials object is null/undefined, use fallback
        if (!credentials) {
            return true;
        }
        // If isComplete is explicitly set, use that
        if (typeof credentials.isComplete === 'boolean') {
            return !credentials.isComplete;
        }
        // Otherwise, check if user or passwordHash are missing
        const normalizedUser = this.normalizeCredentialValue(credentials.user);
        const normalizedPasswordHash = this.normalizeCredentialValue(credentials.passwordHash);
        return normalizedUser === null || normalizedPasswordHash === null;
    }
    /**
     * Logs fallback usage for monitoring and debugging
     *
     * @param projectRef - Project reference identifier
     * @param reason - Reason for using fallback credentials
     * @param credentialType - Type of credential that triggered fallback
     */
    logFallbackUsage(projectRef, reason, credentialType = 'both') {
        const logEntry = {
            projectRef,
            reason,
            timestamp: new Date().toISOString(),
            credentialType
        };
        // Add to in-memory log
        this.fallbackUsageLog.push(logEntry);
        // Keep only the last 1000 entries to prevent memory issues
        if (this.fallbackUsageLog.length > 1000) {
            this.fallbackUsageLog = this.fallbackUsageLog.slice(-1000);
        }
        // Log to console for operational visibility
        console.log(`[Credential Fallback] Project: ${projectRef}, Reason: ${reason}, Type: ${credentialType}, Time: ${logEntry.timestamp}`);
        // Also log to monitoring service if available (avoid circular dependency)
        try {
            // Use dynamic import to avoid circular dependency
            Promise.resolve().then(() => __importStar(require('./credential-monitoring-service'))).then(({ getCredentialMonitoringService }) => {
                const monitoringService = getCredentialMonitoringService();
                monitoringService.logAuditEvent('fallback_used', projectRef, {
                    reason,
                    credentialType,
                    timestamp: logEntry.timestamp
                }).catch(error => {
                    console.warn('[Credential Fallback] Failed to log to monitoring service:', error);
                });
            }).catch(() => {
                // Monitoring service not available, continue silently
            });
        }
        catch (error) {
            // Monitoring service not available, continue silently
        }
    }
    /**
     * Gets recent fallback usage entries
     *
     * @param limit - Maximum number of entries to return (default: 100)
     * @returns Array of recent fallback usage entries
     */
    getRecentFallbackUsage(limit = 100) {
        // Sort all entries by timestamp (newest first), then take the limit
        return this.fallbackUsageLog
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }
    /**
     * Gets fallback usage statistics
     *
     * @returns Statistics about fallback usage
     */
    getFallbackUsageStats() {
        const uniqueProjects = new Set(this.fallbackUsageLog.map(entry => entry.projectRef)).size;
        // Count reasons
        const reasonCounts = new Map();
        this.fallbackUsageLog.forEach(entry => {
            const count = reasonCounts.get(entry.reason) || 0;
            reasonCounts.set(entry.reason, count + 1);
        });
        const mostCommonReasons = Array.from(reasonCounts.entries())
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10 reasons
        return {
            totalEntries: this.fallbackUsageLog.length,
            uniqueProjects,
            recentUsage: this.getRecentFallbackUsage(10),
            mostCommonReasons
        };
    }
    /**
     * Clears the fallback usage log
     * Useful for testing or periodic cleanup
     */
    clearFallbackUsageLog() {
        this.fallbackUsageLog = [];
    }
    /**
     * Normalizes credential values by treating null, undefined, and empty strings as null
     *
     * @param value - Credential value to normalize
     * @returns Normalized value (null if empty/null/undefined, trimmed string otherwise)
     */
    normalizeCredentialValue(value) {
        if (value === null || value === undefined) {
            return null;
        }
        if (typeof value !== 'string') {
            return null;
        }
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
    }
}
exports.CredentialFallbackManager = CredentialFallbackManager;
/**
 * Singleton instance of the CredentialFallbackManager
 * This ensures consistent logging and state across the application
 */
let credentialFallbackManagerInstance = null;
/**
 * Gets the singleton instance of CredentialFallbackManager
 *
 * @returns CredentialFallbackManager instance
 */
function getCredentialFallbackManager() {
    if (!credentialFallbackManagerInstance) {
        credentialFallbackManagerInstance = new CredentialFallbackManager();
    }
    return credentialFallbackManagerInstance;
}
/**
 * Resets the singleton instance (useful for testing)
 */
function resetCredentialFallbackManager() {
    credentialFallbackManagerInstance = null;
}
