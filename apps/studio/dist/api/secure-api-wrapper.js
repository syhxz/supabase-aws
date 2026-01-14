"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityConfigs = exports.SecurityValidators = void 0;
exports.withSecureProjectAccess = withSecureProjectAccess;
exports.withSecureReadAccess = withSecureReadAccess;
exports.withSecureWriteAccess = withSecureWriteAccess;
exports.withSecureAdminAccess = withSecureAdminAccess;
exports.withSecureApiKeyAccess = withSecureApiKeyAccess;
exports.withSecureJwtKeyAccess = withSecureJwtKeyAccess;
exports.withSecureDeleteAccess = withSecureDeleteAccess;
exports.withMethodBasedSecurity = withMethodBasedSecurity;
exports.hasPermission = hasPermission;
exports.requirePermission = requirePermission;
exports.isProjectOwner = isProjectOwner;
exports.isOrganizationMember = isOrganizationMember;
exports.requireProjectOwnership = requireProjectOwnership;
exports.createSecurityValidator = createSecurityValidator;
const project_isolation_middleware_1 = require("./project-isolation-middleware");
const error_handling_1 = require("./error-handling");
/**
 * Higher-order function to wrap API handlers with comprehensive security
 *
 * This is the main security wrapper that provides:
 * - User authentication
 * - Project access validation
 * - Permission level checking
 * - Data ownership validation
 * - Security audit logging
 *
 * @param handler - API handler function
 * @param config - Security configuration
 * @returns Wrapped API handler with security
 */
