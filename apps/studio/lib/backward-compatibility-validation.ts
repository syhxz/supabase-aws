/**
 * Backward Compatibility Validation Utilities
 * 
 * Provides validation and migration logic for handling both old and new data formats
 * to ensure the application continues to work when API response structures change.
 * 
 * This module implements validation that handles data structure changes gracefully,
 * maintaining backward compatibility through proper validation and migration logic.
 */

import { isArray, ensureArray, ValidationResult } from './array-validation'

/**
 * Interface for data format migration
 */
export interface DataMigration<T> {
  version: string
  migrate: (data: any) => T
  validate: (data: any) => boolean
}

/**
 * Interface for backward compatibility validation result
 */
export interface CompatibilityValidationResult<T> extends ValidationResult<T> {
  version: string
  migrated: boolean
  originalFormat?: string
}

/**
 * Legacy project addons data format (pre-validation)
 * This represents the old format that might not have proper array structure
 */
export interface LegacyProjectAddonsData {
  selected_addons?: any // Could be null, undefined, object, or array
  available_addons?: any // Could be null, undefined, object, or array
  ref?: string
  // Legacy fields that might exist
  addons?: any
  subscription?: any
}

/**
 * Modern project addons data format (post-validation)
 */
export interface ModernProjectAddonsData {
  selected_addons: Array<{
    type: string
    variant: {
      identifier: string
      name: string
    }
  }>
  available_addons: Array<any>
  ref: string
}

/**
 * Validates and migrates legacy project addons data to modern format
 */
export function validateProjectAddonsCompatibility(
  data: any
): CompatibilityValidationResult<ModernProjectAddonsData> {
  if (data === null || data === undefined || typeof data !== 'object') {
    console.warn('[Backward Compatibility] Invalid data: expected object, received:', typeof data)
    return {
      isValid: false,
      data: {
        selected_addons: [],
        available_addons: [],
        ref: ''
      },
      error: `Expected object but received ${typeof data}`,
      version: 'unknown',
      migrated: false
    }
  }

  // Detect data format version
  const version = detectProjectAddonsVersion(data)
  let migrated = false
  let migratedData = data

  // Apply migration if needed
  if (version === 'legacy-v1' || version === 'legacy-v2') {
    migratedData = migrateProjectAddonsData(data, version)
    migrated = true
  }

  // Validate the final structure
  const validation = validateModernProjectAddonsStructure(migratedData)

  return {
    ...validation,
    version,
    migrated,
    originalFormat: version !== 'modern' ? version : undefined
  }
}

/**
 * Detects the version/format of project addons data
 */
function detectProjectAddonsVersion(data: any): string {
  // Modern format: has selected_addons as array and proper structure
  if (isArray(data.selected_addons) && isArray(data.available_addons)) {
    return 'modern'
  }

  // Legacy v2: has selected_addons but not as array, or missing available_addons
  if (data.selected_addons !== undefined || data.available_addons !== undefined) {
    return 'legacy-v2'
  }

  // Legacy v1: uses old field names like 'addons' or 'subscription'
  if (data.addons !== undefined || data.subscription !== undefined) {
    return 'legacy-v1'
  }

  // Empty object or unknown format - treat as legacy that needs migration
  return 'legacy-v2'
}

/**
 * Migrates project addons data from legacy formats to modern format
 */
function migrateProjectAddonsData(data: any, version: string): any {
  console.log(`[Backward Compatibility] Migrating project addons data from ${version} to modern format`)

  switch (version) {
    case 'legacy-v1':
      return migrateLegacyV1ProjectAddons(data)
    case 'legacy-v2':
      return migrateLegacyV2ProjectAddons(data)
    default:
      console.warn('[Backward Compatibility] Unknown version for migration:', version)
      return data
  }
}

/**
 * Migrates from legacy v1 format (using 'addons' or 'subscription' fields)
 */
