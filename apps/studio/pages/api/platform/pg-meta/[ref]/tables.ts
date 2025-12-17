import { NextApiRequest, NextApiResponse } from 'next'

import { fetchGet } from 'data/fetchers'
import { constructHeaders } from 'lib/api/apiHelpers'
import apiWrapper from 'lib/api/apiWrapper'
import { IS_PLATFORM, PG_META_URL } from 'lib/constants'
import { getProjectRefFromRequest, getDatabaseNameForProject } from 'lib/api/self-hosted/project-database'
import { getConnectionString } from 'lib/api/self-hosted/util'

export default (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: true })

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res)
    case 'POST':
      return handleCreate(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ error: { message: `Method ${method} Not Allowed` } })
  }
}

/**
 * Construct the pgMeta redirection url passing along the filtering query params
 * @param req
 * @param endpoint
 */
export function getPgMetaRedirectUrl(req: NextApiRequest, endpoint: string) {
  const query = Object.entries(req.query).reduce((query, entry) => {
    const [key, value] = entry
    if (Array.isArray(value)) {
      for (const v of value) {
        query.append(key, v)
      }
    } else if (value) {
      query.set(key, value)
    }
    return query
  }, new URLSearchParams())

  let url = `${PG_META_URL}/${endpoint}`
  if (Object.keys(req.query).length > 0) {
    url += `?${query}`
  }
  return url
}

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!IS_PLATFORM) {
    // Self-hosted mode: use pg-meta service with project-specific connection string
    const projectRef = getProjectRefFromRequest(req)
    
    if (!projectRef) {
      return res.status(400).json({ error: 'Project ref is required' })
    }
    
    try {
      console.log(`[API] Fetching tables for project: ${projectRef}`)
      
      // Get database name for the project
      const databaseName = await getDatabaseNameForProject(projectRef)
      console.log(`[API] Using database: ${databaseName}`)
      
      // Get connection pool and query database directly
      const { getPool } = await import('lib/api/self-hosted/pg-meta-pool-manager')
      const pool = await getPool({ databaseName, readOnly: false })
      
      // Use a single optimized query leveraging PostgreSQL's JSON aggregation features
      const query = `
        WITH table_info AS (
          SELECT 
            c.oid::int8 as id,
            nc.nspname as schema,
            c.relname as name,
            c.relrowsecurity as rls_enabled,
            c.relforcerowsecurity as rls_forced,
            CASE c.relreplident
              WHEN 'd' THEN 'DEFAULT'
              WHEN 'n' THEN 'NOTHING'
              WHEN 'f' THEN 'FULL'
              WHEN 'i' THEN 'INDEX'
            END as replica_identity,
            pg_total_relation_size(c.oid)::int8 as bytes,
            pg_size_pretty(pg_total_relation_size(c.oid)) as size,
            obj_description(c.oid) as comment
          FROM pg_class c
          JOIN pg_namespace nc ON nc.oid = c.relnamespace
          WHERE c.relkind IN ('r', 'p')
            AND nc.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            AND nc.nspname NOT LIKE 'pg_temp_%'
            AND nc.nspname NOT LIKE 'pg_toast_temp_%'
        ),
        columns_agg AS (
          SELECT 
            a.attrelid::int8 as table_id,
            json_agg(
              json_build_object(
                'id', a.attrelid::text || '.' || a.attname,
                'name', a.attname,
                'format', pg_catalog.format_type(a.atttypid, a.atttypmod),
                'is_nullable', NOT a.attnotnull,
                'is_identity', a.attidentity != '',
                'is_updatable', true,
                'is_unique', false,
                'ordinal_position', a.attnum,
                'default_value', pg_get_expr(ad.adbin, ad.adrelid)
              ) ORDER BY a.attnum
            ) as columns
          FROM pg_attribute a
          LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
          WHERE a.attnum > 0 AND NOT a.attisdropped
          GROUP BY a.attrelid
        ),
        primary_keys_agg AS (
          SELECT 
            i.indrelid::int8 as table_id,
            json_agg(json_build_object('name', a.attname)) as primary_keys
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indisprimary
          GROUP BY i.indrelid
        ),
        relationships_agg AS (
          SELECT 
            c.conrelid::int8 as table_id,
            json_agg(
              json_build_object(
                'id', c.oid::int8,
                'constraint_name', c.conname,
                'source_schema', ns.nspname,
                'source_table_name', cls.relname,
                'source_column_name', a.attname,
                'target_table_schema', nf.nspname,
                'target_table_name', clf.relname,
                'target_column_name', af.attname
              )
            ) as relationships
          FROM pg_constraint c
          JOIN pg_class cls ON c.conrelid = cls.oid
          JOIN pg_namespace ns ON cls.relnamespace = ns.oid
          JOIN pg_class clf ON c.confrelid = clf.oid
          JOIN pg_namespace nf ON clf.relnamespace = nf.oid
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
          JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY(c.confkey)
          WHERE c.contype = 'f'
          GROUP BY c.conrelid
        )
        SELECT 
          t.*,
          COALESCE(c.columns, '[]'::json) as columns,
          COALESCE(pk.primary_keys, '[]'::json) as primary_keys,
          COALESCE(r.relationships, '[]'::json) as relationships
        FROM table_info t
        LEFT JOIN columns_agg c ON t.id = c.table_id
        LEFT JOIN primary_keys_agg pk ON t.id = pk.table_id
        LEFT JOIN relationships_agg r ON t.id = r.table_id
        ORDER BY t.schema, t.name
      `
      
      const result = await pool.query(query)
      
      console.log(`[API] Found ${result.rows.length} tables for project: ${projectRef}`)
      
      return res.status(200).json(result.rows)
    } catch (error: any) {
      console.error('[API] Error fetching tables:', error)
      return res.status(500).json({ error: error.message })
    }
  }
  
  // Platform mode: use original pg-meta service
  const headers = constructHeaders(req.headers)
  const response = await fetchGet(getPgMetaRedirectUrl(req, 'tables'), { headers })

  if (response.error) {
    const { code, message } = response.error
    return res.status(code).json({ message })
  } else {
    return res.status(200).json(response)
  }
}

const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!IS_PLATFORM) {
    // Self-hosted mode: use pg-meta service to create table
    const projectRef = getProjectRefFromRequest(req)
    
    if (!projectRef) {
      return res.status(400).json({ error: 'Project ref is required' })
    }
    
    try {
      console.log(`[API] Creating table for project: ${projectRef}`)
      
      // Get database name for the project
      const databaseName = await getDatabaseNameForProject(projectRef)
      
      // Construct connection string
      const connectionString = getConnectionString({ readOnly: false, databaseName })
      
      // Call pg-meta service
      const response = await fetch(`${PG_META_URL}/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Connection-Encrypted': connectionString,
        },
        body: JSON.stringify(req.body),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        console.error('[API] pg-meta service error:', result)
        return res.status(response.status).json(result)
      }
      
      console.log(`[API] Created table for project: ${projectRef}`)
      
      return res.status(201).json(result)
    } catch (error: any) {
      console.error('[API] Error creating table:', error)
      return res.status(500).json({ error: error.message })
    }
  }
  
  // Platform mode: not supported
  return res.status(501).json({ error: 'Not implemented for platform mode' })
}
