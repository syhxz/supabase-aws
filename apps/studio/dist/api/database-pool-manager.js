"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabasePoolManager = void 0;
exports.getDatabasePoolManager = getDatabasePoolManager;
const pg_1 = require("pg");
/**
 * Database Connection Pool Manager
 * Manages multiple connection pools for different databases
 */
class DatabasePoolManager {
    constructor() {
        this.pools = new Map();
        this.poolConfigs = new Map();
        // Cleanup pools on process exit
        process.on('SIGINT', () => this.closeAllPools());
        process.on('SIGTERM', () => this.closeAllPools());
        process.on('exit', () => this.closeAllPools());
    }
    static getInstance() {
        if (!DatabasePoolManager.instance) {
            DatabasePoolManager.instance = new DatabasePoolManager();
        }
        return DatabasePoolManager.instance;
    }
    /**
     * Get or create a connection pool for a database
     */
    getPool(poolKey, config) {
        if (this.pools.has(poolKey)) {
            const existingPool = this.pools.get(poolKey);
            // Verify the existing pool configuration matches the requested config
            const existingConfig = this.poolConfigs.get(poolKey);
            if (existingConfig && this.configsMatch(existingConfig, config)) {
                return existingPool;
            }
            else {
                // Configuration has changed, close the old pool and create a new one
                console.log(`Configuration changed for pool ${poolKey}, recreating pool`);
                this.closePool(poolKey);
            }
        }
        // Create new pool with optimized configuration
        const poolConfig = {
            ...config,
            // Connection pool settings
            max: config.max || 20, // Maximum number of clients in the pool
            min: config.min || 2, // Minimum number of clients in the pool
            idleTimeoutMillis: config.idleTimeoutMillis || 30000, // Close idle clients after 30 seconds
            connectionTimeoutMillis: config.connectionTimeoutMillis || 10000, // Timeout for new connections
            // Connection settings
            statement_timeout: config.statement_timeout || 30000, // 30 second statement timeout
            query_timeout: config.query_timeout || 30000, // 30 second query timeout
            // SSL settings - preserve the exact SSL configuration passed in
            ssl: config.ssl,
            // Application name for monitoring - include pool key for better identification
            application_name: config.application_name || `supabase-studio-${poolKey}`
        };
        const pool = new pg_1.Pool(poolConfig);
        // Handle pool errors
        pool.on('error', (err) => {
            console.error(`Database pool error for ${poolKey}:`, err);
        });
        // Handle client connections
        pool.on('connect', (client) => {
            console.log(`New client connected to pool ${poolKey}`);
        });
        // Handle client removal
        pool.on('remove', (client) => {
            console.log(`Client removed from pool ${poolKey}`);
        });
        // Store pool and config
        this.pools.set(poolKey, pool);
        this.poolConfigs.set(poolKey, poolConfig);
        console.log(`Created new database pool: ${poolKey} (host: ${poolConfig.host}, database: ${poolConfig.database})`);
        return pool;
    }
    /**
     * Get a client from the pool
     */
    async getClient(poolKey, config) {
        const pool = this.getPool(poolKey, config);
        return await pool.connect();
    }
    /**
     * Execute a query using a pool
     */
    async query(poolKey, config, text, params) {
        const pool = this.getPool(poolKey, config);
        return await pool.query(text, params);
    }
    /**
     * Execute a transaction using a pool
     */
    async transaction(poolKey, config, callback) {
        const client = await this.getClient(poolKey, config);
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Compare two pool configurations to see if they match
     */
    configsMatch(config1, config2) {
        const keys = ['host', 'port', 'database', 'user', 'password'];
        for (const key of keys) {
            if (config1[key] !== config2[key]) {
                return false;
            }
        }
        // Compare SSL configuration
        if (JSON.stringify(config1.ssl) !== JSON.stringify(config2.ssl)) {
            return false;
        }
        return true;
    }
    /**
     * Get detailed pool information for debugging
     */
    getPoolInfo(poolKey) {
        const pool = this.pools.get(poolKey);
        const config = this.poolConfigs.get(poolKey);
        if (!pool || !config) {
            return null;
        }
        return {
            poolKey,
            exists: true,
            stats: {
                totalCount: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount
            },
            config: {
                host: config.host,
                port: config.port,
                database: config.database,
                user: config.user,
                max: config.max,
                min: config.min,
                sslEnabled: !!config.ssl,
                applicationName: config.application_name
            }
        };
    }
    /**
     * Close a specific pool
     */
    async closePool(poolKey) {
        const pool = this.pools.get(poolKey);
        if (pool) {
            await pool.end();
            this.pools.delete(poolKey);
            this.poolConfigs.delete(poolKey);
            console.log(`Closed database pool: ${poolKey}`);
        }
    }
    /**
     * Close all pools
     */
    async closeAllPools() {
        const closePromises = Array.from(this.pools.entries()).map(async ([key, pool]) => {
            try {
                await pool.end();
                console.log(`Closed database pool: ${key}`);
            }
            catch (error) {
                console.error(`Error closing pool ${key}:`, error);
            }
        });
        await Promise.all(closePromises);
        this.pools.clear();
        this.poolConfigs.clear();
    }
    /**
     * Get pool statistics
     */
    getPoolStats(poolKey) {
        const pool = this.pools.get(poolKey);
        if (!pool)
            return null;
        return {
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount
        };
    }
    /**
     * Get all pool statistics
     */
    getAllPoolStats() {
        const stats = new Map();
        for (const [key, pool] of this.pools) {
            stats.set(key, {
                totalCount: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount
            });
        }
        return stats;
    }
    /**
     * Health check for all pools
     */
    async healthCheck() {
        const healthStatus = new Map();
        for (const [key, pool] of this.pools) {
            try {
                await pool.query('SELECT 1');
                healthStatus.set(key, true);
            }
            catch (error) {
                console.error(`Health check failed for pool ${key}:`, error);
                healthStatus.set(key, false);
            }
        }
        return healthStatus;
    }
}
exports.DatabasePoolManager = DatabasePoolManager;
/**
 * Factory function to get the database pool manager
 */
function getDatabasePoolManager() {
    return DatabasePoolManager.getInstance();
}
