"use strict";
/**
 * Comprehensive error handling utilities for project management improvements
 *
 * This module provides:
 * - Standardized error types and codes
 * - Error classification and handling strategies
 * - User-friendly error messages and recovery options
 * - Logging and monitoring integration
 * - Security audit logging for access control violations
 * - Sanitized error messages that don't leak sensitive information
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorFactory = exports.ProjectManagementError = exports.RecoveryStrategy = exports.ErrorSeverity = exports.ErrorCode = void 0;
exports.writeSecurityAuditLog = writeSecurityAuditLog;
exports.logAuthenticationFailure = logAuthenticationFailure;
exports.logAuthorizationFailure = logAuthorizationFailure;
exports.logAccessViolation = logAccessViolation;
exports.logDataOwnershipViolation = logDataOwnershipViolation;
exports.logSuspiciousActivity = logSuspiciousActivity;
exports.sanitizeErrorMessage = sanitizeErrorMessage;
exports.createSafeErrorResponse = createSafeErrorResponse;
exports.handleApiError = handleApiError;
exports.handleClientError = handleClientError;
exports.withErrorHandling = withErrorHandling;
exports.createErrorContext = createErrorContext;
exports.extractErrorContextFromRequest = extractErrorContextFromRequest;
const sonner_1 = require("sonner");
/**
 * Standard error codes for project management operations
 */
