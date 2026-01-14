"use strict";
/**
 * PostgreSQL-based Project Store
 *
 * Stores project metadata in PostgreSQL instead of JSON files
 * This provides better reliability, scalability, and multi-instance support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectStoreError = exports.ProjectStoreErrorCode = void 0;
exports.save = save;
exports.findAll = findAll;
exports.findById = findById;
exports.findByRef = findByRef;
exports.findByDatabaseName = findByDatabaseName;
exports.findByOrganizationId = findByOrganizationId;
exports.findByOwnerUserId = findByOwnerUserId;
exports.update = update;
exports.deleteProject = deleteProject;
exports.findAllWithCredentialStatus = findAllWithCredentialStatus;
exports.findByRefWithCredentialStatus = findByRefWithCredentialStatus;
exports.findByOrganizationIdWithCredentialStatus = findByOrganizationIdWithCredentialStatus;
exports.findByOwnerUserIdWithCredentialStatus = findByOwnerUserIdWithCredentialStatus;
exports.getProjectEffectiveCredentials = getProjectEffectiveCredentials;
exports.updateProjectCredentials = updateProjectCredentials;
const query_1 = require("./query");
const credential_fallback_manager_1 = require("./credential-fallback-manager");
/**
 * Error codes for project store operations
 */
var ProjectStoreErrorCode;
(function (ProjectStoreErrorCode) {
    ProjectStoreErrorCode["PROJECT_NOT_FOUND"] = "PROJECT_NOT_FOUND";
    ProjectStoreErrorCode["PROJECT_ALREADY_EXISTS"] = "PROJECT_ALREADY_EXISTS";
    ProjectStoreErrorCode["INVALID_PROJECT_DATA"] = "INVALID_PROJECT_DATA";
    ProjectStoreErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ProjectStoreErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(ProjectStoreErrorCode || (exports.ProjectStoreErrorCode = ProjectStoreErrorCode = {}));
/**
 * Custom error class for project store operations
 */
class ProjectStoreError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'ProjectStoreError';
    }
}
exports.ProjectStoreError = ProjectStoreError;
/**
 * Calculates credential status for a project
 */
function calculateCredentialStatus(databaseUser, databasePasswordHash) {
    const hasUser = databaseUser !== null && databaseUser !== undefined && databaseUser.trim() !== '';
    const hasPassword = databasePasswordHash !== null && databasePasswordHash !== undefined && databasePasswordHash.trim() !== '';
    if (hasUser && hasPassword) {
        return 'complete';
    }
    else if (!hasUser && !hasPassword) {
        return 'missing_both';
    }
    else if (!hasUser) {
        return 'missing_user';
    }
    else {
        return 'missing_password';
    }
}
/**
 * Enhances project metadata with credential status information
 */
function enhanceProjectWithCredentialStatus(project) {
    const credentialStatus = calculateCredentialStatus(project.database_user, project.database_password_hash);
    const usesFallback = credentialStatus !== 'complete';
    return {
        ...project,
        credential_status: credentialStatus,
        last_credential_check: new Date().toISOString(),
        uses_fallback_credentials: usesFallback
    };
}
/**
 * Gets effective credentials for a project, preferring project-specific over fallback
 */
function getEffectiveCredentials(project, readOnly = false) {
    const fallbackManager = (0, credential_fallback_manager_1.getCredentialFallbackManager)();
    const projectCredentials = fallbackManager.getProjectCredentials(project.ref, project.database_user, project.database_password_hash);
    // Prefer project-specific credentials if complete
    if (projectCredentials.isComplete && projectCredentials.user && projectCredentials.passwordHash) {
        return {
            user: projectCredentials.user,
            password: projectCredentials.passwordHash, // Note: This should be decrypted in real implementation
            usedFallback: false
        };
    }
    // Fall back to system credentials
    const fallbackCredentials = fallbackManager.getFallbackCredentials(readOnly);
    // Determine fallback reason
    let fallbackReason = 'missing_both';
    if (projectCredentials.user && !projectCredentials.passwordHash) {
        fallbackReason = 'missing_password';
    }
    else if (!projectCredentials.user && projectCredentials.passwordHash) {
        fallbackReason = 'missing_user';
    }
    // Log fallback usage
    fallbackManager.logFallbackUsage(project.ref, fallbackReason, fallbackReason);
    return {
        user: fallbackCredentials.user,
        password: fallbackCredentials.password,
        usedFallback: true,
        fallbackReason
    };
}
/**
 * Validates project metadata
 */
