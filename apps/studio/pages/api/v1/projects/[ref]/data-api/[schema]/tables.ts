import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { 
  withDataApiAccessControl, 
  SchemaExtractors 
} from 'lib/api/data-api-access-control'

/**
 * Sample Data API endpoint that demonstrates access control
 * 
 * This endpoint lists tables in a specific schema, but only if:
 * 1. The Data API is enabled for the project
 * 2. The requested schema is in the exposed schemas list
 */
export default withSecureProjectAccess(
  withDataApiAccessControl(
    handler,
    {
      extractSchemaFromRequest: SchemaExtractors.fromPathParam('schema'),
      operation: 'read'
    }
  ),
  {
    permissions: { read: true }
  }
)

async function handler(
  req: NextApiRequest, 
  res: NextApiResponse, 
  context: ProjectIsolationContext
) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res, context)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

const handleGet = async (
  req: NextApiRequest, 
  res: NextApiResponse, 
  context: ProjectIsolationContext
) => {
  try {
    const schema = req.query.schema as string

    // In a real implementation, this would query the database
    // to get the actual tables in the schema
    const mockTables = [
      {
        name: 'users',
        schema: schema,
        columns: ['id', 'email', 'created_at'],
        rowCount: 150
      },
      {
        name: 'posts',
        schema: schema,
        columns: ['id', 'title', 'content', 'user_id', 'created_at'],
        rowCount: 45
      }
    ]

    const response = {
      schema: schema,
      tables: mockTables,
      totalTables: mockTables.length
    }

    res.status(200).json({
      data: response,
      error: null
    })

    return response
  } catch (error) {
    console.error('Error fetching tables:', error)
    res.status(500).json({ 
      data: null, 
      error: { message: 'Failed to fetch tables' } 
    })
    throw error
  }
}