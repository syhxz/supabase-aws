/**
 * Unified pooling configuration queries and mutations
 * 
 * This module provides environment-aware pooling configuration management
 * that automatically detects whether to use PgBouncer (platform) or 
 * Supavisor (self-hosted) based on the IS_PLATFORM environment variable.
 * 
 * Features:
 * - Automatic environment detection
 * - Unified interface for both pooling services
 * - Fallback logic when services are unavailable
 * - Consistent caching and error handling
 * - Type-safe transformations between service formats
 */

// Configuration queries
export {
  usePoolingConfigurationQuery,
  getPoolingConfiguration,
  detectPoolingService,
  type PoolingConfigurationVariables,
  type PoolingConfigurationData,
  type PoolingConfigurationError,
  type UnifiedPoolingConfig,
  type PoolingService,
} from './pooling-configuration-query'

// Statistics queries
export {
  usePoolingStatisticsQuery,
  getPoolingStatistics,
  type PoolingStatisticsVariables,
  type PoolingStatisticsData,
  type PoolingStatisticsError,
  type UnifiedPoolingStats,
} from './pooling-statistics-query'

// Health queries
export {
  usePoolingHealthQuery,
  getPoolingHealth,
  type PoolingHealthVariables,
  type PoolingHealthData,
  type PoolingHealthError,
  type UnifiedPoolingHealth,
} from './pooling-health-query'

// Update mutations
export {
  usePoolingConfigurationUpdateMutation,
  updatePoolingConfiguration,
  type UnifiedPoolingConfigurationUpdate,
  type PoolingConfigurationUpdateData,
  type PoolingConfigurationUpdateError,
} from './pooling-configuration-update-mutation'

// Service detection queries
export {
  usePoolingServiceDetectionQuery,
  getPoolingServiceDetection,
  type PoolingServiceDetectionVariables,
  type PoolingServiceDetectionData,
  type PoolingServiceDetectionError,
} from './pooling-service-detection-query'

// Import the hooks for the convenience function
import { usePoolingConfigurationQuery } from './pooling-configuration-query'
import { usePoolingStatisticsQuery } from './pooling-statistics-query'
import { usePoolingHealthQuery } from './pooling-health-query'
import { usePoolingServiceDetectionQuery } from './pooling-service-detection-query'

/**
 * Convenience hook that provides all pooling-related queries in one place
 */
export function useUnifiedPoolingQueries(projectRef?: string) {
  const configuration = usePoolingConfigurationQuery({ projectRef })
  const statistics = usePoolingStatisticsQuery({ projectRef })
  const health = usePoolingHealthQuery({ projectRef })
  const detection = usePoolingServiceDetectionQuery({ projectRef })
  
  return {
    configuration,
    statistics,
    health,
    detection,
    isLoading: configuration.isLoading || statistics.isLoading || health.isLoading || detection.isLoading,
    isError: configuration.isError || statistics.isError || health.isError || detection.isError,
    error: configuration.error || statistics.error || health.error || detection.error,
  }
}