var ErrorCode;
(function (ErrorCode) {
    // Project deletion errors
    ErrorCode["PROJECT_NOT_FOUND"] = "PROJECT_NOT_FOUND";
    ErrorCode["PROJECT_DELETE_FORBIDDEN"] = "PROJECT_DELETE_FORBIDDEN";
    ErrorCode["PROJECT_DELETE_FAILED"] = "PROJECT_DELETE_FAILED";
    ErrorCode["PROJECT_DELETE_DEFAULT_PROJECT"] = "PROJECT_DELETE_DEFAULT_PROJECT";
    ErrorCode["PROJECT_DELETE_VALIDATION_FAILED"] = "PROJECT_DELETE_VALIDATION_FAILED";
    // Data isolation errors
    ErrorCode["DATA_ISOLATION_FAILED"] = "DATA_ISOLATION_FAILED";
    ErrorCode["INVALID_PROJECT_ID"] = "INVALID_PROJECT_ID";
    ErrorCode["PROJECT_ACCESS_DENIED"] = "PROJECT_ACCESS_DENIED";
    ErrorCode["DATA_OWNERSHIP_VIOLATION"] = "DATA_OWNERSHIP_VIOLATION";
    ErrorCode["DATA_QUERY_FAILED"] = "DATA_QUERY_FAILED";
    ErrorCode["CROSS_PROJECT_DATA_LEAK"] = "CROSS_PROJECT_DATA_LEAK";
    // Routing errors
    ErrorCode["INVALID_PROJECT_REF"] = "INVALID_PROJECT_REF";
    ErrorCode["SETTINGS_LOAD_FAILED"] = "SETTINGS_LOAD_FAILED";
    ErrorCode["ROUTE_PARAMETER_INVALID"] = "ROUTE_PARAMETER_INVALID";
    ErrorCode["SESSION_EXPIRED"] = "SESSION_EXPIRED";
    // Authentication and authorization errors
    ErrorCode["USER_NOT_AUTHENTICATED"] = "USER_NOT_AUTHENTICATED";
    ErrorCode["TOKEN_MISSING"] = "TOKEN_MISSING";
    ErrorCode["TOKEN_INVALID"] = "TOKEN_INVALID";
    ErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ErrorCode["AUTHENTICATION_FAILED"] = "AUTHENTICATION_FAILED";
    ErrorCode["INSUFFICIENT_PERMISSIONS"] = "INSUFFICIENT_PERMISSIONS";
    ErrorCode["ORGANIZATION_ACCESS_DENIED"] = "ORGANIZATION_ACCESS_DENIED";
    // Validation errors
    ErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    ErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    // Generic errors
    ErrorCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorCode["TIMEOUT_ERROR"] = "TIMEOUT_ERROR";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
/**
 * Error severity levels
 */
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["LOW"] = "low";
    ErrorSeverity["MEDIUM"] = "medium";
    ErrorSeverity["HIGH"] = "high";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
/**
 * Error recovery strategies
 */
var RecoveryStrategy;
(function (RecoveryStrategy) {
    RecoveryStrategy["RETRY"] = "retry";
    RecoveryStrategy["REDIRECT"] = "redirect";
    RecoveryStrategy["REFRESH"] = "refresh";
    RecoveryStrategy["CONTACT_SUPPORT"] = "contact_support";
    RecoveryStrategy["MANUAL_INTERVENTION"] = "manual_intervention";
    RecoveryStrategy["NONE"] = "none";
})(RecoveryStrategy || (exports.RecoveryStrategy = RecoveryStrategy = {}));
/**
 * Write security audit log entry
 * Requirements: 6.2, 6.3
 *
 * @param log - Security audit log entry
 */
function writeSecurityAuditLog(log) {
    // Structured security audit log
    const auditEntry = {
        type: 'SECURITY_AUDIT',
        eventType: log.eventType,
        severity: log.severity,
        userId: log.userId || 'anonymous',
        projectId: log.projectId,
        projectRef: log.projectRef,
        operation: log.operation,
        reason: log.reason,
        ip: log.ip,
        userAgent: log.userAgent,
        endpoint: log.endpoint,
        method: log.method,
        requestId: log.requestId,
        metadata: log.metadata,
        timestamp: log.timestamp.toISOString()
    };
    // Log with appropriate severity level
    switch (log.severity) {
        case 'critical':
            console.error('[SECURITY AUDIT - CRITICAL]', JSON.stringify(auditEntry, null, 2));
            break;
        case 'high':
            console.error('[SECURITY AUDIT - HIGH]', JSON.stringify(auditEntry, null, 2));
            break;
        case 'medium':
            console.warn('[SECURITY AUDIT - MEDIUM]', JSON.stringify(auditEntry, null, 2));
            break;
        case 'low':
            console.info('[SECURITY AUDIT - LOW]', JSON.stringify(auditEntry, null, 2));
            break;
    }
    // In production, this would also send to a security monitoring service
    // e.g., Sentry, DataDog, CloudWatch, etc.
}
/**
 * Log authentication failure for security audit
 * Requirements: 4.5, 6.3
 *
 * @param context - Error context with authentication details
 * @param reason - Reason for authentication failure
 */
function logAuthenticationFailure(context, reason) {
    writeSecurityAuditLog({
        eventType: 'authentication_failure',
        severity: 'medium',
        userId: context.userId,
        projectId: context.projectId,
        projectRef: context.projectRef,
        operation: context.operation,
        reason,
        ip: context.ip,
        userAgent: context.userAgent,
        endpoint: context.endpoint,
        requestId: context.requestId,
        timestamp: new Date()
    });
}
/**
 * Log authorization failure for security audit
 * Requirements: 6.2, 6.3
 *
 * @param context - Error context with authorization details
 * @param reason - Reason for authorization failure
 */
function logAuthorizationFailure(context, reason) {
    writeSecurityAuditLog({
        eventType: 'authorization_failure',
        severity: 'high',
        userId: context.userId,
        projectId: context.projectId,
        projectRef: context.projectRef,
        operation: context.operation,
        reason,
        ip: context.ip,
        userAgent: context.userAgent,
        endpoint: context.endpoint,
        requestId: context.requestId,
        timestamp: new Date()
    });
}
/**
 * Log access control violation for security audit
 * Requirements: 6.2
 *
 * @param context - Error context with violation details
 * @param violationType - Type of access violation
 * @param details - Additional details about the violation
 */
function logAccessViolation(context, violationType, details) {
    writeSecurityAuditLog({
        eventType: 'access_violation',
        severity: 'high',
        userId: context.userId,
        projectId: context.projectId,
        projectRef: context.projectRef,
        operation: context.operation,
        reason: violationType,
        ip: context.ip,
        userAgent: context.userAgent,
        endpoint: context.endpoint,
        requestId: context.requestId,
        metadata: details,
        timestamp: new Date()
    });
}
/**
 * Log data ownership violation for security audit
 * Requirements: 6.2
 *
 * @param context - Error context with violation details
 * @param details - Details about the data ownership violation
 */
function logDataOwnershipViolation(context, details) {
    writeSecurityAuditLog({
        eventType: 'data_ownership_violation',
        severity: 'critical',
        userId: context.userId,
        projectId: context.projectId,
        projectRef: context.projectRef,
        operation: context.operation,
        reason: 'Data ownership violation detected',
        ip: context.ip,
        userAgent: context.userAgent,
        endpoint: context.endpoint,
        requestId: context.requestId,
        metadata: details,
        timestamp: new Date()
    });
}
/**
 * Log suspicious activity for security audit
 * Requirements: 6.2, 6.3
 *
 * @param context - Error context with activity details
 * @param activityDescription - Description of suspicious activity
 * @param metadata - Additional metadata about the activity
 */
function logSuspiciousActivity(context, activityDescription, metadata) {
    writeSecurityAuditLog({
        eventType: 'suspicious_activity',
        severity: 'high',
        userId: context.userId,
        projectId: context.projectId,
        projectRef: context.projectRef,
        operation: context.operation,
        reason: activityDescription,
        ip: context.ip,
        userAgent: context.userAgent,
        endpoint: context.endpoint,
        requestId: context.requestId,
        metadata,
        timestamp: new Date()
    });
}
/**
 * Sanitize error message to prevent sensitive information leakage
 * Requirements: 6.1, 6.5
 *
 * @param message - Original error message
 * @returns Sanitized error message safe for client display
 */
function sanitizeErrorMessage(message) {
    // Remove potential sensitive patterns
    let sanitized = message;
    // Remove database connection strings
    sanitized = sanitized.replace(/postgres:\/\/[^\s]+/gi, '[DATABASE_CONNECTION]');
    sanitized = sanitized.replace(/postgresql:\/\/[^\s]+/gi, '[DATABASE_CONNECTION]');
    // Remove API keys and tokens
    sanitized = sanitized.replace(/[a-zA-Z0-9_-]{32,}/g, '[REDACTED_TOKEN]');
    // Remove email addresses (except in specific contexts)
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
    // Remove IP addresses
    sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_ADDRESS]');
    // Remove file paths
    sanitized = sanitized.replace(/\/[a-zA-Z0-9_\-./]+/g, '[FILE_PATH]');
    sanitized = sanitized.replace(/[A-Z]:\\[a-zA-Z0-9_\-\\]+/g, '[FILE_PATH]');
    // Remove SQL query fragments
    sanitized = sanitized.replace(/SELECT .+ FROM .+/gi, '[SQL_QUERY]');
    sanitized = sanitized.replace(/INSERT INTO .+/gi, '[SQL_QUERY]');
    sanitized = sanitized.replace(/UPDATE .+ SET .+/gi, '[SQL_QUERY]');
    sanitized = sanitized.replace(/DELETE FROM .+/gi, '[SQL_QUERY]');
    // Remove stack traces
    sanitized = sanitized.replace(/at .+\(.+:\d+:\d+\)/g, '[STACK_TRACE]');
    return sanitized;
}
/**
 * Create safe error response that doesn't leak sensitive information
 * Requirements: 6.1, 6.4, 6.5
 *
 * @param error - Error object
 * @param includeDetails - Whether to include detailed error information (only in development)
 * @returns Safe error response object
 */
function createSafeErrorResponse(error, includeDetails = false) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    // Base response with sanitized message
    const response = {
        error: error.name,
        message: sanitizeErrorMessage(error.userMessage),
        code: error.code,
        severity: error.severity,
        recoveryStrategy: error.recoveryStrategy,
        timestamp: error.timestamp.toISOString()
    };
    // Only include detailed information in development mode
    if (isDevelopment && includeDetails) {
        return {
            ...response,
            details: {
                originalMessage: error.message,
                metadata: error.metadata,
                stack: error.stack
            }
        };
    }
    return response;
}
/**
 * Comprehensive error class with context and recovery options
 */
