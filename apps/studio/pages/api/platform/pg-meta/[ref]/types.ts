import { NextApiRequest, NextApiResponse } from 'next'

import { fetchGet } from 'data/fetchers'
import { constructHeaders } from 'lib/api/apiHelpers'
import apiWrapper from 'lib/api/apiWrapper'
import { IS_PLATFORM, PG_META_URL } from 'lib/constants'
import { getProjectRefFromRequest, getDatabaseNameForProject } from 'lib/api/self-hosted/project-database'

export default (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: true })

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!IS_PLATFORM) {
    // Self-hosted mode: query database directly
    const projectRef = getProjectRefFromRequest(req)
    
    if (!projectRef) {
      return res.status(400).json({ error: 'Project ref is required' })
    }
    
    try {
      console.log(`[API] Fetching types for project: ${projectRef}`)
      
      const databaseName = await getDatabaseNameForProject(projectRef)
      const { getPool } = await import('lib/api/self-hosted/pg-meta-pool-manager')
      const pool = await getPool({ databaseName, readOnly: false })
      
      // Query custom type list
      const query = `
        SELECT 
          t.oid::int8 as id,
          t.typname as name,
          n.nspname as schema,
          format_type(t.oid, NULL) as format,
          CASE t.typtype
            WHEN 'b' THEN 'BASE'
            WHEN 'c' THEN 'COMPOSITE'
            WHEN 'd' THEN 'DOMAIN'
            WHEN 'e' THEN 'ENUM'
            WHEN 'p' THEN 'PSEUDO'
            WHEN 'r' THEN 'RANGE'
            WHEN 'm' THEN 'MULTIRANGE'
          END as type,
          obj_description(t.oid, 'pg_type') as comment,
          array_to_json(
            CASE 
              WHEN t.typtype = 'e' THEN 
                ARRAY(SELECT enumlabel FROM pg_enum WHERE enumtypid = t.oid ORDER BY enumsortorder)
              ELSE NULL
            END
          ) as enums
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typtype IN ('b', 'c', 'd', 'e', 'r', 'm')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          AND t.typname !~ '^_'
        ORDER BY n.nspname, t.typname
      `
      
      const result = await pool.query(query)
      
      // Ensure enums field is always an array, not null
      const types = result.rows.map((row: any) => ({
        ...row,
        enums: row.enums || []
      }))
      
      console.log(`[API] Found ${types.length} types for project: ${projectRef}`)
      
      return res.status(200).json(types)
    } catch (error: any) {
      console.error('[API] Error fetching types:', error)
      return res.status(500).json({ error: error.message })
    }
  }
  
  // Platform mode
  const headers = constructHeaders(req.headers)
  const response = await fetchGet(`${PG_META_URL}/types`, { headers })

  if (response.error) {
    const { code, message } = response.error
    return res.status(code).json({ message })
  } else {
    return res.status(200).json(response)
  }
}
