/**
 * Comprehensive error handling utilities for project management improvements
 * 
 * This module provides:
 * - Standardized error types and codes
 * - Error classification and handling strategies
 * - User-friendly error messages and recovery options
 * - Logging and monitoring integration
 * 
 * Requirements: All error handling scenarios
 */

import { NextApiResponse } from 'next'
import { toast } from 'sonner'

/**
 * Standard error codes for project management operations
 */
export enum ErrorCode {
  // Project deletion errors
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  PROJECT_DELETE_FORBIDDEN = 'PROJECT_DELETE_FORBIDDEN',
  PROJECT_DELETE_FAILED = 'PROJECT_DELETE_FAILED',
  PROJECT_DELETE_DEFAULT_PROJECT = 'PROJECT_DELETE_DEFAULT_PROJECT',
  PROJECT_DELETE_VALIDATION_FAILED = 'PROJECT_DELETE_VALIDATION_FAILED',
  
  // Data isolation errors
  DATA_ISOLATION_FAILED = 'DATA_ISOLATION_FAILED',
  INVALID_PROJECT_ID = 'INVALID_PROJECT_ID',
  PROJECT_ACCESS_DENIED = 'PROJECT_ACCESS_DENIED',
  DATA_OWNERSHIP_VIOLATION = 'DATA_OWNERSHIP_VIOLATION',
  DATA_QUERY_FAILED = 'DATA_QUERY_FAILED',
  
  // Routing errors
  INVALID_PROJECT_REF = 'INVALID_PROJECT_REF',
  SETTINGS_LOAD_FAILED = 'SETTINGS_LOAD_FAILED',
  ROUTE_PARAMETER_INVALID = 'ROUTE_PARAMETER_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Authentication and authorization errors
  USER_NOT_AUTHENTICATED = 'USER_NOT_AUTHENTICATED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Generic errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error recovery strategies
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  REDIRECT = 'redirect',
  REFRESH = 'refresh',
  CONTACT_SUPPORT = 'contact_support',
  MANUAL_INTERVENTION = 'manual_intervention',
  NONE = 'none'
}

/**
 * Structured error information
 */
export interface ErrorInfo {
  code: ErrorCode
  message: string
  userMessage: string
  severity: ErrorSeverity
  recoveryStrategy: RecoveryStrategy
  recoveryOptions?: RecoveryOption[]
  metadata?: Record<string, any>
  timestamp: Date
}

/**
 * Recovery option for user actions
 */
export interface RecoveryOption {
  label: string
  action: () => void | Promise<void>
  type: 'primary' | 'secondary' | 'danger'
}

/**
 * Error context for logging and debugging
 */
export interface ErrorContext {
  userId?: string
  projectId?: number
  projectRef?: string
  operation: string
  endpoint?: string
  userAgent?: string
  ip?: string
  requestId?: string
}

/**
 * Comprehensive error class with context and recovery options
 */
export class ProjectManagementError extends Error {
  public readonly code: ErrorCode
  public readonly userMessage: string
  public readonly severity: ErrorSeverity
  public readonly recoveryStrategy: RecoveryStrategy
  public readonly recoveryOptions?: RecoveryOption[]
  public readonly context?: ErrorContext
  public readonly metadata?: Record<string, any>
  public readonly timestamp: Date

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    recoveryStrategy: RecoveryStrategy = RecoveryStrategy.NONE,
    options?: {
      recoveryOptions?: RecoveryOption[]
      context?: ErrorContext
      metadata?: Record<string, any>
      cause?: Error
    }
  ) {
    super(message, { cause: options?.cause })
    
    this.name = 'ProjectManagementError'
    this.code = code
    this.userMessage = userMessage
    this.severity = severity
    this.recoveryStrategy = recoveryStrategy
    this.recoveryOptions = options?.recoveryOptions
    this.context = options?.context
    this.metadata = options?.metadata
    this.timestamp = new Date()
  }

  /**
   * Convert error to API response format
   */
  toApiResponse(): {
    error: string
    message: string
    code: string
    severity: string
    recoveryStrategy: string
    timestamp: string
    metadata?: Record<string, any>
  } {
    return {
      error: this.name,
      message: this.userMessage,
      code: this.code,
      severity: this.severity,
      recoveryStrategy: this.recoveryStrategy,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata
    }
  }

  /**
   * Log error with appropriate level based on severity
   */
  log(): void {
    const logData = {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      context: this.context,
      metadata: this.metadata,
      timestamp: this.timestamp,
      stack: this.stack
    }

    switch (this.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('CRITICAL ERROR:', logData)
        break
      case ErrorSeverity.HIGH:
        console.error('HIGH SEVERITY ERROR:', logData)
        break
      case ErrorSeverity.MEDIUM:
        console.warn('MEDIUM SEVERITY ERROR:', logData)
        break
      case ErrorSeverity.LOW:
        console.info('LOW SEVERITY ERROR:', logData)
        break
    }
  }
}