function migrateLegacyV1ProjectAddons(data: any): any {
  console.log('[Backward Compatibility] Migrating from legacy v1 format')

  const migratedData: any = {
    ref: data.ref || data.project_ref || ''
  }

  // Handle legacy 'addons' field
  if (data.addons !== undefined) {
    if (isArray(data.addons)) {
      migratedData.selected_addons = data.addons
    } else if (data.addons && typeof data.addons === 'object') {
      // Convert object to array format
      migratedData.selected_addons = Object.values(data.addons).filter(Boolean)
    } else {
      migratedData.selected_addons = []
    }
  }

  // Handle legacy 'subscription' field
  if (data.subscription && data.subscription.addons) {
    if (isArray(data.subscription.addons)) {
      migratedData.selected_addons = data.subscription.addons
    } else {
      migratedData.selected_addons = []
    }
  }

  // Set default values if not migrated
  if (!migratedData.selected_addons) {
    migratedData.selected_addons = []
  }
  migratedData.available_addons = data.available_addons || []

  return migratedData
}

/**
 * Migrates from legacy v2 format (has selected_addons but wrong type)
 */
function migrateLegacyV2ProjectAddons(data: any): any {
  console.log('[Backward Compatibility] Migrating from legacy v2 format')

  const migratedData: any = {
    ref: data.ref || ''
  }

  // Handle selected_addons that might not be an array
  if (data.selected_addons !== undefined) {
    if (isArray(data.selected_addons)) {
      migratedData.selected_addons = data.selected_addons
    } else if (data.selected_addons && typeof data.selected_addons === 'object') {
      // Convert object to array
      migratedData.selected_addons = Object.values(data.selected_addons).filter(Boolean)
    } else if (data.selected_addons === null) {
      migratedData.selected_addons = []
    } else {
      console.warn('[Backward Compatibility] Unexpected selected_addons format:', typeof data.selected_addons)
      migratedData.selected_addons = []
    }
  } else {
    migratedData.selected_addons = []
  }

  // Handle available_addons
  if (data.available_addons !== undefined) {
    migratedData.available_addons = ensureArray(data.available_addons)
  } else {
    migratedData.available_addons = []
  }

  return migratedData
}

/**
 * Validates the modern project addons data structure
 */
function validateModernProjectAddonsStructure(
  data: any
): ValidationResult<ModernProjectAddonsData> {
  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      data: {
        selected_addons: [],
        available_addons: [],
        ref: ''
      },
      error: 'Data is not an object'
    }
  }

  // Validate selected_addons
  if (!isArray(data.selected_addons)) {
    return {
      isValid: false,
      data: {
        selected_addons: [],
        available_addons: ensureArray(data.available_addons),
        ref: data.ref || ''
      },
      error: 'selected_addons is not an array'
    }
  }

  // Validate available_addons
  if (!isArray(data.available_addons)) {
    return {
      isValid: false,
      data: {
        selected_addons: data.selected_addons,
        available_addons: [],
        ref: data.ref || ''
      },
      error: 'available_addons is not an array'
    }
  }

  // Validate individual addon objects in selected_addons
  const validatedSelectedAddons = data.selected_addons.filter((addon: any, index: number) => {
    if (!addon || typeof addon !== 'object') {
      console.warn(`[Backward Compatibility] Invalid addon object at index ${index}:`, addon)
      return false
    }

    if (!addon.type || typeof addon.type !== 'string') {
      console.warn(`[Backward Compatibility] Addon at index ${index} missing valid type:`, addon)
      return false
    }

    if (!addon.variant || typeof addon.variant !== 'object') {
      console.warn(`[Backward Compatibility] Addon at index ${index} missing valid variant:`, addon)
      return false
    }

    return true
  })

  return {
    isValid: true,
    data: {
      selected_addons: validatedSelectedAddons,
      available_addons: data.available_addons,
      ref: data.ref || ''
    }
  }
}

