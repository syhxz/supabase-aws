import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { 
  withDataApiAccessControl, 
  SchemaExtractors 
} from 'lib/api/data-api-access-control'

// Request validation schema
const bulkQuerySchema = z.object({
  schemas: z.array(z.string()).min(1, 'At least one schema must be specified'),
  query: z.string().min(1, 'Query cannot be empty'),
  limit: z.number().min(1).max(1000).optional().default(100)
})

/**
 * Sample Data API endpoint that demonstrates multi-schema access control
 * 
 * This endpoint allows querying across multiple schemas, but only if:
 * 1. The Data API is enabled for the project
 * 2. ALL requested schemas are in the exposed schemas list
 */
export default withSecureProjectAccess(
  withDataApiAccessControl(
    handler,
    {
      extractSchemaFromRequest: SchemaExtractors.fromBodyArray('schemas'),
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
    case 'POST':
      return handlePost(req, res, context)
    default:
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

const handlePost = async (
  req: NextApiRequest, 
  res: NextApiResponse, 
  context: ProjectIsolationContext
) => {
  try {
    // Validate request body
    const validationResult = bulkQuerySchema.safeParse(req.body)
    
    if (!validationResult.success) {
      res.status(400).json({ 
        data: null, 
        error: { 
          message: 'Invalid request data',
          details: validationResult.error.errors
        } 
      })
      return
    }

    const { schemas, query, limit } = validationResult.data

    // In a real implementation, this would execute the query
    // across the specified schemas with proper security
    const mockResults = schemas.map(schema => ({
      schema: schema,
      results: [
        {
          table: 'sample_table',
          data: [
            { id: 1, name: 'Sample 1', schema: schema },
            { id: 2, name: 'Sample 2', schema: schema }
          ]
        }
      ],
      executionTime: Math.random() * 100 + 10 // Mock execution time
    }))

    const response = {
      query: query,
      schemas: schemas,
      limit: limit,
      results: mockResults,
      totalSchemas: schemas.length,
      executedAt: new Date().toISOString()
    }

    res.status(200).json({
      data: response,
      error: null
    })

    return response
  } catch (error) {
    console.error('Error executing bulk query:', error)
    res.status(500).json({ 
      data: null, 
      error: { message: 'Failed to execute bulk query' } 
    })
    throw error
  }
}