class ProjectManagementError extends Error {
    constructor(code, message, userMessage, severity = ErrorSeverity.MEDIUM, recoveryStrategy = RecoveryStrategy.NONE, options) {
        super(message, { cause: options?.cause });
        this.name = 'ProjectManagementError';
        this.code = code;
        this.userMessage = userMessage;
        this.severity = severity;
        this.recoveryStrategy = recoveryStrategy;
        this.recoveryOptions = options?.recoveryOptions;
        this.context = options?.context;
        this.metadata = options?.metadata;
        this.timestamp = new Date();
    }
    /**
     * Convert error to API response format
     * Requirements: 6.1, 6.4
     */
    toApiResponse() {
        // Use safe error response that doesn't leak sensitive information
        return createSafeErrorResponse(this, false);
    }
    /**
     * Log error with appropriate level based on severity
     * Also writes security audit log for security-related errors
     * Requirements: 6.2, 6.3
     */
    log() {
        const logData = {
            code: this.code,
            message: this.message,
            userMessage: this.userMessage,
            severity: this.severity,
            context: this.context,
            metadata: this.metadata,
            timestamp: this.timestamp,
            stack: this.stack
        };
        switch (this.severity) {
            case ErrorSeverity.CRITICAL:
                console.error('CRITICAL ERROR:', logData);
                break;
            case ErrorSeverity.HIGH:
                console.error('HIGH SEVERITY ERROR:', logData);
                break;
            case ErrorSeverity.MEDIUM:
                console.warn('MEDIUM SEVERITY ERROR:', logData);
                break;
            case ErrorSeverity.LOW:
                console.info('LOW SEVERITY ERROR:', logData);
                break;
        }
        // Write security audit log for security-related errors
        if (this.context && this.isSecurityRelated()) {
            this.writeSecurityAuditLog();
        }
    }
    /**
     * Check if error is security-related
     * Requirements: 6.2
     */
    isSecurityRelated() {
        const securityCodes = [
            ErrorCode.USER_NOT_AUTHENTICATED,
            ErrorCode.TOKEN_MISSING,
            ErrorCode.TOKEN_INVALID,
            ErrorCode.TOKEN_EXPIRED,
            ErrorCode.AUTHENTICATION_FAILED,
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            ErrorCode.PROJECT_ACCESS_DENIED,
            ErrorCode.ORGANIZATION_ACCESS_DENIED,
            ErrorCode.DATA_OWNERSHIP_VIOLATION,
            ErrorCode.CROSS_PROJECT_DATA_LEAK,
            ErrorCode.PROJECT_DELETE_FORBIDDEN
        ];
        return securityCodes.includes(this.code);
    }
    /**
     * Write security audit log for this error
     * Requirements: 6.2, 6.3
     */
    writeSecurityAuditLog() {
        if (!this.context)
            return;
        let eventType = 'access_violation';
        let severity = 'medium';
        // Determine event type and severity based on error code
        switch (this.code) {
            case ErrorCode.USER_NOT_AUTHENTICATED:
            case ErrorCode.TOKEN_MISSING:
            case ErrorCode.TOKEN_INVALID:
            case ErrorCode.TOKEN_EXPIRED:
            case ErrorCode.AUTHENTICATION_FAILED:
                eventType = 'authentication_failure';
                severity = 'medium';
                break;
            case ErrorCode.INSUFFICIENT_PERMISSIONS:
            case ErrorCode.PROJECT_ACCESS_DENIED:
            case ErrorCode.ORGANIZATION_ACCESS_DENIED:
            case ErrorCode.PROJECT_DELETE_FORBIDDEN:
                eventType = 'authorization_failure';
                severity = 'high';
                break;
            case ErrorCode.DATA_OWNERSHIP_VIOLATION:
            case ErrorCode.CROSS_PROJECT_DATA_LEAK:
                eventType = 'data_ownership_violation';
                severity = 'critical';
                break;
        }
        writeSecurityAuditLog({
            eventType,
            severity,
            userId: this.context.userId,
            projectId: this.context.projectId,
            projectRef: this.context.projectRef,
            operation: this.context.operation,
            reason: this.message,
            ip: this.context.ip,
            userAgent: this.context.userAgent,
            endpoint: this.context.endpoint,
            requestId: this.context.requestId,
            metadata: this.metadata,
            timestamp: this.timestamp
        });
    }
}
exports.ProjectManagementError = ProjectManagementError;
/**
 * Error factory for creating standardized errors
 */
