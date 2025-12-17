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
      console.log(`[API] Fetching triggers for project: ${projectRef}`)
      
      const databaseName = await getDatabaseNameForProject(projectRef)
      const { getPool } = await import('lib/api/self-hosted/pg-meta-pool-manager')
      const pool = await getPool({ databaseName, readOnly: false })
      
      // Query trigger list
      const query = `
        SELECT 
          t.oid::int8 as id,
          t.tgname as name,
          ns.nspname as schema,
          c.relname as table,
          c.oid::int8 as table_id,
          p.proname as function_name,
          pns.nspname as function_schema,
          CASE 
            WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
            WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
            ELSE 'AFTER'
          END as activation,
          array_to_string(
            ARRAY[
              CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END,
              CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END,
              CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END,
              CASE WHEN t.tgtype & 32 = 32 THEN 'TRUNCATE' END
            ]::text[], 
            ' OR '
          ) as events,
          t.tgenabled::text as enabled_mode,
          pg_get_triggerdef(t.oid) as definition
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace ns ON ns.oid = c.relnamespace
        LEFT JOIN pg_proc p ON p.oid = t.tgfoid
        LEFT JOIN pg_namespace pns ON pns.oid = p.pronamespace
        WHERE NOT t.tgisinternal
          AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY ns.nspname, c.relname, t.tgname
      `
      
      const result = await pool.query(query)
      
      console.log(`[API] Found ${result.rows.length} triggers for project: ${projectRef}`)
      
      return res.status(200).json(result.rows)
    } catch (error: any) {
      console.error('[API] Error fetching triggers:', error)
      return res.status(500).json({ error: error.message })
    }
  }
  
  // Platform mode
  const headers = constructHeaders(req.headers)
  const response = await fetchGet(`${PG_META_URL}/triggers`, { headers })

  if (response.error) {
    const { code, message } = response.error
    return res.status(code).json({ message })
  } else {
    return res.status(200).json(response)
  }
}