/**
 * Error factory for creating standardized errors
 */
export class ErrorFactory {
  /**
   * Create project deletion errors
   */
  static projectDeletion = {
    projectNotFound: (projectRef: string, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.PROJECT_NOT_FOUND,
        `Project not found: ${projectRef}`,
        `The project "${projectRef}" could not be found. It may have been deleted or you may not have access to it.`,
        ErrorSeverity.MEDIUM,
        RecoveryStrategy.REDIRECT,
        {
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
        }
      ),

    deleteForbidden: (projectRef: string, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.PROJECT_DELETE_FORBIDDEN,
        `Delete forbidden for project: ${projectRef}`,
        'You do not have permission to delete this project. Please contact your organization administrator.',
        ErrorSeverity.HIGH,
        RecoveryStrategy.CONTACT_SUPPORT,
        {
          context,
          recoveryOptions: [
            {
              label: 'Contact Admin',
              action: () => toast.info('Please contact your organization administrator for project deletion permissions.'),
              type: 'primary'
            }
          ]
        }
      ),

    deleteFailed: (projectRef: string, cause?: Error, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.PROJECT_DELETE_FAILED,
        `Failed to delete project: ${projectRef}`,
        'Project deletion failed due to a server error. Please try again or contact support if the problem persists.',
        ErrorSeverity.HIGH,
        RecoveryStrategy.RETRY,
        {
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
        }
      ),

    deleteDefaultProject: (context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.PROJECT_DELETE_DEFAULT_PROJECT,
        'Cannot delete default project',
        'The default project cannot be deleted. Please select a different project to delete.',
        ErrorSeverity.MEDIUM,
        RecoveryStrategy.NONE,
        { context }
      ),

    validationFailed: (reason: string, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.PROJECT_DELETE_VALIDATION_FAILED,
        `Project deletion validation failed: ${reason}`,
        `Project deletion was blocked: ${reason}`,
        ErrorSeverity.MEDIUM,
        RecoveryStrategy.MANUAL_INTERVENTION,
        { context }
      )
  }

  /**
   * Create data isolation errors
   */
  static dataIsolation = {
    isolationFailed: (operation: string, cause?: Error, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.DATA_ISOLATION_FAILED,
        `Data isolation failed for operation: ${operation}`,
        'A data isolation error occurred. Your request could not be processed safely.',
        ErrorSeverity.HIGH,
        RecoveryStrategy.REFRESH,
        {
          context,
          cause,
          recoveryOptions: [
            {
              label: 'Refresh Page',
              action: () => window.location.reload(),
              type: 'primary'
            }
          ]
        }
      ),

    invalidProjectId: (projectId: any, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.INVALID_PROJECT_ID,
        `Invalid project ID: ${projectId}`,
        'The project ID is invalid. Please check the URL and try again.',
        ErrorSeverity.MEDIUM,
        RecoveryStrategy.REDIRECT,
        {
          context,
          recoveryOptions: [
            {
              label: 'Go to Projects',
              action: () => window.location.href = '/projects',
              type: 'primary'
            }
          ]
        }
      ),

    accessDenied: (projectRef: string, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.PROJECT_ACCESS_DENIED,
        `Access denied to project: ${projectRef}`,
        'You do not have permission to access this project\'s data.',
        ErrorSeverity.HIGH,
        RecoveryStrategy.CONTACT_SUPPORT,
        {
          context,
          recoveryOptions: [
            {
              label: 'Contact Admin',
              action: () => toast.info('Please contact your organization administrator for project access.'),
              type: 'primary'
            }
          ]
        }
      ),

    ownershipViolation: (details: string, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.DATA_OWNERSHIP_VIOLATION,
        `Data ownership violation: ${details}`,
        'A data security violation was detected. The operation was blocked for your protection.',
        ErrorSeverity.CRITICAL,
        RecoveryStrategy.CONTACT_SUPPORT,
        {
          context,
          recoveryOptions: [
            {
              label: 'Contact Support',
              action: () => window.open('/support', '_blank'),
              type: 'danger'
            }
          ]
        }
      ),

    queryFailed: (dataType: string, cause?: Error, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.DATA_QUERY_FAILED,
        `Failed to query ${dataType} data`,
        `Failed to load ${dataType} data. Please try again.`,
        ErrorSeverity.MEDIUM,
        RecoveryStrategy.RETRY,
        {
          context,
          cause,
          recoveryOptions: [
            {
              label: 'Retry',
              action: () => window.location.reload(),
              type: 'primary'
            }
          ]
        }
      )
  }

