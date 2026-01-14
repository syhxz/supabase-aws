import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { 
  createDataApiConfigDataAccess, 
  DataApiConfigRequest,
  DataApiConfigResponse 
} from 'lib/api/data-api-config-data-access'
import { DataApiAccessControl } from 'lib/api/data-api-access-control'

// Request validation schema
const dataApiConfigUpdateSchema = z.object({
  enableDataApi: z.boolean().optional(),
  exposedSchemas: z.array(z.string()).optional(),
  extraSearchPath: z.array(z.string()).optional(),
  maxRows: z.number().min(1).max(1000000).optional(),
  poolSize: z.number().min(1).max(1000).nullable().optional()
}).refine(
  (data) => {
    // If enableDataApi is true, exposedSchemas must not be empty
    if (data.enableDataApi === true && data.exposedSchemas && data.exposedSchemas.length === 0) {
      return false
    }
    return true
  },
  {
    message: "At least one schema must be exposed when Data API is enabled",
    path: ["exposedSchemas"]
  }
).refine(
  (data) => {
    // Validate that all exposed schemas are allowed
    if (data.exposedSchemas) {
      const disallowedSchemas = data.exposedSchemas.filter(
        schema => !DataApiAccessControl.isSchemaAllowedForExposure(schema)
      )
      if (disallowedSchemas.length > 0) {
        return false
      }
    }
    return true
  },
  {
    message: "Some schemas are not allowed to be exposed (system schemas are restricted)",
    path: ["exposedSchemas"]
  }
)

export default withSecureProjectAccess(handler, {
  permissions: { read: true, write: true }
})

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res, context)
    case 'PUT':
      return handlePut(req, res, context)
    default:
      res.setHeader('Allow', ['GET', 'PUT'])
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
): Promise<DataApiConfigResponse> => {
  try {
    const dataApiConfigDA = createDataApiConfigDataAccess(context)
    const config = await dataApiConfigDA.getConfiguration()
    
    return config
  } catch (error) {
    console.error('Error fetching Data API configuration:', error)
    res.status(500).json({ 
      data: null, 
      error: { message: 'Failed to fetch Data API configuration' } 
    })
    throw error
  }
}

const handlePut = async (
  req: NextApiRequest, 
  res: NextApiResponse, 
  context: ProjectIsolationContext
): Promise<{ success: boolean; config: DataApiConfigResponse; appliedAt: string }> => {
  try {
    // Validate request body
    const validationResult = dataApiConfigUpdateSchema.safeParse(req.body)
    
    if (!validationResult.success) {
      res.status(400).json({ 
        data: null, 
        error: { 
          message: 'Invalid configuration data',
          details: validationResult.error.errors
        } 
      })
      throw new Error('Validation failed')
    }

    const configUpdate: DataApiConfigRequest = validationResult.data
    const dataApiConfigDA = createDataApiConfigDataAccess(context)
    
    const updatedConfig = await dataApiConfigDA.updateConfiguration(configUpdate)
    
    const response = {
      success: true,
      config: updatedConfig,
      appliedAt: new Date().toISOString()
    }
    
    res.status(200)
    return response
  } catch (error) {
    console.error('Error updating Data API configuration:', error)
    
    if (error instanceof Error && error.message.includes('must be between')) {
      res.status(400).json({ 
        data: null, 
        error: { message: error.message } 
      })
    } else if (error instanceof Error && error.message.includes('Invalid')) {
      res.status(400).json({ 
        data: null, 
        error: { message: error.message } 
      })
    } else if (error instanceof Error && error.message.includes('rollback')) {
      res.status(500).json({ 
        data: null, 
        error: { 
          message: 'Configuration update failed and rollback was unsuccessful',
          details: error.message
        } 
      })
    } else if (!res.headersSent) {
      res.status(500).json({ 
        data: null, 
        error: { message: 'Failed to update Data API configuration' } 
      })
    }
    
    throw error
  }
}