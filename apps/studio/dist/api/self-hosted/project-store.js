"use strict";
/**
 * Project metadata storage service for self-hosted environments.
 * Manages project metadata persistence using JSON file storage.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
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
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const credential_fallback_manager_1 = require("./credential-fallback-manager");
/**
 * Error codes for project store operations
 */
var ProjectStoreErrorCode;
(function (ProjectStoreErrorCode) {
    ProjectStoreErrorCode["PROJECT_NOT_FOUND"] = "PROJECT_NOT_FOUND";
    ProjectStoreErrorCode["PROJECT_ALREADY_EXISTS"] = "PROJECT_ALREADY_EXISTS";
    ProjectStoreErrorCode["INVALID_PROJECT_DATA"] = "INVALID_PROJECT_DATA";
    ProjectStoreErrorCode["FILE_READ_ERROR"] = "FILE_READ_ERROR";
    ProjectStoreErrorCode["FILE_WRITE_ERROR"] = "FILE_WRITE_ERROR";
    ProjectStoreErrorCode["DIRECTORY_CREATE_ERROR"] = "DIRECTORY_CREATE_ERROR";
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
 * Default storage path for project metadata
 * Using .project-data to align with other service data storage
 */
const DEFAULT_STORE_PATH = '.project-data/projects.json';
/**
 * Current store version
 */
const STORE_VERSION = '1.0.0';
/**
 * Get the storage file path from environment or use default
 */
function getStorePath() {
    return process.env.PROJECT_STORE_PATH || DEFAULT_STORE_PATH;
}
/**
 * Ensures the storage directory exists
 */
async function ensureStorageDirectory() {
    const storePath = getStorePath();
    const directory = path_1.default.dirname(storePath);
    try {
        await promises_1.default.mkdir(directory, { recursive: true });
        return { data: undefined, error: undefined };
    }
    catch (error) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.DIRECTORY_CREATE_ERROR, `Failed to create storage directory: ${directory}`, { directory, originalError: error }),
        };
    }
}
/**
 * Reads the project store from disk
 */
async function readStore() {
    const storePath = getStorePath();
    try {
        const fileContent = await promises_1.default.readFile(storePath, 'utf-8');
        const data = JSON.parse(fileContent);
        return { data, error: undefined };
    }
    catch (error) {
        // If file doesn't exist, return empty store
        if (error.code === 'ENOENT') {
            return {
                data: {
                    projects: [],
                    version: STORE_VERSION,
                },
                error: undefined,
            };
        }
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.FILE_READ_ERROR, `Failed to read project store: ${error.message}`, { storePath, originalError: error }),
        };
    }
}
/**
 * Writes the project store to disk
 */
async function writeStore(data) {
    const storePath = getStorePath();
    // Ensure directory exists
    const dirResult = await ensureStorageDirectory();
    if (dirResult.error) {
        return dirResult;
    }
    try {
        const fileContent = JSON.stringify(data, null, 2);
        await promises_1.default.writeFile(storePath, fileContent, 'utf-8');
        return { data: undefined, error: undefined };
    }
    catch (error) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.FILE_WRITE_ERROR, `Failed to write project store: ${error.message}`, { storePath, originalError: error }),
        };
    }
}
/**
 * Generates a new unique project ID
 */
function generateProjectId(existingProjects) {
    if (existingProjects.length === 0) {
        return 1;
    }
    const maxId = Math.max(...existingProjects.map((p) => p.id));
    return maxId + 1;
}
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
    if (project.organization_id !== undefined && typeof project.organization_id !== 'number') {
        throw new ProjectStoreError(ProjectStoreErrorCode.INVALID_PROJECT_DATA, 'Organization ID must be a number');
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
 * Saves a new project to the store
 *
 * @param project - Project metadata to save (id will be auto-generated if not provided)
 * @returns Result with the saved project including generated ID
 */
async function save(project) {
    try {
        validateProjectMetadata(project);
    }
    catch (error) {
        return {
            data: undefined,
            error: error instanceof ProjectStoreError ? error : new ProjectStoreError(ProjectStoreErrorCode.INVALID_PROJECT_DATA, error instanceof Error ? error.message : 'Invalid project data'),
        };
    }
    const storeResult = await readStore();
    if (storeResult.error) {
        return { data: undefined, error: storeResult.error };
    }
    const store = storeResult.data;
    // Check for duplicate ref
    const existingByRef = store.projects.find((p) => p.ref === project.ref);
    if (existingByRef) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.PROJECT_ALREADY_EXISTS, `Project with ref "${project.ref}" already exists`, { ref: project.ref }),
        };
    }
    // Check for duplicate database name
    const existingByDbName = store.projects.find((p) => p.database_name === project.database_name);
    if (existingByDbName) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.PROJECT_ALREADY_EXISTS, `Project with database name "${project.database_name}" already exists`, { database_name: project.database_name }),
        };
    }
    // Generate ID if not provided
    const id = project.id ?? generateProjectId(store.projects);
    // Check for duplicate ID
    if (store.projects.find((p) => p.id === id)) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.PROJECT_ALREADY_EXISTS, `Project with ID ${id} already exists`, { id }),
        };
    }
    const now = new Date().toISOString();
    const newProject = {
        ...project,
        id,
        inserted_at: project.inserted_at || now,
        updated_at: project.updated_at || now,
    };
    store.projects.push(newProject);
    const writeResult = await writeStore(store);
    if (writeResult.error) {
        return { data: undefined, error: writeResult.error };
    }
    return { data: newProject, error: undefined };
}
/**
 * Finds all projects in the store
 *
 * @returns Result with array of all projects
 */
