"use strict";
/**
 * Enhanced error messages and user feedback for credential generation failures.
 * Provides specific, actionable error messages for different failure scenarios.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FALLBACK_STRATEGIES = exports.CREDENTIAL_GENERATION_STATUS_MESSAGES = exports.FALLBACK_ERROR_MESSAGE = exports.CREDENTIAL_GENERATION_ERROR_MESSAGES = void 0;
exports.getCredentialGenerationErrorMessage = getCredentialGenerationErrorMessage;
exports.getRecoverySuggestions = getRecoverySuggestions;
exports.isRetryableError = isRetryableError;
exports.getRetryDelay = getRetryDelay;
exports.formatCredentialGenerationError = formatCredentialGenerationError;
const enhanced_credential_generation_1 = require("./enhanced-credential-generation");
/**
 * User-friendly error messages for credential generation failures
 */
exports.CREDENTIAL_GENERATION_ERROR_MESSAGES = {
    [enhanced_credential_generation_1.CredentialGenerationErrorCode.RETRY_EXHAUSTED]: {
        title: 'Unable to Generate Unique Credentials',
        message: 'We tried multiple times to generate unique database credentials for your project, but encountered conflicts each time. This is usually temporary.',
        userAction: 'Please try creating your project again in a few moments.',
        technicalDetails: 'Maximum retry attempts exceeded during credential generation',
        severity: 'high',
        retryable: true,
    },
    [enhanced_credential_generation_1.CredentialGenerationErrorCode.INVALID_PROJECT_NAME]: {
        title: 'Invalid Project Name',
        message: 'The project name you provided cannot be used to generate valid database credentials.',
        userAction: 'Please choose a different project name using only letters, numbers, and spaces.',
        technicalDetails: 'Project name contains characters that cannot be sanitized for database use',
        severity: 'medium',
        retryable: false,
    },
    [enhanced_credential_generation_1.CredentialGenerationErrorCode.GENERATION_FAILED]: {
        title: 'Credential Generation Failed',
        message: 'We encountered an error while generating database credentials for your project.',
        userAction: 'Please try again. If the problem persists, contact support.',
        technicalDetails: 'Internal error during credential generation process',
        severity: 'high',
        retryable: true,
    },
    [enhanced_credential_generation_1.CredentialGenerationErrorCode.UNIQUENESS_CHECK_FAILED]: {
        title: 'Database Connection Issue',
        message: 'We cannot verify if your credentials are unique due to a temporary database connection issue.',
        userAction: 'Please wait a moment and try again. Our database services may be temporarily busy.',
        technicalDetails: 'Unable to connect to database for uniqueness verification',
        severity: 'high',
        retryable: true,
    },
};
/**
 * Fallback error message for unknown error codes
 */
exports.FALLBACK_ERROR_MESSAGE = {
    title: 'Project Creation Error',
    message: 'An unexpected error occurred while setting up your project.',
    userAction: 'Please try again. If the problem persists, contact support.',
    technicalDetails: 'Unknown error during project creation',
    severity: 'high',
    retryable: true,
};
/**
 * Gets user-friendly error message for a credential generation error code
 */
function getCredentialGenerationErrorMessage(code) {
    return exports.CREDENTIAL_GENERATION_ERROR_MESSAGES[code] || exports.FALLBACK_ERROR_MESSAGE;
}
/**
 * Status messages for different phases of credential generation
 */
exports.CREDENTIAL_GENERATION_STATUS_MESSAGES = {
    GENERATING_DATABASE_NAME: 'Generating unique database name...',
    GENERATING_USERNAME: 'Generating unique database username...',
    CHECKING_UNIQUENESS: 'Verifying credentials are unique...',
    RETRYING_GENERATION: 'Retrying credential generation...',
    GENERATION_COMPLETE: 'Database credentials generated successfully',
    APPLYING_FALLBACK: 'Applying fallback generation strategy...',
};
/**
 * Fallback strategies for credential generation failures
 */
