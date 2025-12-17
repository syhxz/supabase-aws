import { NextApiRequest, NextApiResponse } from 'next'
import { Pool } from 'pg'

import apiWrapper from 'lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref } = req.query
  
  if (typeof ref !== 'string') {
    return res.status(400).json({ 
      error: { message: 'Project ref is required' } 
    })
  }

  try {
    // Use direct database query
    const pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'postgres',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
    })
    
    const result = await pool.query('SELECT * FROM public.studio_projects WHERE ref = $1', [ref])
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: { message: `Project not found: ${ref}` } 
      })
    }
    
    const project = result.rows[0]

    // Return the project password (stored in database_password_hash field)
    return res.status(200).json({
      password: project.database_password_hash || null
    })
  } catch (error: any) {
    console.error('Error fetching project password:', error)
    return res.status(500).json({ 
      error: { message: error.message || 'Failed to fetch project password' } 
    })
  }
}