class ErrorFactory {
}
exports.ErrorFactory = ErrorFactory;
/**
 * Create project deletion errors
 */
ErrorFactory.projectDeletion = {
    projectNotFound: (projectRef, context) => new ProjectManagementError(ErrorCode.PROJECT_NOT_FOUND, `Project not found: ${projectRef}`, `The project "${projectRef}" could not be found. It may have been deleted or you may not have access to it.`, ErrorSeverity.MEDIUM, RecoveryStrategy.REDIRECT, {
        context,
        recoveryOptions: [
            {
                label: 'Go to Projects',
                action: () => window.location.href = '/projects',
                type: 'primary'
            },
            {
                label: 'Contact Support',
                action: () => window.open('/support', '_blank'),
                type: 'secondary'
            }
        ]
    }),
    deleteForbidden: (projectRef, context) => new ProjectManagementError(ErrorCode.PROJECT_DELETE_FORBIDDEN, `Delete forbidden for project: ${projectRef}`, 'You do not have permission to delete this project. Please contact your organization administrator.', ErrorSeverity.HIGH, RecoveryStrategy.CONTACT_SUPPORT, {
        context,
        recoveryOptions: [
            {
                label: 'Contact Admin',
                action: () => sonner_1.toast.info('Please contact your organization administrator for project deletion permissions.'),
                type: 'primary'
            }
        ]
    }),
    deleteFailed: (projectRef, cause, context) => new ProjectManagementError(ErrorCode.PROJECT_DELETE_FAILED, `Failed to delete project: ${projectRef}`, 'Project deletion failed due to a server error. Please try again or contact support if the problem persists.', ErrorSeverity.HIGH, RecoveryStrategy.RETRY, {
        context,
        cause,
        recoveryOptions: [
            {
                label: 'Try Again',
                action: () => window.location.reload(),
                type: 'primary'
            },
            {
                label: 'Contact Support',
                action: () => window.open('/support', '_blank'),
                type: 'secondary'
            }
        ]
    }),
    deleteDefaultProject: (context) => new ProjectManagementError(ErrorCode.PROJECT_DELETE_DEFAULT_PROJECT, 'Cannot delete default project', 'The default project cannot be deleted. Please select a different project to delete.', ErrorSeverity.MEDIUM, RecoveryStrategy.NONE, { context }),
    validationFailed: (reason, context) => new ProjectManagementError(ErrorCode.PROJECT_DELETE_VALIDATION_FAILED, `Project deletion validation failed: ${reason}`, `Project deletion was blocked: ${reason}`, ErrorSeverity.MEDIUM, RecoveryStrategy.MANUAL_INTERVENTION, { context })
};
/**
 * Create data isolation errors
 */
