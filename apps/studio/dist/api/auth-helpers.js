"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUserId = getCurrentUserId;
exports.getProjectLegacyJwtSecret = getProjectLegacyJwtSecret;
exports.validateJwtTokenWithMultipleSources = validateJwtTokenWithMultipleSources;
exports.validateUserProjectAccess = validateUserProjectAccess;
exports.validateUserProjectAccessByRef = validateUserProjectAccessByRef;
exports.getUserProjectPermissions = getUserProjectPermissions;
exports.extractUserIdFromToken = extractUserIdFromToken;
exports.isAuthenticated = isAuthenticated;
exports.requireAuthentication = requireAuthentication;
exports.requireProjectAccess = requireProjectAccess;
exports.requireProjectAccessByRef = requireProjectAccessByRef;
exports.isUserIsolationEnabled = isUserIsolationEnabled;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Get the current authenticated user ID from the request
 *
 * @param req - Next.js API request object
 * @param projectRef - Optional project reference for project-specific JWT verification
 * @param requireProjectRef - @deprecated This parameter is no longer used. GoTrue JWT tokens do not contain project_ref claim. Project access is verified via database queries instead.
 * @returns User ID string or null if not authenticated
 */
async function getCurrentUserId(req, projectRef, requireProjectRef = false) {
    try {
        // Extract JWT token from Authorization header or cookies
        const token = extractTokenFromRequest(req);
        if (!token) {
            // Log authentication failure - token missing
            const { logAuthenticationFailure, extractErrorContextFromRequest } = await Promise.resolve().then(() => __importStar(require('./error-handling')));
            const context = extractErrorContextFromRequest(req, 'getCurrentUserId', { projectRef });
            logAuthenticationFailure(context, 'Authentication token missing from request');
            return null;
        }
        // If no projectRef provided, try to extract it from the request
        const resolvedProjectRef = projectRef || extractProjectRefFromRequest(req);
        // Verify and decode the JWT token (with optional project-specific secret)
        // Note: We no longer require project_ref claim as GoTrue JWT tokens don't contain it
        // Project access is verified separately via database queries
        const decoded = await verifyJwtToken(token, resolvedProjectRef || undefined, req, false);
        if (!decoded || !decoded.sub) {
            // Log authentication failure - invalid token
            const { logAuthenticationFailure, extractErrorContextFromRequest } = await Promise.resolve().then(() => __importStar(require('./error-handling')));
            const context = extractErrorContextFromRequest(req, 'getCurrentUserId', { projectRef: resolvedProjectRef || undefined });
            logAuthenticationFailure(context, 'JWT token verification failed or missing subject claim');
            return null;
        }
        return decoded.sub;
    }
    catch (error) {
        // Log authentication failure - unexpected error
        const { logAuthenticationFailure, extractErrorContextFromRequest } = await Promise.resolve().then(() => __importStar(require('./error-handling')));
        const context = extractErrorContextFromRequest(req, 'getCurrentUserId', { projectRef });
        logAuthenticationFailure(context, `Unexpected error during authentication: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('Error getting current user ID:', error);
        return null;
    }
}
/**
 * Extract project reference from request URL
 *
 * @param req - Next.js API request object
 * @returns Project reference string or null if not found
 */
function extractProjectRefFromRequest(req) {
    // Try to extract project ref from URL path
    // Common patterns: /api/v1/projects/[ref]/... or /api/platform/projects/[ref]/...
    const url = req.url || '';
    // Match patterns like /projects/[ref]/ or /projects/[ref]?
    const projectRefMatch = url.match(/\/projects\/([^\/\?]+)/);
    if (projectRefMatch && projectRefMatch[1]) {
        return projectRefMatch[1];
    }
    // Try to get from query parameters
    if (req.query && req.query.ref && typeof req.query.ref === 'string') {
        return req.query.ref;
    }
    return null;
}
/**
 * Extract JWT token from request (Authorization header or cookies)
 *
 * @param req - Next.js API request object
 * @returns JWT token string or null if not found
 */
function extractTokenFromRequest(req) {
    // Check for Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token.length > 0) {
            return token;
        }
    }
    // Check for session cookie (alternative auth method)
    const sessionCookie = req.cookies['supabase-auth-token'] || req.cookies['sb-access-token'];
    if (sessionCookie) {
        return sessionCookie;
    }
    // Check for access token in cookies (Supabase auth)
    const accessToken = req.cookies['sb-access-token'];
    if (accessToken) {
        return accessToken;
    }
    return null;
}
/**
 * Verify JWT token signature and expiration
 * Supports both global and project-specific JWT secrets
 *
 * @param token - JWT token string
 * @param projectRef - Optional project reference for project-specific JWT secrets
 * @param req - Optional Next.js API request for logging context
 * @param requireProjectRef - @deprecated This parameter is no longer used. GoTrue JWT tokens do not contain project_ref claim. Project access is verified via database queries instead.
 * @returns Decoded token payload or null if invalid
 */
async function verifyJwtToken(token, projectRef, req, requireProjectRef = false) {
    try {
        // Build list of valid issuers for JWT verification (used across all verification attempts)
        const validIssuers = [];
        if (process.env.SUPABASE_URL) {
            validIssuers.push(process.env.SUPABASE_URL);
        }
        if (process.env.SUPABASE_API_URL) {
            validIssuers.push(process.env.SUPABASE_API_URL);
        }
        // Also accept the external URL as a valid issuer (for tokens issued by GoTrue)
        if (process.env.GOTRUE_JWT_ISSUER) {
            validIssuers.push(process.env.GOTRUE_JWT_ISSUER);
        }
        // Accept localhost:8000 as fallback for development
        if (process.env.NODE_ENV === 'development') {
            validIssuers.push('http://localhost:8000');
        }
        // First, try with global JWT secret
        const globalJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
        if (globalJwtSecret) {
            try {
                // Try with issuer validation first (more secure)
                const verifyOptions = {
                    algorithms: ['HS256'],
                };
                // Add issuer validation if we have valid issuers configured
                // But only if the token actually has an issuer claim
                const decodedForIssuerCheck = jsonwebtoken_1.default.decode(token);
                const tokenHasIssuer = decodedForIssuerCheck && decodedForIssuerCheck.iss;
                if (validIssuers.length > 0 && tokenHasIssuer) {
                    verifyOptions.issuer = validIssuers.length === 1 ? validIssuers[0] : validIssuers;
                }
                const decoded = jsonwebtoken_1.default.verify(token, globalJwtSecret, verifyOptions);
                if (typeof decoded === 'object' && decoded !== null && 'sub' in decoded) {
                    // Token is valid with required user identity claims
                    // Note: We no longer check for project_ref claim as GoTrue JWT doesn't include it
                    // Project access is verified separately via database queries
                    return decoded;
                }
            }
            catch (globalError) {
                // Log detailed error for issuer mismatch
                // Requirements: 6.2, 6.4, 6.5
                if (globalError instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                    const errorMessage = globalError.message;
                    const isIssuerError = errorMessage.includes('issuer');
                    if (isIssuerError) {
                        // Extract issuer from token for logging (without exposing the full token)
                        try {
                            const decodedUnsafe = jsonwebtoken_1.default.decode(token);
                            const tokenIssuer = decodedUnsafe?.iss || 'undefined';
                            console.error('[JWT Verification] Issuer validation failed', {
                                error: errorMessage,
                                expectedIssuers: validIssuers.length > 0 ? validIssuers : 'none configured',
                                tokenIssuer,
                                userId: decodedUnsafe?.sub || 'unknown',
                                projectRef: decodedUnsafe?.project_ref || projectRef || 'unknown',
                                // Note: Full token and secrets are NOT logged for security
                            });
                        }
                        catch (decodeError) {
                            console.error('[JWT Verification] Issuer validation failed (unable to decode token)', {
                                error: errorMessage,
                                expectedIssuers: validIssuers.length > 0 ? validIssuers : 'none configured',
                            });
                        }
                    }
                    else {
                        console.warn('[JWT Verification] Token validation failed:', errorMessage);
                    }
                }
                // If global secret fails and we have a project reference, try project-specific secret
                if (projectRef) {
                    console.log('Global JWT verification failed, trying project-specific secret for project:', projectRef);
                }
                else {
                    // No project reference, so we can't try project-specific secret
                    // Log the authentication failure
                    if (req) {
                        const { logAuthenticationFailure, extractErrorContextFromRequest } = await Promise.resolve().then(() => __importStar(require('./error-handling')));
                        const context = extractErrorContextFromRequest(req, 'verifyJwtToken', { projectRef });
                        const errorMessage = globalError instanceof jsonwebtoken_1.default.TokenExpiredError
                            ? 'JWT token expired'
                            : globalError instanceof jsonwebtoken_1.default.JsonWebTokenError
                                ? `JWT token invalid: ${globalError.message}`
                                : 'JWT verification failed';
                        logAuthenticationFailure(context, errorMessage);
                    }
                    throw globalError;
                }
            }
        }
        // Try project-specific JWT secret if available
        if (projectRef) {
            const projectJwtSecret = await getProjectJwtSecret(projectRef);
            if (projectJwtSecret) {
                try {
                    const decoded = jsonwebtoken_1.default.verify(token, projectJwtSecret, {
                        algorithms: ['HS256'],
                    });
                    if (typeof decoded === 'object' && decoded !== null && 'sub' in decoded) {
                        console.log('Successfully verified JWT with project-specific secret for project:', projectRef);
                        // Token is valid with required user identity claims
                        // Note: We no longer check for project_ref claim
                        return decoded;
                    }
                }
                catch (projectError) {
                    // Log detailed error for issuer mismatch with project-specific secret
                    // Requirements: 6.2, 6.4, 6.5
                    if (projectError instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                        const errorMessage = projectError.message;
                        const isIssuerError = errorMessage.includes('issuer');
                        if (isIssuerError) {
                            // Extract issuer from token for logging (without exposing the full token)
                            try {
                                const decodedUnsafe = jsonwebtoken_1.default.decode(token);
                                const tokenIssuer = decodedUnsafe?.iss || 'undefined';
                                console.error('[JWT Verification] Project-specific issuer validation failed', {
                                    error: errorMessage,
                                    projectRef,
                                    tokenIssuer,
                                    userId: decodedUnsafe?.sub || 'unknown',
                                    projectRefInToken: decodedUnsafe?.project_ref || 'unknown',
                                    // Note: Full token and secrets are NOT logged for security
                                });
                            }
                            catch (decodeError) {
                                console.error('[JWT Verification] Project-specific issuer validation failed (unable to decode token)', {
                                    error: errorMessage,
                                    projectRef,
                                });
                            }
                        }
                        else {
                            console.warn('Project-specific JWT verification also failed for project:', projectRef, projectError?.message || 'Unknown error');
                        }
                    }
                    else {
                        console.warn('Project-specific JWT verification also failed for project:', projectRef, projectError?.message || 'Unknown error');
                    }
                    // Log the authentication failure
                    if (req) {
                        const { logAuthenticationFailure, extractErrorContextFromRequest } = await Promise.resolve().then(() => __importStar(require('./error-handling')));
                        const context = extractErrorContextFromRequest(req, 'verifyJwtToken', { projectRef });
                        const errorMessage = projectError instanceof jsonwebtoken_1.default.TokenExpiredError
                            ? 'JWT token expired'
                            : projectError instanceof jsonwebtoken_1.default.JsonWebTokenError
                                ? `JWT token invalid: ${projectError.message}`
                                : 'JWT verification failed with project-specific secret';
                        logAuthenticationFailure(context, errorMessage);
                    }
                }
            }
        }
        return null;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            console.warn('JWT token expired:', error.message);
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            console.warn('JWT token invalid:', error.message);
        }
        else {
            console.error('JWT verification error:', error);
        }
        return null;
    }
}
/**
 * Get project-specific JWT secret from project settings
 *
 * @param projectRef - Project reference
 * @returns JWT secret string or null if not found
 */
async function getProjectJwtSecret(projectRef) {
    try {
        // Skip project-specific secret lookup for special endpoints that don't represent actual projects
        const specialEndpoints = ['create', 'index', 'list'];
        if (specialEndpoints.includes(projectRef)) {
            return null;
        }
        // Import the project store functions to get project information
        const { findByRef } = await Promise.resolve().then(() => __importStar(require('./self-hosted/project-store-pg')));
        // First check if the project exists
        const projectResult = await findByRef(projectRef);
        if (projectResult.error || !projectResult.data) {
            console.warn('Project not found for JWT secret lookup:', projectRef);
            return null;
        }
        // Try to get project-specific JWT secret from various sources
        // 1. Check if there's a project-specific JWT secret in environment variables
        const projectSpecificSecret = process.env[`JWT_SECRET_${projectRef.toUpperCase()}`] ||
            process.env[`SUPABASE_JWT_SECRET_${projectRef.toUpperCase()}`];
        if (projectSpecificSecret) {
            return projectSpecificSecret;
        }
        // 2. Try to get from the legacy JWT secret endpoint (simulated)
        // In a real implementation, this might query a database or configuration store
        // For now, we'll use the same global secret as fallback
        const legacySecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
        if (legacySecret) {
            console.log('Using legacy JWT secret for project:', projectRef);
            return legacySecret;
        }
        return null;
    }
    catch (error) {
        console.error('Error getting project JWT secret:', error);
        return null;
    }
}
/**
 * Get project-specific JWT secret from Legacy JWT Secret endpoint
 * This function simulates calling the legacy JWT secret API
 *
 * @param projectRef - Project reference
 * @returns JWT secret string or null if not found
 */
async function getProjectLegacyJwtSecret(projectRef) {
    try {
        // In a real implementation, this would make an internal API call to:
        // GET /api/v1/projects/[ref]/config/auth/signing-keys/legacy
        // For now, we'll simulate the logic from the legacy endpoint
        const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.warn('No JWT secret configured for project:', projectRef);
            return null;
        }
        // Verify the project exists first
        const { findByRef } = await Promise.resolve().then(() => __importStar(require('./self-hosted/project-store-pg')));
        const projectResult = await findByRef(projectRef);
        if (projectResult.error || !projectResult.data) {
            console.warn('Project not found for legacy JWT secret:', projectRef);
            return null;
        }
        console.log('Retrieved legacy JWT secret for project:', projectRef);
        return jwtSecret;
    }
    catch (error) {
        console.error('Error getting project legacy JWT secret:', error);
        return null;
    }
}
/**
 * Validate JWT token with multiple secret sources
 * This function tries different JWT secrets in order of preference
 *
 * @param token - JWT token string
 * @param projectRef - Project reference
 * @returns Validation result with decoded token and secret source used
 */
async function validateJwtTokenWithMultipleSources(token, projectRef) {
    const result = {
        isValid: false,
        decoded: null,
        secretSource: null,
        projectRef
    };
    try {
        // Build list of valid issuers for JWT verification
        const validIssuers = [];
        if (process.env.SUPABASE_URL) {
            validIssuers.push(process.env.SUPABASE_URL);
        }
        if (process.env.SUPABASE_API_URL) {
            validIssuers.push(process.env.SUPABASE_API_URL);
        }
        // Also accept the external URL as a valid issuer (for tokens issued by GoTrue)
        if (process.env.GOTRUE_JWT_ISSUER) {
            validIssuers.push(process.env.GOTRUE_JWT_ISSUER);
        }
        // Accept localhost:8000 as fallback for development
        if (process.env.NODE_ENV === 'development') {
            validIssuers.push('http://localhost:8000');
        }
        // 1. Try global JWT secret first
        const globalJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
        if (globalJwtSecret) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, globalJwtSecret, {
                    algorithms: ['HS256'],
                    issuer: process.env.SUPABASE_URL || undefined,
                });
                if (typeof decoded === 'object' && decoded !== null && 'sub' in decoded) {
                    result.isValid = true;
                    result.decoded = decoded;
                    result.secretSource = 'global';
                    return result;
                }
            }
            catch (globalError) {
                // Continue to try project-specific secrets
            }
        }
        // 2. Try project-specific secrets if projectRef is provided
        if (projectRef) {
            // Try project-specific environment variable
            const projectSpecificSecret = process.env[`JWT_SECRET_${projectRef.toUpperCase()}`] ||
                process.env[`SUPABASE_JWT_SECRET_${projectRef.toUpperCase()}`];
            if (projectSpecificSecret) {
                try {
                    // Try with issuer validation first if we have valid issuers
                    const verifyOptions = {
                        algorithms: ['HS256'],
                    };
                    if (validIssuers.length > 0) {
                        verifyOptions.issuer = validIssuers.length === 1 ? validIssuers[0] : validIssuers;
                    }
                    const decoded = jsonwebtoken_1.default.verify(token, projectSpecificSecret, verifyOptions);
                    if (typeof decoded === 'object' && decoded !== null && 'sub' in decoded) {
                        result.isValid = true;
                        result.decoded = decoded;
                        result.secretSource = 'project-specific';
                        return result;
                    }
                }
                catch (issuerError) {
                    // Log detailed error for issuer mismatch
                    // Requirements: 6.2, 6.4, 6.5
                    if (issuerError instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                        const errorMessage = issuerError.message;
                        const isIssuerError = errorMessage.includes('issuer');
                        if (isIssuerError) {
                            // Extract issuer from token for logging (without exposing the full token)
                            try {
                                const decodedUnsafe = jsonwebtoken_1.default.decode(token);
                                const tokenIssuer = decodedUnsafe?.iss || 'undefined';
                                console.error('[JWT Verification] Project-specific issuer validation failed', {
                                    error: errorMessage,
                                    expectedIssuers: validIssuers.length > 0 ? validIssuers : 'none configured',
                                    tokenIssuer,
                                    projectRef,
                                    userId: decodedUnsafe?.sub || 'unknown',
                                    projectRefInToken: decodedUnsafe?.project_ref || 'unknown',
                                    // Note: Full token and secrets are NOT logged for security
                                });
                            }
                            catch (decodeError) {
                                console.error('[JWT Verification] Project-specific issuer validation failed (unable to decode token)', {
                                    error: errorMessage,
                                    projectRef,
                                    expectedIssuers: validIssuers.length > 0 ? validIssuers : 'none configured',
                                });
                            }
                        }
                    }
                    // Do not fallback to lenient validation - issuer check is required for security
                    console.warn('[JWT Verification] Project-specific token rejected due to issuer validation failure:', issuerError instanceof jsonwebtoken_1.default.JsonWebTokenError ? issuerError.message : 'Unknown error');
                    // Continue to try legacy secret
                }
            }
            // 3. Try legacy JWT secret
            const legacySecret = await getProjectLegacyJwtSecret(projectRef);
            if (legacySecret && legacySecret !== globalJwtSecret) {
                try {
                    // Try with issuer validation first if we have valid issuers
                    const verifyOptions = {
                        algorithms: ['HS256'],
                    };
                    if (validIssuers.length > 0) {
                        verifyOptions.issuer = validIssuers.length === 1 ? validIssuers[0] : validIssuers;
                    }
                    const decoded = jsonwebtoken_1.default.verify(token, legacySecret, verifyOptions);
                    if (typeof decoded === 'object' && decoded !== null && 'sub' in decoded) {
                        result.isValid = true;
                        result.decoded = decoded;
                        result.secretSource = 'legacy';
                        return result;
                    }
                }
                catch (issuerError) {
                    // Log detailed error for issuer mismatch with legacy secret
                    // Requirements: 6.2, 6.4, 6.5
                    if (issuerError instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                        const errorMessage = issuerError.message;
                        const isIssuerError = errorMessage.includes('issuer');
                        if (isIssuerError) {
                            // Extract issuer from token for logging (without exposing the full token)
                            try {
                                const decodedUnsafe = jsonwebtoken_1.default.decode(token);
                                const tokenIssuer = decodedUnsafe?.iss || 'undefined';
                                console.error('[JWT Verification] Legacy secret issuer validation failed', {
                                    error: errorMessage,
                                    expectedIssuers: validIssuers.length > 0 ? validIssuers : 'none configured',
                                    tokenIssuer,
                                    projectRef,
                                    userId: decodedUnsafe?.sub || 'unknown',
                                    projectRefInToken: decodedUnsafe?.project_ref || 'unknown',
                                    // Note: Full token and secrets are NOT logged for security
                                });
                            }
                            catch (decodeError) {
                                console.error('[JWT Verification] Legacy secret issuer validation failed (unable to decode token)', {
                                    error: errorMessage,
                                    projectRef,
                                    expectedIssuers: validIssuers.length > 0 ? validIssuers : 'none configured',
                                });
                            }
                        }
                    }
                    // Do not fallback to lenient validation - issuer check is required for security
                    console.warn('[JWT Verification] Legacy token rejected due to issuer validation failure:', issuerError instanceof jsonwebtoken_1.default.JsonWebTokenError ? issuerError.message : 'Unknown error');
                    // All attempts failed
                }
            }
        }
        return result;
    }
    catch (error) {
        console.error('Error validating JWT token with multiple sources:', error);
        return result;
    }
}
/**
 * Validate that a user has access to a specific project
 *
 * @param userId - User ID
 * @param projectId - Project ID
 * @returns ProjectAccessResult with access information
 */
async function validateUserProjectAccess(userId, projectId) {
    const startTime = Date.now();
    try {
        if (!userId || !projectId) {
            return {
                hasAccess: false,
                accessType: 'none',
                reason: 'Invalid userId or projectId'
            };
        }
        // Import the project store functions
        const { findById, findByOrganizationId } = await Promise.resolve().then(() => __importStar(require('./self-hosted/project-store-pg')));
        // First, check if user is the direct owner of the project
        const projectResult = await findById(projectId);
        if (projectResult.error) {
            console.error('[validateUserProjectAccess] Error finding project:', projectResult.error);
            return {
                hasAccess: false,
                accessType: 'none',
                reason: 'Database error while checking project access'
            };
        }
        if (!projectResult.data) {
            return {
                hasAccess: false,
                accessType: 'none',
                reason: 'Project not found'
            };
        }
        const project = projectResult.data;
        // Check if user is the direct owner
        if (project.owner_user_id === userId) {
            const executionTimeMs = Date.now() - startTime;
            // Log performance metrics
            console.log('[validateUserProjectAccess] Validation completed', {
                userId,
                projectId,
                executionTimeMs,
                meetsRequirement: executionTimeMs < 100,
                accessType: 'owner'
            });
            return {
                hasAccess: true,
                accessType: 'owner',
                organizationId: project.organization_id
            };
        }
        // Check if user has access through organization membership
        // TODO: Implement proper organization membership table
        // For now, we'll disable organization-based access to ensure strict project isolation
        // Only direct project owners should have access
        // SECURITY FIX: Removed flawed organization membership logic
        // The previous logic allowed any user who owned a project in an organization
        // to access ALL projects in that organization, which is a security vulnerability.
        // 
        // Proper organization membership should be implemented with:
        // 1. An organization_members table with explicit user-organization relationships
        // 2. Role-based permissions (admin, member, viewer, etc.)
        // 3. Project-specific permissions within organizations
        //
        // Until proper organization membership is implemented, we only allow
        // direct project owners to access their projects.
        /*
        if (project.organization_id) {
          // Get all projects in the same organization
          const orgProjectsResult = await findByOrganizationId(project.organization_id)
          
          if (orgProjectsResult.error) {
            console.error('[validateUserProjectAccess] Error finding organization projects:', orgProjectsResult.error)
            return {
              hasAccess: false,
              accessType: 'none',
              reason: 'Database error while checking organization access'
            }
          }
          
          // Check if user owns any project in the same organization
          // This is a simplified organization membership check
          const userOwnsProjectInOrg = orgProjectsResult.data?.some(
            (orgProject) => orgProject.owner_user_id === userId
          )
          
          if (userOwnsProjectInOrg) {
            const executionTimeMs = Date.now() - startTime
            
            // Log performance metrics
            console.log('[validateUserProjectAccess] Validation completed', {
              userId,
              projectId,
              executionTimeMs,
              meetsRequirement: executionTimeMs < 100,
              accessType: 'organization_member'
            })
            
            return {
              hasAccess: true,
              accessType: 'organization_member',
              organizationId: project.organization_id
            }
          }
        }
        */
        const executionTimeMs = Date.now() - startTime;
        // Log performance metrics for denied access
        console.log('[validateUserProjectAccess] Access denied', {
            userId,
            projectId,
            executionTimeMs,
            meetsRequirement: executionTimeMs < 100
        });
        // No access found
        return {
            hasAccess: false,
            accessType: 'none',
            reason: 'User is not owner or organization member'
        };
    }
    catch (error) {
        const executionTimeMs = Date.now() - startTime;
        console.error('[validateUserProjectAccess] Error validating user project access:', {
            error,
            userId,
            projectId,
            executionTimeMs
        });
        return {
            hasAccess: false,
            accessType: 'none',
            reason: 'Unexpected error during access validation'
        };
    }
}
/**
 * Validate user access to project by project reference
 *
 * @param userId - User ID
 * @param projectRef - Project reference string
 * @returns ProjectAccessResult with access information
 */
async function validateUserProjectAccessByRef(userId, projectRef) {
    try {
        if (!userId || !projectRef) {
            return {
                hasAccess: false,
                accessType: 'none',
                reason: 'Invalid userId or projectRef'
            };
        }
        // Import the project store functions
        const { findByRef } = await Promise.resolve().then(() => __importStar(require('./self-hosted/project-store-pg')));
        // Find project by reference
        const projectResult = await findByRef(projectRef);
        if (projectResult.error) {
            console.error('Error finding project by ref:', projectResult.error);
            return {
                hasAccess: false,
                accessType: 'none',
                reason: 'Database error while finding project'
            };
        }
        if (!projectResult.data) {
            return {
                hasAccess: false,
                accessType: 'none',
                reason: 'Project not found'
            };
        }
        // Use the existing validateUserProjectAccess function
        return await validateUserProjectAccess(userId, projectResult.data.id);
    }
    catch (error) {
        console.error('Error validating user project access by ref:', error);
        return {
            hasAccess: false,
            accessType: 'none',
            reason: 'Unexpected error during access validation'
        };
    }
}
/**
 * Get user permissions for a specific project
 *
 * @param userId - User ID
 * @param projectId - Project ID
 * @returns User permissions object
 */
async function getUserProjectPermissions(userId, projectId) {
    try {
        const accessResult = await validateUserProjectAccess(userId, projectId);
        if (!accessResult.hasAccess) {
            return {
                canRead: false,
                canWrite: false,
                canAdmin: false,
                canDelete: false,
                canManageApiKeys: false,
                canManageJwtKeys: false
            };
        }
        // Define permissions based on access type
        if (accessResult.accessType === 'owner') {
            // Project owners have full permissions
            return {
                canRead: true,
                canWrite: true,
                canAdmin: true,
                canDelete: true,
                canManageApiKeys: true,
                canManageJwtKeys: true
            };
        }
        else if (accessResult.accessType === 'organization_member') {
            // Organization members have limited permissions
            return {
                canRead: true,
                canWrite: true,
                canAdmin: false,
                canDelete: false,
                canManageApiKeys: false,
                canManageJwtKeys: false
            };
        }
        // Default: no permissions
        return {
            canRead: false,
            canWrite: false,
            canAdmin: false,
            canDelete: false,
            canManageApiKeys: false,
            canManageJwtKeys: false
        };
    }
    catch (error) {
        console.error('Error getting user project permissions:', error);
        return {
            canRead: false,
            canWrite: false,
            canAdmin: false,
            canDelete: false,
            canManageApiKeys: false,
            canManageJwtKeys: false
        };
    }
}
/**
 * Extract user ID from JWT token (helper function)
 *
 * @param token - JWT token string
 * @param projectRef - Optional project reference for project-specific JWT verification
 * @param requireProjectRef - @deprecated This parameter is no longer used. GoTrue JWT tokens do not contain project_ref claim.
 * @returns User ID or null if invalid
 */
async function extractUserIdFromToken(token, projectRef, requireProjectRef = false) {
    try {
        // Use the same verification logic as verifyJwtToken
        // Note: requireProjectRef is ignored as we no longer check project_ref claim
        const decoded = await verifyJwtToken(token, projectRef || undefined, undefined, false);
        if (decoded && typeof decoded === 'object' && 'sub' in decoded) {
            return decoded.sub;
        }
        return null;
    }
    catch (error) {
        console.error('Error extracting user ID from token:', error);
        return null;
    }
}
/**
 * Check if request is from an authenticated user
 *
 * @param req - Next.js API request object
 * @param projectRef - Optional project reference for project-specific JWT verification
 * @param requireProjectRef - @deprecated This parameter is no longer used. GoTrue JWT tokens do not contain project_ref claim.
 * @returns True if authenticated, false otherwise
 */
async function isAuthenticated(req, projectRef, requireProjectRef = false) {
    // Note: requireProjectRef is ignored as we no longer check project_ref claim
    const userId = await getCurrentUserId(req, projectRef, false);
    return userId !== null;
}
/**
 * Require authentication for an API endpoint
 * Throws error if user is not authenticated
 *
 * @param req - Next.js API request object
 * @param projectRef - Optional project reference for project-specific JWT verification
 * @param requireProjectRef - @deprecated This parameter is no longer used. GoTrue JWT tokens do not contain project_ref claim.
 * @returns User ID
 * @throws Error if not authenticated
 */
async function requireAuthentication(req, projectRef, requireProjectRef = false) {
    // Note: requireProjectRef is ignored as we no longer check project_ref claim
    const userId = await getCurrentUserId(req, projectRef, false);
    if (!userId) {
        // Log authentication failure for security audit
        const { logAuthenticationFailure, extractErrorContextFromRequest } = await Promise.resolve().then(() => __importStar(require('./error-handling')));
        const resolvedProjectRef = projectRef || extractProjectRefFromRequest(req);
        const context = extractErrorContextFromRequest(req, 'requireAuthentication', {
            projectRef: resolvedProjectRef || undefined
        });
        logAuthenticationFailure(context, 'Authentication required but no valid token found');
        throw new Error('Authentication required');
    }
    return userId;
}
/**
 * Require authentication and project access for an API endpoint
 *
 * @param req - Next.js API request object
 * @param projectId - Project ID to check access for
 * @param projectRef - Optional project reference (will be auto-detected if not provided)
 * @returns Object with userId and access information
 * @throws Error if not authenticated or no access
 */
async function requireProjectAccess(req, projectId, projectRef) {
    const resolvedProjectRef = projectRef || extractProjectRefFromRequest(req);
    const userId = await requireAuthentication(req, resolvedProjectRef || undefined);
    const accessResult = await validateUserProjectAccess(userId, projectId);
    if (!accessResult.hasAccess) {
        // Log authorization failure for security audit
        const { logAuthorizationFailure, extractErrorContextFromRequest } = await Promise.resolve().then(() => __importStar(require('./error-handling')));
        const context = extractErrorContextFromRequest(req, 'requireProjectAccess', {
            userId,
            projectId,
            projectRef: resolvedProjectRef || undefined
        });
        logAuthorizationFailure(context, `Project access denied: ${accessResult.reason}`);
        throw new Error(`Access denied: ${accessResult.reason}`);
    }
    return { userId, accessResult };
}
/**
 * Require authentication and project access by project reference
 *
 * @param req - Next.js API request object
 * @param projectRef - Project reference to check access for
 * @returns Object with userId and access information
 * @throws Error if not authenticated or no access
 */
async function requireProjectAccessByRef(req, projectRef) {
    const userId = await requireAuthentication(req, projectRef);
    const accessResult = await validateUserProjectAccessByRef(userId, projectRef);
    if (!accessResult.hasAccess) {
        // Log authorization failure for security audit
        const { logAuthorizationFailure, extractErrorContextFromRequest } = await Promise.resolve().then(() => __importStar(require('./error-handling')));
        const context = extractErrorContextFromRequest(req, 'requireProjectAccessByRef', {
            userId,
            projectRef
        });
        logAuthorizationFailure(context, `Project access denied: ${accessResult.reason}`);
        throw new Error(`Access denied: ${accessResult.reason}`);
    }
    return { userId, accessResult };
}
/**
 * Check if user isolation is enabled in the current environment
 *
 * @returns True if user isolation is enabled, false otherwise
 */
function isUserIsolationEnabled() {
    // Check environment variable to determine if user isolation is enabled
    const userIsolationEnabled = process.env.ENABLE_USER_ISOLATION === 'true';
    // In development, we can enable it by default for testing
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ENVIRONMENT === 'development';
    // Return true if explicitly enabled or in development mode
    return userIsolationEnabled || isDevelopment;
}
