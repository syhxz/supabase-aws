"use strict";
/**
 * Environment-Specific Configuration Handler
 *
 * Provides logic to adapt connection strings based on environment
 * and implement reactive updates when configuration changes.
 *
 * Requirements: 3.3, 3.4
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentConfigHandler = void 0;
exports.getEnvironmentConfigHandler = getEnvironmentConfigHandler;
exports.createEnvironmentConfigHandler = createEnvironmentConfigHandler;
exports.setupEnvironmentWatcher = setupEnvironmentWatcher;
exports.useEnvironmentConfig = useEnvironmentConfig;
const connection_string_1 = require("./api/self-hosted/connection-string");
const database_type_identifier_1 = require("./database-type-identifier");
/**
 * Environment-specific configuration handler that adapts connection strings
 * based on environment and provides reactive updates
 */
class EnvironmentConfigHandler {
    constructor(initialConfig) {
        this.listeners = new Set();
        this.databases = [];
        this.currentConfig = this.loadEnvironmentConfig(initialConfig);
    }
    /**
     * Loads environment configuration from process.env with fallbacks
     */
    loadEnvironmentConfig(overrides) {
        const config = {
            POSTGRES_HOST: process.env.POSTGRES_HOST || 'db',
            POSTGRES_PORT: parseInt(process.env.POSTGRES_PORT || '5432', 10),
            POSTGRES_DB: process.env.POSTGRES_DB || 'postgres',
            POSTGRES_USER_READ_WRITE: process.env.POSTGRES_USER_READ_WRITE || 'supabase_admin',
            POSTGRES_USER_READ_ONLY: process.env.POSTGRES_USER_READ_ONLY || 'supabase_read_only_user',
            POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'postgres',
            ENVIRONMENT: process.env.ENVIRONMENT || 'development',
            NODE_ENV: process.env.NODE_ENV || 'development',
            ...overrides
        };
        return config;
    }
    /**
     * Updates the database list for type identification
     */
    updateDatabases(databases) {
        this.databases = databases;
    }
    /**
     * Gets the current environment configuration
     */
    getCurrentConfig() {
        return { ...this.currentConfig };
    }
    /**
     * Updates environment configuration and notifies listeners
     * Requirement 3.4: Reactive UI updates when configuration changes
     */
    updateConfig(newConfig) {
        const previousConfig = { ...this.currentConfig };
        this.currentConfig = { ...this.currentConfig, ...newConfig };
        // Notify all listeners of the configuration change
        this.notifyListeners(this.currentConfig);
    }
    /**
     * Adds a listener for configuration changes
     * Requirement 3.4: Reactive UI updates when configuration changes
     */
    addConfigChangeListener(listener) {
        this.listeners.add(listener);
        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
        };
    }
    /**
     * Notifies all listeners of configuration changes
     */
    notifyListeners(config) {
        this.listeners.forEach(listener => {
            try {
                listener(config);
            }
            catch (error) {
                console.error('Error in config change listener:', error);
            }
        });
    }
    /**
     * Generates environment-adapted connection string
     * Requirement 3.3: Adapt connection strings based on environment
     */
    generateEnvironmentConnectionString(options) {
        const { projectRef, databaseId, readOnly = false, maskPassword = true } = options;
        // Identify database type using current databases (if available)
        let isPrimary = true;
        if (this.databases.length > 0) {
            const typeIdentifier = (0, database_type_identifier_1.createDatabaseTypeIdentifier)(this.databases);
            isPrimary = typeIdentifier.isPrimaryDatabase(projectRef, databaseId);
        }
        // Get environment-specific configuration
        const envConfig = this.getEnvironmentSpecificConfig();
        // Determine if we should use read-only credentials
        // Use explicit readOnly parameter first, then fall back to database type
        const useReadOnly = readOnly || !isPrimary;
        // Prepare connection string options with environment-specific values
        const connectionOptions = {
            databaseName: this.getDatabaseName(projectRef, databaseId),
            readOnly: useReadOnly,
            host: envConfig.host,
            port: envConfig.port,
            user: useReadOnly ? envConfig.readOnlyUser : envConfig.readWriteUser,
            password: envConfig.password,
            useEnvironmentDefaults: true,
            maskPassword
        };
        return (0, connection_string_1.generateConnectionString)(connectionOptions);
    }
    /**
     * Gets environment-specific configuration based on current environment
     * Requirement 3.3: Environment-specific adaptation
     */
    getEnvironmentSpecificConfig() {
        const config = this.currentConfig;
        // Adapt configuration based on environment
        switch (config.ENVIRONMENT) {
            case 'production':
                return {
                    host: config.POSTGRES_HOST,
                    port: config.POSTGRES_PORT,
                    readWriteUser: config.POSTGRES_USER_READ_WRITE,
                    readOnlyUser: config.POSTGRES_USER_READ_ONLY,
                    password: config.POSTGRES_PASSWORD
                };
            case 'staging':
                return {
                    host: config.POSTGRES_HOST,
                    port: config.POSTGRES_PORT,
                    readWriteUser: config.POSTGRES_USER_READ_WRITE,
                    readOnlyUser: config.POSTGRES_USER_READ_ONLY,
                    password: config.POSTGRES_PASSWORD
                };
            case 'development':
            default:
                return {
                    host: config.POSTGRES_HOST || 'db',
                    port: config.POSTGRES_PORT || 5432,
                    readWriteUser: config.POSTGRES_USER_READ_WRITE || 'supabase_admin',
                    readOnlyUser: config.POSTGRES_USER_READ_ONLY || 'supabase_read_only_user',
                    password: config.POSTGRES_PASSWORD || 'postgres'
                };
        }
    }
    /**
     * Gets the appropriate database name for the connection
     */
    getDatabaseName(projectRef, databaseId) {
        // Find the specific database
        const database = this.databases.find(db => db.identifier === databaseId);
        if (database?.db_name) {
            return database.db_name;
        }
        // Fallback to project reference or environment default
        return projectRef || this.currentConfig.POSTGRES_DB;
    }
    /**
     * Validates environment configuration
     */
    validateConfig() {
        const errors = [];
        const config = this.currentConfig;
        if (!config.POSTGRES_HOST || config.POSTGRES_HOST.trim() === '') {
            errors.push('POSTGRES_HOST cannot be empty');
        }
        if (!config.POSTGRES_PORT || config.POSTGRES_PORT <= 0 || config.POSTGRES_PORT > 65535) {
            errors.push('POSTGRES_PORT must be a valid port number between 1 and 65535');
        }
        if (!config.POSTGRES_DB || config.POSTGRES_DB.trim() === '') {
            errors.push('POSTGRES_DB cannot be empty');
        }
        if (!config.POSTGRES_USER_READ_WRITE || config.POSTGRES_USER_READ_WRITE.trim() === '') {
            errors.push('POSTGRES_USER_READ_WRITE cannot be empty');
        }
        if (!config.POSTGRES_USER_READ_ONLY || config.POSTGRES_USER_READ_ONLY.trim() === '') {
            errors.push('POSTGRES_USER_READ_ONLY cannot be empty');
        }
        if (!config.POSTGRES_PASSWORD || config.POSTGRES_PASSWORD.trim() === '') {
            errors.push('POSTGRES_PASSWORD cannot be empty');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Reloads configuration from environment variables
     * Useful for detecting external configuration changes
     */
    reloadFromEnvironment() {
        const newConfig = this.loadEnvironmentConfig();
        // Check if configuration actually changed
        const hasChanged = Object.keys(newConfig).some(key => {
            const configKey = key;
            return this.currentConfig[configKey] !== newConfig[configKey];
        });
        if (hasChanged) {
            this.currentConfig = newConfig;
            this.notifyListeners(this.currentConfig);
        }
    }
    /**
     * Gets connection strings for all supported formats with environment adaptation
     */
    getAllConnectionStrings(options) {
        const baseConnectionString = this.generateEnvironmentConnectionString(options);
        const { projectRef, databaseId, readOnly = false } = options;
        // Get environment-specific configuration
        const envConfig = this.getEnvironmentSpecificConfig();
        const databaseName = this.getDatabaseName(projectRef, databaseId);
        const user = readOnly ? envConfig.readOnlyUser : envConfig.readWriteUser;
        const password = '[YOUR_PASSWORD]'; // Always mask for display
        return {
            postgresql: baseConnectionString,
            psql: `psql -h ${envConfig.host} -p ${envConfig.port} -d ${databaseName} -U ${user}`,
            jdbc: `jdbc:postgresql://${envConfig.host}:${envConfig.port}/${databaseName}?user=${user}&password=${password}`,
            dotnet: `Host=${envConfig.host};Database=${databaseName};Username=${user};Password=${password};SSL Mode=Require;Trust Server Certificate=true`,
            nodejs: `DATABASE_URL=${baseConnectionString}`
        };
    }
}
exports.EnvironmentConfigHandler = EnvironmentConfigHandler;
/**
 * Global instance for environment configuration handling
 */
let globalConfigHandler = null;
/**
 * Gets or creates the global environment configuration handler
 */
function getEnvironmentConfigHandler() {
    if (!globalConfigHandler) {
        globalConfigHandler = new EnvironmentConfigHandler();
    }
    return globalConfigHandler;
}
/**
 * Creates a new environment configuration handler instance
 */
function createEnvironmentConfigHandler(initialConfig) {
    return new EnvironmentConfigHandler(initialConfig);
}
/**
 * Utility function to detect environment changes and update configuration
 */
function setupEnvironmentWatcher(handler) {
    // Set up periodic checking for environment changes
    const interval = setInterval(() => {
        handler.reloadFromEnvironment();
    }, 5000); // Check every 5 seconds
    // Return cleanup function
    return () => {
        clearInterval(interval);
    };
}
/**
 * React hook for environment configuration (if using React)
 */
function useEnvironmentConfig() {
    const handler = getEnvironmentConfigHandler();
    return {
        config: handler.getCurrentConfig(),
        updateConfig: (newConfig) => handler.updateConfig(newConfig),
        addListener: (listener) => handler.addConfigChangeListener(listener),
        generateConnectionString: (options) => handler.generateEnvironmentConnectionString(options),
        getAllConnectionStrings: (options) => handler.getAllConnectionStrings(options),
        validateConfig: () => handler.validateConfig(),
        reloadFromEnvironment: () => handler.reloadFromEnvironment()
    };
}
