/**
 * Service Router - Project-level service isolation
 * 
 * This module provides the infrastructure for routing service requests
 * to the correct project database, ensuring complete isolation between projects.
 */

export {
  ServiceRouter,
  getServiceRouter,
  resetServiceRouter,
} from './ServiceRouter'

export {
  ConnectionPoolManager,
  getConnectionPoolManager,
  resetConnectionPoolManager,
  type ProjectPoolConfig,
  type PoolStats,
} from './ConnectionPoolManager'

export {
  ProjectConfigStorage,
  getProjectConfigStorage,
  resetProjectConfigStorage,
  type ProjectConfig,
} from './ProjectConfigStorage'

export {
  AccessValidator,
  getAccessValidator,
  resetAccessValidator,
  withProjectAccess,
  type AccessValidationResult,
} from './AccessValidation'
