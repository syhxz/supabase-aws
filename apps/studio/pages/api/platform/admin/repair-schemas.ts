import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'
import { SchemaRepairService } from 'lib/project-initialization/SchemaRepairService'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // Get database connection string
    const connectionString = `postgresql://postgres:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/postgres`
    
    console.log('[RepairSchemas] Starting schema repair for all databases...')
    
    // Create repair service
    const repairService = new SchemaRepairService(connectionString)
    
    try {
      // Repair all databases
      const results = await repairService.repairAllDatabases()
      
      // Calculate summary
      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length
      const totalSchemasRepaired = results.reduce((sum, r) => sum + r.schemasRepaired.length, 0)
      
      console.log(`[RepairSchemas] Repair completed: ${successful} successful, ${failed} failed, ${totalSchemasRepaired} schemas repaired`)
      
      return res.status(200).json({
        success: true,
        message: `Schema repair completed: ${successful} databases successful, ${failed} failed`,
        summary: {
          totalDatabases: results.length,
          successful,
          failed,
          totalSchemasRepaired,
        },
        results,
      })
    } finally {
      await repairService.close()
    }
  } catch (error: any) {
    console.error('[RepairSchemas] Error during schema repair:', error)
    return res.status(500).json({
      success: false,
      error: { message: error.message || 'Internal Server Error' },
    })
  }
}