  /**
   * Create routing errors
   */
  static routing = {
    invalidProjectRef: (projectRef: string, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.INVALID_PROJECT_REF,
        `Invalid project reference: ${projectRef}`,
        'The project reference in the URL is invalid. Please check the URL and try again.',
        ErrorSeverity.MEDIUM,
        RecoveryStrategy.REDIRECT,
        {
          context,
          recoveryOptions: [
            {
              label: 'Go to Projects',
              action: () => window.location.href = '/projects',
              type: 'primary'
            }
          ]
        }
      ),

    settingsLoadFailed: (projectRef: string, cause?: Error, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.SETTINGS_LOAD_FAILED,
        `Failed to load settings for project: ${projectRef}`,
        'Failed to load project settings. Please try again or contact support if the problem persists.',
        ErrorSeverity.MEDIUM,
        RecoveryStrategy.RETRY,
        {
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
        }
      ),

    sessionExpired: (context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.SESSION_EXPIRED,
        'User session has expired',
        'Your session has expired. Please log in again to continue.',
        ErrorSeverity.MEDIUM,
        RecoveryStrategy.REDIRECT,
        {
          context,
          recoveryOptions: [
            {
              label: 'Log In',
              action: () => window.location.href = '/sign-in',
              type: 'primary'
            }
          ]
        }
      )
  }

  /**
   * Create authentication/authorization errors
   */
  static auth = {
    notAuthenticated: (context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.USER_NOT_AUTHENTICATED,
        'User not authenticated',
        'You must be logged in to perform this action.',
        ErrorSeverity.HIGH,
        RecoveryStrategy.REDIRECT,
        {
          context,
          recoveryOptions: [
            {
              label: 'Log In',
              action: () => window.location.href = '/sign-in',
              type: 'primary'
            }
          ]
        }
      ),

    insufficientPermissions: (resource: string, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        `Insufficient permissions for: ${resource}`,
        `You do not have permission to access ${resource}. Please contact your administrator.`,
        ErrorSeverity.HIGH,
        RecoveryStrategy.CONTACT_SUPPORT,
        {
          context,
          recoveryOptions: [
            {
              label: 'Contact Admin',
              action: () => toast.info('Please contact your organization administrator for access permissions.'),
              type: 'primary'
            }
          ]
        }
      )
  }

  /**
   * Create validation errors
   */
  static validation = {
    invalidInput: (field: string, reason: string, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.INVALID_INPUT,
        `Invalid input for ${field}: ${reason}`,
        `Invalid ${field}: ${reason}`,
        ErrorSeverity.LOW,
        RecoveryStrategy.MANUAL_INTERVENTION,
        { context }
      ),

    missingRequiredField: (field: string, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        `Missing required field: ${field}`,
        `${field} is required. Please provide a value.`,
        ErrorSeverity.LOW,
        RecoveryStrategy.MANUAL_INTERVENTION,
        { context }
      )
  }

