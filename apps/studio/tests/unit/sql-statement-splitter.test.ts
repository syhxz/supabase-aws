import { describe, it, expect } from 'vitest'

/**
 * Splits a SQL query string into individual statements, respecting PostgreSQL quoting rules.
 */
function splitSQLStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let i = 0
  
  while (i < sql.length) {
    const char = sql[i]
    const nextChar = sql[i + 1]
    
    // Handle dollar-quoted strings ($$...$$ or $tag$...$tag$)
    if (char === '$') {
      const dollarMatch = sql.substring(i).match(/^(\$[a-zA-Z0-9_]*\$)/)
      if (dollarMatch) {
        const dollarTag = dollarMatch[1]
        const endIndex = sql.indexOf(dollarTag, i + dollarTag.length)
        if (endIndex !== -1) {
          // Include the entire dollar-quoted string
          current += sql.substring(i, endIndex + dollarTag.length)
          i = endIndex + dollarTag.length
          continue
        }
      }
    }
    
    // Handle single-quoted strings
    if (char === "'") {
      current += char
      i++
      while (i < sql.length) {
        current += sql[i]
        if (sql[i] === "'") {
          // Check for escaped quote ('')
          if (sql[i + 1] === "'") {
            current += sql[i + 1]
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }
    
    // Handle double-quoted identifiers
    if (char === '"') {
      current += char
      i++
      while (i < sql.length) {
        current += sql[i]
        if (sql[i] === '"') {
          // Check for escaped quote ("")
          if (sql[i + 1] === '"') {
            current += sql[i + 1]
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }
    
    // Handle line comments (--)
    if (char === '-' && nextChar === '-') {
      current += char + nextChar
      i += 2
      while (i < sql.length && sql[i] !== '\n') {
        current += sql[i]
        i++
      }
      if (i < sql.length) {
        current += sql[i] // Include the newline
        i++
      }
      continue
    }
    
    // Handle block comments (/* */)
    if (char === '/' && nextChar === '*') {
      current += char + nextChar
      i += 2
      while (i < sql.length - 1) {
        current += sql[i]
        if (sql[i] === '*' && sql[i + 1] === '/') {
          current += sql[i + 1]
          i += 2
          break
        }
        i++
      }
      continue
    }
    
    // Handle statement terminator (semicolon)
    if (char === ';') {
      current += char
      const trimmed = current.trim()
      if (trimmed) {
        statements.push(trimmed)
      }
      current = ''
      i++
      continue
    }
    
    // Regular character
    current += char
    i++
  }
  
  // Add any remaining statement
  const trimmed = current.trim()
  if (trimmed) {
    statements.push(trimmed)
  }
  
  return statements
}

describe('SQL Statement Splitter', () => {
  it('should split simple statements', () => {
    const sql = 'SELECT 1; SELECT 2;'
    const statements = splitSQLStatements(sql)
    expect(statements).toHaveLength(2)
    expect(statements[0]).toBe('SELECT 1;')
    expect(statements[1]).toBe('SELECT 2;')
  })

  it('should handle dollar-quoted strings with semicolons', () => {
    const sql = `CREATE FUNCTION test() RETURNS text AS $$ BEGIN RETURN 'hello;world'; END; $$ LANGUAGE plpgsql;`
    const statements = splitSQLStatements(sql)
    expect(statements).toHaveLength(1)
    expect(statements[0]).toContain('hello;world')
  })

  it('should handle tagged dollar quotes', () => {
    const sql = `CREATE FUNCTION test() RETURNS text AS $body$ BEGIN RETURN 'test;'; END; $body$ LANGUAGE plpgsql;`
    const statements = splitSQLStatements(sql)
    expect(statements).toHaveLength(1)
    expect(statements[0]).toContain('test;')
  })

  it('should handle single-quoted strings with semicolons', () => {
    const sql = `INSERT INTO test VALUES ('value;with;semicolons'); SELECT * FROM test;`
    const statements = splitSQLStatements(sql)
    expect(statements).toHaveLength(2)
    expect(statements[0]).toContain('value;with;semicolons')
  })

  it('should handle complex function with multiple semicolons', () => {
    const sql = `
      DROP TYPE IF EXISTS test_type CASCADE;
      CREATE TYPE test_type AS ENUM('A','B');
      CREATE OR REPLACE FUNCTION test_func() RETURNS text AS $$
      DECLARE
        v_text text := '';
      BEGIN
        IF true THEN
          v_text := 'test;value';
        END IF;
        RETURN v_text;
      END;
      $$ LANGUAGE plpgsql;
    `
    const statements = splitSQLStatements(sql)
    expect(statements).toHaveLength(3)
    expect(statements[0]).toContain('DROP TYPE')
    expect(statements[1]).toContain('CREATE TYPE')
    expect(statements[2]).toContain('CREATE OR REPLACE FUNCTION')
    expect(statements[2]).toContain('test;value')
  })
})