function validateProjectMetadata(project) {
    if (!project.name || typeof project.name !== 'string') {
        throw new ProjectStoreError(ProjectStoreErrorCode.INVALID_PROJECT_DATA, 'Project name is required and must be a string');
    }
    if (!project.database_name || typeof project.database_name !== 'string') {
        throw new ProjectStoreError(ProjectStoreErrorCode.INVALID_PROJECT_DATA, 'Database name is required and must be a string');
    }
    if (!project.ref || typeof project.ref !== 'string') {
        throw new ProjectStoreError(ProjectStoreErrorCode.INVALID_PROJECT_DATA, 'Project ref is required and must be a string');
    }
    if (!project.connection_string || typeof project.connection_string !== 'string') {
        throw new ProjectStoreError(ProjectStoreErrorCode.INVALID_PROJECT_DATA, 'Connection string is required and must be a string');
    }
    // Validate credential fields if provided (they can be null for legacy projects)
    if (project.database_user !== undefined && project.database_user !== null && typeof project.database_user !== 'string') {
        throw new ProjectStoreError(ProjectStoreErrorCode.INVALID_PROJECT_DATA, 'Database user must be a string or null');
    }
    if (project.database_password_hash !== undefined && project.database_password_hash !== null && typeof project.database_password_hash !== 'string') {
        throw new ProjectStoreError(ProjectStoreErrorCode.INVALID_PROJECT_DATA, 'Database password hash must be a string or null');
    }
}
/**
 * Saves a new project to the database
 */
