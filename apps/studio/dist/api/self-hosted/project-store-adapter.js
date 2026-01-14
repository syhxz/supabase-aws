"use strict";
/**
 * Project Store Adapter
 *
 * Automatically selects between JSON file storage and PostgreSQL storage
 * based on environment configuration
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
exports.ProjectStoreErrorCode = exports.ProjectStoreError = void 0;
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
// Lazy imports to avoid loading Node.js modules on client side
let JsonStore = null;
let PgStore = null;
async function getJsonStore() {
    if (!JsonStore) {
        JsonStore = await Promise.resolve().then(() => __importStar(require('./project-store')));
    }
    return JsonStore;
}
async function getPgStore() {
    if (!PgStore) {
        PgStore = await Promise.resolve().then(() => __importStar(require('./project-store-pg')));
    }
    return PgStore;
}
/**
 * Check if PostgreSQL storage should be used
 * Default: true (PostgreSQL storage)
 * Set USE_JSON_PROJECT_STORE=true to use legacy JSON file storage
 */
function usePgStore() {
    // If explicitly set to use JSON store, use it
    if (process.env.USE_JSON_PROJECT_STORE === 'true') {
        return false;
    }
    // Default to PostgreSQL storage
    return true;
}
/**
 * Get the appropriate store implementation
 */
async function getStore() {
    return usePgStore() ? await getPgStore() : await getJsonStore();
}
/**
 * Ensure the studio_projects table exists (auto-migration)
 * This is called automatically on first database operation
 */
let tableInitialized = false;
async function ensureTableExists() {
    if (tableInitialized || !usePgStore()) {
        return;
    }
    tableInitialized = true;
    try {
        const { executeQuery } = await Promise.resolve().then(() => __importStar(require('./query')));
        // Check if table exists
        const checkResult = await executeQuery({
            query: `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'studio_projects'
        );
      `,
        });
        const tableExists = checkResult.data?.[0]?.exists;
        if (!tableExists) {
            console.log('[Project Store] Auto-creating studio_projects table...');
            // Create table with all constraints
            await executeQuery({
                query: `
          CREATE TABLE IF NOT EXISTS public.studio_projects (
            id SERIAL PRIMARY KEY,
            ref TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            database_name TEXT UNIQUE NOT NULL,
            database_user TEXT, -- Nullable for legacy projects
            database_password_hash TEXT, -- Nullable for legacy projects
            organization_id INTEGER NOT NULL DEFAULT 1,
            owner_user_id TEXT,
            status TEXT NOT NULL DEFAULT 'ACTIVE_HEALTHY',
            region TEXT NOT NULL DEFAULT 'localhost',
            connection_string TEXT NOT NULL,
            inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_studio_projects_ref ON public.studio_projects(ref);
          CREATE INDEX IF NOT EXISTS idx_studio_projects_database_name ON public.studio_projects(database_name);
          CREATE INDEX IF NOT EXISTS idx_studio_projects_owner ON public.studio_projects(owner_user_id);
          CREATE INDEX IF NOT EXISTS idx_studio_projects_org ON public.studio_projects(organization_id);
          CREATE INDEX IF NOT EXISTS idx_studio_projects_status ON public.studio_projects(status);

          CREATE OR REPLACE FUNCTION update_studio_projects_updated_at()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;

          DROP TRIGGER IF EXISTS trigger_studio_projects_updated_at ON public.studio_projects;
          CREATE TRIGGER trigger_studio_projects_updated_at
            BEFORE UPDATE ON public.studio_projects
            FOR EACH ROW
            EXECUTE FUNCTION update_studio_projects_updated_at();
        `,
            });
            console.log('[Project Store] ✓ Table created successfully');
        }
        else {
            // Check if new columns exist and add them if missing
            const columnsResult = await executeQuery({
                query: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'studio_projects'
          AND column_name IN ('database_user', 'database_password_hash');
        `,
            });
            const existingColumns = (columnsResult.data || []).map((row) => row.column_name);
            if (!existingColumns.includes('database_user')) {
                console.log('[Project Store] Adding database_user column...');
                await executeQuery({
                    query: `ALTER TABLE public.studio_projects ADD COLUMN database_user TEXT;`,
                });
            }
            if (!existingColumns.includes('database_password_hash')) {
                console.log('[Project Store] Adding database_password_hash column...');
                await executeQuery({
                    query: `ALTER TABLE public.studio_projects ADD COLUMN database_password_hash TEXT;`,
                });
            }
        }
    }
    catch (error) {
        console.error('[Project Store] Failed to auto-create table:', error);
        // Reset flag to retry on next operation
        tableInitialized = false;
    }
}
var project_store_1 = require("./project-store");
Object.defineProperty(exports, "ProjectStoreError", { enumerable: true, get: function () { return project_store_1.ProjectStoreError; } });
Object.defineProperty(exports, "ProjectStoreErrorCode", { enumerable: true, get: function () { return project_store_1.ProjectStoreErrorCode; } });
/**
 * Save a project
 */
async function save(project) {
    await ensureTableExists();
    const store = await getStore();
    return store.save(project);
}
/**
 * Find all projects
 */
async function findAll() {
    await ensureTableExists();
    const store = await getStore();
    return store.findAll();
}
/**
 * Find project by ID
 */
async function findById(id) {
    const store = await getStore();
    return store.findById(id);
}
/**
 * Find project by ref
 */
async function findByRef(ref) {
    const store = await getStore();
    return store.findByRef(ref);
}
/**
 * Find project by database name
 */
async function findByDatabaseName(databaseName) {
    const store = await getStore();
    return store.findByDatabaseName(databaseName);
}
/**
 * Find projects by organization ID
 */
async function findByOrganizationId(organizationId) {
    const store = await getStore();
    return store.findByOrganizationId(organizationId);
}
/**
 * Find projects by owner user ID
 */
async function findByOwnerUserId(ownerUserId) {
    const store = await getStore();
    return store.findByOwnerUserId(ownerUserId);
}
/**
 * Update a project
 */
async function update(id, updates) {
    const store = await getStore();
    return store.update(id, updates);
}
/**
 * Delete a project
 */
async function deleteProject(id) {
    const store = await getStore();
    return store.deleteProject(id);
}
// Enhanced functions with credential status information
/**
 * Find all projects with enhanced credential status information
 */
async function findAllWithCredentialStatus() {
    await ensureTableExists();
    const store = await getStore();
    return store.findAllWithCredentialStatus();
}
/**
 * Find project by ref with enhanced credential status information
 */
async function findByRefWithCredentialStatus(ref) {
    const store = await getStore();
    return store.findByRefWithCredentialStatus(ref);
}
/**
 * Find projects by organization ID with enhanced credential status information
 */
async function findByOrganizationIdWithCredentialStatus(organizationId) {
    const store = await getStore();
    return store.findByOrganizationIdWithCredentialStatus(organizationId);
}
/**
 * Find projects by owner user ID with enhanced credential status information
 */
async function findByOwnerUserIdWithCredentialStatus(ownerUserId) {
    const store = await getStore();
    return store.findByOwnerUserIdWithCredentialStatus(ownerUserId);
}
/**
 * Get effective credentials for a project by ref
 */
async function getProjectEffectiveCredentials(ref, readOnly = false) {
    const store = await getStore();
    return store.getProjectEffectiveCredentials(ref, readOnly);
}
/**
 * Update project credentials and validate them
 */
async function updateProjectCredentials(id, credentials) {
    const store = await getStore();
    return store.updateProjectCredentials(id, credentials);
}