function withSecureProjectAccess(handler, config = {}) {
    return (0, project_isolation_middleware_1.withProjectIsolation)(async (req, res, context) => {
        const errorContext = (0, error_handling_1.createErrorContext)('withSecureProjectAccess', {
            endpoint: req.url,
            projectId: context.projectId,
            projectRef: context.projectRef,
            userId: context.userId,
            userAgent: req.headers['user-agent'],
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
        });
        try {
            // Run custom validation if provided
            if (config.customValidation) {
                await config.customValidation(context);
            }
            // Log successful access for security audit
            console.log('Secure API access granted', {
                userId: context.userId,
                projectId: context.projectId,
                projectRef: context.projectRef,
                endpoint: req.url,
                method: req.method,
                accessType: context.accessResult.accessType,
                permissions: context.permissions,
                timestamp: new Date().toISOString()
            });
            // Execute the handler
            const result = await handler(req, res, context);
            return result;
        }
        catch (error) {
            // Log security violations
            console.warn('Secure API access violation', {
                userId: context.userId,
                projectId: context.projectId,
                projectRef: context.projectRef,
                endpoint: req.url,
                method: req.method,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }, config.permissions);
}
/**
 * Wrapper for read-only endpoints (GET requests)
 * Requires read permission
 */
function withSecureReadAccess(handler, config = {}) {
    return withSecureProjectAccess(handler, {
        ...config,
        permissions: { read: true }
    });
}
/**
 * Wrapper for write endpoints (POST, PUT, PATCH requests)
 * Requires read and write permissions
 */
function withSecureWriteAccess(handler, config = {}) {
    return withSecureProjectAccess(handler, {
        ...config,
        permissions: { read: true, write: true }
    });
}
/**
 * Wrapper for admin endpoints (DELETE, admin operations)
 * Requires read, write, and admin permissions
 */
function withSecureAdminAccess(handler, config = {}) {
    return withSecureProjectAccess(handler, {
        ...config,
        permissions: { read: true, write: true, admin: true }
    });
}
/**
 * Wrapper for API key management endpoints
 * Requires read and API key management permissions
 */
function withSecureApiKeyAccess(handler, config = {}) {
    return withSecureProjectAccess(handler, {
        ...config,
        permissions: { read: true, manageApiKeys: true }
    });
}
/**
 * Wrapper for JWT key management endpoints
 * Requires read and JWT key management permissions
 */
function withSecureJwtKeyAccess(handler, config = {}) {
    return withSecureProjectAccess(handler, {
        ...config,
        permissions: { read: true, manageJwtKeys: true }
    });
}
/**
 * Wrapper for delete operations
 * Requires read, write, and delete permissions
 */
function withSecureDeleteAccess(handler, config = {}) {
    return withSecureProjectAccess(handler, {
        ...config,
        permissions: { read: true, write: true, delete: true }
    });
}
/**
 * Method-based security wrapper that automatically selects appropriate permissions
 * based on HTTP method
 */
function withMethodBasedSecurity(handler, config = {}) {
    return async (req, res) => {
        const method = req.method?.toUpperCase();
        let permissions = { read: true };
        switch (method) {
            case 'GET':
            case 'HEAD':
                permissions = { read: true };
                break;
            case 'POST':
            case 'PUT':
            case 'PATCH':
                permissions = { read: true, write: true };
                break;
            case 'DELETE':
                permissions = { read: true, write: true, delete: true };
                break;
            default:
                permissions = { read: true };
        }
        return withSecureProjectAccess(handler, {
            ...config,
            permissions
        })(req, res);
    };
}
/**
 * Utility function to check if user has specific permission
 */
function hasPermission(context, permission) {
    return context.permissions[permission];
}
/**
 * Utility function to require specific permission
 * Throws error if permission is not granted
 */
function requirePermission(context, permission, customMessage) {
    if (!context.permissions[permission]) {
        const errorContext = (0, error_handling_1.createErrorContext)('requirePermission', {
            userId: context.userId,
            projectId: context.projectId,
            projectRef: context.projectRef
        });
        throw error_handling_1.ErrorFactory.auth.insufficientPermissions(customMessage || `permission '${permission}'`, errorContext);
    }
}
/**
 * Utility function to check if user is project owner
 */
function isProjectOwner(context) {
    return context.accessResult.accessType === 'owner';
}
/**
 * Utility function to check if user is organization member
 */
function isOrganizationMember(context) {
    return context.accessResult.accessType === 'organization_member';
}
/**
 * Utility function to require project ownership
 * Throws error if user is not the project owner
 */
function requireProjectOwnership(context, customMessage) {
    if (!isProjectOwner(context)) {
        const errorContext = (0, error_handling_1.createErrorContext)('requireProjectOwnership', {
            userId: context.userId,
            projectId: context.projectId,
            projectRef: context.projectRef
        });
        throw error_handling_1.ErrorFactory.auth.insufficientPermissions(customMessage || 'project ownership', errorContext);
    }
}
/**
 * Create a custom security validator
 */
function createSecurityValidator(validator) {
    return validator;
}
/**
 * Common security validators
 */
exports.SecurityValidators = {
    /**
     * Require project ownership
     */
    requireOwnership: createSecurityValidator(async (context) => {
        requireProjectOwnership(context);
    }),
    /**
     * Require specific permission
     */
    requirePermission: (permission) => createSecurityValidator(async (context) => {
        requirePermission(context, permission);
    }),
    /**
     * Require multiple permissions
     */
    requirePermissions: (permissions) => createSecurityValidator(async (context) => {
        permissions.forEach(permission => {
            requirePermission(context, permission);
        });
    }),
    /**
     * Custom validation function
     */
    custom: (validator) => createSecurityValidator(validator)
};
/**
 * Export commonly used security configurations
 */
exports.SecurityConfigs = {
    /** Read-only access */
    readOnly: { permissions: { read: true } },
    /** Write access */
    write: { permissions: { read: true, write: true } },
    /** Admin access */
    admin: { permissions: { read: true, write: true, admin: true } },
    /** API key management */
    apiKeys: { permissions: { read: true, manageApiKeys: true } },
    /** JWT key management */
    jwtKeys: { permissions: { read: true, manageJwtKeys: true } },
    /** Delete operations */
    delete: { permissions: { read: true, write: true, delete: true } },
    /** Owner only */
    ownerOnly: {
        permissions: { read: true, write: true, admin: true },
        customValidation: exports.SecurityValidators.requireOwnership
    }
};
