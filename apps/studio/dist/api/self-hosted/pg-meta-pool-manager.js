"use strict";
/**
 * PostgreSQL Connection Pool Manager for Multi-Database Support
 *
 * Manages connection pools for multiple databases, allowing dynamic switching
 * between databases without restarting the service.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.closePool = closePool;
exports.closeAllPools = closeAllPools;
exports.getPoolStats = getPoolStats;
exports.cleanupIdlePools = cleanupIdlePools;
const pg_1 = require("pg");
const constants_1 = require("./constants");
// Connection pool cache
const connectionPools = new Map();
// Configuration (can be overridden via environment variables)
const MAX_POOLS = parseInt(process.env.MAX_CONNECTION_POOLS || '100');
const MAX_CONNECTIONS_PER_POOL = parseInt(process.env.MAX_CONNECTIONS_PER_POOL || '10');
const IDLE_TIMEOUT_MS = parseInt(process.env.POOL_IDLE_TIMEOUT_MS || '30000');
const CONNECTION_TIMEOUT_MS = parseInt(process.env.POOL_CONNECTION_TIMEOUT_MS || '2000');
// Track pool usage for better management
const poolLastUsed = new Map();
/**
 * Get or create a connection pool for the specified database
 */
async function getPool({ databaseName, readOnly = false }) {
    const user = readOnly ? constants_1.POSTGRES_USER_READ_ONLY : constants_1.POSTGRES_USER_READ_WRITE;
    const key = `${databaseName}:${user}`;
    if (!connectionPools.has(key)) {
        // Check pool limit
        if (connectionPools.size >= MAX_POOLS) {
            // Remove least recently used pool (LRU strategy)
            let oldestKey = null;
            let oldestTime = new Date();
            for (const [poolKey, lastUsed] of poolLastUsed.entries()) {
                if (lastUsed < oldestTime) {
                    oldestTime = lastUsed;
                    oldestKey = poolKey;
                }
            }
            if (oldestKey) {
                const oldPool = connectionPools.get(oldestKey);
                if (oldPool) {
                    await oldPool.end().catch(console.error);
                    connectionPools.delete(oldestKey);
                    poolLastUsed.delete(oldestKey);
                    console.log(`[Pool Manager] Closed LRU connection pool: ${oldestKey} (last used: ${oldestTime.toISOString()})`);
                }
            }
        }
        // Studio runs inside Docker, so use Docker internal network addresses
        // Use the configured host and port directly from environment variables
        let host = constants_1.POSTGRES_HOST || 'db';
        let portStr = String(constants_1.POSTGRES_PORT || '5432');
        // Use the same port as configured in environment (5432 in this case)
        // No need to convert port since it's already the exposed port
        const port = parseInt(portStr);
        // Create new pool with configurable settings
        const pool = new pg_1.Pool({
            host,
            port,
            database: databaseName,
            user,
            password: constants_1.POSTGRES_PASSWORD,
            max: MAX_CONNECTIONS_PER_POOL,
            idleTimeoutMillis: IDLE_TIMEOUT_MS,
            connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
        });
        // Error handling
        pool.on('error', (err) => {
            console.error(`[Pool Manager] Pool error for ${key}:`, err);
        });
        connectionPools.set(key, pool);
        poolLastUsed.set(key, new Date());
        console.log(`[Pool Manager] Created new connection pool: ${key} (total: ${connectionPools.size}/${MAX_POOLS})`);
    }
    // Update last used timestamp
    poolLastUsed.set(key, new Date());
    return connectionPools.get(key);
}
/**
 * Close connection pool for specified database
 */
async function closePool(databaseName) {
    const keysToClose = Array.from(connectionPools.keys()).filter(key => key.startsWith(`${databaseName}:`));
    for (const key of keysToClose) {
        const pool = connectionPools.get(key);
        if (pool) {
            await pool.end();
            connectionPools.delete(key);
            console.log(`[Pool Manager] Closed connection pool: ${key}`);
        }
    }
}
/**
 * Close all connection pools
 */
async function closeAllPools() {
    const promises = Array.from(connectionPools.values()).map(pool => pool.end());
    await Promise.all(promises);
    connectionPools.clear();
    console.log('[Pool Manager] Closed all connection pools');
}
/**
 * Get connection pool statistics
 */
function getPoolStats() {
    const stats = Array.from(connectionPools.entries()).map(([key, pool]) => ({
        key,
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
    }));
    return {
        poolCount: connectionPools.size,
        maxPools: MAX_POOLS,
        pools: stats,
    };
}
/**
 * Clean up idle pools (can be called periodically)
 */
async function cleanupIdlePools() {
    let cleaned = 0;
    for (const [key, pool] of connectionPools.entries()) {
        // If all connections are idle, close the pool
        if (pool.idleCount === pool.totalCount && pool.totalCount > 0) {
            await pool.end();
            connectionPools.delete(key);
            cleaned++;
            console.log(`[Pool Manager] Cleaned up idle pool: ${key}`);
        }
    }
    return cleaned;
}
