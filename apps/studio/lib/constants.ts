/**
 * Studio application constants
 */

// Re-export from common package
export { IS_PLATFORM } from 'common'

// Re-export from constants/index (correct path)
export { 
  DOCS_URL, 
  PROJECT_STATUS,
  DATE_FORMAT,
  DATETIME_FORMAT,
  GOTRUE_ERRORS,
  STRIPE_PUBLIC_KEY,
  POSTHOG_URL,
  USAGE_APPROACHING_THRESHOLD,
  OPT_IN_TAGS,
  GB,
  MB,
  KB,
  PROVIDERS,
  useDefaultProvider,
  MANAGED_BY,
  PRICING_TIER_LABELS_ORG,
  PRICING_TIER_PRODUCT_IDS,
  PASSWORD_STRENGTH,
  PASSWORD_STRENGTH_COLOR,
  PASSWORD_STRENGTH_PERCENTAGE,
  DEFAULT_MINIMUM_PASSWORD_STRENGTH,
  DEFAULT_PROJECT_API_SERVICE_ID,
  INSTANCE_NANO_SPECS,
  INSTANCE_MICRO_SPECS,
  PG_META_URL,
  AWS_REGIONS_DEFAULT,
  FLY_REGIONS_DEFAULT
} from './constants/index'

// Studio-specific constants
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

// Environment detection
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'
export const IS_PRODUCTION = process.env.NODE_ENV === 'production'
export const IS_TEST = process.env.NODE_ENV === 'test'