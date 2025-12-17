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
      console.log(`[API] Fetching extensions for project: ${projectRef}`)
      
      const databaseName = await getDatabaseNameForProject(projectRef)
      console.log(`[API] Using database: ${databaseName}`)
      
      const { getPool } = await import('lib/api/self-hosted/pg-meta-pool-manager')
      const pool = await getPool({ databaseName, readOnly: false })
      
      // Query extension list
      const query = `
        SELECT 
          e.oid::int8 as id,
          e.extname as name,
          e.extversion as version,
          n.nspname as schema,
          c.description as comment,
          e.extrelocatable as relocatable
        FROM pg_extension e
        LEFT JOIN pg_namespace n ON n.oid = e.extnamespace
        LEFT JOIN pg_description c ON c.objoid = e.oid AND c.classoid = 'pg_extension'::regclass
        ORDER BY e.extname
      `
      
      const result = await pool.query(query)
      
      console.log(`[API] Found ${result.rows.length} extensions for project: ${projectRef}`)
      
      return res.status(200).json(result.rows)
    } catch (error: any) {
      console.error('[API] Error fetching extensions:', error)
      return res.status(500).json({ error: error.message })
    }
  }
  
  // Platform mode
  const headers = constructHeaders(req.headers)
  const response = await fetchGet(`${PG_META_URL}/extensions`, { headers })

  if (response.error) {
    const { code, message } = response.error
    return res.status(code).json({ message })
  } else {
    return res.status(200).json(response)
  }
}