ErrorFactory.dataIsolation = {
    isolationFailed: (operation, cause, context) => new ProjectManagementError(ErrorCode.DATA_ISOLATION_FAILED, `Data isolation failed for operation: ${operation}`, 'A data isolation error occurred. Your request could not be processed safely.', ErrorSeverity.HIGH, RecoveryStrategy.REFRESH, {
        context,
        cause,
        recoveryOptions: [
            {
                label: 'Refresh Page',
                action: () => window.location.reload(),
                type: 'primary'
            }
        ]
    }),
    invalidProjectId: (projectId, context) => new ProjectManagementError(ErrorCode.INVALID_PROJECT_ID, `Invalid project ID: ${projectId}`, 'The project ID is invalid. Please check the URL and try again.', ErrorSeverity.MEDIUM, RecoveryStrategy.REDIRECT, {
        context,
        recoveryOptions: [
            {
                label: 'Go to Projects',
                action: () => window.location.href = '/projects',
                type: 'primary'
            }
        ]
    }),
    accessDenied: (projectRef, context) => new ProjectManagementError(ErrorCode.PROJECT_ACCESS_DENIED, `Access denied to project: ${projectRef}`, 'You do not have permission to access this project\'s data.', ErrorSeverity.HIGH, RecoveryStrategy.CONTACT_SUPPORT, {
        context,
        recoveryOptions: [
            {
                label: 'Contact Admin',
                action: () => sonner_1.toast.info('Please contact your organization administrator for project access.'),
                type: 'primary'
            }
        ]
    }),
    ownershipViolation: (details, context) => new ProjectManagementError(ErrorCode.DATA_OWNERSHIP_VIOLATION, `Data ownership violation: ${details}`, 'A data security violation was detected. The operation was blocked for your protection.', ErrorSeverity.CRITICAL, RecoveryStrategy.CONTACT_SUPPORT, {
        context,
        recoveryOptions: [
            {
                label: 'Contact Support',
                action: () => window.open('/support', '_blank'),
                type: 'danger'
            }
        ]
    }),
    queryFailed: (dataType, cause, context) => new ProjectManagementError(ErrorCode.DATA_QUERY_FAILED, `Failed to query ${dataType} data`, `Failed to load ${dataType} data. Please try again.`, ErrorSeverity.MEDIUM, RecoveryStrategy.RETRY, {
        context,
        cause,
        recoveryOptions: [
            {
                label: 'Retry',
                action: () => window.location.reload(),
                type: 'primary'
            }
        ]
    }),
    crossProjectDataLeak: (details, context) => new ProjectManagementError(ErrorCode.CROSS_PROJECT_DATA_LEAK, `Cross-project data leak detected: ${details}`, 'A data security issue was detected and prevented. The operation was blocked for your protection.', ErrorSeverity.CRITICAL, RecoveryStrategy.CONTACT_SUPPORT, {
        context,
        metadata: { details },
        recoveryOptions: [
            {
                label: 'Contact Support',
                action: () => window.open('/support', '_blank'),
                type: 'danger'
            }
        ]
    })
};
/**
 * Create routing errors
 */