/**
 * Generic backward compatibility validator for any data structure
 */
export class BackwardCompatibilityValidator<T> {
  private migrations: Map<string, DataMigration<T>> = new Map()

  /**
   * Register a migration for a specific version
   */
  registerMigration(migration: DataMigration<T>): void {
    this.migrations.set(migration.version, migration)
  }

  /**
   * Validate and migrate data to the latest format
   */
  validateAndMigrate(data: any): CompatibilityValidationResult<T> {
    if (!data) {
      return {
        isValid: false,
        data: {} as T,
        error: 'No data provided',
        version: 'unknown',
        migrated: false
      }
    }

    // Try to find a matching migration
    for (const [version, migration] of this.migrations) {
      if (migration.validate(data)) {
        console.log(`[Backward Compatibility] Applying migration for version: ${version}`)
        
        try {
          const migratedData = migration.migrate(data)
          return {
            isValid: true,
            data: migratedData,
            version,
            migrated: true
          }
        } catch (error) {
          console.error(`[Backward Compatibility] Migration failed for version ${version}:`, error)
          return {
            isValid: false,
            data: {} as T,
            error: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            version,
            migrated: false
          }
        }
      }
    }

    // No migration needed, assume modern format
    return {
      isValid: true,
      data: data as T,
      version: 'modern',
      migrated: false
    }
  }
}

/**
 * Test various API response formats to ensure compatibility
 */
export function testApiResponseFormats(): void {
  console.log('[Backward Compatibility] Testing various API response formats...')

  const testCases = [
    // Modern format
    {
      name: 'Modern format',
      data: {
        selected_addons: [
          { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } }
        ],
        available_addons: [],
        ref: 'test-project'
      }
    },
    // Legacy v2 format (null selected_addons)
    {
      name: 'Legacy v2 - null selected_addons',
      data: {
        selected_addons: null,
        available_addons: [],
        ref: 'test-project'
      }
    },
    // Legacy v2 format (object selected_addons)
    {
      name: 'Legacy v2 - object selected_addons',
      data: {
        selected_addons: {
          ipv4: { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } }
        },
        available_addons: [],
        ref: 'test-project'
      }
    },
    // Legacy v1 format (using 'addons' field)
    {
      name: 'Legacy v1 - addons field',
      data: {
        addons: [
          { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } }
        ],
        ref: 'test-project'
      }
    },
    // Legacy v1 format (using 'subscription' field)
    {
      name: 'Legacy v1 - subscription field',
      data: {
        subscription: {
          addons: [
            { type: 'compute_instance', variant: { identifier: 'ci_micro', name: 'Micro' } }
          ]
        },
        ref: 'test-project'
      }
    },
    // Invalid format
    {
      name: 'Invalid format',
      data: null
    },
    // Empty object
    {
      name: 'Empty object',
      data: {}
    }
  ]

  testCases.forEach(testCase => {
    console.log(`\nTesting: ${testCase.name}`)
    const result = validateProjectAddonsCompatibility(testCase.data)
    console.log('Result:', {
      isValid: result.isValid,
      version: result.version,
      migrated: result.migrated,
      selectedAddonsLength: result.data.selected_addons.length,
      error: result.error
    })
  })

  console.log('[Backward Compatibility] Testing completed')
}

/**
 * Utility to log compatibility validation results for debugging
 */
export function logCompatibilityValidation<T>(
  result: CompatibilityValidationResult<T>,
  context: string
): void {
  const logLevel = result.isValid ? 'log' : 'warn'
  
  console[logLevel](`[Backward Compatibility] ${context}:`, {
    isValid: result.isValid,
    version: result.version,
    migrated: result.migrated,
    originalFormat: result.originalFormat,
    error: result.error
  })

  if (result.migrated) {
    console.log(`[Backward Compatibility] Successfully migrated ${context} from ${result.originalFormat} to modern format`)
  }
}