  /**
   * Create generic errors
   */
  static generic = {
    internalServerError: (operation: string, cause?: Error, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.INTERNAL_SERVER_ERROR,
        `Internal server error during: ${operation}`,
        'An unexpected error occurred. Please try again or contact support if the problem persists.',
        ErrorSeverity.HIGH,
        RecoveryStrategy.RETRY,
        {
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
        }
      ),

    networkError: (operation: string, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.NETWORK_ERROR,
        `Network error during: ${operation}`,
        'Network connection failed. Please check your internet connection and try again.',
        ErrorSeverity.MEDIUM,
        RecoveryStrategy.RETRY,
        {
          context,
          recoveryOptions: [
            {
              label: 'Retry',
              action: () => window.location.reload(),
              type: 'primary'
            }
          ]
        }
      ),

    timeoutError: (operation: string, context?: ErrorContext) =>
      new ProjectManagementError(
        ErrorCode.TIMEOUT_ERROR,
        `Timeout error during: ${operation}`,
        'The operation timed out. Please try again.',
        ErrorSeverity.MEDIUM,
        RecoveryStrategy.RETRY,
        {
          context,
          recoveryOptions: [
            {
              label: 'Try Again',
              action: () => window.location.reload(),
              type: 'primary'
            }
          ]
        }
      )
  }
}

/**
 * Error handler for API responses
 */
export function handleApiError(
  error: ProjectManagementError,
  res: NextApiResponse,
  context?: ErrorContext
): void {
  // Log the error
  error.log()

  // Add context if provided
  if (context && !error.context) {
    error.context = context
  }

  // Determine HTTP status code based on error code
  let statusCode = 500
  switch (error.code) {
    case ErrorCode.PROJECT_NOT_FOUND:
    case ErrorCode.INVALID_PROJECT_REF:
      statusCode = 404
      break
    case ErrorCode.PROJECT_DELETE_FORBIDDEN:
    case ErrorCode.PROJECT_ACCESS_DENIED:
    case ErrorCode.INSUFFICIENT_PERMISSIONS:
    case ErrorCode.DATA_OWNERSHIP_VIOLATION:
      statusCode = 403
      break
    case ErrorCode.USER_NOT_AUTHENTICATED:
    case ErrorCode.SESSION_EXPIRED:
      statusCode = 401
      break
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.MISSING_REQUIRED_FIELD:
    case ErrorCode.PROJECT_DELETE_VALIDATION_FAILED:
    case ErrorCode.INVALID_PROJECT_ID:
      statusCode = 400
      break
    default:
      statusCode = 500
  }

  // Send error response
  if (!res.headersSent) {
    res.status(statusCode).json(error.toApiResponse())
  }
}

/**
 * Error handler for client-side errors
 */
export function handleClientError(
  error: ProjectManagementError,
  options?: {
    showToast?: boolean
    showRecoveryOptions?: boolean
  }
): void {
  // Log the error
  error.log()

  // Show toast notification if requested
  if (options?.showToast !== false) {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        toast.error(error.userMessage)
        break
      case ErrorSeverity.MEDIUM:
        toast.warning(error.userMessage)
        break
      case ErrorSeverity.LOW:
        toast.info(error.userMessage)
        break
    }
  }

  // Show recovery options if available and requested
  if (options?.showRecoveryOptions !== false && error.recoveryOptions?.length) {
    // This would typically integrate with a modal or notification system
    // For now, we'll just log the available recovery options
    console.info('Recovery options available:', error.recoveryOptions)
  }
}

/**
 * Utility to wrap async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorContext: ErrorContext,
  errorFactory: (cause: Error) => ProjectManagementError
): Promise<T> {
  try {
    return await operation()
  } catch (cause) {
    const error = errorFactory(cause as Error)
    error.context = { ...error.context, ...errorContext }
    throw error
  }
}

/**
 * Utility to create error context from request
 */
export function createErrorContext(
  operation: string,
  options?: {
    userId?: string
    projectId?: number
    projectRef?: string
    endpoint?: string
    userAgent?: string
    ip?: string
    requestId?: string
  }
): ErrorContext {
  return {
    operation,
    timestamp: new Date(),
    ...options
  }
}