exports.FALLBACK_STRATEGIES = {
    SIMPLIFIED_NAMING: {
        name: 'Simplified Naming',
        description: 'Use timestamp-based naming when project name sanitization fails',
        applicable: [enhanced_credential_generation_1.CredentialGenerationErrorCode.INVALID_PROJECT_NAME],
    },
    EXTENDED_RETRY: {
        name: 'Extended Retry',
        description: 'Increase retry attempts with longer random strings',
        applicable: [enhanced_credential_generation_1.CredentialGenerationErrorCode.RETRY_EXHAUSTED],
    },
    OFFLINE_GENERATION: {
        name: 'Offline Generation',
        description: 'Generate credentials without uniqueness checking when database is unavailable',
        applicable: [enhanced_credential_generation_1.CredentialGenerationErrorCode.UNIQUENESS_CHECK_FAILED],
    },
};
/**
 * Recovery suggestions based on error patterns
 */
function getRecoverySuggestions(errorCode, attempts = 1) {
    const suggestions = [];
    switch (errorCode) {
        case enhanced_credential_generation_1.CredentialGenerationErrorCode.RETRY_EXHAUSTED:
            suggestions.push('Wait a few minutes before trying again');
            if (attempts > 1) {
                suggestions.push('Try using a shorter or simpler project name');
                suggestions.push('Contact support if this continues to happen');
            }
            break;
        case enhanced_credential_generation_1.CredentialGenerationErrorCode.INVALID_PROJECT_NAME:
            suggestions.push('Use only letters, numbers, and spaces in your project name');
            suggestions.push('Avoid special characters like @, #, $, %, etc.');
            suggestions.push('Keep the project name between 3-64 characters');
            break;
        case enhanced_credential_generation_1.CredentialGenerationErrorCode.GENERATION_FAILED:
            suggestions.push('Try again in a few moments');
            if (attempts > 2) {
                suggestions.push('Check if there are any ongoing maintenance windows');
                suggestions.push('Contact support with the error details');
            }
            break;
        case enhanced_credential_generation_1.CredentialGenerationErrorCode.UNIQUENESS_CHECK_FAILED:
            suggestions.push('Wait for database services to become available');
            suggestions.push('Try again in 1-2 minutes');
            if (attempts > 3) {
                suggestions.push('Contact support if database connectivity issues persist');
            }
            break;
        default:
            suggestions.push('Try creating the project again');
            suggestions.push('Contact support if the problem continues');
    }
    return suggestions;
}
/**
 * Determines if an error is likely to be resolved by retrying
 */
function isRetryableError(errorCode) {
    const errorInfo = exports.CREDENTIAL_GENERATION_ERROR_MESSAGES[errorCode];
    return errorInfo?.retryable ?? false;
}
/**
 * Gets appropriate retry delay based on error type and attempt number
 */
function getRetryDelay(errorCode, attempt) {
    const baseDelay = 2000; // 2 seconds
    switch (errorCode) {
        case enhanced_credential_generation_1.CredentialGenerationErrorCode.RETRY_EXHAUSTED:
            return baseDelay * Math.pow(2, Math.min(attempt, 4)); // Exponential backoff, max 32 seconds
        case enhanced_credential_generation_1.CredentialGenerationErrorCode.UNIQUENESS_CHECK_FAILED:
            return baseDelay * (1 + attempt); // Linear increase for database connectivity issues
        case enhanced_credential_generation_1.CredentialGenerationErrorCode.GENERATION_FAILED:
            return baseDelay + (attempt * 1000); // Gradual increase
        default:
            return baseDelay;
    }
}
function formatCredentialGenerationError(errorCode, attempts = 1, additionalContext) {
    const errorInfo = getCredentialGenerationErrorMessage(errorCode);
    const suggestions = getRecoverySuggestions(errorCode, attempts);
    const canRetry = isRetryableError(errorCode);
    const retryDelay = canRetry ? getRetryDelay(errorCode, attempts) : undefined;
    return {
        title: errorInfo.title,
        message: errorInfo.message,
        userAction: errorInfo.userAction,
        suggestions,
        canRetry,
        retryDelay,
        severity: errorInfo.severity,
        technicalDetails: additionalContext ?
            `${errorInfo.technicalDetails}. Context: ${JSON.stringify(additionalContext)}` :
            errorInfo.technicalDetails,
    };
}
