import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { 
  withDataApiAccessControl, 
  SchemaExtractors 
} from 'lib/api/data-api-access-control'
import { MaxRowsEnforcementService } from 'lib/api/max-rows-enforcement-service'
import { createDataApiConfigDataAccess } from 'lib/api/data-api-config-data-access'

// Query parameters validation schema
const queryParamsSchema = z.object({
  offset: z.coerce.number().min(0).optional().default(0),
  limit: z.coerce.number().min(1).max(1000000).optional(),
  select: z.string().optional(),
  order: z.string().optional(),
  filter: z.string().optional()
})

/**
 * Data API endpoint for querying table rows with max rows enforcement
 * 
 * This endpoint demonstrates:
 * - Max rows enforcement with pagination headers (Requirements 5.2, 5.3)
 * - Proper Content-Range and X-Total-Count headers
 * - Schema access control validation
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
    const table = req.query.table as string
    
    // Validate query parameters
    const validationResult = queryParamsSchema.safeParse(req.query)
    
    if (!validationResult.success) {
      res.status(400).json({ 
        data: null, 
        error: { 
          message: 'Invalid query parameters',
          details: validationResult.error.errors
        } 
      })
      return
    }

    const { offset, limit, select, order, filter } = validationResult.data
    
    // Get current Data API configuration to determine max rows limit
    const dataApiConfigDA = createDataApiConfigDataAccess(context)
    const config = await dataApiConfigDA.getConfiguration()
    
    // Determine effective limit (use configured max rows if no limit specified)
    const effectiveLimit = limit || config.maxRows
    
    // Validate that the requested limit doesn't exceed max rows
    if (effectiveLimit > config.maxRows) {
      res.status(400).json({ 
        data: null, 
        error: { 
          message: `Requested limit (${effectiveLimit}) exceeds maximum allowed rows (${config.maxRows})`,
          maxRows: config.maxRows
        } 
      })
      return
    }

    // Simulate database query (in real implementation, this would query the actual database)
    const mockData = generateMockTableData(table, offset, effectiveLimit + 1) // +1 to detect if there are more rows
    const totalCount = estimateTotalCount(table, filter)
    
    // Apply max rows enforcement with pagination headers
    const limitedData = MaxRowsEnforcementService.applyMaxRowsToResponse(
      res,
      mockData,
      {
        maxRows: effectiveLimit,
        offset,
        totalCount
      }
    )

    const response = {
      schema: schema,
      table: table,
      data: limitedData,
      query: {
        offset,
        limit: effectiveLimit,
        select,
        order,
        filter
      },
      metadata: {
        count: limitedData.length,
        totalEstimate: totalCount,
        hasMore: mockData.length > effectiveLimit,
        maxRowsLimit: config.maxRows
      }
    }

    res.status(200).json({
      data: response,
      error: null
    })

    return response
  } catch (error) {
    console.error('Error querying table rows:', error)
    
    if (error instanceof Error && error.message.includes('Max rows')) {
      res.status(400).json({ 
        data: null, 
        error: { message: error.message } 
      })
    } else {
      res.status(500).json({ 
        data: null, 
        error: { message: 'Failed to query table rows' } 
      })
    }
    
    throw error
  }
}

/**
 * Generate mock table data for testing
 */
function generateMockTableData(table: string, offset: number, limit: number): any[] {
  const data = []
  
  for (let i = 0; i < limit; i++) {
    const id = offset + i + 1
    data.push({
      id: id,
      name: `${table}_record_${id}`,
      created_at: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(), // Random date within last 30 days
      updated_at: new Date().toISOString(),
      data: {
        field1: `value_${id}`,
        field2: Math.floor(Math.random() * 1000),
        field3: Math.random() > 0.5
      }
    })
  }
  
  return data
}

/**
 * Estimate total count for pagination (in real implementation, this would be a COUNT query)
 */
function estimateTotalCount(table: string, filter?: string): number {
  // Mock total counts based on table name
  const baseCounts: Record<string, number> = {
    'users': 1250,
    'posts': 3400,
    'comments': 8900,
    'orders': 2100,
    'products': 450
  }
  
  let baseCount = baseCounts[table] || 1000
  
  // Simulate filter reducing count
  if (filter) {
    baseCount = Math.floor(baseCount * (0.3 + Math.random() * 0.4)) // 30-70% of original
  }
  
  return baseCount
}