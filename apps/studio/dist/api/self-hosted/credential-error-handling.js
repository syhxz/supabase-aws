"use strict";
/**
 * Comprehensive Error Handling System for Credential Management.
 * Provides retry logic, circuit breaker pattern, graceful degradation, and error recovery mechanisms.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CredentialErrorHandler = exports.GracefulDegradationManager = exports.RetryManager = exports.CircuitBreaker = exports.CircuitBreakerState = exports.CredentialError = exports.ErrorSeverity = exports.CredentialErrorType = void 0;
exports.getCredentialErrorHandler = getCredentialErrorHandler;
exports.resetCredentialErrorHandler = resetCredentialErrorHandler;
/**
 * Error types for credential operations
 */
var CredentialErrorType;
(function (CredentialErrorType) {
    CredentialErrorType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    CredentialErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
    CredentialErrorType["DATABASE_ERROR"] = "DATABASE_ERROR";
    CredentialErrorType["AUTHENTICATION_ERROR"] = "AUTHENTICATION_ERROR";
    CredentialErrorType["AUTHORIZATION_ERROR"] = "AUTHORIZATION_ERROR";
    CredentialErrorType["CONFIGURATION_ERROR"] = "CONFIGURATION_ERROR";
    CredentialErrorType["TIMEOUT_ERROR"] = "TIMEOUT_ERROR";
    CredentialErrorType["RATE_LIMIT_ERROR"] = "RATE_LIMIT_ERROR";
    CredentialErrorType["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    CredentialErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(CredentialErrorType || (exports.CredentialErrorType = CredentialErrorType = {}));
/**
 * Error severity levels
 */
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["LOW"] = "LOW";
    ErrorSeverity["MEDIUM"] = "MEDIUM";
    ErrorSeverity["HIGH"] = "HIGH";
    ErrorSeverity["CRITICAL"] = "CRITICAL";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
/**
 * Structured error class for credential operations
 */
class CredentialError extends Error {
    constructor(message, type, severity = ErrorSeverity.MEDIUM, retryable = false, context = {}, originalError) {
        super(message);
        this.name = 'CredentialError';
        this.type = type;
        this.severity = severity;
        this.retryable = retryable;
        this.context = context;
        this.timestamp = new Date().toISOString();
        this.originalError = originalError;
        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CredentialError);
        }
    }
    /**
     * Creates a validation error
     */
    static validation(message, context = {}) {
        return new CredentialError(message, CredentialErrorType.VALIDATION_ERROR, ErrorSeverity.MEDIUM, false, context);
    }
    /**
     * Creates a network error (retryable)
     */
    static network(message, context = {}, originalError) {
        return new CredentialError(message, CredentialErrorType.NETWORK_ERROR, ErrorSeverity.HIGH, true, context, originalError);
    }
    /**
     * Creates a database error (retryable)
     */
    static database(message, context = {}, originalError) {
        return new CredentialError(message, CredentialErrorType.DATABASE_ERROR, ErrorSeverity.HIGH, true, context, originalError);
    }
    /**
     * Creates a configuration error
     */
    static configuration(message, context = {}) {
        return new CredentialError(message, CredentialErrorType.CONFIGURATION_ERROR, ErrorSeverity.CRITICAL, false, context);
    }
    /**
     * Creates a timeout error (retryable)
     */
    static timeout(message, context = {}) {
        return new CredentialError(message, CredentialErrorType.TIMEOUT_ERROR, ErrorSeverity.MEDIUM, true, context);
    }
    /**
     * Creates a service unavailable error (retryable)
     */
    static serviceUnavailable(message, context = {}) {
        return new CredentialError(message, CredentialErrorType.SERVICE_UNAVAILABLE, ErrorSeverity.HIGH, true, context);
    }
    /**
     * Converts a generic error to a CredentialError
     */
    static fromError(error, context = {}) {
        if (error instanceof CredentialError) {
            return error;
        }
        // Classify error based on message and type
        let type = CredentialErrorType.UNKNOWN_ERROR;
        let severity = ErrorSeverity.MEDIUM;
        let retryable = false;
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('network') || errorMessage.includes('connection')) {
            type = CredentialErrorType.NETWORK_ERROR;
            severity = ErrorSeverity.HIGH;
            retryable = true;
        }
        else if (errorMessage.includes('database') || errorMessage.includes('sql')) {
            type = CredentialErrorType.DATABASE_ERROR;
            severity = ErrorSeverity.HIGH;
            retryable = true;
        }
        else if (errorMessage.includes('timeout')) {
            type = CredentialErrorType.TIMEOUT_ERROR;
            severity = ErrorSeverity.MEDIUM;
            retryable = true;
        }
        else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
            type = CredentialErrorType.VALIDATION_ERROR;
            severity = ErrorSeverity.MEDIUM;
            retryable = false;
        }
        else if (errorMessage.includes('config') || errorMessage.includes('environment')) {
            type = CredentialErrorType.CONFIGURATION_ERROR;
            severity = ErrorSeverity.CRITICAL;
            retryable = false;
        }
        return new CredentialError(error.message, type, severity, retryable, context, error);
    }
    /**
     * Serializes the error for logging
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            severity: this.severity,
            retryable: this.retryable,
            context: this.context,
            timestamp: this.timestamp,
            stack: this.stack,
            originalError: this.originalError ? {
                name: this.originalError.name,
                message: this.originalError.message,
                stack: this.originalError.stack
            } : undefined
        };
    }
}
exports.CredentialError = CredentialError;
/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (error) => {
        if (error instanceof CredentialError) {
            return error.retryable;
        }
        // Default: retry network, timeout, and service unavailable errors
        const message = error.message.toLowerCase();
        return message.includes('network') ||
            message.includes('timeout') ||
            message.includes('connection') ||
            message.includes('unavailable');
    }
};
/**
 * Circuit breaker states
 */
