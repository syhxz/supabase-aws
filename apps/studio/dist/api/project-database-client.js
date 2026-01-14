"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectDatabaseClient = void 0;
exports.getProjectDatabaseClient = getProjectDatabaseClient;
const database_pool_manager_1 = require("./database-pool-manager");
const user_permission_service_1 = require("./user-permission-service");
const ssl_error_handler_1 = require("./ssl-error-handler");
/**
 * Database client for project metadata operations
 */
class ProjectDatabaseClient {
    constructor() {
        this.projectCache = new Map();
        this.cacheExpiry = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        this.poolManager = (0, database_pool_manager_1.getDatabasePoolManager)();
        this.permissionService = (0, user_permission_service_1.getUserPermissionService)();
        this.sslErrorHandler = (0, ssl_error_handler_1.getSSLErrorHandler)();
    }
    static getInstance() {
        if (!ProjectDatabaseClient.instance) {
            ProjectDatabaseClient.instance = new ProjectDatabaseClient();
        }
        return ProjectDatabaseClient.instance;
    }
    /**
     * Get project metadata by project reference with user permission validation
     */
    async getProjectByRef(projectRef, userId) {
        // Check cache first
        const cached = this.getCachedProject(projectRef);
        if (cached && userId) {
            // Validate user access to cached project
            const validation = await this.permissionService.validateProjectAccess(userId, projectRef, { read: true });
            if (!validation.isValid) {
                return null;
            }
        }
        if (cached) {
            return cached;
        }
        try {
            // Query the database
            const project = await this.queryProjectFromDatabase(projectRef, userId);
            if (project) {
                // Cache the result
                this.cacheProject(projectRef, project);
            }
            return project;
        }
        catch (error) {
            console.error('Failed to get project metadata:', error);
            return null;
        }
    }
    /**
     * Get all projects for a user
     */
    async getProjectsForUser(userId) {
        try {
            const globalDbConfig = this.getGlobalDatabaseConfig();
            const poolKey = 'global-projects';
            const query = `
        SELECT 
          sp.id,
          sp.ref,
          sp.name,
          sp.database_name,
          sp.database_user,
          sp.database_password_hash,
          sp.organization_id,
          sp.owner_user_id,
          sp.status,
          sp.region,
          sp.connection_string,
          sp.inserted_at,
          sp.updated_at
        FROM studio_projects sp
        WHERE sp.owner_user_id = $1 
        ORDER BY sp.name ASC
      `;
            const result = await this.poolManager.query(poolKey, globalDbConfig, query, [userId]);
            return result.rows.map(this.mapRowToProjectMetadata);
        }
        catch (error) {
            console.error('Failed to get projects for user:', error);
            return [];
        }
    }
    /**
     * Create a new project
     */
    async createProject(projectData, userId) {
        try {
            const globalDbConfig = this.getGlobalDatabaseConfig();
            const poolKey = 'global-projects';
            const query = `
        INSERT INTO studio_projects (
          ref, name, database_name, database_user, database_password_hash,
          organization_id, owner_user_id, status, region, connection_string
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
            const values = [
                projectData.ref,
                projectData.name,
                projectData.database_name,
                projectData.database_user,
                projectData.database_password_hash,
                projectData.organization_id,
                userId,
                'ACTIVE_HEALTHY',
                projectData.region || 'local',
                projectData.connection_string
            ];
            const result = await this.poolManager.query(poolKey, globalDbConfig, query, values);
            if (result.rows.length > 0) {
                const project = this.mapRowToProjectMetadata(result.rows[0]);
                this.cacheProject(project.ref, project);
                return project;
            }
            return null;
        }
        catch (error) {
            console.error('Failed to create project:', error);
            return null;
        }
    }
    /**
     * Update project metadata
     */
    async updateProject(projectRef, updates, userId) {
        try {
            // Validate user has admin access
            const validation = await this.permissionService.validateProjectAccess(userId, projectRef, { admin: true });
            if (!validation.isValid) {
                throw new Error('User does not have admin access to this project');
            }
            const globalDbConfig = this.getGlobalDatabaseConfig();
            const poolKey = 'global-projects';
            // Build dynamic update query
            const updateFields = [];
            const values = [];
            let paramIndex = 1;
            if (updates.name !== undefined) {
                updateFields.push(`name = $${paramIndex++}`);
                values.push(updates.name);
            }
            if (updates.status !== undefined) {
                updateFields.push(`status = $${paramIndex++}`);
                values.push(updates.status);
            }
            if (updates.region !== undefined) {
                updateFields.push(`region = $${paramIndex++}`);
                values.push(updates.region);
            }
            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }
            updateFields.push(`updated_at = NOW()`);
            values.push(projectRef); // WHERE condition
            const query = `
        UPDATE studio_projects 
        SET ${updateFields.join(', ')}
        WHERE ref = $${paramIndex}
        RETURNING *
      `;
            const result = await this.poolManager.query(poolKey, globalDbConfig, query, values);
            if (result.rows.length > 0) {
                const project = this.mapRowToProjectMetadata(result.rows[0]);
                this.cacheProject(project.ref, project);
                return project;
            }
            return null;
        }
        catch (error) {
            console.error('Failed to update project:', error);
            return null;
        }
    }
    /**
     * Delete a project
     */
    async deleteProject(projectRef, userId) {
        try {
            // Validate user has admin access
            const validation = await this.permissionService.validateProjectAccess(userId, projectRef, { admin: true });
            if (!validation.isValid) {
                throw new Error('User does not have admin access to this project');
            }
            const globalDbConfig = this.getGlobalDatabaseConfig();
            const poolKey = 'global-projects';
            const query = `
        DELETE FROM studio_projects 
        WHERE ref = $1 AND owner_user_id = $2
      `;
            const result = await this.poolManager.query(poolKey, globalDbConfig, query, [projectRef, userId]);
            if (result.rowCount > 0) {
                this.clearProjectCache(projectRef);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Failed to delete project:', error);
            return false;
        }
    }
    /**
     * Execute a query on a project's database
     */
    async queryProjectDatabase(projectRef, userId, query, params, options) {
        try {
            console.log(`[queryProjectDatabase] Starting query for project ${projectRef}, user ${userId}`);
            // Validate user access (unless explicitly skipped)
            if (!options?.skipPermissionCheck) {
                console.log(`[queryProjectDatabase] Validating user access...`);
                const validation = await this.permissionService.validateProjectAccess(userId, projectRef, { read: true });
                if (!validation.isValid) {
                    console.error(`[queryProjectDatabase] Permission validation failed for user ${userId} on project ${projectRef}:`, validation.error, validation.message);
                    throw new Error(`User does not have access to this project: ${validation.message}`);
                }
                console.log(`[queryProjectDatabase] Permission validation passed`);
            }
            else {
                console.log(`[queryProjectDatabase] Skipping permission check`);
            }
            // Get project metadata (without user validation if permissions already checked)
            console.log(`[queryProjectDatabase] Getting project metadata...`);
            const project = await this.getProjectByRef(projectRef, options?.skipPermissionCheck ? undefined : userId);
            if (!project) {
                console.error(`[queryProjectDatabase] Project not found: ${projectRef}`);
                throw new Error('Project not found');
            }
            console.log(`[queryProjectDatabase] Found project: ${project.name} (${project.database_name})`);
            // Create project-specific database configuration
            const projectDbConfig = this.createProjectDatabaseConfig(project);
            const poolKey = `project-${projectRef}`;
            console.log(`[queryProjectDatabase] Executing query on project database...`);
            console.log(`[queryProjectDatabase] Pool key: ${poolKey}`);
            console.log(`[queryProjectDatabase] Query: ${query.substring(0, 100)}...`);
            // Execute query on project database
            const result = await this.poolManager.query(poolKey, projectDbConfig, query, params);
            console.log(`[queryProjectDatabase] Query successful, returned ${result.rows?.length || 0} rows`);
            return result;
        }
        catch (error) {
            console.error(`[queryProjectDatabase] Failed to query project database for ${projectRef}:`, error);
            throw error;
        }
    }
    /**
     * Query project from database using real PostgreSQL client
     */
    async queryProjectFromDatabase(projectRef, userId) {
        try {
            const globalDbConfig = this.getGlobalDatabaseConfig();
            const poolKey = 'global-projects';
            console.log(`[queryProjectFromDatabase] Looking up project ${projectRef} for user ${userId}`);
            console.log(`[queryProjectFromDatabase] Global DB config:`, {
                host: globalDbConfig.host,
                port: globalDbConfig.port,
                database: globalDbConfig.database,
                user: globalDbConfig.user,
                ssl: globalDbConfig.ssl,
                application_name: globalDbConfig.application_name
            });
            let query;
            let params;
            if (userId) {
                // Query with user permission validation
                query = `
          SELECT 
            sp.id,
            sp.ref,
            sp.name,
            sp.database_name,
            sp.database_user,
            sp.database_password_hash,
            sp.organization_id,
            sp.owner_user_id,
            sp.status,
            sp.region,
            sp.connection_string,
            sp.inserted_at,
            sp.updated_at
          FROM studio_projects sp
          WHERE sp.ref = $1 
            AND sp.owner_user_id = $2
          LIMIT 1
        `;
                params = [projectRef, userId];
                console.log(`[queryProjectFromDatabase] Query with user validation: ${projectRef}, ${userId}`);
            }
            else {
                // Query without user validation (for internal use)
                query = `
          SELECT 
            sp.id,
            sp.ref,
            sp.name,
            sp.database_name,
            sp.database_user,
            sp.database_password_hash,
            sp.organization_id,
            sp.owner_user_id,
            sp.status,
            sp.region,
            sp.connection_string,
            sp.inserted_at,
            sp.updated_at
          FROM studio_projects sp
          WHERE sp.ref = $1
          LIMIT 1
        `;
                params = [projectRef];
                console.log(`[queryProjectFromDatabase] Query without user validation: ${projectRef}`);
            }
            const result = await this.poolManager.query(poolKey, globalDbConfig, query, params);
            console.log(`[queryProjectFromDatabase] Query result: ${result.rows.length} rows found`);
            if (result.rows.length === 0) {
                console.log(`[queryProjectFromDatabase] No project found for ref: ${projectRef}`);
                return null;
            }
            const project = this.mapRowToProjectMetadata(result.rows[0]);
            console.log(`[queryProjectFromDatabase] Found project:`, {
                id: project.id,
                ref: project.ref,
                name: project.name,
                database_name: project.database_name,
                owner_user_id: project.owner_user_id
            });
            return project;
        }
        catch (error) {
            console.error(`[queryProjectFromDatabase] Database query failed for project ${projectRef}:`, error);
            return null;
        }
    }
    /**
     * Create project-specific database configuration with enhanced SSL handling
     * Requirements: 10.1, 10.3, 10.4, 12.1, 12.2
     */
    createProjectDatabaseConfig(project) {
        console.log(`Creating database config for project ${project.ref}:`, {
            hasConnectionString: !!project.connection_string,
            connectionString: project.connection_string ? project.connection_string.replace(/password=[^&]+/, 'password=***') : null
        });
        // First try to use connection_string if available
        if (project.connection_string) {
            try {
                const parsedConfig = this.parseConnectionString(project.connection_string);
                if (parsedConfig) {
                    console.log(`Parsed connection string for project ${project.ref}:`, {
                        host: parsedConfig.host,
                        port: parsedConfig.port,
                        database: parsedConfig.database,
                        user: parsedConfig.user,
                        ssl: parsedConfig.ssl
                    });
                    return {
                        ...parsedConfig,
                        max: 10,
                        idleTimeoutMillis: 30000,
                        connectionTimeoutMillis: 10000,
                        application_name: `supabase-studio-${project.ref}`
                    };
                }
            }
            catch (error) {
                console.warn(`Failed to parse connection string for project ${project.ref}, falling back to individual parameters:`, error);
            }
        }
        // Fallback to individual connection parameters
        const sslConfig = this.getProjectSSLConfig(project);
        const config = {
            host: this.getProjectHost(project),
            port: this.getProjectPort(project),
            database: project.database_name,
            user: project.database_user,
            password: project.database_password_hash,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            ssl: sslConfig,
            application_name: `supabase-studio-${project.ref}`
        };
        console.log(`Final database config for project ${project.ref}:`, {
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            ssl: config.ssl
        });
        return config;
    }
    /**
     * Parse PostgreSQL connection string
     */
    parseConnectionString(connectionString) {
        try {
            // Handle different connection string formats
            // postgresql://user:password@host:port/database?options
            // postgres://user:password@host:port/database?options
            const url = new URL(connectionString);
            if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
                throw new Error('Invalid connection string protocol');
            }
            const config = {
                host: url.hostname,
                port: url.port ? parseInt(url.port, 10) : 5432,
                database: url.pathname.slice(1), // Remove leading slash
                user: url.username,
                password: url.password
            };
            // Parse SSL and other options from query parameters
            const sslMode = url.searchParams.get('sslmode');
            if (sslMode) {
                config.ssl = this.parseSSLMode(sslMode);
            }
            // Validate required fields
            if (!config.host || !config.database || !config.user) {
                throw new Error('Missing required connection parameters');
            }
            return config;
        }
        catch (error) {
            console.error('Failed to parse connection string:', error);
            return null;
        }
    }
    /**
     * Get project-specific host
     */
    getProjectHost(project) {
        // Check if project has specific host configuration
        if (project.database_host) {
            return project.database_host;
        }
        // Fallback to environment variable
        return process.env.POSTGRES_HOST || 'db';
    }
    /**
     * Get project-specific port
     */
    getProjectPort(project) {
        // Check if project has specific port configuration
        if (project.database_port) {
            return project.database_port;
        }
        // Fallback to environment variable
        return parseInt(process.env.POSTGRES_PORT || '5432', 10);
    }
    /**
     * Get project-specific SSL configuration with enhanced validation and logging
     * Requirements: 12.1, 12.2, 12.3, 12.5
     */
    getProjectSSLConfig(project) {
        // Check if project has specific SSL configuration
        if (project.ssl_config) {
            const sslConfig = this.parseProjectSSLConfig(project.ssl_config);
            // Validate SSL configuration
            const validation = this.sslErrorHandler.validateSSLConfig(sslConfig || false);
            if (!validation.isValid) {
                console.warn(`Invalid SSL configuration for project ${project.ref}:`, validation.errors);
                // Log SSL configuration warning
                console.warn('SSL Configuration Warning:', {
                    timestamp: new Date().toISOString(),
                    level: 'warning',
                    category: 'ssl_config_validation',
                    projectRef: project.ref,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    fallbackToDefault: true
                });
            }
            return sslConfig;
        }
        // Check for SSL configuration in connection string
        if (project.connection_string) {
            const sslFromConnectionString = this.extractSSLFromConnectionString(project.connection_string);
            if (sslFromConnectionString !== null) {
                return sslFromConnectionString;
            }
        }
        // Check environment variable for project-specific SSL override
        const projectSSLOverride = process.env[`PROJECT_${project.ref.toUpperCase()}_SSL_MODE`];
        if (projectSSLOverride) {
            return this.parseSSLMode(projectSSLOverride);
        }
        // Check global SSL configuration
        const globalSSLMode = process.env.POSTGRES_SSL_MODE || process.env.DATABASE_SSL_MODE;
        if (globalSSLMode) {
            return this.parseSSLMode(globalSSLMode);
        }
        // Default behavior: SSL is optional, not required
        // This prevents connection failures when SSL is not supported by the database
        return false; // Disable SSL by default to avoid connection errors
    }
    /**
     * Parse SSL mode from connection string with enhanced SSL support and logging
     * Requirements: 12.1, 12.4, 12.5
     */
    parseSSLMode(sslMode) {
        const mode = sslMode.toLowerCase();
        // Log SSL mode parsing for debugging
        console.log('SSL Mode Parsing:', {
            timestamp: new Date().toISOString(),
            level: 'debug',
            category: 'ssl_mode_parsing',
            inputMode: sslMode,
            normalizedMode: mode
        });
        switch (mode) {
            case 'require':
                return { rejectUnauthorized: true };
            case 'prefer':
                return { rejectUnauthorized: false };
            case 'allow':
                return { rejectUnauthorized: false };
            case 'verify-ca':
                return {
                    rejectUnauthorized: true,
                    ca: process.env.POSTGRES_SSL_CA_CERT
                };
            case 'verify-full':
                return {
                    rejectUnauthorized: true,
                    ca: process.env.POSTGRES_SSL_CA_CERT,
                    checkServerIdentity: () => undefined // Custom server identity check
                };
            case 'disable':
            case 'none':
            case 'false':
                return false;
            default:
                console.warn(`Unknown SSL mode: ${sslMode}, defaulting to disabled`);
                // Log SSL mode warning
                console.warn('SSL Mode Warning:', {
                    timestamp: new Date().toISOString(),
                    level: 'warning',
                    category: 'ssl_mode_unknown',
                    unknownMode: sslMode,
                    fallbackMode: 'disable'
                });
                return false;
        }
    }
    /**
     * Parse project-specific SSL configuration object
     * Requirements: 12.2, 12.3
     */
    parseProjectSSLConfig(sslConfig) {
        if (typeof sslConfig === 'boolean') {
            return sslConfig;
        }
        if (typeof sslConfig === 'string') {
            return this.parseSSLMode(sslConfig);
        }
        if (typeof sslConfig === 'object' && sslConfig !== null) {
            // Handle SSL configuration object
            const config = {};
            if ('rejectUnauthorized' in sslConfig) {
                config.rejectUnauthorized = Boolean(sslConfig.rejectUnauthorized);
            }
            if ('ca' in sslConfig && sslConfig.ca) {
                config.ca = sslConfig.ca;
            }
            if ('cert' in sslConfig && sslConfig.cert) {
                config.cert = sslConfig.cert;
            }
            if ('key' in sslConfig && sslConfig.key) {
                config.key = sslConfig.key;
            }
            return Object.keys(config).length > 0 ? config : false;
        }
        return false;
    }
    /**
     * Extract SSL configuration from connection string
     * Requirements: 11.2, 12.1
     */
    extractSSLFromConnectionString(connectionString) {
        try {
            const url = new URL(connectionString);
            const sslMode = url.searchParams.get('sslmode');
            if (sslMode) {
                return this.parseSSLMode(sslMode);
            }
            // Check for other SSL-related parameters
            const sslCert = url.searchParams.get('sslcert');
            const sslKey = url.searchParams.get('sslkey');
            const sslRootCert = url.searchParams.get('sslrootcert');
            if (sslCert || sslKey || sslRootCert) {
                return {
                    rejectUnauthorized: true,
                    cert: sslCert,
                    key: sslKey,
                    ca: sslRootCert
                };
            }
            return null; // No SSL configuration found in connection string
        }
        catch (error) {
            console.warn('Failed to extract SSL configuration from connection string:', error);
            return null;
        }
    }
    /**
     * Test project database connection with enhanced SSL error handling
     * Requirements: 12.4, 12.5
     */
    async testProjectConnection(projectRef, userId) {
        let connectionAttempt = 0;
        const startTime = Date.now();
        try {
            // Validate user access
            const validation = await this.permissionService.validateProjectAccess(userId, projectRef, { read: true });
            if (!validation.isValid) {
                console.error(`Permission validation failed for user ${userId} on project ${projectRef}:`, {
                    error: validation.error,
                    message: validation.message,
                    userId,
                    projectRef
                });
                return {
                    success: false,
                    sslEnabled: false,
                    error: `User does not have access to this project: ${validation.message}`
                };
            }
            // Get project metadata
            const project = await this.getProjectByRef(projectRef, userId);
            if (!project) {
                console.error(`Project not found: ${projectRef} for user ${userId}`);
                return {
                    success: false,
                    sslEnabled: false,
                    error: 'Project not found'
                };
            }
            console.log(`Testing connection for project ${projectRef}:`, {
                projectId: project.id,
                databaseName: project.database_name,
                databaseUser: project.database_user,
                hasConnectionString: !!project.connection_string,
                ownerUserId: project.owner_user_id,
                requestingUserId: userId,
                ownerMatch: project.owner_user_id === userId
            });
            // Test connection with SSL error handling
            connectionAttempt++;
            try {
                const result = await this.queryProjectDatabase(projectRef, userId, 'SELECT 1 as test');
                const connectionTime = Date.now() - startTime;
                const projectConfig = this.createProjectDatabaseConfig(project);
                return {
                    success: true,
                    sslEnabled: !!projectConfig.ssl,
                    sslMode: this.extractSSLModeFromConfig(projectConfig.ssl),
                    connectionTime
                };
            }
            catch (error) {
                // Check if this is an SSL-related error
                if (this.sslErrorHandler.isSSLError(error)) {
                    const sslError = this.sslErrorHandler.categorizeSSLError(error);
                    const projectConfig = this.createProjectDatabaseConfig(project);
                    const sslMode = this.extractSSLModeFromConfig(projectConfig.ssl);
                    // Log the SSL error with context
                    this.sslErrorHandler.logSSLError(sslError, {
                        projectRef,
                        sslMode,
                        connectionAttempt,
                        fallbackAttempted: false
                    });
                    console.warn(`SSL connection failed for project ${projectRef}, attempting without SSL:`, sslError.message);
                    // Try to reconnect without SSL
                    connectionAttempt++;
                    const fallbackResult = await this.testConnectionWithoutSSL(project, userId);
                    if (fallbackResult.success) {
                        // Log successful fallback
                        this.sslErrorHandler.logSSLError(sslError, {
                            projectRef,
                            sslMode,
                            connectionAttempt,
                            fallbackAttempted: true
                        });
                        return {
                            success: true,
                            sslEnabled: false,
                            connectionTime: Date.now() - startTime,
                            fallbackUsed: true,
                            error: `SSL connection failed, connected without SSL: ${sslError.message}`
                        };
                    }
                    else {
                        return {
                            success: false,
                            sslEnabled: !!projectConfig.ssl,
                            sslMode,
                            connectionTime: Date.now() - startTime,
                            error: `Both SSL and non-SSL connections failed: ${sslError.message}`
                        };
                    }
                }
                // Re-throw non-SSL errors
                throw error;
            }
        }
        catch (error) {
            const connectionTime = Date.now() - startTime;
            console.error(`Failed to test connection for project ${projectRef}:`, {
                error: error instanceof Error ? error.message : error,
                userId,
                projectRef,
                connectionAttempt,
                connectionTime,
                stack: error instanceof Error ? error.stack : undefined
            });
            return {
                success: false,
                sslEnabled: false,
                connectionTime,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
    /**
     * Test connection without SSL as fallback
     * Requirements: 12.4
     */
    async testConnectionWithoutSSL(project, userId) {
        try {
            // Create a temporary configuration without SSL
            const tempConfig = this.createProjectDatabaseConfig(project);
            tempConfig.ssl = false;
            const poolKey = `project-${project.ref}-no-ssl-test`;
            // Test with a simple query
            const result = await this.poolManager.query(poolKey, tempConfig, 'SELECT 1 as test', []);
            // Clean up the temporary pool
            this.poolManager.closePool(poolKey);
            const success = result && result.rows && result.rows.length > 0;
            return {
                success,
                sslEnabled: false,
                error: success ? undefined : 'Non-SSL connection test failed'
            };
        }
        catch (error) {
            console.error(`Non-SSL connection test also failed for project ${project.ref}:`, error);
            return {
                success: false,
                sslEnabled: false,
                error: error instanceof Error ? error.message : 'Non-SSL connection failed'
            };
        }
    }
    /**
     * Extract SSL mode from SSL configuration
     * Requirements: 12.1
     */
    extractSSLModeFromConfig(sslConfig) {
        if (sslConfig === undefined || sslConfig === null) {
            return undefined;
        }
        if (typeof sslConfig === 'boolean') {
            return sslConfig ? 'require' : 'disable';
        }
        if (typeof sslConfig === 'object' && sslConfig !== null) {
            // Try to determine mode from configuration
            if ('rejectUnauthorized' in sslConfig) {
                return sslConfig.rejectUnauthorized ? 'verify-ca' : 'require';
            }
            return 'require';
        }
        return undefined;
    }
    /**
     * Get connection info for debugging (without sensitive data)
     * Requirements: 12.4
     */
    async getProjectConnectionInfo(projectRef, userId) {
        try {
            // Validate user access
            const validation = await this.permissionService.validateProjectAccess(userId, projectRef, { read: true });
            if (!validation.isValid) {
                throw new Error('User does not have access to this project');
            }
            // Get project metadata
            const project = await this.getProjectByRef(projectRef, userId);
            if (!project) {
                throw new Error('Project not found');
            }
            const config = this.createProjectDatabaseConfig(project);
            // Return connection info without sensitive data
            return {
                projectRef,
                host: config.host,
                port: config.port,
                database: config.database,
                user: config.user,
                sslEnabled: !!config.ssl,
                sslConfig: this.sanitizeSSLConfig(config.ssl || false),
                poolKey: `project-${projectRef}`,
                hasConnectionString: !!project.connection_string,
                connectionSource: project.connection_string ? 'connection_string' : 'individual_parameters',
                sslSource: this.getSSLConfigSource(project)
            };
        }
        catch (error) {
            console.error(`Failed to get connection info for project ${projectRef}:`, error);
            throw error;
        }
    }
    /**
     * Sanitize SSL configuration for debugging (remove sensitive data)
     * Requirements: 12.4
     */
    sanitizeSSLConfig(sslConfig) {
        if (typeof sslConfig === 'boolean') {
            return sslConfig;
        }
        if (typeof sslConfig === 'object' && sslConfig !== null) {
            const sanitized = {};
            if ('rejectUnauthorized' in sslConfig) {
                sanitized.rejectUnauthorized = sslConfig.rejectUnauthorized;
            }
            if ('ca' in sslConfig) {
                sanitized.hasCaCert = !!sslConfig.ca;
            }
            if ('cert' in sslConfig) {
                sanitized.hasClientCert = !!sslConfig.cert;
            }
            if ('key' in sslConfig) {
                sanitized.hasClientKey = !!sslConfig.key;
            }
            return sanitized;
        }
        return sslConfig;
    }
    /**
     * Get the source of SSL configuration for debugging
     * Requirements: 12.1, 12.2
     */
    getSSLConfigSource(project) {
        if (project.ssl_config) {
            return 'project_ssl_config';
        }
        if (project.connection_string && this.extractSSLFromConnectionString(project.connection_string)) {
            return 'connection_string';
        }
        const projectSSLOverride = process.env[`PROJECT_${project.ref.toUpperCase()}_SSL_MODE`];
        if (projectSSLOverride) {
            return 'project_env_override';
        }
        const globalSSLMode = process.env.POSTGRES_SSL_MODE || process.env.DATABASE_SSL_MODE;
        if (globalSSLMode) {
            return 'global_env_config';
        }
        return 'default_disabled';
    }
    /**
     * Get global database configuration for studio metadata
     */
    getGlobalDatabaseConfig() {
        // Get SSL configuration using the same logic as project-specific configs
        const globalSSLMode = process.env.POSTGRES_SSL_MODE || process.env.DATABASE_SSL_MODE;
        let sslConfig = false;
        if (globalSSLMode) {
            sslConfig = this.parseSSLMode(globalSSLMode);
        }
        else if (process.env.NODE_ENV === 'production') {
            sslConfig = { rejectUnauthorized: false };
        }
        return {
            host: process.env.POSTGRES_HOST || 'db',
            port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
            database: process.env.POSTGRES_DB || 'postgres',
            user: process.env.POSTGRES_USER_READ_WRITE || 'supabase_admin',
            password: process.env.POSTGRES_PASSWORD,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            ssl: sslConfig,
            application_name: 'supabase-studio-global'
        };
    }
    /**
     * Map database row to ProjectMetadata interface
     */
    mapRowToProjectMetadata(row) {
        return {
            id: row.id,
            ref: row.ref,
            name: row.name,
            database_name: row.database_name,
            database_user: row.database_user,
            database_password_hash: row.database_password_hash,
            organization_id: row.organization_id,
            owner_user_id: row.owner_user_id,
            status: row.status,
            region: row.region,
            connection_string: row.connection_string,
            inserted_at: row.inserted_at,
            updated_at: row.updated_at
        };
    }
    /**
     * Get cached project if available and not expired
     */
    getCachedProject(projectRef) {
        const cached = this.projectCache.get(projectRef);
        const expiry = this.cacheExpiry.get(projectRef);
        if (cached && expiry && Date.now() < expiry) {
            return cached;
        }
        // Remove expired cache
        if (cached) {
            this.projectCache.delete(projectRef);
            this.cacheExpiry.delete(projectRef);
        }
        return null;
    }
    /**
     * Cache project metadata
     */
    cacheProject(projectRef, project) {
        this.projectCache.set(projectRef, project);
        this.cacheExpiry.set(projectRef, Date.now() + this.CACHE_TTL);
    }
    /**
     * Clear cache for a specific project
     */
    clearProjectCache(projectRef) {
        this.projectCache.delete(projectRef);
        this.cacheExpiry.delete(projectRef);
    }
    /**
     * Clear all cached projects
     */
    clearAllCache() {
        this.projectCache.clear();
        this.cacheExpiry.clear();
    }
}
exports.ProjectDatabaseClient = ProjectDatabaseClient;
/**
 * Factory function to get the project database client
 */
function getProjectDatabaseClient() {
    return ProjectDatabaseClient.getInstance();
}