async function save(project) {
    try {
        validateProjectMetadata(project);
    }
    catch (error) {
        return {
            data: undefined,
            error: error instanceof ProjectStoreError
                ? error
                : new ProjectStoreError(ProjectStoreErrorCode.INVALID_PROJECT_DATA, error instanceof Error ? error.message : 'Invalid project data'),
        };
    }
    const result = await (0, query_1.executeQuery)({
        query: `
      INSERT INTO public.studio_projects (
        ref, name, database_name, database_user, database_password_hash,
        organization_id, owner_user_id, status, region, connection_string
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
        parameters: [
            project.ref,
            project.name,
            project.database_name,
            project.database_user || null,
            project.database_password_hash || null,
            project.organization_id || 1,
            project.owner_user_id || null,
            project.status || 'ACTIVE_HEALTHY',
            project.region || 'localhost',
            project.connection_string,
        ],
    });
    if (result.error) {
        // Check for unique constraint violations
        const errorMessage = result.error.message || '';
        if (errorMessage.includes('studio_projects_ref_key')) {
            return {
                data: undefined,
                error: new ProjectStoreError(ProjectStoreErrorCode.PROJECT_ALREADY_EXISTS, `Project with ref "${project.ref}" already exists`),
            };
        }
        if (errorMessage.includes('studio_projects_database_name_key')) {
            return {
                data: undefined,
                error: new ProjectStoreError(ProjectStoreErrorCode.PROJECT_ALREADY_EXISTS, `Project with database name "${project.database_name}" already exists`),
            };
        }
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.DATABASE_ERROR, `Failed to save project: ${errorMessage}`, result.error),
        };
    }
    return { data: result.data?.[0], error: undefined };
}
/**
 * Finds all projects
 */
async function findAll() {
    const result = await (0, query_1.executeQuery)({
        query: 'SELECT * FROM public.studio_projects ORDER BY inserted_at DESC',
    });
    if (result.error) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.DATABASE_ERROR, `Failed to load projects: ${result.error.message}`, result.error),
        };
    }
    return { data: (result.data || []), error: undefined };
}
/**
 * Finds a project by ID
 */
async function findById(id) {
    const result = await (0, query_1.executeQuery)({
        query: 'SELECT * FROM public.studio_projects WHERE id = $1',
        parameters: [id],
    });
    if (result.error) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.DATABASE_ERROR, `Failed to find project: ${result.error.message}`, result.error),
        };
    }
    return { data: result.data?.[0] || null, error: undefined };
}
/**
 * Finds a project by ref
 */
async function findByRef(ref) {
    const result = await (0, query_1.executeQuery)({
        query: 'SELECT * FROM public.studio_projects WHERE ref = $1',
        parameters: [ref],
    });
    if (result.error) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.DATABASE_ERROR, `Failed to find project: ${result.error.message}`, result.error),
        };
    }
    return { data: result.data?.[0] || null, error: undefined };
}
/**
 * Finds a project by database name
 */
async function findByDatabaseName(databaseName) {
    const result = await (0, query_1.executeQuery)({
        query: 'SELECT * FROM public.studio_projects WHERE database_name = $1',
        parameters: [databaseName],
    });
    if (result.error) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.DATABASE_ERROR, `Failed to find project: ${result.error.message}`, result.error),
        };
    }
    return { data: result.data?.[0] || null, error: undefined };
}
/**
 * Finds projects by organization ID
 */
async function findByOrganizationId(organizationId) {
    const result = await (0, query_1.executeQuery)({
        query: 'SELECT * FROM public.studio_projects WHERE organization_id = $1 ORDER BY inserted_at DESC',
        parameters: [organizationId],
    });
    if (result.error) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.DATABASE_ERROR, `Failed to find projects: ${result.error.message}`, result.error),
        };
    }
    return { data: (result.data || []), error: undefined };
}
/**
 * Finds projects by owner user ID
 */
async function findByOwnerUserId(ownerUserId) {
    const result = await (0, query_1.executeQuery)({
        query: 'SELECT * FROM public.studio_projects WHERE owner_user_id = $1 ORDER BY inserted_at DESC',
        parameters: [ownerUserId],
    });
    if (result.error) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.DATABASE_ERROR, `Failed to find projects: ${result.error.message}`, result.error),
        };
    }
    return { data: (result.data || []), error: undefined };
}
/**
 * Updates a project
 */
async function update(id, updates) {
    // Build dynamic UPDATE query
    const fields = [];
    const parameters = [];
    let paramIndex = 1;
    if (updates.ref !== undefined) {
        fields.push(`ref = $${paramIndex++}`);
        parameters.push(updates.ref);
    }
    if (updates.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        parameters.push(updates.name);
    }
    if (updates.database_name !== undefined) {
        fields.push(`database_name = $${paramIndex++}`);
        parameters.push(updates.database_name);
    }
    if (updates.database_user !== undefined) {
        fields.push(`database_user = $${paramIndex++}`);
        parameters.push(updates.database_user);
    }
    if (updates.database_password_hash !== undefined) {
        fields.push(`database_password_hash = $${paramIndex++}`);
        parameters.push(updates.database_password_hash);
    }
    if (updates.organization_id !== undefined) {
        fields.push(`organization_id = $${paramIndex++}`);
        parameters.push(updates.organization_id);
    }
    if (updates.owner_user_id !== undefined) {
        fields.push(`owner_user_id = $${paramIndex++}`);
        parameters.push(updates.owner_user_id);
    }
    if (updates.status !== undefined) {
        fields.push(`status = $${paramIndex++}`);
        parameters.push(updates.status);
    }
    if (updates.region !== undefined) {
        fields.push(`region = $${paramIndex++}`);
        parameters.push(updates.region);
    }
    if (updates.connection_string !== undefined) {
        fields.push(`connection_string = $${paramIndex++}`);
        parameters.push(updates.connection_string);
    }
    if (fields.length === 0) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.INVALID_PROJECT_DATA, 'No fields to update'),
        };
    }
    parameters.push(id);
    const result = await (0, query_1.executeQuery)({
        query: `
      UPDATE public.studio_projects
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
        parameters,
    });
    if (result.error) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.DATABASE_ERROR, `Failed to update project: ${result.error.message}`, result.error),
        };
    }
    if (!result.data || result.data.length === 0) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.PROJECT_NOT_FOUND, `Project with ID ${id} not found`),
        };
    }
    return { data: result.data[0], error: undefined };
}
/**
 * Deletes a project
 */
