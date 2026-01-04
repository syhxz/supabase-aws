import { withSecureProjectAccess } from '../../../../../../../lib/api/secure-api-wrapper'
import { retrieveAnalyticsData } from 'lib/api/self-hosted/logs'
import assert from 'node:assert'

/**
 * API endpoint for analytics endpoints with project isolation
 * 
 * GET /api/platform/projects/[ref]/analytics/endpoints/[name] - Get analytics data
 * POST /api/platform/projects/[ref]/analytics/endpoints/[name] - Query analytics data
 * 
 * Requirements: 2.5
 */
export default withSecureProjectAccess(async (req, res, context) => {
  const { method } = req
  const { projectRef } = context

  if (method === 'GET' || method === 'POST') {
    const { name, ref, ...queryToForward } = req.query
    const params = req.method === 'GET' ? queryToForward : req.body

    assert(typeof name === 'string', 'Invalid or missing name parameter')

    const { data, error } = await retrieveAnalyticsData({
      name,
      params,
      projectRef,
    })

    if (data) {
      return res.status(200).json(data)
    } else {
      return res.status(500).json({ error: { message: error.message } })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
}, {
  permissions: { read: true }
})
