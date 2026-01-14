import type { NextApiRequest, NextApiResponse } from 'next'
import { getPool } from 'lib/api/self-hosted/pg-meta-pool-manager'
import { POSTGRES_DATABASE } from 'lib/api/self-hosted/constants'

/**
 * Custom OpenAPI schema generator for self-hosted Supabase
 * 
 * This endpoint generates an OpenAPI 3.0 schema by introspecting the database
 * directly using SQL queries, bypassing PostgREST's db-root-spec feature which
 * has issues in self-hosted environments.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get database connection details from environment
    const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL || 'http://kong:8000'
    
    // Get direct database connection pool
    const pool = await getPool({ databaseName: POSTGRES_DATABASE, readOnly: true })

    // Query database for tables and views using direct SQL
    const tablesResult = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY table_name
    `)

    const tables = tablesResult.rows

    // Query database for columns using direct SQL
    const columnsResult = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `)

    const columns = columnsResult.rows

    // Query database for functions (optional, may fail if no functions exist)
    let functions: any[] = []
    try {
      const functionsResult = await pool.query(`
        SELECT 
          p.proname as function_name,
          pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        ORDER BY p.proname
      `)
      functions = functionsResult.rows
    } catch (error) {
      console.warn('Could not fetch functions:', error)
      // Continue without functions
    }

    // Build OpenAPI schema
    const openApiSchema: any = {
      openapi: '3.0.0',
      info: {
        title: 'Supabase API',
        description: 'Auto-generated OpenAPI schema for Supabase database',
        version: '1.0.0',
      },
      servers: [
        {
          url: supabaseUrl + '/rest/v1',
        },
      ],
      paths: {},
      definitions: {},
      components: {
        schemas: {},
        securitySchemes: {
          apikey: {
            type: 'apiKey',
            in: 'header',
            name: 'apikey',
          },
        },
      },
      security: [
        {
          apikey: [],
        },
      ],
    }

    // Build table definitions
    const tablesByName: Record<string, any> = {}
    tables.forEach((table: any) => {
      const tableName = table.table_name
      const tableColumns = columns.filter((col: any) => col.table_name === tableName)

      const properties: Record<string, any> = {}
      const required: string[] = []

      tableColumns.forEach((col: any) => {
        properties[col.column_name] = {
          type: mapPostgresTypeToOpenAPI(col.data_type),
          description: col.column_default ? `Default: ${col.column_default}` : undefined,
        }

        if (col.is_nullable === 'NO') {
          required.push(col.column_name)
        }
      })

      openApiSchema.definitions[tableName] = {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      }

      openApiSchema.components.schemas[tableName] = {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      }

      // Add paths for table operations
      openApiSchema.paths[`/${tableName}`] = {
        get: {
          summary: `List ${tableName}`,
          tags: [tableName],
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      $ref: `#/components/schemas/${tableName}`,
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: `Create ${tableName}`,
          tags: [tableName],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref: `#/components/schemas/${tableName}`,
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      }

      tablesByName[tableName] = {
        name: tableName,
        fields: tableColumns.map((col: any) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
        })),
      }
    })

    // Return response in the format expected by Studio
    return res.status(200).json({
      data: openApiSchema,
      tables: Object.values(tablesByName),
      functions: functions || [],
    })
  } catch (error) {
    console.error('Error generating OpenAPI schema:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

function mapPostgresTypeToOpenAPI(pgType: string): string {
  const typeMap: Record<string, string> = {
    'integer': 'integer',
    'bigint': 'integer',
    'smallint': 'integer',
    'numeric': 'number',
    'real': 'number',
    'double precision': 'number',
    'text': 'string',
    'character varying': 'string',
    'character': 'string',
    'boolean': 'boolean',
    'date': 'string',
    'timestamp': 'string',
    'timestamp without time zone': 'string',
    'timestamp with time zone': 'string',
    'time': 'string',
    'uuid': 'string',
    'json': 'object',
    'jsonb': 'object',
    'array': 'array',
  }

  return typeMap[pgType.toLowerCase()] || 'string'
}