ErrorFactory.routing = {
    invalidProjectRef: (projectRef, context) => new ProjectManagementError(ErrorCode.INVALID_PROJECT_REF, `Invalid project reference: ${projectRef}`, 'The project reference in the URL is invalid. Please check the URL and try again.', ErrorSeverity.MEDIUM, RecoveryStrategy.REDIRECT, {
        context,
        recoveryOptions: [
            {
                label: 'Go to Projects',
                action: () => window.location.href = '/projects',
                type: 'primary'
            }
        ]
    }),
    settingsLoadFailed: (projectRef, cause, context) => new ProjectManagementError(ErrorCode.SETTINGS_LOAD_FAILED, `Failed to load settings for project: ${projectRef}`, 'Failed to load project settings. Please try again or contact support if the problem persists.', ErrorSeverity.MEDIUM, RecoveryStrategy.RETRY, {
        context,
        cause,
        recoveryOptions: [
            {
                label: 'Retry',
                action: () => window.location.reload(),
                type: 'primary'
            },
            {
                label: 'Go Back',
                action: () => window.history.back(),
                type: 'secondary'
            }
        ]
    }),
    sessionExpired: (context) => new ProjectManagementError(ErrorCode.SESSION_EXPIRED, 'User session has expired', 'Your session has expired. Please log in again to continue.', ErrorSeverity.MEDIUM, RecoveryStrategy.REDIRECT, {
        context,
        recoveryOptions: [
            {
                label: 'Log In',
                action: () => window.location.href = '/sign-in',
                type: 'primary'
            }
        ]
    })
};
/**
 * Create authentication/authorization errors
 */