async function deleteProject(id) {
    const result = await (0, query_1.executeQuery)({
        query: 'DELETE FROM public.studio_projects WHERE id = $1 RETURNING id',
        parameters: [id],
    });
    if (result.error) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.DATABASE_ERROR, `Failed to delete project: ${result.error.message}`, result.error),
        };
    }
    if (!result.data || result.data.length === 0) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.PROJECT_NOT_FOUND, `Project with ID ${id} not found`),
        };
    }
    return { data: undefined, error: undefined };
}
// Enhanced functions with credential status information
/**
 * Finds all projects with enhanced credential status information
 *
 * @returns Result with array of all enhanced projects
 */
async function findAllWithCredentialStatus() {
    const result = await findAll();
    if (result.error) {
        return { data: undefined, error: result.error };
    }
    const enhancedProjects = result.data.map(enhanceProjectWithCredentialStatus);
    return { data: enhancedProjects, error: undefined };
}
/**
 * Finds a project by ref with enhanced credential status information
 *
 * @param ref - Project ref
 * @returns Result with enhanced project or null if not found
 */
async function findByRefWithCredentialStatus(ref) {
    const result = await findByRef(ref);
    if (result.error) {
        return { data: undefined, error: result.error };
    }
    if (!result.data) {
        return { data: null, error: undefined };
    }
    const enhancedProject = enhanceProjectWithCredentialStatus(result.data);
    return { data: enhancedProject, error: undefined };
}
/**
 * Finds projects by organization ID with enhanced credential status information
 *
 * @param organizationId - Organization ID
 * @returns Result with array of enhanced projects
 */
async function findByOrganizationIdWithCredentialStatus(organizationId) {
    const result = await findByOrganizationId(organizationId);
    if (result.error) {
        return { data: undefined, error: result.error };
    }
    const enhancedProjects = result.data.map(enhanceProjectWithCredentialStatus);
    return { data: enhancedProjects, error: undefined };
}
/**
 * Finds projects by owner user ID with enhanced credential status information
 *
 * @param ownerUserId - GoTrue user ID
 * @returns Result with array of enhanced projects owned by the user
 */
async function findByOwnerUserIdWithCredentialStatus(ownerUserId) {
    const result = await findByOwnerUserId(ownerUserId);
    if (result.error) {
        return { data: undefined, error: result.error };
    }
    const enhancedProjects = result.data.map(enhanceProjectWithCredentialStatus);
    return { data: enhancedProjects, error: undefined };
}
/**
 * Gets effective credentials for a project by ref
 *
 * @param ref - Project ref
 * @param readOnly - Whether to get read-only credentials
 * @returns Result with effective credentials information
 */
async function getProjectEffectiveCredentials(ref, readOnly = false) {
    const result = await findByRef(ref);
    if (result.error) {
        return { data: undefined, error: result.error };
    }
    if (!result.data) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.PROJECT_NOT_FOUND, `Project with ref "${ref}" not found`, { ref }),
        };
    }
    const effectiveCredentials = getEffectiveCredentials(result.data, readOnly);
    return { data: effectiveCredentials, error: undefined };
}
/**
 * Updates project credentials and validates them
 *
 * @param id - Project ID
 * @param credentials - New credentials to set
 * @returns Result with updated project
 */
async function updateProjectCredentials(id, credentials) {
    // Validate credentials if provided
    if (credentials.database_user !== undefined || credentials.database_password_hash !== undefined) {
        const fallbackManager = (0, credential_fallback_manager_1.getCredentialFallbackManager)();
        const projectCredentials = fallbackManager.getProjectCredentials(`project-${id}`, // Temporary ref for validation
        credentials.database_user, credentials.database_password_hash);
        // Log if we're updating to incomplete credentials
        if (!projectCredentials.isComplete) {
            console.warn(`[Project Store] Updating project ${id} with incomplete credentials`);
        }
    }
    return update(id, credentials);
}
