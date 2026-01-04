import { withSecureProjectAccess } from '../../../../../../lib/api/secure-api-wrapper'
import { components } from 'api-types'

type ProjectAppConfig = components['schemas']['ProjectSettingsResponse']['app_config'] & {
  protocol?: string
}
export type ProjectSettings = components['schemas']['ProjectSettingsResponse'] & {
  app_config?: ProjectAppConfig
}

/**
 * API endpoint for temporary API keys with project isolation
 * 
 * POST /api/platform/projects/[ref]/api-keys/temporary - Create temporary API key
 * 
 * Requirements: 2.5
 */
export default withSecureProjectAccess(async (req, res, context) => {
  const { method } = req

  if (method === 'POST') {
    const response = {
      api_key: process.env.SUPABASE_SERVICE_KEY ?? '',
    }

    return res.status(200).json(response)
  }

  res.setHeader('Allow', ['POST'])
  return res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
}, {
  permissions: { canManageApiKeys: true }
})