ErrorFactory.auth = {
    notAuthenticated: (context) => new ProjectManagementError(ErrorCode.USER_NOT_AUTHENTICATED, 'User not authenticated', 'You must be logged in to perform this action.', ErrorSeverity.HIGH, RecoveryStrategy.REDIRECT, {
        context,
        recoveryOptions: [
            {
                label: 'Log In',
                action: () => window.location.href = '/sign-in',
                type: 'primary'
            }
        ]
    }),
    tokenMissing: (context) => new ProjectManagementError(ErrorCode.TOKEN_MISSING, 'Authentication token missing', 'Authentication token is missing. Please log in again.', ErrorSeverity.HIGH, RecoveryStrategy.REDIRECT, {
        context,
        recoveryOptions: [
            {
                label: 'Log In',
                action: () => window.location.href = '/sign-in',
                type: 'primary'
            }
        ]
    }),
    tokenInvalid: (context) => new ProjectManagementError(ErrorCode.TOKEN_INVALID, 'Authentication token invalid', 'Your authentication token is invalid. Please log in again.', ErrorSeverity.HIGH, RecoveryStrategy.REDIRECT, {
        context,
        recoveryOptions: [
            {
                label: 'Log In',
                action: () => window.location.href = '/sign-in',
                type: 'primary'
            }
        ]
    }),
    tokenExpired: (context) => new ProjectManagementError(ErrorCode.TOKEN_EXPIRED, 'Authentication token expired', 'Your session has expired. Please log in again.', ErrorSeverity.MEDIUM, RecoveryStrategy.REDIRECT, {
        context,
        recoveryOptions: [
            {
                label: 'Log In',
                action: () => window.location.href = '/sign-in',
                type: 'primary'
            }
        ]
    }),
    authenticationFailed: (reason, context) => new ProjectManagementError(ErrorCode.AUTHENTICATION_FAILED, `Authentication failed: ${reason}`, 'Authentication failed. Please check your credentials and try again.', ErrorSeverity.HIGH, RecoveryStrategy.RETRY, {
        context,
        recoveryOptions: [
            {
                label: 'Try Again',
                action: () => window.location.reload(),
                type: 'primary'
            },
            {
                label: 'Log In',
                action: () => window.location.href = '/sign-in',
                type: 'secondary'
            }
        ]
    }),
    insufficientPermissions: (resource, context) => new ProjectManagementError(ErrorCode.INSUFFICIENT_PERMISSIONS, `Insufficient permissions for: ${resource}`, `You do not have permission to access ${resource}. Please contact your administrator.`, ErrorSeverity.HIGH, RecoveryStrategy.CONTACT_SUPPORT, {
        context,
        recoveryOptions: [
            {
                label: 'Contact Admin',
                action: () => sonner_1.toast.info('Please contact your organization administrator for access permissions.'),
                type: 'primary'
            }
        ]
    }),
    organizationAccessDenied: (organizationId, context) => new ProjectManagementError(ErrorCode.ORGANIZATION_ACCESS_DENIED, `Access denied to organization: ${organizationId}`, 'You do not have permission to access this organization\'s resources.', ErrorSeverity.HIGH, RecoveryStrategy.CONTACT_SUPPORT, {
        context,
        metadata: { organizationId },
        recoveryOptions: [
            {
                label: 'Contact Admin',
                action: () => sonner_1.toast.info('Please contact your organization administrator for access.'),
                type: 'primary'
            }
        ]
    })
};
/**
 * Create validation errors
 */
ErrorFactory.validation = {
    invalidInput: (field, reason, context) => new ProjectManagementError(ErrorCode.INVALID_INPUT, `Invalid input for ${field}: ${reason}`, `Invalid ${field}: ${reason}`, ErrorSeverity.LOW, RecoveryStrategy.MANUAL_INTERVENTION, { context }),
    missingRequiredField: (field, context) => new ProjectManagementError(ErrorCode.MISSING_REQUIRED_FIELD, `Missing required field: ${field}`, `${field} is required. Please provide a value.`, ErrorSeverity.LOW, RecoveryStrategy.MANUAL_INTERVENTION, { context })
};
/**
 * Create generic errors
 */
ErrorFactory.generic = {
    internalServerError: (operation, cause, context) => new ProjectManagementError(ErrorCode.INTERNAL_SERVER_ERROR, `Internal server error during: ${operation}`, 'An unexpected error occurred. Please try again or contact support if the problem persists.', ErrorSeverity.HIGH, RecoveryStrategy.RETRY, {
        context,
        cause,
        recoveryOptions: [
            {
                label: 'Try Again',
                action: () => window.location.reload(),
                type: 'primary'
            },
            {
                label: 'Contact Support',
                action: () => window.open('/support', '_blank'),
                type: 'secondary'
            }
        ]
    }),
    networkError: (operation, context) => new ProjectManagementError(ErrorCode.NETWORK_ERROR, `Network error during: ${operation}`, 'Network connection failed. Please check your internet connection and try again.', ErrorSeverity.MEDIUM, RecoveryStrategy.RETRY, {
        context,
        recoveryOptions: [
            {
                label: 'Retry',
                action: () => window.location.reload(),
                type: 'primary'
            }
        ]
    }),
    timeoutError: (operation, context) => new ProjectManagementError(ErrorCode.TIMEOUT_ERROR, `Timeout error during: ${operation}`, 'The operation timed out. Please try again.', ErrorSeverity.MEDIUM, RecoveryStrategy.RETRY, {
        context,
        recoveryOptions: [
            {
                label: 'Try Again',
                action: () => window.location.reload(),
                type: 'primary'
            }
        ]
    })
};
/**
 * Error handler for API responses
 * Requirements: 6.1, 6.4, 6.5
 */
