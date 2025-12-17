/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import {
  validateDatabaseName,
  isValidDatabaseName,
  sanitizeDatabaseName,
  generateDatabaseName,
  DatabaseNamingError,
  DATABASE_NAMING_RULES,
} from './database-naming'

describe('validateDatabaseName', () => {
  it('should accept valid database names', () => {
    expect(() => validateDatabaseName('mydb')).not.toThrow()
    expect(() => validateDatabaseName('my_database')).not.toThrow()
    expect(() => validateDatabaseName('db123')).not.toThrow()
    expect(() => validateDatabaseName('my_db_123')).not.toThrow()
  })

  it('should reject empty names', () => {
    expect(() => validateDatabaseName('')).toThrow(DatabaseNamingError)
    expect(() => validateDatabaseName('   ')).toThrow(DatabaseNamingError)
  })

  it('should reject names exceeding max length', () => {
    const longName = 'a'.repeat(64)
    expect(() => validateDatabaseName(longName)).toThrow(DatabaseNamingError)
    expect(() => validateDatabaseName(longName)).toThrow(/cannot exceed 63 characters/)
  })

  it('should reject names with invalid characters', () => {
    expect(() => validateDatabaseName('my-database')).toThrow(DatabaseNamingError)
    expect(() => validateDatabaseName('my database')).toThrow(DatabaseNamingError)
    expect(() => validateDatabaseName('my.database')).toThrow(DatabaseNamingError)
    expect(() => validateDatabaseName('MyDatabase')).toThrow(DatabaseNamingError)
  })

  it('should reject names starting with numbers', () => {
    expect(() => validateDatabaseName('123db')).toThrow(DatabaseNamingError)
  })

  it('should reject reserved names', () => {
    expect(() => validateDatabaseName('postgres')).toThrow(DatabaseNamingError)
    expect(() => validateDatabaseName('template0')).toThrow(DatabaseNamingError)
    expect(() => validateDatabaseName('template1')).toThrow(DatabaseNamingError)
    expect(() => validateDatabaseName('supabase')).toThrow(DatabaseNamingError)
    expect(() => validateDatabaseName('auth')).toThrow(DatabaseNamingError)
    expect(() => validateDatabaseName('storage')).toThrow(DatabaseNamingError)
    expect(() => validateDatabaseName('realtime')).toThrow(DatabaseNamingError)
  })
})

describe('isValidDatabaseName', () => {
  it('should return true for valid names', () => {
    expect(isValidDatabaseName('mydb')).toBe(true)
    expect(isValidDatabaseName('my_database')).toBe(true)
    expect(isValidDatabaseName('db123')).toBe(true)
  })

  it('should return false for invalid names', () => {
    expect(isValidDatabaseName('')).toBe(false)
    expect(isValidDatabaseName('my-database')).toBe(false)
    expect(isValidDatabaseName('postgres')).toBe(false)
    expect(isValidDatabaseName('123db')).toBe(false)
  })
})

describe('sanitizeDatabaseName', () => {
  it('should convert to lowercase', () => {
    expect(sanitizeDatabaseName('MyDatabase')).toBe('mydatabase')
    expect(sanitizeDatabaseName('MY_DATABASE')).toBe('my_database')
  })

  it('should replace special characters with underscores', () => {
    expect(sanitizeDatabaseName('my-database')).toBe('my_database')
    expect(sanitizeDatabaseName('my database')).toBe('my_database')
    expect(sanitizeDatabaseName('my.database')).toBe('my_database')
    expect(sanitizeDatabaseName('my@database#test')).toBe('my_database_test')
  })

  it('should remove leading and trailing underscores', () => {
    expect(sanitizeDatabaseName('_mydb_')).toBe('mydb')
    expect(sanitizeDatabaseName('___mydb___')).toBe('mydb')
  })

  it('should replace multiple underscores with single', () => {
    expect(sanitizeDatabaseName('my___database')).toBe('my_database')
    expect(sanitizeDatabaseName('my__db__test')).toBe('my_db_test')
  })

  it('should prefix with db_ if starts with number', () => {
    expect(sanitizeDatabaseName('123database')).toBe('db_123database')
    expect(sanitizeDatabaseName('9test')).toBe('db_9test')
  })

  it('should handle complex inputs', () => {
    expect(sanitizeDatabaseName('My Project #1!')).toBe('my_project_1')
    expect(sanitizeDatabaseName('Test-DB (2024)')).toBe('test_db_2024')
  })
})

describe('generateDatabaseName', () => {
  it('should generate valid database names', () => {
    const name = generateDatabaseName('My Project')
    expect(isValidDatabaseName(name)).toBe(true)
  })

  it('should include sanitized project name', () => {
    const name = generateDatabaseName('test project')
    expect(name).toContain('test_project')
  })

  it('should include random suffix for uniqueness', () => {
    const name1 = generateDatabaseName('test')
    const name2 = generateDatabaseName('test')
    // Names should be different due to random suffix
    expect(name1).not.toBe(name2)
    // Both should follow the new format: db_test_xxxx
    expect(name1).toMatch(/^db_test_[a-z0-9]{4}$/)
    expect(name2).toMatch(/^db_test_[a-z0-9]{4}$/)
  })

  it('should not exceed max length', () => {
    const longName = 'a'.repeat(100)
    const generated = generateDatabaseName(longName)
    expect(generated.length).toBeLessThanOrEqual(DATABASE_NAMING_RULES.maxLength)
  })

  it('should handle empty input', () => {
    const name = generateDatabaseName('')
    expect(name).toMatch(/^db_proj_[a-z0-9]+$/)
    expect(isValidDatabaseName(name)).toBe(true)
  })

  it('should handle special characters', () => {
    const name = generateDatabaseName('My-Project@2024!')
    expect(isValidDatabaseName(name)).toBe(true)
    expect(name).toContain('my_project_2024')
  })
})
