/**
 * Tests for backward compatibility validation utilities
 * 
 * These tests verify that the validation handles both old and new data formats
 * correctly, ensuring the application continues to work when API response
 * structures change.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  validateProjectAddonsCompatibility,
  BackwardCompatibilityValidator,
  testApiResponseFormats,
  logCompatibilityValidation,
  type DataMigration,
  type CompatibilityValidationResult
} from '../backward-compatibility-validation'

describe('validateProjectAddonsCompatibility', () => {
  beforeEach(() => {
    // Clear console warnings/logs for clean test output
    vi.clearAllMocks()
  })

  it('should handle modern format correctly', () => {
    const modernData = {
      selected_addons: [
        { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } },
        { type: 'compute_instance', variant: { identifier: 'ci_micro', name: 'Micro' } }
      ],
      available_addons: [
        { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } }
      ],
      ref: 'test-project'
    }

    const result = validateProjectAddonsCompatibility(modernData)

    expect(result.isValid).toBe(true)
    expect(result.version).toBe('modern')
    expect(result.migrated).toBe(false)
    expect(result.data.selected_addons).toHaveLength(2)
    expect(result.data.available_addons).toHaveLength(1)
    expect(result.data.ref).toBe('test-project')
  })

  it('should migrate legacy v2 format with null selected_addons', () => {
    const legacyData = {
      selected_addons: null,
      available_addons: [],
      ref: 'test-project'
    }

    const result = validateProjectAddonsCompatibility(legacyData)

    expect(result.isValid).toBe(true)
    expect(result.version).toBe('legacy-v2')
    expect(result.migrated).toBe(true)
    expect(result.originalFormat).toBe('legacy-v2')
    expect(result.data.selected_addons).toEqual([])
    expect(result.data.available_addons).toEqual([])
    expect(result.data.ref).toBe('test-project')
  })

  it('should migrate legacy v2 format with object selected_addons', () => {
    const legacyData = {
      selected_addons: {
        ipv4: { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } },
        compute: { type: 'compute_instance', variant: { identifier: 'ci_micro', name: 'Micro' } }
      },
      available_addons: [],
      ref: 'test-project'
    }

    const result = validateProjectAddonsCompatibility(legacyData)

    expect(result.isValid).toBe(true)
    expect(result.version).toBe('legacy-v2')
    expect(result.migrated).toBe(true)
    expect(result.data.selected_addons).toHaveLength(2)
    expect(result.data.selected_addons[0].type).toBe('ipv4')
    expect(result.data.selected_addons[1].type).toBe('compute_instance')
  })

  it('should migrate legacy v1 format with addons field', () => {
    const legacyData = {
      addons: [
        { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } }
      ],
      ref: 'test-project'
    }

    const result = validateProjectAddonsCompatibility(legacyData)

    expect(result.isValid).toBe(true)
    expect(result.version).toBe('legacy-v1')
    expect(result.migrated).toBe(true)
    expect(result.data.selected_addons).toHaveLength(1)
    expect(result.data.selected_addons[0].type).toBe('ipv4')
    expect(result.data.available_addons).toEqual([])
  })

  it('should migrate legacy v1 format with subscription field', () => {
    const legacyData = {
      subscription: {
        addons: [
          { type: 'compute_instance', variant: { identifier: 'ci_micro', name: 'Micro' } }
        ]
      },
      project_ref: 'test-project'
    }

    const result = validateProjectAddonsCompatibility(legacyData)

    expect(result.isValid).toBe(true)
    expect(result.version).toBe('legacy-v1')
    expect(result.migrated).toBe(true)
    expect(result.data.selected_addons).toHaveLength(1)
    expect(result.data.selected_addons[0].type).toBe('compute_instance')
    expect(result.data.ref).toBe('test-project')
  })

  it('should handle invalid data gracefully', () => {
    const invalidData = null

    const result = validateProjectAddonsCompatibility(invalidData)

    expect(result.isValid).toBe(false)
    expect(result.version).toBe('unknown')
    expect(result.migrated).toBe(false)
    expect(result.data.selected_addons).toEqual([])
    expect(result.data.available_addons).toEqual([])
    expect(result.error).toContain('Expected object')
  })

  it('should handle empty object', () => {
    const emptyData = {}

    const result = validateProjectAddonsCompatibility(emptyData)

    expect(result.isValid).toBe(true)
    expect(result.version).toBe('legacy-v2')
    expect(result.migrated).toBe(true)
    expect(result.data.selected_addons).toEqual([])
    expect(result.data.available_addons).toEqual([])
    expect(result.data.ref).toBe('')
  })

  it('should filter out invalid addon objects', () => {
    const dataWithInvalidAddons = {
      selected_addons: [
        { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } }, // Valid
        { type: 'invalid' }, // Invalid - missing variant
        null, // Invalid - null
        { variant: { identifier: 'test', name: 'Test' } }, // Invalid - missing type
        { type: 'compute_instance', variant: { identifier: 'ci_micro', name: 'Micro' } } // Valid
      ],
      available_addons: [],
      ref: 'test-project'
    }

    const result = validateProjectAddonsCompatibility(dataWithInvalidAddons)

    expect(result.isValid).toBe(true)
    expect(result.data.selected_addons).toHaveLength(2) // Only valid addons
    expect(result.data.selected_addons[0].type).toBe('ipv4')
    expect(result.data.selected_addons[1].type).toBe('compute_instance')
  })

  it('should handle legacy v1 format with object addons field', () => {
    const legacyData = {
      addons: {
        ipv4: { type: 'ipv4', variant: { identifier: 'ipv4', name: 'IPv4' } },
        compute: { type: 'compute_instance', variant: { identifier: 'ci_micro', name: 'Micro' } }
      },
      ref: 'test-project'
    }

    const result = validateProjectAddonsCompatibility(legacyData)

    expect(result.isValid).toBe(true)
    expect(result.version).toBe('legacy-v1')
    expect(result.migrated).toBe(true)
    expect(result.data.selected_addons).toHaveLength(2)
  })
})

describe('BackwardCompatibilityValidator', () => {
  interface TestData {
    id: string
    name: string
    items: string[]
  }

  let validator: BackwardCompatibilityValidator<TestData>

  beforeEach(() => {
    validator = new BackwardCompatibilityValidator<TestData>()
  })

  it('should register and apply migrations', () => {
    const migration: DataMigration<TestData> = {
      version: 'v1',
      validate: (data: any) => data && data.legacy_field !== undefined,
      migrate: (data: any) => ({
        id: data.legacy_field,
        name: data.title || 'Unknown',
        items: data.list || []
      })
    }

    validator.registerMigration(migration)

    const legacyData = {
      legacy_field: 'test-id',
      title: 'Test Title',
      list: ['item1', 'item2']
    }

    const result = validator.validateAndMigrate(legacyData)

    expect(result.isValid).toBe(true)
    expect(result.version).toBe('v1')
    expect(result.migrated).toBe(true)
    expect(result.data.id).toBe('test-id')
    expect(result.data.name).toBe('Test Title')
    expect(result.data.items).toEqual(['item1', 'item2'])
  })

  it('should handle modern format without migration', () => {
    const modernData: TestData = {
      id: 'modern-id',
      name: 'Modern Name',
      items: ['modern1', 'modern2']
    }

    const result = validator.validateAndMigrate(modernData)

    expect(result.isValid).toBe(true)
    expect(result.version).toBe('modern')
    expect(result.migrated).toBe(false)
    expect(result.data).toEqual(modernData)
  })

  it('should handle migration errors gracefully', () => {
    const faultyMigration: DataMigration<TestData> = {
      version: 'faulty',
      validate: (data: any) => data && data.faulty_field !== undefined,
      migrate: (data: any) => {
        throw new Error('Migration failed')
      }
    }

    validator.registerMigration(faultyMigration)

    const faultyData = {
      faulty_field: 'test'
    }

    const result = validator.validateAndMigrate(faultyData)

    expect(result.isValid).toBe(false)
    expect(result.version).toBe('faulty')
    expect(result.migrated).toBe(false)
    expect(result.error).toContain('Migration failed')
  })

  it('should handle null data', () => {
    const result = validator.validateAndMigrate(null)

    expect(result.isValid).toBe(false)
    expect(result.version).toBe('unknown')
    expect(result.migrated).toBe(false)
    expect(result.error).toBe('No data provided')
  })
})

describe('testApiResponseFormats', () => {
  it('should run without errors', () => {
    // Mock console.log to avoid test output noise
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    expect(() => testApiResponseFormats()).not.toThrow()

    consoleSpy.mockRestore()
  })
})

describe('logCompatibilityValidation', () => {
  it('should log successful validation', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const result: CompatibilityValidationResult<any> = {
      isValid: true,
      data: { test: 'data' },
      version: 'modern',
      migrated: false
    }

    logCompatibilityValidation(result, 'Test Context')

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Backward Compatibility] Test Context:',
      expect.objectContaining({
        isValid: true,
        version: 'modern',
        migrated: false
      })
    )

    consoleSpy.mockRestore()
  })

  it('should log failed validation with warning', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result: CompatibilityValidationResult<any> = {
      isValid: false,
      data: {},
      version: 'unknown',
      migrated: false,
      error: 'Test error'
    }

    logCompatibilityValidation(result, 'Test Context')

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Backward Compatibility] Test Context:',
      expect.objectContaining({
        isValid: false,
        version: 'unknown',
        migrated: false,
        error: 'Test error'
      })
    )

    consoleSpy.mockRestore()
  })

  it('should log migration success', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const result: CompatibilityValidationResult<any> = {
      isValid: true,
      data: { test: 'data' },
      version: 'legacy-v1',
      migrated: true,
      originalFormat: 'legacy-v1'
    }

    logCompatibilityValidation(result, 'Test Context')

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Backward Compatibility] Successfully migrated Test Context from legacy-v1 to modern format'
    )

    consoleSpy.mockRestore()
  })
})