var CircuitBreakerState;
(function (CircuitBreakerState) {
    CircuitBreakerState["CLOSED"] = "CLOSED";
    CircuitBreakerState["OPEN"] = "OPEN";
    CircuitBreakerState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitBreakerState || (exports.CircuitBreakerState = CircuitBreakerState = {}));
/**
 * Default circuit breaker configuration
 */
const DEFAULT_CIRCUIT_BREAKER_OPTIONS = {
    failureThreshold: 5, // Open after 5 failures
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 10000, // 10 seconds
    halfOpenMaxCalls: 3 // Allow 3 calls in half-open state
};
/**
 * Circuit breaker implementation for credential services
 */
class CircuitBreaker {
    constructor(options = {}) {
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.halfOpenCalls = 0;
        this.options = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...options };
    }
    /**
     * Executes a function with circuit breaker protection
     */
    async execute(fn, context = 'unknown') {
        if (this.state === CircuitBreakerState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.options.recoveryTimeout) {
                this.state = CircuitBreakerState.HALF_OPEN;
                this.halfOpenCalls = 0;
                console.log(`[Circuit Breaker] ${context}: Transitioning to HALF_OPEN state`);
            }
            else {
                throw CredentialError.serviceUnavailable(`Circuit breaker is OPEN for ${context}. Service temporarily unavailable.`, {
                    circuitBreakerState: this.state,
                    failureCount: this.failureCount,
                    lastFailureTime: this.lastFailureTime
                });
            }
        }
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            if (this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
                throw CredentialError.serviceUnavailable(`Circuit breaker is HALF_OPEN for ${context}. Maximum test calls exceeded.`, {
                    circuitBreakerState: this.state,
                    halfOpenCalls: this.halfOpenCalls,
                    maxCalls: this.options.halfOpenMaxCalls
                });
            }
            this.halfOpenCalls++;
        }
        try {
            const result = await fn();
            this.onSuccess(context);
            return result;
        }
        catch (error) {
            this.onFailure(error, context);
            throw error;
        }
    }
    /**
     * Handles successful execution
     */
    onSuccess(context) {
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.state = CircuitBreakerState.CLOSED;
            this.failureCount = 0;
            console.log(`[Circuit Breaker] ${context}: Transitioning to CLOSED state after successful recovery`);
        }
        this.failureCount = 0;
    }
    /**
     * Handles failed execution
     */
    onFailure(error, context) {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.state = CircuitBreakerState.OPEN;
            console.log(`[Circuit Breaker] ${context}: Transitioning to OPEN state after failure in HALF_OPEN`);
        }
        else if (this.failureCount >= this.options.failureThreshold) {
            this.state = CircuitBreakerState.OPEN;
            console.log(`[Circuit Breaker] ${context}: Transitioning to OPEN state after ${this.failureCount} failures`);
        }
        console.error(`[Circuit Breaker] ${context}: Failure recorded`, {
            error: error.message,
            failureCount: this.failureCount,
            state: this.state
        });
    }
    /**
     * Gets current circuit breaker status
     */
    getStatus() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
            halfOpenCalls: this.halfOpenCalls
        };
    }
    /**
     * Resets the circuit breaker to closed state
     */
    reset() {
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.halfOpenCalls = 0;
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Retry mechanism with exponential backoff and jitter
 */
class RetryManager {
    constructor(options = {}) {
        this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
    }
    /**
     * Executes a function with retry logic
     */
    async execute(fn, context = 'unknown', customOptions) {
        const finalOptions = { ...this.options, ...customOptions };
        let lastError;
        for (let attempt = 1; attempt <= finalOptions.maxAttempts; attempt++) {
            try {
                const result = await fn();
                if (attempt > 1) {
                    console.log(`[Retry Manager] ${context}: Succeeded on attempt ${attempt}`);
                }
                return result;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                // Check if we should retry this error
                const shouldRetry = finalOptions.retryCondition ?
                    finalOptions.retryCondition(lastError) :
                    DEFAULT_RETRY_OPTIONS.retryCondition(lastError);
                if (!shouldRetry || attempt === finalOptions.maxAttempts) {
                    console.error(`[Retry Manager] ${context}: Failed after ${attempt} attempts`, {
                        error: lastError.message,
                        shouldRetry,
                        finalAttempt: attempt === finalOptions.maxAttempts
                    });
                    throw CredentialError.fromError(lastError, {
                        context,
                        attempts: attempt,
                        maxAttempts: finalOptions.maxAttempts
                    });
                }
                // Calculate delay for next attempt
                const delay = this.calculateDelay(attempt, finalOptions);
                console.warn(`[Retry Manager] ${context}: Attempt ${attempt} failed, retrying in ${delay}ms`, {
                    error: lastError.message,
                    nextAttempt: attempt + 1
                });
                await this.sleep(delay);
            }
        }
        // This should never be reached, but TypeScript requires it
        throw CredentialError.fromError(lastError, { context, attempts: finalOptions.maxAttempts });
    }
    /**
     * Calculates delay with exponential backoff and optional jitter
     */
    calculateDelay(attempt, options) {
        const exponentialDelay = options.baseDelay * Math.pow(options.backoffMultiplier, attempt - 1);
        const cappedDelay = Math.min(exponentialDelay, options.maxDelay);
        if (options.jitter) {
            // Add random jitter (±25% of the delay)
            const jitterRange = cappedDelay * 0.25;
            const jitter = (Math.random() - 0.5) * 2 * jitterRange;
            return Math.max(0, cappedDelay + jitter);
        }
        return cappedDelay;
    }
    /**
     * Sleep utility function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.RetryManager = RetryManager;
/**
 * Graceful degradation manager for credential services
 */
class GracefulDegradationManager {
    constructor() {
        this.fallbackStrategies = new Map();
        this.serviceHealth = new Map();
    }
    /**
     * Registers a fallback strategy for a service
     */
    registerFallback(serviceName, fallbackFn) {
        this.fallbackStrategies.set(serviceName, fallbackFn);
    }
    /**
     * Executes a service with graceful degradation
     */
    async executeWithFallback(serviceName, primaryFn, context = 'unknown') {
        try {
            const result = await primaryFn();
            this.markServiceHealthy(serviceName);
            return result;
        }
        catch (error) {
            console.warn(`[Graceful Degradation] ${context}: Primary service ${serviceName} failed`, {
                error: error instanceof Error ? error.message : String(error)
            });
            this.markServiceUnhealthy(serviceName);
            // Try fallback strategy if available
            const fallbackFn = this.fallbackStrategies.get(serviceName);
            if (fallbackFn) {
                try {
                    console.log(`[Graceful Degradation] ${context}: Attempting fallback for ${serviceName}`);
                    const fallbackResult = await fallbackFn();
                    console.log(`[Graceful Degradation] ${context}: Fallback succeeded for ${serviceName}`);
                    return fallbackResult;
                }
                catch (fallbackError) {
                    console.error(`[Graceful Degradation] ${context}: Fallback also failed for ${serviceName}`, {
                        fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                    });
                    throw CredentialError.fromError(error instanceof Error ? error : new Error(String(error)), {
                        context,
                        serviceName,
                        fallbackAttempted: true,
                        fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                    });
                }
            }
            // No fallback available
            throw CredentialError.fromError(error instanceof Error ? error : new Error(String(error)), { context, serviceName, fallbackAvailable: false });
        }
    }
    /**
     * Marks a service as healthy
     */
    markServiceHealthy(serviceName) {
        const wasUnhealthy = this.serviceHealth.get(serviceName) === false;
        this.serviceHealth.set(serviceName, true);
        if (wasUnhealthy) {
            console.log(`[Graceful Degradation] Service ${serviceName} recovered`);
        }
    }
    /**
     * Marks a service as unhealthy
     */
    markServiceUnhealthy(serviceName) {
        const wasHealthy = this.serviceHealth.get(serviceName) !== false;
        this.serviceHealth.set(serviceName, false);
        if (wasHealthy) {
            console.warn(`[Graceful Degradation] Service ${serviceName} marked as unhealthy`);
        }
    }
    /**
     * Gets health status of all services
     */
    getServiceHealth() {
        return Object.fromEntries(this.serviceHealth.entries());
    }
    /**
     * Checks if a service is healthy
     */
    isServiceHealthy(serviceName) {
        return this.serviceHealth.get(serviceName) !== false;
    }
}
exports.GracefulDegradationManager = GracefulDegradationManager;
/**
 * Comprehensive error handler that combines all error handling strategies
 */
class CredentialErrorHandler {
    constructor(retryOptions, circuitBreakerOptions) {
        this.circuitBreakers = new Map();
        this.retryManager = new RetryManager(retryOptions);
        this.degradationManager = new GracefulDegradationManager();
    }
    /**
     * Gets or creates a circuit breaker for a service
     */
    getCircuitBreaker(serviceName, options) {
        if (!this.circuitBreakers.has(serviceName)) {
            this.circuitBreakers.set(serviceName, new CircuitBreaker(options));
        }
        return this.circuitBreakers.get(serviceName);
    }
    /**
     * Executes a function with comprehensive error handling
     */
    async executeWithErrorHandling(fn, options) {
        const { serviceName, context, retryOptions, circuitBreakerOptions, fallbackFn, enableRetry = true, enableCircuitBreaker = true, enableGracefulDegradation = true } = options;
        // Register fallback if provided
        if (enableGracefulDegradation && fallbackFn) {
            this.degradationManager.registerFallback(serviceName, fallbackFn);
        }
        // Create the execution function with proper layering to avoid circular dependencies
        let executionFn = fn;
        // Layer 1: Circuit breaker (innermost)
        if (enableCircuitBreaker) {
            const circuitBreaker = this.getCircuitBreaker(serviceName, circuitBreakerOptions);
            const originalFn = executionFn;
            executionFn = () => circuitBreaker.execute(originalFn, `${serviceName}:${context}`);
        }
        // Layer 2: Retry logic (middle)
        if (enableRetry) {
            const originalFn = executionFn;
            executionFn = () => this.retryManager.execute(originalFn, `${serviceName}:${context}`, retryOptions);
        }
        // Layer 3: Graceful degradation (outermost)
        if (enableGracefulDegradation) {
            return this.degradationManager.executeWithFallback(serviceName, executionFn, `${serviceName}:${context}`);
        }
        return executionFn();
    }
    /**
     * Gets status of all error handling components
     */
    getStatus() {
        const circuitBreakerStatus = {};
        this.circuitBreakers.forEach((breaker, serviceName) => {
            circuitBreakerStatus[serviceName] = breaker.getStatus();
        });
        return {
            circuitBreakers: circuitBreakerStatus,
            serviceHealth: this.degradationManager.getServiceHealth()
        };
    }
    /**
     * Resets all circuit breakers
     */
    resetCircuitBreakers() {
        this.circuitBreakers.forEach((breaker, serviceName) => {
            breaker.reset();
            console.log(`[Error Handler] Reset circuit breaker for ${serviceName}`);
        });
    }
}
exports.CredentialErrorHandler = CredentialErrorHandler;
/**
 * Global error handler instance
 */
let globalErrorHandler = null;
/**
 * Gets the global error handler instance
 */
function getCredentialErrorHandler() {
    if (!globalErrorHandler) {
        globalErrorHandler = new CredentialErrorHandler();
    }
    return globalErrorHandler;
}
/**
 * Resets the global error handler (useful for testing)
 */
function resetCredentialErrorHandler() {
    globalErrorHandler = null;
}
