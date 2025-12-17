import { NextApiRequest, NextApiResponse } from 'next'

import { fetchGet } from 'data/fetchers'
import { constructHeaders } from 'lib/api/apiHelpers'
import apiWrapper from 'lib/api/apiWrapper'
import { IS_PLATFORM } from 'lib/constants'
import { getProjectRefFromRequest, getDatabaseNameForProject } from 'lib/api/self-hosted/project-database'
import { getPgMetaRedirectUrl } from './tables'

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
      console.log(`[API] Fetching views for project: ${projectRef}`)
      
      // 获取查询参数
      const includedSchemas = req.query.included_schemas as string | undefined
      const excludedSchemas = req.query.excluded_schemas as string | undefined
      
      const databaseName = await getDatabaseNameForProject(projectRef)
      console.log(`[API] Using database: ${databaseName}`)
      
      const { getPool } = await import('lib/api/self-hosted/pg-meta-pool-manager')
      const pool = await getPool({ databaseName, readOnly: false })
      
      // 构建 schema 过滤条件
      let schemaFilter = `nc.nspname NOT IN ('pg_catalog', 'information_schema')`
      
      // 只有当参数有实际值时才处理
      if (includedSchemas && includedSchemas.trim()) {
        const schemas = includedSchemas.split(',').map(s => `'${s.trim()}'`).join(',')
        schemaFilter = `nc.nspname IN (${schemas})`
      } else if (excludedSchemas && excludedSchemas.trim()) {
        const schemas = excludedSchemas.split(',').map(s => `'${s.trim()}'`).join(',')
        schemaFilter = `nc.nspname NOT IN ('pg_catalog', 'information_schema', ${schemas})`
      }
      
      // 查询视图列表
      const query = `
        SELECT 
          c.oid::int8 as id,
          nc.nspname as schema,
          c.relname as name,
          pg_get_viewdef(c.oid, true) as definition,
          obj_description(c.oid) as comment,
          c.relkind = 'm' as is_materialized
        FROM pg_class c
        JOIN pg_namespace nc ON nc.oid = c.relnamespace
        WHERE c.relkind IN ('v', 'm')
          AND ${schemaFilter}
        ORDER BY nc.nspname, c.relname
      `
      
      const result = await pool.query(query)
      
      console.log(`[API] Found ${result.rows.length} views for project: ${projectRef}`)
      
      return res.status(200).json(result.rows)
    } catch (error: any) {
      console.error('[API] Error fetching views:', error)
      return res.status(500).json({ error: error.message })
    }
  }
  
  // 平台模式
  const headers = constructHeaders(req.headers)
  const response = await fetchGet(getPgMetaRedirectUrl(req, 'views'), { headers })

  if (response.error) {
    const { code, message } = response.error
    return res.status(code).json({ message })
  } else {
    return res.status(200).json(response)
  }
}
