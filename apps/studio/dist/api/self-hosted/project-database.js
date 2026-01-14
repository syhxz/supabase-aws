"use strict";
/**
 * Helper functions to get database name for a project in self-hosted mode
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseNameForProject = getDatabaseNameForProject;
exports.getProjectRefFromRequest = getProjectRefFromRequest;
const index_1 = require("./index");
const constants_1 = require("./constants");
/**
 * Get the database name for a given project ref
 * Returns the default database if project not found or in case of error
 */
async function getDatabaseNameForProject(ref) {
    // If ref is 'default', return the default database
    if (ref === 'default') {
        console.log(`[getDatabaseNameForProject] Using default database for ref: ${ref}`);
        return constants_1.POSTGRES_DATABASE;
    }
    try {
        console.log(`[getDatabaseNameForProject] Looking up project with ref: ${ref}`);
        const result = await (0, index_1.findProjectByRef)(ref);
        if (result.error || !result.data) {
            console.warn(`[getDatabaseNameForProject] Project not found for ref: ${ref}, using default database`);
            console.warn(`[getDatabaseNameForProject] Error:`, result.error);
            return constants_1.POSTGRES_DATABASE;
        }
        console.log(`[getDatabaseNameForProject] Found project ${ref} -> database: ${result.data.database_name}`);
        return result.data.database_name;
    }
    catch (error) {
        console.error(`[getDatabaseNameForProject] Error getting database name for project ${ref}:`, error);
        return constants_1.POSTGRES_DATABASE;
    }
}
/**
 * Extract project ref from Next.js API request
 */
function getProjectRefFromRequest(req) {
    const { ref } = req.query;
    if (typeof ref === 'string') {
        return ref;
    }
    if (Array.isArray(ref) && ref.length > 0) {
        return ref[0];
    }
    return null;
}