function handleApiError(error, res, context) {
    // Log the error (includes security audit logging)
    error.log();
    // Add context if provided
    if (context && !error.context) {
        error.context = context;
    }
    // Determine HTTP status code based on error code
    let statusCode = 500;
    switch (error.code) {
        case ErrorCode.PROJECT_NOT_FOUND:
        case ErrorCode.INVALID_PROJECT_REF:
            statusCode = 404;
            break;
        case ErrorCode.PROJECT_DELETE_FORBIDDEN:
        case ErrorCode.PROJECT_ACCESS_DENIED:
        case ErrorCode.INSUFFICIENT_PERMISSIONS:
        case ErrorCode.DATA_OWNERSHIP_VIOLATION:
        case ErrorCode.ORGANIZATION_ACCESS_DENIED:
        case ErrorCode.CROSS_PROJECT_DATA_LEAK:
            statusCode = 403;
            break;
        case ErrorCode.USER_NOT_AUTHENTICATED:
        case ErrorCode.SESSION_EXPIRED:
        case ErrorCode.TOKEN_MISSING:
        case ErrorCode.TOKEN_INVALID:
        case ErrorCode.TOKEN_EXPIRED:
        case ErrorCode.AUTHENTICATION_FAILED:
            statusCode = 401;
            break;
        case ErrorCode.INVALID_INPUT:
        case ErrorCode.MISSING_REQUIRED_FIELD:
        case ErrorCode.PROJECT_DELETE_VALIDATION_FAILED:
        case ErrorCode.INVALID_PROJECT_ID:
            statusCode = 400;
            break;
        default:
            statusCode = 500;
    }
    // Send safe error response that doesn't leak sensitive information
    if (!res.headersSent) {
        res.status(statusCode).json(error.toApiResponse());
    }
}
/**
 * Error handler for client-side errors
 */
function handleClientError(error, options) {
    // Log the error
    error.log();
    // Show toast notification if requested
    if (options?.showToast !== false) {
        switch (error.severity) {
            case ErrorSeverity.CRITICAL:
            case ErrorSeverity.HIGH:
                sonner_1.toast.error(error.userMessage);
                break;
            case ErrorSeverity.MEDIUM:
                sonner_1.toast.warning(error.userMessage);
                break;
            case ErrorSeverity.LOW:
                sonner_1.toast.info(error.userMessage);
                break;
        }
    }
    // Show recovery options if available and requested
    if (options?.showRecoveryOptions !== false && error.recoveryOptions?.length) {
        // This would typically integrate with a modal or notification system
        // For now, we'll just log the available recovery options
        console.info('Recovery options available:', error.recoveryOptions);
    }
}
/**
 * Utility to wrap async operations with error handling
 */
async function withErrorHandling(operation, errorContext, errorFactory) {
    try {
        return await operation();
    }
    catch (cause) {
        const error = errorFactory(cause);
        error.context = { ...error.context, ...errorContext };
        throw error;
    }
}
/**
 * Utility to create error context from request
 * Requirements: 6.2, 6.3
 */
function createErrorContext(operation, options) {
    return {
        operation,
        ...options
    };
}
/**
 * Extract error context from Next.js API request
 * Requirements: 6.2, 6.3
 *
 * @param req - Next.js API request
 * @param operation - Operation being performed
 * @param additionalContext - Additional context to include
 * @returns Error context object
 */
function extractErrorContextFromRequest(req, operation, additionalContext) {
    return createErrorContext(operation, {
        ...additionalContext,
        endpoint: req.url,
        method: req.method,
        userAgent: req.headers?.['user-agent'],
        ip: req.headers?.['x-forwarded-for'] || req.connection?.remoteAddress,
        requestId: req.headers?.['x-request-id']
    });
}
