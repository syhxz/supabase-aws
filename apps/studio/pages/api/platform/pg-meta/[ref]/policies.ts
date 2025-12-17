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
    // 自托管模式：直接查询数据库
    const projectRef = getProjectRefFromRequest(req)
    
    if (!projectRef) {
      return res.status(400).json({ error: 'Project ref is required' })
    }
    
    try {
      console.log(`[API] Fetching policies for project: ${projectRef}`)
      
      // 获取查询参数
      const includedSchemas = req.query.included_schemas as string | undefined
      const excludedSchemas = req.query.excluded_schemas as string | undefined
      
      const databaseName = await getDatabaseNameForProject(projectRef)
      console.log(`[API] Using database: ${databaseName}`)
      
      const { getPool } = await import('lib/api/self-hosted/pg-meta-pool-manager')
      const pool = await getPool({ databaseName, readOnly: false })
      
      // 构建 schema 过滤条件
      let schemaFilter = `n.nspname NOT IN ('pg_catalog', 'information_schema')`
      
      // 只有当参数有实际值时才处理
      if (includedSchemas && includedSchemas.trim()) {
        const schemas = includedSchemas.split(',').map(s => `'${s.trim()}'`).join(',')
        schemaFilter = `n.nspname IN (${schemas})`
      } else if (excludedSchemas && excludedSchemas.trim()) {
        const schemas = excludedSchemas.split(',').map(s => `'${s.trim()}'`).join(',')
        schemaFilter = `n.nspname NOT IN ('pg_catalog', 'information_schema', ${schemas})`
      }
      
      // 查询策略列表
      const query = `
        SELECT 
          p.oid::int8 as id,
          p.polname as name,
          n.nspname as schema,
          c.relname as table,
          c.oid::int8 as table_id,
          CASE p.polcmd
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
          END as command,
          CASE p.polpermissive
            WHEN true THEN 'PERMISSIVE'
            WHEN false THEN 'RESTRICTIVE'
          END as permissive,
          pg_get_expr(p.polqual, p.polrelid) as definition,
          pg_get_expr(p.polwithcheck, p.polrelid) as check,
          array_to_json(
            ARRAY(
              SELECT rolname 
              FROM pg_roles 
              WHERE oid = ANY(p.polroles)
            )
          ) as roles
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE ${schemaFilter}
        ORDER BY n.nspname, c.relname, p.polname
      `
      
      const result = await pool.query(query)
      
      console.log(`[API] Found ${result.rows.length} policies for project: ${projectRef}`)
      
      return res.status(200).json(result.rows)
    } catch (error: any) {
      console.error('[API] Error fetching policies:', error)
      return res.status(500).json({ error: error.message })
    }
  }
  
  // 平台模式
  const headers = constructHeaders(req.headers)
  const response = await fetchGet(`${PG_META_URL}/policies`, { headers })

  if (response.error) {
    const { code, message } = response.error
    return res.status(code).json({ message })
  } else {
    return res.status(200).json(response)
  }
}