async function findAll() {
    const storeResult = await readStore();
    if (storeResult.error) {
        return { data: undefined, error: storeResult.error };
    }
    return { data: storeResult.data.projects, error: undefined };
}
/**
 * Finds a project by ID
 *
 * @param id - Project ID
 * @returns Result with project or null if not found
 */
async function findById(id) {
    const storeResult = await readStore();
    if (storeResult.error) {
        return { data: undefined, error: storeResult.error };
    }
    const project = storeResult.data.projects.find((p) => p.id === id) || null;
    return { data: project, error: undefined };
}
/**
 * Finds a project by ref
 *
 * @param ref - Project ref
 * @returns Result with project or null if not found
 */
async function findByRef(ref) {
    const storeResult = await readStore();
    if (storeResult.error) {
        return { data: undefined, error: storeResult.error };
    }
    const project = storeResult.data.projects.find((p) => p.ref === ref) || null;
    return { data: project, error: undefined };
}
/**
 * Finds a project by database name
 *
 * @param databaseName - Database name
 * @returns Result with project or null if not found
 */
async function findByDatabaseName(databaseName) {
    const storeResult = await readStore();
    if (storeResult.error) {
        return { data: undefined, error: storeResult.error };
    }
    const project = storeResult.data.projects.find((p) => p.database_name === databaseName) || null;
    return { data: project, error: undefined };
}
/**
 * Finds projects by organization ID
 *
 * @param organizationId - Organization ID
 * @returns Result with array of projects
 */
async function findByOrganizationId(organizationId) {
    const storeResult = await readStore();
    if (storeResult.error) {
        return { data: undefined, error: storeResult.error };
    }
    const projects = storeResult.data.projects.filter((p) => p.organization_id === organizationId);
    return { data: projects, error: undefined };
}
/**
 * Finds projects by owner user ID
 *
 * @param ownerUserId - GoTrue user ID
 * @returns Result with array of projects owned by the user
 */
async function findByOwnerUserId(ownerUserId) {
    const storeResult = await readStore();
    if (storeResult.error) {
        return { data: undefined, error: storeResult.error };
    }
    const projects = storeResult.data.projects.filter((p) => p.owner_user_id === ownerUserId);
    return { data: projects, error: undefined };
}
/**
 * Updates a project
 *
 * @param id - Project ID
 * @param updates - Partial project data to update
 * @returns Result with updated project
 */
async function update(id, updates) {
    const storeResult = await readStore();
    if (storeResult.error) {
        return { data: undefined, error: storeResult.error };
    }
    const store = storeResult.data;
    const projectIndex = store.projects.findIndex((p) => p.id === id);
    if (projectIndex === -1) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.PROJECT_NOT_FOUND, `Project with ID ${id} not found`, { id }),
        };
    }
    // Check for duplicate ref if updating ref
    if (updates.ref) {
        const existingByRef = store.projects.find((p) => p.ref === updates.ref && p.id !== id);
        if (existingByRef) {
            return {
                data: undefined,
                error: new ProjectStoreError(ProjectStoreErrorCode.PROJECT_ALREADY_EXISTS, `Project with ref "${updates.ref}" already exists`, { ref: updates.ref }),
            };
        }
    }
    // Check for duplicate database name if updating database_name
    if (updates.database_name) {
        const existingByDbName = store.projects.find((p) => p.database_name === updates.database_name && p.id !== id);
        if (existingByDbName) {
            return {
                data: undefined,
                error: new ProjectStoreError(ProjectStoreErrorCode.PROJECT_ALREADY_EXISTS, `Project with database name "${updates.database_name}" already exists`, { database_name: updates.database_name }),
            };
        }
    }
    const updatedProject = {
        ...store.projects[projectIndex],
        ...updates,
        updated_at: new Date().toISOString(),
    };
    store.projects[projectIndex] = updatedProject;
    const writeResult = await writeStore(store);
    if (writeResult.error) {
        return { data: undefined, error: writeResult.error };
    }
    return { data: updatedProject, error: undefined };
}
/**
 * Deletes a project from the store
 *
 * @param id - Project ID
 * @returns Result indicating success
 */
async function deleteProject(id) {
    const storeResult = await readStore();
    if (storeResult.error) {
        return { data: undefined, error: storeResult.error };
    }
    const store = storeResult.data;
    const projectIndex = store.projects.findIndex((p) => p.id === id);
    if (projectIndex === -1) {
        return {
            data: undefined,
            error: new ProjectStoreError(ProjectStoreErrorCode.PROJECT_NOT_FOUND, `Project with ID ${id} not found`, { id }),
        };
    }
    store.projects.splice(projectIndex, 1);
    const writeResult = await writeStore(store);
    if (writeResult.error) {
        return { data: undefined, error: writeResult.error };
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
